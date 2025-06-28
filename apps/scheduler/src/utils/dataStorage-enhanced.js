// Enhanced data storage functions for the scheduler worker
// Handles storing rich venue and accessibility data with the new schema

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
        venueData.title || null,
        venueData.description || null,
        venueData.venueCode || null,
        venueData.address1 || null,
        venueData.address2 || null,
        venueData.postCode || null,
        venueData.geoLocation ? JSON.stringify(venueData.geoLocation) : null,
        venueData.slug || null,
        venueData.images ? JSON.stringify(venueData.images) : null,
        venueData.attributes ? JSON.stringify(venueData.attributes) : null,
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
        venueData.title || null,
        venueData.description || null,
        venueData.venueCode || null,
        venueData.address1 || null,
        venueData.address2 || null,
        venueData.postCode || null,
        venueData.geoLocation ? JSON.stringify(venueData.geoLocation) : null,
        venueData.slug || null,
        venueData.images ? JSON.stringify(venueData.images) : null,
        venueData.attributes ? JSON.stringify(venueData.attributes) : null
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
        spaceData.title || null,
        spaceData.description || null,
        spaceData.venueName || null,
        spaceData.venueCode || null,
        spaceData.accessibilityNotes || null,
        spaceData.attributes ? JSON.stringify(spaceData.attributes) : null,
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
        spaceData.title || null,
        spaceData.description || null,
        spaceData.venueName || null,
        spaceData.venueCode || null,
        spaceData.accessibilityNotes || null,
        spaceData.attributes ? JSON.stringify(spaceData.attributes) : null
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
    let venueName = null;
    if (performanceData.venue) {
      venueId = await storeVenueData(env, performanceData.venue);
      venueName = performanceData.venue.title;
      
      // Update show with venue information if not already set
      await env.DB.prepare(`
        UPDATE shows SET
          venue = COALESCE(venue, ?),
          venue_id = COALESCE(venue_id, ?),
          venue_code = COALESCE(venue_code, ?)
        WHERE id = ? AND (venue IS NULL OR venue_id IS NULL)
      `).bind(
        venueName,
        venueId,
        performanceData.venue.venueCode,
        showId
      ).run();
    }

    // Store space data if present
    let spaceId = null;
    let spaceName = null;
    if (performanceData.space) {
      spaceId = await storeSpaceData(env, performanceData.space, venueId);
      spaceName = performanceData.space.title;
    }

    // Insert or update performance data with enhanced fields including pricing
    await env.DB.prepare(`
      INSERT OR REPLACE INTO performances (
        show_id, venue_id, space_id, performance_id, title, description,
        date_time, estimated_end_date_time, duration, sold_out, cancelled,
        tickets_available, ticket_status, ticket_status_label, status,
        available, price, ticket_url, notes, accessibility_notes,
        box_office_id, box_office_ref, accessibility, badges, 
        venue_name, space_name, scraped_at, last_checked,
        standard_price, lowest_price, availability_percentage,
        has_concessions, has_free_accessibility, price_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      showId,
      venueId,
      spaceId,
      performanceData.id,
      performanceData.title || null,
      performanceData.description || null,
      performanceData.dateTime,
      performanceData.estimatedEndDateTime || null,
      performanceData.duration || null,
      performanceData.soldOut ? 1 : 0,
      performanceData.cancelled ? 1 : 0,
      performanceData.ticketsAvailable ? 1 : 0,
      performanceData.ticketStatus || 'UNKNOWN',
      performanceData.ticketStatusLabel || performanceData.ticketStatus || 'Unknown',
      performanceData.status || null,
      (performanceData.available || (!performanceData.soldOut && !performanceData.cancelled)) ? 1 : 0,
      performanceData.price || null,
      performanceData.ticketUrl || null,
      performanceData.notes || null,
      performanceData.accessibilityNotes || null,
      performanceData.boxOfficeId || null,
      performanceData.boxOfficeRef || null,
      performanceData.accessibility ? JSON.stringify(performanceData.accessibility) : null,
      performanceData.badges ? JSON.stringify(performanceData.badges) : null,
      venueName,
      spaceName,
      scrapedAt,
      scrapedAt,
      performanceData.standardPrice || null,
      performanceData.lowestPrice || null,
      performanceData.availabilityPercentage || null,
      performanceData.hasConcessions ? 1 : 0,
      performanceData.hasFreeAccessibility ? 1 : 0,
      performanceData.priceDetails || null
    ).run();

    // Store in performance history for tracking changes
    await env.DB.prepare(`
      INSERT INTO performance_history (
        performance_id, show_id, date_time, sold_out, ticket_status,
        tickets_available, price, accessibility, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      performanceData.id,
      showId,
      performanceData.dateTime,
      performanceData.soldOut ? 1 : 0,
      performanceData.ticketStatus || 'UNKNOWN',
      performanceData.ticketsAvailable ? 1 : 0,
      performanceData.price || null,
      performanceData.accessibility ? JSON.stringify(performanceData.accessibility) : null,
      scrapedAt
    ).run();

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
    if (showData && showData.venueDetails) {
      venueId = await storeVenueData(env, showData.venueDetails);
    }

    // Check if show already exists
    const existingShow = await env.DB.prepare(
      'SELECT id FROM shows WHERE fringe_url = ? OR url = ?'
    ).bind(fringeUrl, fringeUrl).first();

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
          fringe_url = COALESCE(?, fringe_url),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        showData?.title,
        showData?.venue,
        showData?.venueId || venueId,
        showData?.venueCode,
        showData?.genre,
        showData?.description,
        showData?.priceRange,
        showData?.rating,
        showData?.runTime,
        showData?.image,
        fringeUrl,
        existingShow.id
      ).run();

      return existingShow.id;
    } else {
      // Insert new show
      const result = await env.DB.prepare(`
        INSERT INTO shows (
          title, fringe_url, url, slug, venue, venue_id, venue_code,
          genre, description, price_range, rating, run_time, image_url, active, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
      `).bind(
        showData?.title || 'Unknown Show',
        fringeUrl,
        fringeUrl, // Keep compatibility with old url column
        showData?.slug || fringeUrl.split('/').pop(),
        showData?.venue,
        showData?.venueId || venueId,
        showData?.venueCode,
        showData?.genre,
        showData?.description,
        showData?.priceRange,
        showData?.rating,
        showData?.runTime,
        showData?.image
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
    console.log(`Processing enhanced scraped data for URL: ${showUrl}`);
    
    // Store or update show information
    const showId = await storeEnhancedShowData(env, showInfo, showUrl);
    console.log(`Show ID: ${showId}`);
    
    // Clear old performance data for this show (keep only latest scrape)
    await env.DB.prepare(`
      DELETE FROM performances 
      WHERE show_id = ? AND scraped_at < ?
    `).bind(showId, scrapedAt).run();
    
    // Store all performances with their venue and accessibility data
    let processedCount = 0;
    for (const performance of performances) {
      try {
        await storeEnhancedPerformanceData(env, showId, performance, scrapedAt);
        processedCount++;
      } catch (perfError) {
        console.error(`Error storing performance ${performance.id}:`, perfError);
      }
    }
    
    // Log successful scrape with enhanced debug info
    await env.DB.prepare(`
      INSERT INTO scrape_logs (
        show_id, status, performances_found, scraped_at, debug_info
      ) VALUES (?, 'success', ?, ?, ?)
    `).bind(
      showId,
      processedCount,
      scrapedAt,
      JSON.stringify({
        hasShowInfo: !!showInfo,
        hasVenueData: !!(showInfo?.venueDetails || performances.some(p => p.venue)),
        hasSpaceData: performances.some(p => p.space),
        accessibilityFeatures: performances.flatMap(p => p.accessibility || []),
        uniqueTicketStatuses: [...new Set(performances.map(p => p.ticketStatus))],
        venueCount: performances.filter(p => p.venue).length,
        spaceCount: performances.filter(p => p.space).length
      })
    ).run();
    
    // Update show-level pricing summary from performances
    await updateShowPricingSummary(env, showId);
    
    console.log(`✅ Successfully processed enhanced data: ${processedCount} performances`);
    
    return { 
      success: true, 
      showId, 
      performanceCount: processedCount,
      showTitle: showInfo?.title || 'Unknown Show'
    };
    
  } catch (error) {
    console.error('Error processing enhanced scraped data:', error);
    
    // Log the error
    try {
      const show = await env.DB.prepare(`
        SELECT id FROM shows WHERE fringe_url = ? OR url = ?
      `).bind(showUrl, showUrl).first();
        
      if (show) {
        await env.DB.prepare(`
          INSERT INTO scrape_logs (
            show_id, status, error_message, scraped_at
          ) VALUES (?, 'error', ?, ?)
        `).bind(show.id, error.message, scrapedAt).run();
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

// Update show-level pricing summary based on performance data
async function updateShowPricingSummary(env, showId) {
  try {
    const pricingData = await env.DB.prepare(`
      SELECT 
        MIN(standard_price) as min_standard,
        MAX(standard_price) as max_standard,
        MIN(lowest_price) as min_lowest,
        MAX(lowest_price) as max_lowest,
        AVG(standard_price) as avg_standard,
        COUNT(CASE WHEN has_concessions = 1 THEN 1 END) as concessions_count,
        COUNT(CASE WHEN has_free_accessibility = 1 THEN 1 END) as free_accessibility_count,
        COUNT(CASE WHEN standard_price = 0 THEN 1 END) as free_count
      FROM performances 
      WHERE show_id = ? AND standard_price IS NOT NULL
    `).bind(showId).first();

    if (pricingData && pricingData.min_standard !== null) {
      // Calculate price ranges
      let computedPriceRange;
      if (pricingData.min_lowest < pricingData.min_standard) {
        computedPriceRange = `£${pricingData.min_lowest}-£${pricingData.max_standard}`;
      } else if (pricingData.min_standard === pricingData.max_standard) {
        computedPriceRange = `£${pricingData.min_standard}`;
      } else {
        computedPriceRange = `£${pricingData.min_standard}-£${pricingData.max_standard}`;
      }

      // Update show with computed pricing
      await env.DB.prepare(`
        UPDATE shows SET 
          computed_price_range = ?,
          has_concession_pricing = ?,
          has_free_accessibility = ?
        WHERE id = ?
      `).bind(
        computedPriceRange,
        pricingData.concessions_count > 0 ? 1 : 0,
        pricingData.free_accessibility_count > 0 ? 1 : 0,
        showId
      ).run();

      console.log(`Updated show ${showId} pricing: ${computedPriceRange}`);
    }
  } catch (error) {
    console.error('Error updating show pricing summary:', error);
  }
}

export {
  storeVenueData,
  storeSpaceData,
  storeEnhancedPerformanceData,
  storeEnhancedShowData,
  processScrapedData,
  getAccessibilitySummary,
  updateShowPricingSummary
};
