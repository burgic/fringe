import puppeteer from "@cloudflare/puppeteer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const TICKET_STATUS_MAP = {
  'TWO_FOR_ONE': '2 for 1',
  'TICKETS_AVAILABLE': 'Available',
  'CANCELLED': 'Cancelled',
  'EVENT_SPECIFIC': 'Event Specific',
  'FREE_NON_TICKETED': 'Free Non-Ticketed',
  'FREE_TICKETED': 'Free Ticketed',
  'NO_ALLOCATION_CONTACT_VENUE': 'No allocation, contact venue',
  'PREVIEW_SHOW': 'Preview Show'
};


export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const showUrl = searchParams.get('url');
    
    if (!showUrl || !showUrl.startsWith('https://www.edfringe.com/tickets/whats-on/'))  {
      return new Response(JSON.stringify({ error: 'Invalid show URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();
      const performances = [];
      let showInfo = null;
      
      // Track network calls
      const networkCalls = [];
      let graphqlCallsDetected = 0;
      
      page.on('request', (req) => {
        networkCalls.push(`REQUEST: ${req.url()}`);
      });
      
      page.on('response', async (response) => {
        const url = response.url();
        networkCalls.push(`RESPONSE: ${url}`);
        
        // Detect GraphQL responses
        if (url.includes('edfringe-tikketr-web-api.equhost.com/graphql') && response.status() === 200) {
          graphqlCallsDetected++;
          try {
            const data = await response.json();
            console.log(`*** FOUND GraphQL Response #${graphqlCallsDetected} ***`);
            
            // Extract show information from GetShow query
            if (data.data && data.data.show) {
              const show = data.data.show;
              showInfo = {
                id: show.id,
                title: show.title,
                venue: show.venue?.name || null,
                genre: show.genre?.name || null,
                description: show.description || null,
                priceRange: show.priceRange || null,
                rating: show.rating || null,
                runTime: show.runTime || null,
                image: show.image || null
              };
              console.log('*** EXTRACTED Show Info ***', showInfo);
            }
            
            // Extract performances from GetPerformances query
            if (data.data && data.data.performances) {
              const results = data.data.performances.results;
              console.log(`*** FOUND GetPerformances - ${results.length} performances ***`);
              
              for (const performance of results) {
                // Extract venue information if available
                let venueInfo = null;
                if (performance.venue) {
                  venueInfo = {
                    id: performance.venue.id,
                    title: performance.venue.title,
                    description: performance.venue.description,
                    venueCode: performance.venue.venueCode,
                    address1: performance.venue.address1,
                    address2: performance.venue.address2,
                    postCode: performance.venue.postCode,
                    geoLocation: performance.venue.geoLocation,
                    slug: performance.venue.slug,
                    images: performance.venue.images || [],
                    attributes: performance.venue.attributes || []
                  };
                }

                // Extract space information if available
                let spaceInfo = null;
                if (performance.space) {
                  spaceInfo = {
                    id: performance.space.id,
                    title: performance.space.title,
                    description: performance.space.description,
                    venueName: performance.space.venueName,
                    venueCode: performance.space.venueCode,
                    accessibilityNotes: performance.space.accessibilityNotes,
                    attributes: performance.space.attributes || []
                  };
                }

                const extracted = {
                  id: performance.id,
                  title: performance.title,
                  description: performance.description,
                  dateTime: performance.dateTime,
                  estimatedEndDateTime: performance.estimatedEndDateTime,
                  duration: performance.duration,
                  soldOut: performance.soldOut || false,
                  cancelled: performance.cancelled || false,
                  ticketsAvailable: performance.ticketsAvailable || false,
                  ticketStatus: performance.ticketStatus,
                  ticketStatusLabel: TICKET_STATUS_MAP[performance.ticketStatus] || performance.ticketStatus,
                  status: performance.status, // "On Sale", etc.
                  notes: performance.notes,
                  accessibilityNotes: performance.accessibilityNotes,
                  boxOfficeId: performance.boxOfficeId,
                  boxOfficeRef: performance.boxOfficeRef,
                  
                  // Accessibility information
                  accessibility: performance.accessibility || [],
                  badges: performance.badges || [],
                  
                  // Additional fields we might have missed
                  available: !performance.soldOut && !performance.cancelled && (performance.ticketsAvailable || performance.ticketStatus === 'TICKETS_AVAILABLE' || performance.ticketStatus === 'TWO_FOR_ONE'),
                  price: performance.price || null,
                  ticketUrl: performance.ticketUrl || null,
                  
                  // Venue and space data
                  venue: venueInfo,
                  space: spaceInfo,

                  priceDetails: null,
                  
                  // Raw data for debugging
                  rawTicketStatus: performance.ticketStatus,
                  rawSoldOut: performance.soldOut,
                  rawCancelled: performance.cancelled,
                  rawTicketsAvailable: performance.ticketsAvailable
                };
                performances.push(extracted);
              }

              // Update show info with venue data from first performance if not already set
              if (performances.length > 0 && performances[0].venue && !showInfo?.venue) {
                if (!showInfo) showInfo = {};
                showInfo.venue = performances[0].venue.title;
                showInfo.venueCode = performances[0].venue.venueCode;
                showInfo.venueId = performances[0].venue.id;
                showInfo.venueDetails = performances[0].venue;
              }
            }

            if (data.data && data.data.performancePrices) {
              const priceData = data.data.performancePrices;
              console.log(`*** FOUND PerformancePrices for performance ${priceData.result?.performanceId} ***`);
              
              if (priceData.success && priceData.result) {
                const performanceId = priceData.result.performanceId;
                const pricingInfo = extractSimplePricing(priceData.result);
                
                // Store pricing data by performance ID
                pricingData.set(performanceId, pricingInfo);
                console.log(`*** Stored pricing for performance ${performanceId}: ${JSON.stringify(pricingInfo, null, 2)} ***`);
                
                // Find the corresponding performance and add pricing immediately
                const performance = performances.find(p => p.id === performanceId);
                if (performance) {
                  // Update the performance with pricing data
                  performance.price = pricingInfo.displayPrice;
                  performance.standardPrice = pricingInfo.standardPrice;
                  performance.lowestPrice = pricingInfo.lowestPrice;
                  performance.availabilityPercentage = pricingInfo.availabilityPercentage;
                  performance.hasConcessions = pricingInfo.hasConcessions;
                  performance.hasFreeAccessibility = pricingInfo.hasFreeAccessibility;
                  performance.priceDetails = JSON.stringify(pricingInfo.fullDetails);
                  console.log(`*** Applied pricing to performance ${performanceId}: ${pricingInfo.displayPrice} ***`);
                }
              }
            }

            // Extract ticket status options if present
            if (data.data && data.data.ticketStatusOptions) {
              console.log('*** FOUND Ticket Status Options ***');
              console.log(JSON.stringify(data.data.ticketStatusOptions, null, 2));
            }

          } catch (e) {
            console.error('Error reading GraphQL response:', e);
          }
        }
      });

      // Navigate to page
      console.log('=== STARTING NAVIGATION ===');
      await page.goto(showUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('✓ Page loaded');
      
      await waitForTimeout(5000); // Match working script
      console.log('✓ Initial wait complete');

      // Handle cookie consent
      console.log('=== HANDLING COOKIE CONSENT ===');
      try {
        const cookieResult = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (let i = 0; i < buttons.length; i++) {
            const text = buttons[i].textContent?.toLowerCase() || '';
            if (text.includes('accept') || text.includes('allow')) {
              buttons[i].click();
              return { found: true, text: buttons[i].textContent?.trim() };
            }
          }
          return { found: false };
        });
        console.log('Cookie consent result:', cookieResult);
        
        if (cookieResult.found) {
          await waitForTimeout(1000);
        }
      } catch (e) {
        console.log('Cookie consent error:', e.message);
      }

      if (!showInfo) {
        console.log('=== EXTRACTING SHOW INFO FROM PAGE ===');
        showInfo = await page.evaluate(() => {
          const title = document.querySelector('h1')?.textContent?.trim() || null;
          const venue = document.querySelector('[data-testid="venue-name"]')?.textContent?.trim() || null;
          
          return {
            title,
            venue,
            genre: null, // Will need to extract from GraphQL
            description: null,
            priceRange: null,
            rating: null,
            runTime: null,
            image: null
          };
        });
      }

      // Find and click ALL "Buy tickets" buttons (match working script exactly)
      console.log('=== FINDING AND CLICKING BUY TICKETS BUTTONS ===');
      
      const buttonClickResult = await page.evaluate(() => {
        // Find ALL buttons with "Buy tickets" text
        const allButtons = Array.from(document.querySelectorAll('button'));
        const buyTicketButtons = allButtons.filter(button => 
          button.textContent?.toLowerCase().includes('buy tickets')
        );
        
        const result = {
          totalButtons: allButtons.length,
          buyTicketButtonsFound: buyTicketButtons.length,
          clickAttempts: [],
          timestamp: Date.now()
        };
        
        // Click up to 5 buttons (exactly like working script)
        for (let i = 0; i < Math.min(5, buyTicketButtons.length); i++) {
          try {
            const button = buyTicketButtons[i];
            button.click();
            
            result.clickAttempts.push({
              index: i + 1,
              success: true,
              buttonText: button.textContent?.trim(),
              buttonClasses: button.className,
              hasIcon: !!button.querySelector('[aria-label="Ticket"]')
            });
          } catch (e) {
            result.clickAttempts.push({
              index: i + 1,
              success: false,
              error: e.message
            });
            break;
          }
        }
        
        return result;
      });
      
      console.log('Button click result:', JSON.stringify(buttonClickResult, null, 2));

      // Wait for GraphQL responses after each click (match working script timing)
      console.log('=== WAITING FOR GRAPHQL RESPONSES ===');
      
      const clickedButtons = buttonClickResult.clickAttempts.filter(attempt => attempt.success);
      
      for (let i = 0; i < clickedButtons.length; i++) {
        console.log(`Waiting for response after button ${i + 1}...`);
        await waitForTimeout(4000); // Exact timing from working script
      }

      console.log('=== FINAL WAIT ===');
      await waitForTimeout(3000);

      // NEW: Make explicit GraphQL calls to fetch pricing data for each performance
      console.log('=== FETCHING PRICING DATA ===');
      if (performances.length > 0) {
        for (const performance of performances) {
          if (performance.id) {
            try {
              console.log(`Fetching pricing for performance ${performance.id}...`);
              
              // Make GraphQL call to get pricing data
              const pricingResponse = await page.evaluate(async (performanceId) => {
                const query = `
                  query GetPerformancePrices($performanceId: String!) {
                    performancePrices(performanceId: $performanceId) {
                      success
                      error
                      result {
                        performanceId
                        isFromAllocation
                        allocationDetails
                        performancePercentageRemaining
                        performanceAvailabilityLevel
                        prices {
                          priceBandId
                          priceValue
                          totalPrice
                          outsideFeesPrice
                          feeInTicketPrice
                          pricetype
                          description
                          priceBandReservationLevel
                          seats
                          hideFullPrice
                          seatPercentageRemaining
                          seatPercentageRemainingSpecified
                          availabilityLevel
                          eventFeeExempt
                          handlingFeeExempt
                          fees
                          concessions {
                            code
                            concessionRef
                            title
                            concPrice
                            concessionid
                            concessionRequiredQty
                            description
                            limited
                            promoCodeRequired
                            isGiftAidable
                            donationValue
                            limitValue
                            remainingLimitValue
                            ticketOfferKey
                            feeExempt
                            eventAndPricebandFeeExempt
                            listOnly
                            priceOverrideAvailable
                          }
                        }
                      }
                    }
                  }
                `;
                
                const response = await fetch('https://edfringe-tikketr-web-api.equhost.com/graphql', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                  },
                  body: JSON.stringify({
                    query,
                    variables: { performanceId }
                  })
                });
                
                if (response.ok) {
                  return await response.json();
                } else {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
              }, performance.id);
              
              // Process the pricing response
              if (pricingResponse?.data?.performancePrices?.success) {
                const priceData = pricingResponse.data.performancePrices.result;
                const prices = priceData.prices || [];
                
                if (prices.length > 0) {
                  const mainPrice = prices[0];
                  performance.priceDetails = {
                    fullPrice: parseFloat(mainPrice.priceValue),
                    totalPrice: parseFloat(mainPrice.totalPrice),
                    priceBand: mainPrice.pricetype,
                    availabilityPercentage: priceData.performancePercentageRemaining,
                    seatPercentageRemaining: mainPrice.seatPercentageRemaining,
                    concessions: mainPrice.concessions?.map(conc => ({
                      type: conc.title,
                      code: conc.code,
                      price: parseFloat(conc.concPrice),
                      description: conc.description
                    })) || []
                  };
                  
                  // Set simplified price for compatibility
                  performance.price = `£${mainPrice.priceValue}`;
                  
                  console.log(`✓ Added pricing to performance ${performance.id}: £${mainPrice.priceValue} (${performance.priceDetails.concessions.length} concessions)`);
                }
              } else {
                console.log(`✗ No pricing data available for performance ${performance.id}`);
              }
              
              // Small delay between requests
              await waitForTimeout(500);
              
            } catch (error) {
              console.error(`Error fetching pricing for performance ${performance.id}:`, error.message);
            }
          }
        }
      }

      const availablePerformances = performances.filter(p => p.available);
      const soldOutPerformances = performances.filter(p => p.soldOut);
      
      // Group performances by ticket status
      const performancesByStatus = {};
      performances.forEach(perf => {
        const status = perf.ticketStatusLabel;
        if (!performancesByStatus[status]) {
          performancesByStatus[status] = 0;
        }
        performancesByStatus[status]++;
      });

      // Final results
      const result = {
        success: true,
        showUrl,
        showInfo,
        performances,
        stats: {
          total: performances.length,
          available: availablePerformances.length,
          soldOut: soldOutPerformances.length,
          byStatus: performancesByStatus
        },
        scrapedAt: new Date().toISOString(),
        debug: {
          networkCallsCount: networkCalls.length,
          graphqlCallsDetected,
          buttonClickResult,
          networkCalls: networkCalls.slice(-10),
          hasPerformanceData: performances.length > 0,
          hasShowInfo: !!showInfo
        }
      };

      console.log(`=== FINAL RESULT ===`);
      console.log(`Show: ${showInfo?.title || 'Unknown'}`);
      console.log(`Performances: ${performances.length} total, ${availablePerformances.length} available`);
      console.log(`Status breakdown:`, performancesByStatus);

      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch ticket data',
        details: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
    }
  },
};