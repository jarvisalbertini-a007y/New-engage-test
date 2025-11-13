// API Test Suite with Supertest
// Run with: AUTH_TEST_BYPASS=true npm run test-api
import request from 'supertest';

// Set environment variables before importing app
process.env.AUTH_TEST_BYPASS = 'true';
process.env.NODE_ENV = 'development';
process.env.SKIP_SERVER_LISTEN = 'true'; // Prevent server from binding to port

// Global app and server references
let app;
let server;

async function runTests() {
  console.log('🧪 Starting API Tests with AUTH_TEST_BYPASS...');
  console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}, AUTH_TEST_BYPASS=${process.env.AUTH_TEST_BYPASS}\n`);
  
  try {
    // Import app and wait for server to be ready (using tsx)
    const appModule = await import('./index.ts');
    app = appModule.app;
    await appModule.serverReady; // Wait for server initialization
    server = appModule.server;
    
    if (!app) {
      console.error('❌ Failed to import Express app');
      process.exit(1);
    }
    
    console.log('✅ Express app loaded successfully\n');
    
    // Test groups
    await testHealthEndpoints();
    await testSequencesAPI();
    await testAutopilotAPI();
    await testVoiceCampaignsAPI();
    await testInsightsAPI();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.stack) console.error(error.stack);
  } finally {
    // No need to close server since we didn't start listening
    process.exit(0);
  }
}

async function testHealthEndpoints() {
  console.log('🔍 Testing Health Endpoints...');
  
  try {
    const res = await request(app).get('/api/health');
    if (res.status === 200) {
      console.log('  ✅ GET /api/health - OK');
    } else {
      console.log(`  ❌ GET /api/health - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ GET /api/health - Error:', error.message);
  }
}

async function testSequencesAPI() {
  console.log('\n🔍 Testing Sequences API...');
  
  // Test GET sequences
  try {
    const res = await request(app).get('/api/sequences');
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  ✅ GET /api/sequences - OK (${res.body.length} sequences)`);
    } else {
      console.log(`  ❌ GET /api/sequences - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ GET /api/sequences - Error:', error.message);
  }
  
  // Test CREATE sequence
  try {
    const newSequence = {
      name: `Test Sequence ${Date.now()}`,
      status: 'draft',
      steps: []
    };
    
    const res = await request(app)
      .post('/api/sequences')
      .send(newSequence)
      .set('Content-Type', 'application/json');
      
    if ((res.status === 200 || res.status === 201) && res.body.id) {
      console.log(`  ✅ POST /api/sequences - Created: ${res.body.name}`);
      
      // Test UPDATE
      const updateRes = await request(app)
        .patch(`/api/sequences/${res.body.id}`)
        .send({ status: 'active' })
        .set('Content-Type', 'application/json');
        
      if (updateRes.status === 200) {
        console.log(`  ✅ PATCH /api/sequences/:id - Updated`);
      } else {
        console.log(`  ❌ PATCH /api/sequences/:id - Status: ${updateRes.status}`);
      }
      
      // Test DELETE
      const deleteRes = await request(app)
        .delete(`/api/sequences/${res.body.id}`);
        
      if (deleteRes.status === 204) {
        console.log(`  ✅ DELETE /api/sequences/:id - Deleted`);
      } else {
        console.log(`  ❌ DELETE /api/sequences/:id - Status: ${deleteRes.status}`);
      }
    } else {
      console.log(`  ❌ POST /api/sequences - Status: ${res.status}`);
      if (res.body.error) console.log(`     Error: ${res.body.error}`);
    }
  } catch (error) {
    console.log('  ❌ Sequences CRUD - Error:', error.message);
  }
}

async function testAutopilotAPI() {
  console.log('\n🔍 Testing Autopilot API...');
  
  // Test GET campaigns
  try {
    const res = await request(app).get('/api/autopilot/campaigns');
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  ✅ GET /api/autopilot/campaigns - OK (${res.body.length} campaigns)`);
    } else {
      console.log(`  ❌ GET /api/autopilot/campaigns - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ GET /api/autopilot/campaigns - Error:', error.message);
  }
  
  // Test CREATE campaign
  try {
    const newCampaign = {
      name: `Test Autopilot ${Date.now()}`,
      status: 'paused',
      dailyTargetLeads: 50,
      dailySendLimit: 100,
      autoProspect: true,
      autoFollowUp: true,
      creativityLevel: 5,
      personalizationDepth: 'moderate',
      toneOfVoice: 'professional'
    };
    
    const res = await request(app)
      .post('/api/autopilot/campaigns')
      .send(newCampaign)
      .set('Content-Type', 'application/json');
      
    if ((res.status === 200 || res.status === 201) && res.body.id) {
      console.log(`  ✅ POST /api/autopilot/campaigns - Created: ${res.body.name}`);
      
      // Test GET by ID
      const getRes = await request(app)
        .get(`/api/autopilot/campaigns/${res.body.id}`);
        
      if (getRes.status === 200) {
        console.log(`  ✅ GET /api/autopilot/campaigns/:id - Retrieved`);
      } else {
        console.log(`  ❌ GET /api/autopilot/campaigns/:id - Status: ${getRes.status}`);
      }
      
      // Test UPDATE
      const updateRes = await request(app)
        .patch(`/api/autopilot/campaigns/${res.body.id}`)
        .send({ status: 'active' })
        .set('Content-Type', 'application/json');
        
      if (updateRes.status === 200) {
        console.log(`  ✅ PATCH /api/autopilot/campaigns/:id - Updated`);
      } else {
        console.log(`  ❌ PATCH /api/autopilot/campaigns/:id - Status: ${updateRes.status}`);
      }
    } else {
      console.log(`  ❌ POST /api/autopilot/campaigns - Status: ${res.status}`);
      if (res.body.error) console.log(`     Error: ${res.body.error}`);
    }
  } catch (error) {
    console.log('  ❌ Autopilot CRUD - Error:', error.message);
  }
}

async function testVoiceCampaignsAPI() {
  console.log('\n🔍 Testing Voice Campaigns API...');
  
  // Test GET campaigns
  try {
    const res = await request(app).get('/api/voice/campaigns');
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  ✅ GET /api/voice/campaigns - OK (${res.body.length} campaigns)`);
    } else {
      console.log(`  ❌ GET /api/voice/campaigns - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ GET /api/voice/campaigns - Error:', error.message);
  }
  
  // Test CREATE campaign
  try {
    const newCampaign = {
      name: `Test Voice Campaign ${Date.now()}`,
      status: 'draft'
    };
    
    const res = await request(app)
      .post('/api/voice/campaigns')
      .send(newCampaign)
      .set('Content-Type', 'application/json');
      
    if ((res.status === 200 || res.status === 201) && res.body.id) {
      console.log(`  ✅ POST /api/voice/campaigns - Created: ${res.body.name}`);
      
      // Test UPDATE
      const updateRes = await request(app)
        .patch(`/api/voice/campaigns/${res.body.id}`)
        .send({ status: 'active' })
        .set('Content-Type', 'application/json');
        
      if (updateRes.status === 200) {
        console.log(`  ✅ PATCH /api/voice/campaigns/:id - Updated`);
      } else {
        console.log(`  ❌ PATCH /api/voice/campaigns/:id - Status: ${updateRes.status}`);
      }
      
      // Test DELETE
      const deleteRes = await request(app)
        .delete(`/api/voice/campaigns/${res.body.id}`);
        
      if (deleteRes.status === 204) {
        console.log(`  ✅ DELETE /api/voice/campaigns/:id - Deleted`);
      } else {
        console.log(`  ❌ DELETE /api/voice/campaigns/:id - Status: ${deleteRes.status}`);
      }
    } else {
      console.log(`  ❌ POST /api/voice/campaigns - Status: ${res.status}`);
      if (res.body.error) console.log(`     Error: ${res.body.error}`);
    }
  } catch (error) {
    console.log('  ❌ Voice Campaigns CRUD - Error:', error.message);
  }
  
  // Test Voice Scripts
  try {
    const newScript = {
      name: `Test Script ${Date.now()}`,
      scriptType: 'cold_call',
      content: 'Hello, this is a test script.',
      introduction: 'Hi, this is a test introduction.',
      mainContent: 'This is the main content of the test script.',
      isActive: true
    };
    
    const res = await request(app)
      .post('/api/voice/scripts')
      .send(newScript)
      .set('Content-Type', 'application/json');
      
    if ((res.status === 200 || res.status === 201) && res.body.id) {
      console.log(`  ✅ POST /api/voice/scripts - Created: ${res.body.name}`);
    } else {
      console.log(`  ❌ POST /api/voice/scripts - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ Voice Scripts - Error:', error.message);
  }
}

async function testInsightsAPI() {
  console.log('\n🔍 Testing Insights API...');
  
  // Test GET insights
  try {
    const res = await request(app).get('/api/insights');
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  ✅ GET /api/insights - OK (${res.body.length} insights)`);
    } else {
      console.log(`  ❌ GET /api/insights - Status: ${res.status}`);
    }
  } catch (error) {
    console.log('  ❌ GET /api/insights - Error:', error.message);
  }
  
  // Test CREATE insight
  try {
    const newInsight = {
      companyId: 'test-company-123',
      insightType: 'funding_round',
      title: 'Test Company raised Series A',
      description: 'Test Company announced $10M Series A funding',
      source: 'test',
      sourceUrl: 'https://example.com/news',
      impact: 'high',
      actionRecommended: 'Reach out to discuss scaling needs'
    };
    
    const res = await request(app)
      .post('/api/insights')
      .send(newInsight)
      .set('Content-Type', 'application/json');
      
    if ((res.status === 200 || res.status === 201) && res.body.id) {
      console.log(`  ✅ POST /api/insights - Created: ${res.body.title}`);
    } else {
      console.log(`  ❌ POST /api/insights - Status: ${res.status}`);
      if (res.body.error) console.log(`     Error: ${res.body.error}`);
    }
  } catch (error) {
    console.log('  ❌ Insights CRUD - Error:', error.message);
  }
}

// Run tests
runTests();