#!/usr/bin/env node

/**
 * API Test Script for AI Sales Platform
 * Tests the currently running server with authentication bypass
 */

import http from 'http';

// Assuming the server is already running on port 5000
const PORT = 5000;
const HOST = 'localhost';

console.log('🧪 Starting API Test Suite...\n');
console.log(`Testing server at http://${HOST}:${PORT}\n`);

// Helper function to make HTTP requests
async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add test bypass headers
        'X-Test-Bypass': 'true',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, path, expectedStatus = 200, options = {}) {
  try {
    const response = await makeRequest(path, options);
    const success = response.status === expectedStatus;
    
    if (success) {
      console.log(`✅ ${name}`);
      console.log(`   ${options.method || 'GET'} ${path} → ${response.status}`);
      if (response.data && Array.isArray(response.data)) {
        console.log(`   Data: ${response.data.length} items`);
      } else if (response.data && typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        if (keys.length > 0 && keys.length < 10) {
          console.log(`   Keys: ${keys.join(', ')}`);
        }
      }
    } else {
      console.log(`❌ ${name}`);
      console.log(`   ${options.method || 'GET'} ${path} → ${response.status} (expected ${expectedStatus})`);
      if (response.data?.error || response.data?.message) {
        console.log(`   Error: ${response.data.error || response.data.message}`);
      }
    }
    
    return success;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${options.method || 'GET'} ${path} → Connection Error`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('📋 Testing Core Features\n');
  console.log('─'.repeat(50));
  
  // Dashboard Tests
  console.log('\n🏠 Dashboard');
  if (await testEndpoint('Dashboard Metrics', '/api/dashboard/metrics')) passed++; else failed++;
  if (await testEndpoint('Dashboard Activities', '/api/dashboard/activities')) passed++; else failed++;
  
  // CRM Core Tests  
  console.log('\n👥 CRM Core');
  if (await testEndpoint('Companies List', '/api/companies')) passed++; else failed++;
  if (await testEndpoint('Contacts List', '/api/contacts')) passed++; else failed++;
  if (await testEndpoint('Sequences List', '/api/sequences')) passed++; else failed++;
  if (await testEndpoint('Tasks List', '/api/tasks')) passed++; else failed++;
  
  // Marketplace Tests
  console.log('\n🛒 Marketplace');
  if (await testEndpoint('Marketplace Agents', '/api/marketplace/agents')) passed++; else failed++;
  if (await testEndpoint('My Agents', '/api/marketplace/my-agents')) passed++; else failed++;
  
  // Insights Engine Tests
  console.log('\n💡 Insights Engine');
  if (await testEndpoint('Insights List', '/api/insights')) passed++; else failed++;
  if (await testEndpoint('Companies with Insights', '/api/companies?withInsights=true')) passed++; else failed++;
  
  // Unified Inbox Tests
  console.log('\n📬 Unified Inbox');
  if (await testEndpoint('Inbox Messages', '/api/inbox')) passed++; else failed++;
  if (await testEndpoint('Inbox Stats', '/api/inbox/stats')) passed++; else failed++;
  
  // Playbooks Tests
  console.log('\n📚 Playbooks');
  if (await testEndpoint('Playbooks List', '/api/playbooks')) passed++; else failed++;
  if (await testEndpoint('Template Playbooks', '/api/playbooks/templates')) passed++; else failed++;
  
  // Content Studio Tests
  console.log('\n✍️ Content Studio');
  if (await testEndpoint('Content Templates', '/api/content-templates')) passed++; else failed++;
  if (await testEndpoint('Personas', '/api/personas')) passed++; else failed++;
  
  // Email Coach Tests
  console.log('\n📧 Email Coach');
  if (await testEndpoint('Email Analysis', '/api/email-coach/analyze', 200, {
    method: 'POST',
    body: {
      subject: 'Important Meeting Tomorrow',
      content: 'Hi, I wanted to reach out about our meeting tomorrow. Looking forward to discussing the project.'
    }
  })) passed++; else failed++;
  
  // Multi-channel Tests
  console.log('\n🔀 Multi-channel');
  if (await testEndpoint('Channel Settings', '/api/settings/channels')) passed++; else failed++;
  if (await testEndpoint('Email Settings', '/api/settings/email')) passed++; else failed++;
  
  // AI Agents Tests
  console.log('\n🤖 AI Agents');
  if (await testEndpoint('AI Agents List', '/api/ai-agents')) passed++; else failed++;
  if (await testEndpoint('AI Agent Stats', '/api/ai-agents/stats')) passed++; else failed++;
  
  // Digital Twins Tests
  console.log('\n👥 Digital Twins');
  if (await testEndpoint('Digital Twins List', '/api/digital-twins')) passed++; else failed++;
  
  // SDR Teams Tests
  console.log('\n👨‍💼 SDR Teams');
  if (await testEndpoint('SDR Teams', '/api/sdr-teams')) passed++; else failed++;
  if (await testEndpoint('SDR Team Members', '/api/sdr-team-members')) passed++; else failed++;
  
  // Voice AI Tests
  console.log('\n🎙️ Voice AI');
  if (await testEndpoint('Voice Campaigns', '/api/voice-campaigns')) passed++; else failed++;
  if (await testEndpoint('Voice Scripts', '/api/voice-scripts')) passed++; else failed++;
  
  // Deal Intelligence Tests
  console.log('\n📊 Deal Intelligence');
  if (await testEndpoint('Deal Predictions', '/api/deal-predictions')) passed++; else failed++;
  if (await testEndpoint('Intent Signals', '/api/intent-signals')) passed++; else failed++;
  
  // Revenue Operations Tests
  console.log('\n💰 Revenue Operations');
  if (await testEndpoint('Pipeline Health', '/api/revenue-ops/pipeline-health')) passed++; else failed++;
  if (await testEndpoint('Deal Forensics', '/api/revenue-ops/deal-forensics')) passed++; else failed++;
  
  // Workflows Tests
  console.log('\n⚙️ Workflows');
  if (await testEndpoint('Workflows', '/api/workflows')) passed++; else failed++;
  if (await testEndpoint('Workflow Templates', '/api/workflow-templates')) passed++; else failed++;
  
  // Test Write Operations
  console.log('\n📝 Testing Write Operations');
  console.log('─'.repeat(50));
  
  // Test creating a contact
  if (await testEndpoint('Create Contact', '/api/contacts', 200, {
    method: 'POST',
    body: {
      firstName: 'E2E',
      lastName: 'Test',
      email: `e2e-${Date.now()}@test.com`,
      phone: '555-0100'
    }
  })) passed++; else failed++;
  
  // Test creating a company
  if (await testEndpoint('Create Company', '/api/companies', 200, {
    method: 'POST',
    body: {
      name: `E2E Test Company ${Date.now()}`,
      industry: 'Technology'
    }
  })) passed++; else failed++;
  
  // Test creating an AI agent
  if (await testEndpoint('Create AI Agent', '/api/ai-agents', 200, {
    method: 'POST',
    body: {
      name: `E2E Test Agent ${Date.now()}`,
      type: 'lead_scoring',
      status: 'active',
      configuration: {
        goal: 'Test goal'
      }
    }
  })) passed++; else failed++;
  
  // Results Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed} tests`);
  console.log(`❌ Failed: ${failed} tests`);
  const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The platform is working correctly.');
  } else if (successRate >= 80) {
    console.log('\n✨ Most features are working. Some endpoints may need attention.');
  } else if (successRate >= 50) {
    console.log('\n⚠️ Several features need fixing. Check the failed endpoints above.');
  } else {
    console.log('\n🚨 Many features are not working. Authentication or server issues may be present.');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});