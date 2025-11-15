#!/usr/bin/env node

/**
 * Quick test to verify auth bypass is working
 */

import http from 'http';

const PORT = 5000;

function testRequest(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function checkAuthBypass() {
  console.log('🔍 Checking authentication status...\n');
  
  try {
    // Test a protected endpoint
    const response = await testRequest('/api/companies');
    
    if (response.status === 200) {
      console.log('✅ SUCCESS: API is accessible');
      console.log('   Authentication bypass is working OR you are logged in');
      console.log('   Status:', response.status);
      
      // Try parsing the data to see if we get actual results
      try {
        const data = JSON.parse(response.data);
        if (Array.isArray(data)) {
          console.log('   Data: Received', data.length, 'companies');
        }
      } catch (e) {
        // Ignore parse errors
      }
      
      return true;
    } else if (response.status === 401) {
      console.log('❌ FAILED: Authentication required');
      console.log('   Status:', response.status);
      console.log('   The auth bypass is NOT working');
      console.log('\nTo enable auth bypass:');
      console.log('1. Stop the server');
      console.log('2. Set AUTH_TEST_BYPASS=true');
      console.log('3. Set NODE_ENV=test');
      console.log('4. Restart the server');
      return false;
    } else {
      console.log('⚠️ Unexpected response');
      console.log('   Status:', response.status);
      console.log('   Response:', response.data.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('❌ Connection error');
    console.log('   Error:', error.message);
    console.log('   Is the server running on port 5000?');
    return false;
  }
}

// Run the check
checkAuthBypass().then(success => {
  if (success) {
    console.log('\n🎉 You can now run the full test suite!');
    console.log('   Execute: node test-api.mjs');
  } else {
    console.log('\n⛔ Fix the authentication issue before running tests');
  }
  process.exit(success ? 0 : 1);
});