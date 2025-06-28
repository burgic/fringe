// Enhanced data storage functions for the scheduler worker
// These functions handle storing the rich venue and accessibility data

// Store or update venue information
async function storeVenueData(env, venueData) {
  if (!venueData || !venueData.id) return null;

  try {
    // Check if venue already exists
    const existingVenue = await env.DB.prepare(
      'SELECT id FROM venues WHERE fringe_venue_id = ?'
    ).bind(venueData.id).first();

    if (existingVenue) {
      // Update existing venue
      await env.DB.prepare(`
        UPDATE venues SET
          title = ?,
          description = ?,
          venue_code = ?,
          address1 = ?,
          address2 = ?,
          post_code = ?,
          geo_location = ?,
          slug = ?,
          images = ?,
          attributes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE fringe_venue_id = ?
      `).bind(
        venueData.title,
        venueData.description,
        venueData.venueCode,
        venueData.address1,
        venueData.address2,
        venueData.postCode,
        venueData.geoLocation,
        venueData.slug,
        JSON.stringify(venueData.images || []),
        JSON.stringify(venueData.attributes || []),
        venueData.id
      ).run();
      
      return existingVenue.id;
    } else {
      // Insert new venue
      const result = await env.DB.prepare(`
        INSERT INTO venues (
          fringe_venue_id, title, description, venue_code,
          address1, address2, post_code, geo_location,
          slug, images, attributes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        venueData.id,
        venueData.title,
        venueData.description,
        venueData.venueCode,
        venueData.address1,
        venueData.address2,
        venueData.postCode,
        venueData.geoLocation,
        venueData.slug,
        JSON.stringify(venueData.images || []),
        JSON.stringify(venueData.attributes || [])
      ).run();
      
      return result.meta.last_row_id;
    }
  } catch (error) {
    console.error('Error storing venue data:', error);
    return null;
  }
}

// Store or update space information
async function storeSpaceData(env, spaceData, venueId) {
  if (!spaceData || !spaceData.id) return null;

  try {
    // Check if space already exists
    const existingSpace = await env.DB.prepare(
      'SELECT id FROM spaces WHERE fringe_space_id = ?'
    ).bind(spaceData.id).first();

    if (existingSpace) {
      // Update existing space
      await env.DB.prepare(`
        UPDATE spaces SET
          venue_id = ?,
          title = ?,
          description = ?,
          venue_name = ?,
          venue_code = ?,
          accessibility_notes = ?,
          attributes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE fringe_space_id = ?
      `).bind(
        venueId,
        spaceData.title,
        spaceData.description,
        spaceData.venueName,
        spaceData.venueCode,
        spaceData.accessibilityNotes,
        JSON.stringify(spaceData.attributes || []),
        spaceData.id
      ).run();
      
      return existingSpace.id;
    } else {
      // Insert new space
      const result = await env.DB.prepare(`
        INSERT INTO spaces (
          fringe_space_id, venue_id, title, description,
          venue_name, venue_code, accessibility_notes, attributes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        spaceData.id,
        venueId,
        spaceData.title,
        spaceData.description,
        spaceData.venueName,
        spaceData.venueCode,
        spaceData.accessibilityNotes,
        JSON.stringify(spaceData.attributes || [])
      ).run();
      
      return result.meta.last_row_id;
    }
  } catch (error) {
    console.error('Error storing space data:', error);
    return null;
  }
}

// Store enhanced performance data with venue and accessibility information
async function storeEnhancedPerformanceData(env, showId, performanceData, scrapedAt) {
  try {
    // Store venue data if present
    let venueId = null;
    if (performanceData.venue) {
      venueId = await storeVenueData(env, performanceData.venue);
      
      // Update show with venue information if not already set
      await env.DB.prepare(`
        UPDATE shows SET
          venue = COALESCE(venue, ?),
          venue_id = COALESCE(venue_id, ?),
          venue_code = COALESCE(venue_code, ?)
        WHERE id = ? AND (venue IS NULL OR venue_id IS NULL)
      `).bind(
        performanceData.venue.title,
        performanceData.venue.id,
        performanceData.venue.venueCode,
        showId
      ).run();
    }

    // Store space data if present
    let spaceId = null;
    if (performanceData.space) {
      spaceId = await storeSpaceData(env, performanceData.space, venueId);
    }

    // Clear old performance data for this show
    await env.DB.prepare(`
      DELETE FROM performances 
      WHERE show_id = ? AND scraped_at < ?
    `).bind(showId, scrapedAt).run();

    // Insert new performance data
    const result = await env.DB.prepare(`
      INSERT INTO performances (
        show_id, venue_id, space_id, performance_id, title, description,
        date_time, estimated_end_date_time, duration, sold_out, cancelled,
        tickets_available, ticket_status, ticket_status_label, status,
        available, price, ticket_url, notes, accessibility_notes,
        box_office_id, box_office_ref, accessibility, badges, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      showId,
      venueId,
      spaceId,
      performanceData.id,
      performanceData.title,
      performanceData.description,
      performanceData.dateTime,
      performanceData.estimatedEndDateTime,
      performanceData.duration,
      performanceData.soldOut ? 1 : 0,
      performanceData.cancelled ? 1 : 0,
      performanceData.ticketsAvailable ? 1 : 0,
      performanceData.ticketStatus,
      performanceData.ticketStatusLabel,
      performanceData.status,
      performanceData.available ? 1 : 0,
      performanceData.price,
      performanceData.ticketUrl,
      performanceData.notes,
      performanceData.accessibilityNotes,
      performanceData.boxOfficeId,
      performanceData.boxOfficeRef,
      JSON.stringify(performanceData.accessibility || []),
      JSON.stringify(performanceData.badges || []),
      scrapedAt
    ).run();

    return result.meta.last_row_id;

  } catch (error) {
    console.error('Error storing enhanced performance data:', error);
    throw error;
  }
}

// Store show information with venue details
async function storeEnhancedShowData(env, showData, fringeUrl) {
  try {
    // Store venue data if present in show data
    let venueId = null;
    if (showData.venueDetails) {
      venueId = await storeVenueData(env, showData.venueDetails);
    }

    // Check if show already exists
    const existingShow = await env.DB.prepare(
      'SELECT id FROM shows WHERE fringe_url = ?'
    ).bind(fringeUrl).first();

    if (existingShow) {
      // Update existing show with enhanced data
      await env.DB.prepare(`
        UPDATE shows SET
          title = COALESCE(?, title),
          venue = COALESCE(?, venue),
          venue_id = COALESCE(?, venue_id),
          venue_code = COALESCE(?, venue_code),
          genre = COALESCE(?, genre),
          description = COALESCE(?, description),
          price_range = COALESCE(?, price_range),
          rating = COALESCE(?, rating),
          run_time = COALESCE(?, run_time),
          image_url = COALESCE(?, image_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        showData.title,
        showData.venue,
        showData.venueId || venueId,
        showData.venueCode,
        showData.genre,
        showData.description,
        showData.priceRange,
        showData.rating,
        showData.runTime,
        showData.image,
        existingShow.id
      ).run();

      return existingShow.id;
    } else {
      // Insert new show
      const result = await env.DB.prepare(`
        INSERT INTO shows (
          title, fringe_url, venue, venue_id, venue_code,
          genre, description, price_range, rating, run_time, image_url, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        showData.title,
        fringeUrl,
        showData.venue,
        showData.venueId || venueId,
        showData.venueCode,
        showData.genre,
        showData.description,
        showData.priceRange,
        showData.rating,
        showData.runTime,
        showData.image
      ).run();

      return result.meta.last_row_id;
    }
  } catch (error) {
    console.error('Error storing enhanced show data:', error);
    throw error;
  }
}

// Main function to process and store scraped data
async function processScrapedData(env, scrapedData) {
  const { showUrl, showInfo, performances, scrapedAt } = scrapedData;
  
  try {
    // Start transaction
    await env.DB.prepare('BEGIN TRANSACTION').run();
    
    // Store or update show information
    const showId = await storeEnhancedShowData(env, showInfo, showUrl);
    
    // Store all performances with their venue and accessibility data
    for (const performance of performances) {
      await storeEnhancedPerformanceData(env, showId, performance, scrapedAt);
    }
    
    // Log successful scrape
    await env.DB.prepare(`
      INSERT INTO scrape_logs (
        show_id, status, performances_found, scraped_at, debug_info
      ) VALUES (?, 'success', ?, ?, ?)
    `).bind(
      showId,
      performances.length,
      scrapedAt,
      JSON.stringify({
        hasVenueData: !!showInfo?.venueDetails,
        hasSpaceData: performances.some(p => p.space),
        accessibilityFeatures: performances.flatMap(p => p.accessibility || []),
        uniqueTicketStatuses: [...new Set(performances.map(p => p.ticketStatus))]
      })
    ).run();
    
    // Commit transaction
    await env.DB.prepare('COMMIT').run();
    
    console.log(`Successfully stored data for show ID ${showId}: ${performances.length} performances`);
    
    return { success: true, showId, performanceCount: performances.length };
    
  } catch (error) {
    // Rollback transaction on error
    await env.DB.prepare('ROLLBACK').run();
    
    console.error('Error processing scraped data:', error);
    
    // Log failed scrape
    try {
      const showId = await env.DB.prepare('SELECT id FROM shows WHERE fringe_url = ?')
        .bind(showUrl).first();
        
      if (showId) {
        await env.DB.prepare(`
          INSERT INTO scrape_logs (
            show_id, status, error_message, scraped_at
          ) VALUES (?, 'error', ?, ?)
        `).bind(showId.id, error.message, scrapedAt).run();
      }
    } catch (logError) {
      console.error('Error logging failed scrape:', logError);
    }
    
    throw error;
  }
}

// Utility function to get accessibility summary for a show
async function getAccessibilitySummary(env, showId) {
  try {
    const result = await env.DB.prepare(`
      SELECT 
        v.attributes as venueAttributes,
        s.attributes as spaceAttributes,
        s.accessibility_notes as spaceAccessibilityNotes,
        p.accessibility as performanceAccessibility,
        p.accessibility_notes as performanceAccessibilityNotes
      FROM performances p
      LEFT JOIN venues v ON p.venue_id = v.id
      LEFT JOIN spaces s ON p.space_id = s.id
      WHERE p.show_id = ?
      AND p.scraped_at = (
        SELECT MAX(scraped_at) FROM performances WHERE show_id = ?
      )
      LIMIT 1
    `).bind(showId, showId).first();

    if (!result) return null;

    // Parse JSON fields and extract accessibility information
    let accessibilityFeatures = [];
    let accessibilityNotes = [];

    try {
      // Venue accessibility attributes
      if (result.venueAttributes) {
        const venueAttrs = JSON.parse(result.venueAttributes);
        const accessibilityAttrs = venueAttrs.filter(attr => 
          attr.attributeTypes === 'accessibility'
        );
        accessibilityFeatures.push(...accessibilityAttrs.map(attr => ({
          type: 'venue',
          key: attr.key,
          value: attr.value
        })));
      }

      // Space accessibility attributes
      if (result.spaceAttributes) {
        const spaceAttrs = JSON.parse(result.spaceAttributes);
        const accessibilityAttrs = spaceAttrs.filter(attr => 
          attr.attributeTypes === 'accessibility'
        );
        accessibilityFeatures.push(...accessibilityAttrs.map(attr => ({
          type: 'space',
          key: attr.key,
          value: attr.value
        })));
      }

      // Performance accessibility features
      if (result.performanceAccessibility) {
        const perfAccessibility = JSON.parse(result.performanceAccessibility);
        accessibilityFeatures.push(...perfAccessibility.map(feature => ({
          type: 'performance',
          feature: feature
        })));
      }

      // Accessibility notes
      if (result.spaceAccessibilityNotes) {
        accessibilityNotes.push({
          type: 'space',
          notes: result.spaceAccessibilityNotes
        });
      }

      if (result.performanceAccessibilityNotes) {
        accessibilityNotes.push({
          type: 'performance',
          notes: result.performanceAccessibilityNotes
        });
      }

    } catch (parseError) {
      console.error('Error parsing accessibility JSON:', parseError);
    }

    return {
      features: accessibilityFeatures,
      notes: accessibilityNotes,
      hasWheelchairAccess: accessibilityFeatures.some(f => 
        f.key?.includes('wheelchair') || f.feature?.includes('WHEELCHAIR')
      ),
      hasAccessibleToilets: accessibilityFeatures.some(f => 
        f.key?.includes('wheelchair_accessible_toilet') || f.feature?.includes('WHEELCHAIR_ACCESSIBLE_TOILETS')
      )
    };

  } catch (error) {
    console.error('Error getting accessibility summary:', error);
    return null;
  }
}

export {
  storeVenueData,
  storeSpaceData,
  storeEnhancedPerformanceData,
  storeEnhancedShowData,
  processScrapedData,
  getAccessibilitySummary
};