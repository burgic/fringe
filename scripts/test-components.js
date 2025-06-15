#!/usr/bin/env node

// Simple test script for the scraper
// Tests the David O'Doherty show scraping

import fetch from 'node-fetch';

const TEST_URL = 'https://www.edfringe.com/tickets/whats-on/david-o-doherty-highway-to-the-david-zone';

async function testScraper() {
  console.log('🕷️  Testing Fringe Scraper...');
  console.log(`📋 Testing with: ${TEST_URL}`);
  
  try {
    // Note: You'll need to update this URL to your deployed scraper worker
    const scraperUrl = 'http://localhost:8787'; // For local testing
    // const scraperUrl = 'https://fringe-scraper.your-subdomain.workers.dev'; // For deployed
    
    console.log(`🌐 Calling scraper at: ${scraperUrl}`);
    
    const response = await fetch(`${scraperUrl}/?url=${encodeURIComponent(TEST_URL)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'FringeTestScript/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('📊 Results:');
    console.log(`✅ Success: ${data.success}`);
    console.log(`🎫 Performances found: ${data.performances?.length || 0}`);
    
    if (data.performances && data.performances.length > 0) {
      console.log('\n📋 Performance Details:');
      data.performances.forEach((perf, index) => {
        const date = new Date(perf.dateTime);
        console.log(`  ${index + 1}. ${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
        console.log(`     Status: ${perf.ticketStatus} | Sold Out: ${perf.soldOut}`);
      });
    }
    
    if (data.debug) {
      console.log('\n🔍 Debug Info:');
      console.log(`  GraphQL calls detected: ${data.debug.graphqlCallsDetected}`);
      console.log(`  Network calls: ${data.debug.networkCallsCount}`);
      console.log(`  Button clicks: ${data.debug.buttonClickResult?.clickAttempts?.length || 0}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

async function testDatabase() {
  console.log('\n🗄️  Testing Database Connection...');
  
  try {
    // Note: Update with your API URL
    const apiUrl = 'http://localhost:8788'; // For local testing
    // const apiUrl = 'https://fringe-api.your-subdomain.workers.dev'; // For deployed
    
    const response = await fetch(`${apiUrl}/shows`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`📊 Shows in database: ${data.total}`);
    
    if (data.shows && data.shows.length > 0) {
      console.log('\n📋 Shows:');
      data.shows.forEach(show => {
        console.log(`  • ${show.title} (${show.review_category || 'No review'})`);
        console.log(`    ${show.url}`);
      });
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('💡 Make sure your API worker is running on localhost:8788');
    return null;
  }
}

// Run tests
async function runTests() {
  console.log('🎭 Fringe Show Tracker - Component Tests\n');
  
  // Test 1: Scraper
  const scraperResult = await testScraper();
  
  // Test 2: Database/API
  const dbResult = await testDatabase();
  
  console.log('\n📊 Test Summary:');
  console.log(`Scraper: ${scraperResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database: ${dbResult ? '✅ PASS' : '❌ FAIL'}`);
  
  if (scraperResult && dbResult) {
    console.log('\n🎉 All core components working!');
    console.log('Next: Deploy workers and test end-to-end');
  }
}

runTests().catch(console.error);