// apps/scheduler/src/index.js
// Main scheduler worker that orchestrates scraping and data storage

import { processScrapedData } from './utils/dataStorage-enhanced.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle manual trigger
    if (url.pathname === '/trigger') {
      ctx.waitUntil(runScheduledScraping(env));
      return new Response('Scraping triggered manually', { status: 200 });
    }
    
    // Handle test endpoint to check shows
    if (url.pathname === '/test') {
      try {
        const shows = await env.DB.prepare(`
          SELECT id, title, url as fringe_url, is_active
          FROM shows 
          ORDER BY id
        `).all();
        
        return new Response(JSON.stringify({
          success: shows.success,
          totalShows: shows.results.length,
          activeShows: shows.results.filter(s => s.is_active).length,
          shows: shows.results
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Scheduler worker is running', { status: 200 });
  },

  // Cron trigger - runs every hour
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledScraping(env));
  }
};

async function runScheduledScraping(env) {
  console.log('Starting scheduled scraping run...');
  
  try {
    // Get all active shows that need scraping
    const shows = await env.DB.prepare(`
      SELECT id, title, url as fringe_url 
      FROM shows 
      WHERE is_active = 1
      ORDER BY id
    `).all();

    if (!shows.success) {
      console.error('Database query failed:', shows.error);
      return;
    }
    
    if (shows.results.length === 0) {
      console.log('No active shows found to scrape');
      return;
    }

    console.log(`Found ${shows.results.length} shows to scrape:`);
    shows.results.forEach((show, index) => {
      console.log(`  ${index + 1}. ${show.title} - ${show.fringe_url}`);
    });
    
    // Process shows in batches to avoid overwhelming the scraper
    const batchSize = 5;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < shows.results.length; i += batchSize) {
      const batch = shows.results.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (show) => {
        try {
          console.log(`Scraping show: ${show.title}`);
          
          // Use service binding to call the scraper worker
          const scraperRequest = new Request(`https://fake-host?url=${encodeURIComponent(show.fringe_url)}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Edinburgh-Fringe-Scheduler/1.0'
            }
          });
          
          const response = await env.SCRAPER.fetch(scraperRequest);
          
          if (!response.ok) {
            throw new Error(`Scraper returned ${response.status}: ${response.statusText}`);
          }
          
          const scrapedData = await response.json();
          
          if (!scrapedData.success) {
            throw new Error(scrapedData.error || 'Scraper returned unsuccessful result');
          }
          
          // Process and store the scraped data
          const result = await processScrapedData(env, {
            showUrl: show.fringe_url,
            showInfo: scrapedData.showInfo || null,
            performances: scrapedData.performances,
            scrapedAt: new Date().toISOString()
          });
          
          console.log(`✅ Successfully processed ${show.title}: ${result.performanceCount} performances`);
          successCount++;
          
          return { success: true, show: show.title, result };
          
        } catch (error) {
          console.error(`❌ Error scraping ${show.title}:`, {
            message: error.message,
            stack: error.stack,
            showUrl: show.fringe_url
          });
          errorCount++;
          
          // Log the error to database
          await logScrapeError(env, show.id, error.message);
          
          return { success: false, show: show.title, error: error.message };
        }
      });
      
      // Wait for batch to complete
      await Promise.allSettled(batchPromises);
      
      // Small delay between batches to be respectful
      if (i + batchSize < shows.results.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`Scraping run completed. Success: ${successCount}, Errors: ${errorCount}`);
    
    // Clean up old data periodically
    if (successCount > 0) {
      await cleanupOldData(env);
    }
    
  } catch (error) {
    console.error('Error in scheduled scraping:', error);
  }
}

async function logScrapeError(env, showId, errorMessage) {
  try {
    await env.DB.prepare(`
      INSERT INTO scrape_logs (show_id, status, error_message, scraped_at)
      VALUES (?, 'error', ?, ?)
    `).bind(showId, errorMessage, new Date().toISOString()).run();
  } catch (error) {
    console.error('Error logging scrape error:', error);
  }
}

async function cleanupOldData(env) {
  try {
    // Clean up old performance data (keep last 7 days)
    await env.DB.prepare(`
      DELETE FROM performances 
      WHERE scraped_at < datetime('now', '-7 days')
    `).run();
    
    // Clean up old scrape logs (keep last 30 days)
    await env.DB.prepare(`
      DELETE FROM scrape_logs 
      WHERE scraped_at < datetime('now', '-30 days')
    `).run();
    
    // Clean up old performance history (keep last 90 days)
    await env.DB.prepare(`
      DELETE FROM performance_history 
      WHERE scraped_at < datetime('now', '-90 days')
    `).run();
    
    console.log('✅ Cleaned up old data');
    
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}