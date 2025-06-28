// Simplified data storage functions that work with the existing database schema
// Compatible with: shows, performances, scrape_logs tables

// Main function to process and store scraped data from the scraper worker
async function processScrapedData(env, scrapedData) {
  const { showUrl, performances, scrapedAt } = scrapedData;
  
  try {
    console.log(`Processing scraped data for URL: ${showUrl}`);
    
    // Find the show by URL
    const show = await env.DB.prepare(`
      SELECT id, title FROM shows WHERE url = ?
    `).bind(showUrl).first();
    
    if (!show) {
      throw new Error(`Show not found for URL: ${showUrl}`);
    }
    
    console.log(`Found show: ${show.title} (ID: ${show.id})`);
    
    // Clear old performance data for this show
    await env.DB.prepare(`
      DELETE FROM performances WHERE show_id = ?
    `).bind(show.id).run();
    
    console.log(`Cleared old performance data for show ${show.id}`);
    
    // Insert new performance data
    let insertedCount = 0;
    for (const performance of performances) {
      try {
        await env.DB.prepare(`
          INSERT INTO performances (
            show_id, 
            performance_id, 
            date_time, 
            sold_out, 
            ticket_status, 
            last_checked
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          show.id,
          performance.id,
          performance.dateTime,
          performance.soldOut ? 1 : 0,
          performance.ticketStatus,
          scrapedAt
        ).run();
        
        insertedCount++;
      } catch (perfError) {
        console.error(`Error inserting performance ${performance.id}:`, perfError);
      }
    }
    
    console.log(`Inserted ${insertedCount} performances for show ${show.id}`);
    
    // Log successful scrape
    await env.DB.prepare(`
      INSERT INTO scrape_logs (
        show_id, 
        status, 
        performances_found, 
        scraped_at
      ) VALUES (?, 'success', ?, ?)
    `).bind(
      show.id,
      insertedCount,
      scrapedAt
    ).run();
    
    console.log(`✅ Successfully processed ${show.title}: ${insertedCount} performances`);
    
    return { 
      success: true, 
      showId: show.id, 
      performanceCount: insertedCount,
      showTitle: show.title
    };
    
  } catch (error) {
    console.error('Error processing scraped data:', error);
    
    // Try to log the error if we can find the show
    try {
      const show = await env.DB.prepare(`
        SELECT id FROM shows WHERE url = ?
      `).bind(showUrl).first();
        
      if (show) {
        await env.DB.prepare(`
          INSERT INTO scrape_logs (
            show_id, 
            status, 
            error_message, 
            scraped_at
          ) VALUES (?, 'error', ?, ?)
        `).bind(show.id, error.message, scrapedAt).run();
      }
    } catch (logError) {
      console.error('Error logging failed scrape:', logError);
    }
    
    throw error;
  }
}

export {
  processScrapedData
};
