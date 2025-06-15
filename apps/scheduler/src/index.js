// Scheduled worker that runs every hour to scrape all active shows
export default {
  async scheduled(event, env, ctx) {
    console.log('=== STARTING SCHEDULED SCRAPE ===');
    const startTime = Date.now();
    
    try {
      // Get all active shows from database
      const { results: shows } = await env.DB.prepare(
        `SELECT id, title, url, slug FROM shows 
         WHERE is_active = TRUE 
         ORDER BY title`
      ).all();
      
      console.log(`Found ${shows.length} active shows to scrape`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const show of shows) {
        const showStartTime = Date.now();
        
        try {
          console.log(`Scraping: ${show.title}`);
          
          // Call the scraper worker via service binding
          const response = await env.SCRAPER.fetch(`https://scraper/?url=${encodeURIComponent(show.url)}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'FringeScheduler/1.0'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Scraper returned ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.success && data.performances && data.performances.length > 0) {
            // Clear old performance data for this show
            await env.DB.prepare(
              "DELETE FROM performances WHERE show_id = ?"
            ).bind(show.id).run();
            
            // Insert new performance data
            const stmt = env.DB.prepare(`
              INSERT INTO performances (show_id, performance_id, date_time, sold_out, ticket_status)
              VALUES (?, ?, ?, ?, ?)
            `);
            
            for (const perf of data.performances) {
              await stmt.bind(
                show.id,
                perf.id,
                perf.dateTime,
                perf.soldOut ? 1 : 0,
                perf.ticketStatus
              ).run();
            }
            
            // Log success
            await env.DB.prepare(`
              INSERT INTO scrape_logs (show_id, status, performances_found, duration_ms)
              VALUES (?, 'success', ?, ?)
            `).bind(show.id, data.performances.length, Date.now() - showStartTime).run();
            
            console.log(`✓ ${show.title}: ${data.performances.length} performances`);
            successCount++;
            
          } else {
            throw new Error(data.error || 'No performances found');
          }
          
        } catch (error) {
          console.error(`✗ Failed to scrape ${show.title}:`, error.message);
          
          // Log error
          await env.DB.prepare(`
            INSERT INTO scrape_logs (show_id, status, error_message, duration_ms)
            VALUES (?, 'error', ?, ?)
          `).bind(show.id, error.message, Date.now() - showStartTime).run();
          
          errorCount++;
        }
        
        // Rate limiting - be respectful to the site
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`=== SCRAPE COMPLETE ===`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);
      console.log(`Total duration: ${Math.round(totalDuration / 1000)}s`);
      
    } catch (error) {
      console.error('Scheduled scrape failed:', error);
    }
  },

  // Handle HTTP requests (for manual triggers)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/trigger' && request.method === 'POST') {
      // Manual trigger for testing
      console.log('Manual scrape trigger received');
      
      // Use waitUntil to run the scrape in the background
      ctx.waitUntil(this.scheduled(null, env, ctx));
      
      return new Response(JSON.stringify({
        message: 'Scrape triggered manually',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/status') {
      // Get recent scrape status
      const { results: recentLogs } = await env.DB.prepare(`
        SELECT 
          s.title,
          sl.status,
          sl.performances_found,
          sl.error_message,
          sl.duration_ms,
          sl.scraped_at
        FROM scrape_logs sl
        JOIN shows s ON s.id = sl.show_id
        ORDER BY sl.scraped_at DESC
        LIMIT 20
      `).all();
      
      return new Response(JSON.stringify({
        recentLogs,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/test-scraper' && request.method === 'GET') {
      // Test if we can call the scraper directly
      try {
        const testUrl = 'https://www.edfringe.com/tickets/whats-on/david-o-doherty-highway-to-the-david-zone';
        
        console.log(`Testing scraper call via service binding`);
        
        const response = await env.SCRAPER.fetch(`https://scraper/?url=${encodeURIComponent(testUrl)}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'FringeScheduler/1.0'
          }
        });
        
        const responseText = await response.text();
        
        return new Response(JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          testUrl,
          response: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '')
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Fringe Scheduler - Use POST /trigger to run manually or GET /status for logs', {
      status: 404
    });
  }
};
