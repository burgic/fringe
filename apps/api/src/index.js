// API Worker - src/index.js
// Updated to work with existing database schema
import { handleAutoAddShow } from './handlers/auto-add-show.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response;

      switch (pathname) {
        case '/shows':
          response = await handleGetShows(request, env);
          break;
        case '/shows/auto-add':
          if (request.method === 'POST') {
            response = await handleAutoAddShow(request, env);
          } else {
            response = new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
          }
          break;
        case '/shows/lookup':
        case '/lookup':
          response = await handleLookup(request, env);
          break;
        case '/admin/shows':
          response = await handleAdminShows(request, env);
          break;
        case '/stats':
          response = await handleStats(request, env);
          break;
        case '/health':
          response = new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
          break;
        default:
          response = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }

      // Add CORS headers to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      response.headers.set('Content-Type', 'application/json');

      return response;

    } catch (error) {
      console.error('API Error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error', 
          details: error.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  }
};

// GET /shows - Return all shows with their latest performance data
async function handleGetShows(request, env) {
  try {
    // Get all shows (using enhanced column names)
    const showsQuery = `
      SELECT 
        s.id,
        s.title,
        COALESCE(s.fringe_url, s.url) as url,
        s.venue,
        s.venue_code,
        s.genre,
        s.price_range as priceRange,
        s.rating,
        s.description,
        s.review_category as reviewCategory,
        s.review_notes as reviewNotes,
        s.run_time as runTime,
        s.image_url as imageUrl,
        s.created_at as createdAt,
        s.updated_at as updatedAt
      FROM shows s 
      WHERE COALESCE(s.active, s.is_active) = 1
      ORDER BY s.title
    `;

    const showsResult = await env.DB.prepare(showsQuery).all();
    
    if (!showsResult.success) {
      throw new Error('Failed to fetch shows from database');
    }

    // Get performances for these shows (enhanced query)
    const performancesQuery = `
      SELECT 
        p.show_id,
        p.performance_id,
        p.title as performanceTitle,
        p.date_time as dateTime,
        p.duration,
        p.sold_out as soldOut,
        p.cancelled,
        COALESCE(p.tickets_available, CASE WHEN p.sold_out = 0 THEN 1 ELSE 0 END) as ticketsAvailable,
        p.ticket_status as ticketStatus,
        p.ticket_status_label as ticketStatusLabel,
        p.status,
        p.accessibility,
        p.venue_name,
        p.space_name,
        p.price,
        p.notes,
        p.accessibility_notes,
        COALESCE(p.available, CASE WHEN p.sold_out = 0 AND COALESCE(p.cancelled, 0) = 0 THEN 1 ELSE 0 END) as available,
        COALESCE(p.scraped_at, p.last_checked) as scrapedAt
      FROM performances p
      WHERE p.date_time >= datetime('now', '-1 day')
      ORDER BY p.date_time
    `;

    const performancesResult = await env.DB.prepare(performancesQuery).all();
    
    if (!performancesResult.success) {
      throw new Error('Failed to fetch performances from database');
    }

    // Group performances by show
    const performancesByShow = {};
    performancesResult.results.forEach(perf => {
      if (!performancesByShow[perf.show_id]) {
        performancesByShow[perf.show_id] = [];
      }
      
      // Parse accessibility JSON if it exists
      let accessibility = [];
      try {
        if (perf.accessibility) {
          accessibility = JSON.parse(perf.accessibility);
        }
      } catch (e) {
        console.error('Error parsing accessibility JSON:', e);
      }
      
      performancesByShow[perf.show_id].push({
        ...perf,
        accessibility,
        available: perf.ticketsAvailable && !perf.soldOut && !perf.cancelled,
        ticketStatusLabel: perf.ticket_status || 'Available'
      });
    });

    // Combine shows with their performances
    const shows = showsResult.results.map(show => ({
      ...show,
      performances: performancesByShow[show.id] || []
    }));

    return new Response(JSON.stringify({
      success: true,
      shows,
      count: shows.length,
      lastUpdated: new Date().toISOString(),
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error in handleGetShows:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch shows', 
        details: error.message 
      }), 
      { status: 500 }
    );
  }
}

// GET /lookup - Filter shows by date and other criteria
async function handleLookup(request, env) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const date = searchParams.get('date');
    const genre = searchParams.get('genre');
    const venue = searchParams.get('venue');
    const availableOnly = searchParams.get('available_only') !== 'false';

    if (!date) {
      return new Response(
        JSON.stringify({ error: 'Date parameter is required' }), 
        { status: 400 }
      );
    }

    // Build the query with filters (simplified)
    let showsQuery = `
      SELECT DISTINCT
        s.id,
        s.title,
        s.venue,
        s.genre,
        s.price_range as priceRange,
        s.rating,
        s.description
      FROM shows s
      INNER JOIN performances p ON s.id = p.show_id
      WHERE COALESCE(s.active, s.is_active) = 1
        AND date(p.date_time) = date(?)
    `;

    const params = [date];

    if (genre) {
      showsQuery += ` AND LOWER(s.genre) = LOWER(?)`;
      params.push(genre);
    }

    if (venue) {
      showsQuery += ` AND LOWER(s.venue) LIKE LOWER(?)`;
      params.push(`%${venue}%`);
    }

    if (availableOnly) {
      showsQuery += ` AND p.sold_out = 0 AND COALESCE(p.cancelled, 0) = 0 AND p.ticket_status IN ('TICKETS_AVAILABLE', 'TWO_FOR_ONE', 'FREE_TICKETED')`;
    }

    showsQuery += ` ORDER BY s.title`;

    const showsResult = await env.DB.prepare(showsQuery).bind(...params).all();
    
    if (!showsResult.success) {
      throw new Error('Failed to fetch shows from database');
    }

    // Get performances for the filtered shows on the specified date
    const showIds = showsResult.results.map(show => show.id);
    
    if (showIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        shows: [],
        totalShows: 0,
        totalPerformances: 0,
        availablePerformances: 0,
        date,
        lastUpdated: null
      }));
    }

    const placeholders = showIds.map(() => '?').join(',');
    const performancesQuery = `
      SELECT 
        p.show_id,
        p.performance_id,
        p.date_time as dateTime,
        p.sold_out as soldOut,
        p.cancelled,
        p.tickets_available as ticketsAvailable,
        p.ticket_status as ticketStatus,
        p.status,
        p.accessibility,
        p.venue_name,
        p.space_name,
        p.last_checked as scrapedAt
      FROM performances p
      WHERE p.show_id IN (${placeholders})
        AND date(p.date_time) = date(?)
      ORDER BY p.date_time
    `;

    const performancesResult = await env.DB.prepare(performancesQuery)
      .bind(...showIds, date)
      .all();

    if (!performancesResult.success) {
      throw new Error('Failed to fetch performances from database');
    }

    // Group performances by show
    const performancesByShow = {};
    performancesResult.results.forEach(perf => {
      if (!performancesByShow[perf.show_id]) {
        performancesByShow[perf.show_id] = [];
      }
      
      // Parse accessibility JSON if it exists
      let accessibility = [];
      try {
        if (perf.accessibility) {
          accessibility = JSON.parse(perf.accessibility);
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      performancesByShow[perf.show_id].push({
        ...perf,
        accessibility,
        available: perf.ticketsAvailable && !perf.soldOut && !perf.cancelled,
        ticketStatusLabel: perf.ticket_status || 'Available'
      });
    });

    // Filter shows that have performances and combine with performance data
    const shows = showsResult.results
      .filter(show => performancesByShow[show.id])
      .map(show => ({
        ...show,
        performances: performancesByShow[show.id] || []
      }));

    // Calculate statistics
    const totalPerformances = shows.reduce((sum, show) => sum + show.performances.length, 0);
    const availablePerformances = shows.reduce((sum, show) => {
      return sum + show.performances.filter(p => p.available).length;
    }, 0);

    return new Response(JSON.stringify({
      success: true,
      shows,
      totalShows: shows.length,
      totalPerformances,
      availablePerformances,
      date,
      lastUpdated: new Date().toISOString(),
      filters: {
        genre,
        venue,
        availableOnly
      }
    }));

  } catch (error) {
    console.error('Error in handleLookup:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to lookup shows', 
        details: error.message 
      }), 
      { status: 500 }
    );
  }
}

// POST /admin/shows - Add a new show (simplified)
async function handleAdminShows(request, env) {
  try {
    if (request.method === 'GET') {
      // Return admin view of shows
      const query = `
        SELECT 
          s.*,
          COUNT(p.id) as performance_count
        FROM shows s
        LEFT JOIN performances p ON s.id = p.show_id 
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `;

      const result = await env.DB.prepare(query).all();
      
      if (!result.success) {
        throw new Error('Failed to fetch admin shows data');
      }

      return new Response(JSON.stringify({
        success: true,
        shows: result.results
      }));
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405 }
    );

  } catch (error) {
    console.error('Error in handleAdminShows:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to handle admin shows request', 
        details: error.message 
      }), 
      { status: 500 }
    );
  }
}

// GET /stats - Return system statistics (simplified)
async function handleStats(request, env) {
  try {
    const queries = {
      activeShows: `SELECT COUNT(*) as count FROM shows WHERE is_active = 1`,
      totalPerformances: `SELECT COUNT(*) as count FROM performances WHERE date_time >= datetime('now')`,
      availablePerformances: `SELECT COUNT(*) as count FROM performances WHERE date_time >= datetime('now') AND tickets_available = 1 AND sold_out = 0 AND cancelled = 0`,
      totalShows: `SELECT COUNT(*) as count FROM shows`
    };

    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await env.DB.prepare(query).first();
        results[key] = result?.count || 0;
      } catch (e) {
        console.error(`Error in query ${key}:`, e);
        results[key] = 0;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        active_shows: results.activeShows,
        total_performances: results.totalPerformances,
        available_performances: results.availablePerformances,
        total_shows: results.totalShows,
        successful_scrapes_24h: 0,
        failed_scrapes_24h: 0,
        last_scrape: null
      },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error in handleStats:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch statistics', 
        details: error.message 
      }), 
      { status: 500 }
    );
  }
}
