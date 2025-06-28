// Enhanced API endpoint for auto-populating show data from URL
// Add this to your API worker's index.js

// POST /shows/auto-add - Add show by URL and auto-populate details
async function handleAutoAddShow(request, env) {
  try {
    const body = await request.json();
    const { url, review_category } = body;
    
    if (!url || !url.startsWith('https://www.edfringe.com/tickets/whats-on/')) {
      return new Response(JSON.stringify({ 
        error: 'Valid Edinburgh Fringe URL required' 
      }), { status: 400 });
    }

    // Validate review_category if provided
    const validCategories = ['Great', 'Good', 'Ok', 'Wild Cards'];
    if (review_category && !validCategories.includes(review_category)) {
      return new Response(JSON.stringify({ 
        error: `Invalid review_category. Must be one of: ${validCategories.join(', ')}` 
      }), { status: 400 });
    }

    console.log(`Auto-adding show from URL: ${url}${review_category ? ` with review category: ${review_category}` : ''}`);
    
    // Step 1: Scrape the show data using the scraper worker
    console.log('Calling scraper worker...');
    const scraperRequest = new Request(`https://fake-host?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Edinburgh-Fringe-API/1.0'
      }
    });
    
    // Use service binding if available, otherwise HTTP call
    let scraperResponse;
    if (env.SCRAPER) {
      scraperResponse = await env.SCRAPER.fetch(scraperRequest);
    } else {
      // Fallback to HTTP call if service binding not available
      scraperResponse = await fetch(`https://fringe-scraper.hraasing.workers.dev?url=${encodeURIComponent(url)}`);
    }
    
    if (!scraperResponse.ok) {
      throw new Error(`Scraper failed: ${scraperResponse.status} ${scraperResponse.statusText}`);
    }
    
    const scrapedData = await scraperResponse.json();
    
    if (!scrapedData.success) {
      throw new Error(scrapedData.error || 'Scraping failed');
    }
    
    console.log(`Scraped ${scrapedData.performances?.length || 0} performances`);
    
    // Step 2: Extract show information from scraped data (title from scraping, review category from user)
    const showInfo = extractShowInfo(scrapedData, url, null, review_category);
    console.log('Extracted show info:', showInfo);
    
    // Step 3: Store the show and all its data
    const result = await storeCompleteShowData(env, showInfo, scrapedData.performances || [], url);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Show "${showInfo.title}" added successfully`,
      show: result.show,
      performances: result.performanceCount,
      venue: result.venue,
      accessibility: result.accessibility,
      scrapedAt: new Date().toISOString()
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in auto-add show:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to auto-add show',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Extract show information from scraped data
function extractShowInfo(scrapedData, url, userTitle, userReviewCategory) {
  const performances = scrapedData.performances || [];
  
  // Extract basic show info - prioritize scraped title over user title
  const showInfo = {
    title: scrapedData.showInfo?.title || userTitle || extractTitleFromUrl(url),
    url: url,
    slug: url.split('/').pop(),
  };
  
  // Use user-provided review category if available
  if (userReviewCategory) {
    showInfo.review_category = userReviewCategory;
  }
  
  // Extract venue info from performances (take first non-null venue)
  const venuePerf = performances.find(p => p.venue);
  if (venuePerf?.venue) {
    showInfo.venue = venuePerf.venue.title;
    showInfo.venue_code = venuePerf.venue.venueCode;
    showInfo.venueDetails = venuePerf.venue;
  }
  
  // Extract genre/category
  if (scrapedData.showInfo?.genre) {
    showInfo.genre = scrapedData.showInfo.genre;
  }
  
  // Extract pricing from performances
  const prices = performances
    .map(p => p.price)
    .filter(p => p && p !== 'Free')
    .map(p => parseFloat(p.replace(/[£$]/g, '')))
    .filter(p => !isNaN(p));
    
  if (prices.length > 0) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    showInfo.price_range = minPrice === maxPrice ? `£${minPrice}` : `£${minPrice}-${maxPrice}`;
  }
  
  // Extract duration
  const durations = performances
    .map(p => p.duration)
    .filter(d => d && d > 0);
  if (durations.length > 0) {
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    showInfo.duration_minutes = avgDuration;
    showInfo.run_time = `${avgDuration} mins`;
  }
  
  // Extract other info from scraped data
  if (scrapedData.showInfo) {
    Object.assign(showInfo, {
      description: scrapedData.showInfo.description,
      rating: scrapedData.showInfo.rating, // This is age rating (15+, U, etc.)
      image_url: scrapedData.showInfo.image
    });
  }
  
  return showInfo;
}

// Store complete show data including venue and accessibility info
async function storeCompleteShowData(env, showInfo, performances, url) {
  try {
    // Start transaction
    console.log('Starting database transaction...');
    
    // Step 1: Store venue data if present
    let venueId = null;
    let venueInfo = null;
    if (showInfo.venueDetails) {
      venueId = await storeVenueData(env, showInfo.venueDetails);
      venueInfo = {
        id: venueId,
        title: showInfo.venueDetails.title,
        code: showInfo.venueDetails.venueCode,
        address: showInfo.venueDetails.address1,
        accessibility: extractVenueAccessibility(showInfo.venueDetails)
      };
      console.log(`Stored venue: ${showInfo.venueDetails.title} (ID: ${venueId})`);
    }
    
    // Step 2: Store or update show
    const existingShow = await env.DB.prepare(
      'SELECT id FROM shows WHERE url = ? OR fringe_url = ?'
    ).bind(url, url).first();
    
    let showId;
    if (existingShow) {
      // Update existing show
      await env.DB.prepare(`
        UPDATE shows SET
          title = ?,
          venue = ?,
          venue_id = ?,
          venue_code = ?,
          genre = ?,
          description = ?,
          price_range = ?,
          rating = ?,
          duration_minutes = ?,
          run_time = ?,
          image_url = ?,
          review_category = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        showInfo.title || null,
        showInfo.venue || null,
        venueId || null,
        showInfo.venue_code || null,
        showInfo.genre || null,
        showInfo.description || null,
        showInfo.price_range || null,
        showInfo.rating || null,
        showInfo.duration_minutes || null,
        showInfo.run_time || null,
        showInfo.image_url || null,
        showInfo.review_category || null,
        existingShow.id
      ).run();
      
      showId = existingShow.id;
      console.log(`Updated existing show ID: ${showId}`);
    } else {
      // Insert new show
      const result = await env.DB.prepare(`
        INSERT INTO shows (
          title, url, fringe_url, slug, venue, venue_id, venue_code,
          genre, description, price_range, rating, duration_minutes,
          run_time, image_url, review_category, is_active, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
      `).bind(
        showInfo.title || null,
        url,
        url,
        showInfo.slug || null,
        showInfo.venue || null,
        venueId || null,
        showInfo.venue_code || null,
        showInfo.genre || null,
        showInfo.description || null,
        showInfo.price_range || null,
        showInfo.rating || null,
        showInfo.duration_minutes || null,
        showInfo.run_time || null,
        showInfo.image_url || null,
        showInfo.review_category || null
      ).run();
      
      showId = result.meta.last_row_id;
      console.log(`Created new show ID: ${showId}`);
    }
    
    // Step 3: Store performances with enhanced data
    let performanceCount = 0;
    const scrapedAt = new Date().toISOString();
    
    // Clear old performances
    await env.DB.prepare('DELETE FROM performances WHERE show_id = ?').bind(showId).run();
    
    for (const perf of performances) {
      try {
        // Store space data if present
        let spaceId = null;
        if (perf.space && venueId) {
          spaceId = await storeSpaceData(env, perf.space, venueId);
        }
        
        await env.DB.prepare(`
          INSERT INTO performances (
            show_id, venue_id, space_id, performance_id, title,
            date_time, duration, sold_out, cancelled, tickets_available,
            ticket_status, status, price, price_details, accessibility, venue_name,
            space_name, scraped_at, last_checked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          showId,
          venueId || null,
          spaceId || null,
          perf.id,
          perf.title || null,
          perf.dateTime,
          perf.duration || null,
          perf.soldOut ? 1 : 0,
          perf.cancelled ? 1 : 0,
          perf.ticketsAvailable ? 1 : 0,
          perf.ticketStatus || 'UNKNOWN',
          perf.status || null,
          perf.price || null,
          perf.priceDetails ? JSON.stringify(perf.priceDetails) : null,
          perf.accessibility ? JSON.stringify(perf.accessibility) : null,
          perf.venue?.title || null,
          perf.space?.title || null,
          scrapedAt,
          scrapedAt
        ).run();
        
        performanceCount++;
      } catch (perfError) {
        console.error(`Error storing performance ${perf.id}:`, perfError);
      }
    }
    
    // Step 4: Extract accessibility summary
    const accessibility = extractAccessibilitySummary(performances);
    
    // Step 5: Log the successful addition
    await env.DB.prepare(`
      INSERT INTO scrape_logs (
        show_id, status, performances_found, scraped_at
      ) VALUES (?, 'success', ?, ?)
    `).bind(showId, performanceCount, scrapedAt).run();
    
    console.log(`Successfully stored show with ${performanceCount} performances`);
    
    return {
      show: {
        id: showId,
        title: showInfo.title,
        venue: showInfo.venue,
        genre: showInfo.genre,
        priceRange: showInfo.price_range,
        rating: showInfo.rating,
        runTime: showInfo.run_time
      },
      venue: venueInfo,
      performanceCount,
      accessibility
    };
    
  } catch (error) {
    console.error('Error storing complete show data:', error);
    throw error;
  }
}

// Helper functions
function extractTitleFromUrl(url) {
  return url.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function extractVenueAccessibility(venueDetails) {
  const accessibility = [];
  
  if (venueDetails.attributes) {
    venueDetails.attributes.forEach(attr => {
      if (attr.attributeTypes === 'accessibility') {
        accessibility.push({
          type: 'venue',
          feature: attr.key,
          value: attr.value
        });
      }
    });
  }
  
  return accessibility;
}

function extractAccessibilitySummary(performances) {
  const allFeatures = performances.flatMap(p => p.accessibility || []);
  const uniqueFeatures = [...new Set(allFeatures)];
  
  return {
    features: uniqueFeatures,
    hasWheelchairAccess: uniqueFeatures.some(f => f.includes('WHEELCHAIR')),
    hasAccessibleToilets: uniqueFeatures.some(f => f.includes('WHEELCHAIR_ACCESSIBLE_TOILETS')),
    hasAudioDescription: uniqueFeatures.some(f => f.includes('AUDIO_DESCRIPTION')),
    hasCaptioning: uniqueFeatures.some(f => f.includes('CAPTIONING'))
  };
}

// Venue and space storage functions (simplified versions)
async function storeVenueData(env, venueData) {
  if (!venueData || !venueData.id) return null;
  
  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM venues WHERE fringe_venue_id = ?'
    ).bind(venueData.id).first();
    
    if (existing) return existing.id;
    
    const result = await env.DB.prepare(`
      INSERT INTO venues (
        fringe_venue_id, title, venue_code, address1, address2, 
        post_code, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      venueData.id,
      venueData.title,
      venueData.venueCode,
      venueData.address1,
      venueData.address2,
      venueData.postCode,
      venueData.attributes ? JSON.stringify(venueData.attributes) : null
    ).run();
    
    return result.meta.last_row_id;
  } catch (error) {
    console.error('Error storing venue:', error);
    return null;
  }
}

async function storeSpaceData(env, spaceData, venueId) {
  if (!spaceData || !spaceData.id) return null;
  
  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM spaces WHERE fringe_space_id = ?'
    ).bind(spaceData.id).first();
    
    if (existing) return existing.id;
    
    const result = await env.DB.prepare(`
      INSERT INTO spaces (
        fringe_space_id, venue_id, title, venue_name, venue_code,
        accessibility_notes, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      spaceData.id,
      venueId,
      spaceData.title,
      spaceData.venueName,
      spaceData.venueCode,
      spaceData.accessibilityNotes,
      spaceData.attributes ? JSON.stringify(spaceData.attributes) : null
    ).run();
    
    return result.meta.last_row_id;
  } catch (error) {
    console.error('Error storing space:', error);
    return null;
  }
}

export { handleAutoAddShow };
