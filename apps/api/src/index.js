// Fast API for show lookups - serves cached data from database
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      if (path === '/lookup' && request.method === 'GET') {
        return await handleLookup(request, env);
      }
      
      if (path === '/shows' && request.method === 'GET') {
        return await handleShowsList(request, env);
      }
      
      if (path === '/shows' && request.method === 'POST') {
        return await handleAddShow(request, env);
      }
      
      if (path.startsWith('/shows/') && request.method === 'DELETE') {
        return await handleDeleteShow(request, env);
      }
      
      if (path === '/admin/trigger-scrape' && request.method === 'POST') {
        return await handleTriggerScrape(request, env);
      }
      
      if (path === '/admin/scrape-show' && request.method === 'POST') {
        return await handleScrapeSpecificShow(request, env);
      }
      
      if (path === '/stats' && request.method === 'GET') {
        return await handleStats(request, env);
      }

      if (path === '/logs' && request.method === 'GET') {
        return await handleLogs(request, env);
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// GET /lookup?date=2025-08-01&genre=comedy&venue=monkey
async function handleLookup(request, env) {
  const url = new URL(request.url);
  const selectedDate = url.searchParams.get('date');
  const genre = url.searchParams.get('genre');
  const venue = url.searchParams.get('venue');
  const available_only = url.searchParams.get('available_only') !== 'false';
  
  if (!selectedDate) {
    return new Response(JSON.stringify({ error: 'Date parameter required (YYYY-MM-DD)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Build query with filters
  let query = `
    SELECT 
      s.id,
      s.title,
      s.slug,
      s.venue,
      s.genre,
      s.price_range,
      s.rating,
      p.performance_id,
      p.date_time,
      p.sold_out,
      p.ticket_status,
      p.last_checked
    FROM shows s
    JOIN performances p ON s.id = p.show_id
    WHERE DATE(p.date_time) = DATE(?)
      AND s.is_active = TRUE
  `;
  
  const params = [selectedDate];
  
  if (genre) {
    query += " AND LOWER(s.genre) = LOWER(?)";
    params.push(genre);
  }
  
  if (venue) {
    query += " AND LOWER(s.venue) LIKE LOWER(?)";
    params.push(`%${venue}%`);
  }
  
  if (available_only) {
    query += " AND p.ticket_status = 'TICKETS_AVAILABLE' AND p.sold_out = FALSE";
  }
  
  query += " ORDER BY s.title, p.date_time";
  
  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  // Group performances by show
  const showsMap = new Map();
  
  for (const row of results) {
    if (!showsMap.has(row.id)) {
      showsMap.set(row.id, {
        id: row.id,
        title: row.title,
        slug: row.slug,
        venue: row.venue,
        genre: row.genre,
        priceRange: row.price_range,
        rating: row.rating,
        performances: []
      });
    }
    
    showsMap.get(row.id).performances.push({
      id: row.performance_id,
      dateTime: row.date_time,
      soldOut: row.sold_out === 1,
      ticketStatus: row.ticket_status,
      available: row.ticket_status === 'TICKETS_AVAILABLE' && row.sold_out === 0,
      lastChecked: row.last_checked
    });
  }
  
  const shows = Array.from(showsMap.values());
  
  return new Response(JSON.stringify({
    date: selectedDate,
    filters: { genre, venue, available_only },
    shows,
    totalShows: shows.length,
    totalPerformances: shows.reduce((sum, show) => sum + show.performances.length, 0),
    availablePerformances: shows.reduce((sum, show) => 
      sum + show.performances.filter(p => p.available).length, 0
    ),
    lastUpdated: results[0]?.last_checked
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// GET /shows - List all shows
async function handleShowsList(request, env) {
  const url = new URL(request.url);
  const include_inactive = url.searchParams.get('include_inactive') === 'true';
  
  let query = `
    SELECT 
      s.*,
      COUNT(p.id) as performance_count,
      MAX(p.last_checked) as last_scraped
    FROM shows s
    LEFT JOIN performances p ON s.id = p.show_id
  `;
  
  if (!include_inactive) {
    query += " WHERE s.is_active = TRUE";
  }
  
  query += " GROUP BY s.id ORDER BY s.title";
  
  const { results: shows } = await env.DB.prepare(query).all();
  
  return new Response(JSON.stringify({
    shows: shows.map(show => ({
      ...show,
      is_active: show.is_active === 1,
      performance_count: show.performance_count || 0
    })),
    total: shows.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// POST /shows - Add new show
async function handleAddShow(request, env) {
  const data = await request.json();
  
  const { title, url, venue, genre, price_range, rating, description } = data;
  
  if (!title || !url) {
    return new Response(JSON.stringify({ error: 'Title and URL are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Extract slug from URL
  const slug = url.split('/').pop() || title.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  try {
    const result = await env.DB.prepare(`
      INSERT INTO shows (title, url, slug, venue, genre, price_range, rating, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(title, url, slug, venue || null, genre || null, price_range || null, rating || null, description || null).run();
    
    return new Response(JSON.stringify({
      success: true,
      id: result.meta.last_row_id,
      slug,
      message: 'Show added. Use trigger-scrape to populate performance data.'
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return new Response(JSON.stringify({ error: 'Show with this URL already exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
}

// DELETE /shows/:id - Remove show
async function handleDeleteShow(request, env) {
  const url = new URL(request.url);
  const showId = url.pathname.split('/')[2];
  
  if (!showId || isNaN(showId)) {
    return new Response(JSON.stringify({ error: 'Valid show ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Soft delete by setting is_active = FALSE
  const result = await env.DB.prepare(
    "UPDATE shows SET is_active = FALSE WHERE id = ?"
  ).bind(showId).run();
  
  if (result.changes === 0) {
    return new Response(JSON.stringify({ error: 'Show not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// POST /admin/trigger-scrape - Trigger scheduler to run
async function handleTriggerScrape(request, env) {
  try {
    // Call the scheduler via service binding
    const response = await env.SCHEDULER.fetch('https://scheduler/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FringeAPI/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Scheduler returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Scrape triggered successfully',
      schedulerResponse: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to trigger scrape',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// POST /admin/scrape-show - Scrape specific show
async function handleScrapeSpecificShow(request, env) {
  const data = await request.json();
  const { showId } = data;
  
  if (!showId) {
    return new Response(JSON.stringify({ error: 'showId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get the show details from database
    const { results: shows } = await env.DB.prepare(
      "SELECT * FROM shows WHERE id = ? AND is_active = TRUE"
    ).bind(showId).all();
    
    if (shows.length === 0) {
      return new Response(JSON.stringify({ error: 'Show not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const show = shows[0];
    
    // Call the scraper via service binding
    const response = await env.SCRAPER.fetch(`https://scraper/?url=${encodeURIComponent(show.url)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'FringeAPI/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Scraper returned ${response.status}: ${response.statusText}`);
    }
    
    const scraperData = await response.json();
    
    if (!scraperData.success || !scraperData.performances || scraperData.performances.length === 0) {
      throw new Error(scraperData.error || 'No performances found');
    }
    
    // Clear old performance data for this show
    await env.DB.prepare(
      "DELETE FROM performances WHERE show_id = ?"
    ).bind(showId).run();
    
    // Insert new performance data
    const stmt = env.DB.prepare(`
      INSERT INTO performances (show_id, performance_id, date_time, sold_out, ticket_status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    for (const perf of scraperData.performances) {
      await stmt.bind(
        showId,
        perf.id,
        perf.dateTime,
        perf.soldOut ? 1 : 0,
        perf.ticketStatus
      ).run();
    }
    
    // Log success
    await env.DB.prepare(`
      INSERT INTO scrape_logs (show_id, status, performances_found)
      VALUES (?, 'success', ?)
    `).bind(showId, scraperData.performances.length).run();
    
    return new Response(JSON.stringify({
      success: true,
      showId,
      showTitle: show.title,
      performancesAdded: scraperData.performances.length,
      performances: scraperData.performances
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Log error
    if (showId) {
      await env.DB.prepare(`
        INSERT INTO scrape_logs (show_id, status, error_message)
        VALUES (?, 'error', ?)
      `).bind(showId, error.message).run();
    }
    
    return new Response(JSON.stringify({ 
      error: 'Failed to scrape show',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// GET /stats - System statistics
async function handleStats(request, env) {
  const { results: stats } = await env.DB.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM shows WHERE is_active = TRUE) as active_shows,
      (SELECT COUNT(*) FROM shows WHERE is_active = FALSE) as inactive_shows,
      (SELECT COUNT(*) FROM performances) as total_performances,
      (SELECT COUNT(*) FROM performances WHERE ticket_status = 'TICKETS_AVAILABLE' AND sold_out = FALSE) as available_performances,
      (SELECT COUNT(*) FROM scrape_logs WHERE status = 'success' AND scraped_at > datetime('now', '-24 hours')) as successful_scrapes_24h,
      (SELECT COUNT(*) FROM scrape_logs WHERE status = 'error' AND scraped_at > datetime('now', '-24 hours')) as failed_scrapes_24h,
      (SELECT MAX(scraped_at) FROM scrape_logs) as last_scrape
  `).all();
  
  return new Response(JSON.stringify({
    stats: stats[0],
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// GET /logs - Recent scrape logs
async function handleLogs(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  
  const { results: logs } = await env.DB.prepare(`
    SELECT 
      sl.*,
      s.title as show_title,
      s.slug as show_slug
    FROM scrape_logs sl
    JOIN shows s ON s.id = sl.show_id
    ORDER BY sl.scraped_at DESC
    LIMIT ?
  `).bind(limit).all();
  
  return new Response(JSON.stringify({
    logs: logs.map(log => ({
      ...log,
      scraped_at: log.scraped_at
    })),
    total: logs.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
