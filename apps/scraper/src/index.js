import puppeteer from "@cloudflare/puppeteer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      
      // Track network calls
      const networkCalls = [];
      let graphqlCallsDetected = 0;
      
      page.on('request', (req) => {
        networkCalls.push(`REQUEST: ${req.url()}`);
      });
      
      page.on('response', async (response) => {
        const url = response.url();
        networkCalls.push(`RESPONSE: ${url}`);
        
        // Exact GraphQL detection from working script
        if (url.includes('edfringe-tikketr-web-api.equhost.com/graphql') && response.status() === 200) {
          graphqlCallsDetected++;
          try {
            const data = await response.json();
            console.log(`*** FOUND GraphQL Response #${graphqlCallsDetected} ***`);
            
            if (data.data && data.data.performances) {
              const results = data.data.performances.results;
              console.log(`*** FOUND GetPerformances - ${results.length} performances ***`);
              
              for (const performance of results) {
                const extracted = {
                  id: performance.id,
                  dateTime: performance.dateTime,
                  soldOut: performance.soldOut,
                  ticketStatus: performance.ticketStatus
                };
                performances.push(extracted);
              }
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
        await waitForTimeout(3000); // Exact timing from working script
      }

      console.log('=== FINAL WAIT ===');
      await waitForTimeout(2000);

      // Final results
      const result = {
        success: true,
        showUrl,
        performances,
        count: performances.length,
        scrapedAt: new Date().toISOString(),
        debug: {
          networkCallsCount: networkCalls.length,
          graphqlCallsDetected,
          buttonClickResult,
          networkCalls: networkCalls.slice(-10),
          hasPerformanceData: performances.length > 0
        }
      };

      console.log(`=== FINAL RESULT: ${performances.length} performances found ===`);

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