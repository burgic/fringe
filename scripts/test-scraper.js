// Test script to verify the scraper is working
const SCRAPER_URL = 'https://fringe-scraper.hraasing.workers.dev';
const TEST_SHOW_URL = 'https://www.edfringe.com/tickets/whats-on/helen-bauer-bless-her';

async function testScraper() {
    console.log('🧪 Testing Fringe Scraper...');
    console.log(`Testing with: ${TEST_SHOW_URL}`);
    console.log('');
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${SCRAPER_URL}/?url=${encodeURIComponent(TEST_SHOW_URL)}`);
        
        const duration = Date.now() - startTime;
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Scraper Response:');
        console.log(`   Success: ${data.success}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Performances: ${data.count}`);
        console.log(`   GraphQL calls: ${data.debug?.graphqlCallsDetected || 0}`);
        console.log(`   Button clicks: ${data.debug?.buttonClickResult?.clickAttempts?.length || 0}`);
        
        if (data.performances && data.performances.length > 0) {
            console.log('');
            console.log('📋 Sample Performances:');
            data.performances.slice(0, 3).forEach((perf, i) => {
                const date = new Date(perf.dateTime).toLocaleDateString();
                const time = new Date(perf.dateTime).toLocaleTimeString();
                console.log(`   ${i + 1}. ${date} ${time} - ${perf.ticketStatus} ${perf.soldOut ? '(SOLD OUT)' : ''}`);
            });
        }
        
        console.log('');
        console.log('🎉 Scraper test completed successfully!');
        
    } catch (error) {
        console.error('❌ Scraper test failed:');
        console.error(`   Error: ${error.message}`);
        process.exit(1);
    }
}

// Run test if called directly
if (require.main === module) {
    testScraper();
}

module.exports = { testScraper };