#!/usr/bin/env node

/**
 * End-to-End Test Script for AI Sales Platform
 * This script tests all major features with authentication bypassed
 */

import { spawn } from 'child_process';
import http from 'http';

// Set test environment variables
process.env.AUTH_TEST_BYPASS = 'true';
process.env.NODE_ENV = 'test';
process.env.PORT = '5555'; // Use different port for testing

console.log('🧪 Starting E2E Test Suite with Authentication Bypass...\n');

// Start the server with auth bypass
const serverProcess = spawn('npm', ['run', 'dev'], {
  env: {
    ...process.env,
    AUTH_TEST_BYPASS: 'true',
    NODE_ENV: 'test',
    PORT: '5555'
  },
  stdio: 'pipe'
});

let serverReady = false;

// Monitor server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('serving on port') || output.includes('ready') || output.includes('Local:')) {
    serverReady = true;
    console.log('✅ Server started with auth bypass enabled\n');
    // Start tests after a short delay
    setTimeout(runTests, 3000);
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Test functions
async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5555,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
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
    if (response.status === expectedStatus) {
      console.log(`✅ ${name}: ${path} - Status ${response.status}`);
      if (response.data && Array.isArray(response.data)) {
        console.log(`   → Returned ${response.data.length} items`);
      }
      return true;
    } else {
      console.log(`❌ ${name}: ${path} - Expected ${expectedStatus}, got ${response.status}`);
      if (response.data?.error) {
        console.log(`   → Error: ${response.data.error}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${path} - Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔍 Testing API Endpoints...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test core feature endpoints
  const tests = [
    // Dashboard & Core
    { name: 'Dashboard Metrics', path: '/api/dashboard/metrics' },
    { name: 'Dashboard Activities', path: '/api/dashboard/activities' },
    { name: 'Companies List', path: '/api/companies' },
    { name: 'Contacts List', path: '/api/contacts' },
    
    // Marketplace
    { name: 'Marketplace Agents', path: '/api/marketplace/agents' },
    { name: 'My Marketplace Agents', path: '/api/marketplace/my-agents' },
    
    // Insights Engine
    { name: 'Insights List', path: '/api/insights' },
    { name: 'Companies with Insights', path: '/api/companies?withInsights=true' },
    
    // Unified Inbox
    { name: 'Inbox Messages', path: '/api/inbox' },
    { name: 'Inbox Stats', path: '/api/inbox/stats' },
    
    // Playbooks
    { name: 'Playbooks List', path: '/api/playbooks' },
    { name: 'Template Playbooks', path: '/api/playbooks/templates' },
    
    // Content Studio
    { name: 'Content Templates', path: '/api/content-templates' },
    { name: 'Content Personas', path: '/api/personas' },
    
    // Email Coach
    { name: 'Email Analysis', path: '/api/email-coach/analyze', options: {
      method: 'POST',
      body: {
        subject: 'Test Subject',
        content: 'Test email content for analysis'
      }
    }},
    
    // Multi-channel
    { name: 'Channel Settings', path: '/api/settings/channels' },
    { name: 'Email Settings', path: '/api/settings/email' },
    
    // AI Agents
    { name: 'AI Agents List', path: '/api/ai-agents' },
    { name: 'AI Agent Stats', path: '/api/ai-agents/stats' },
    
    // Digital Twins
    { name: 'Digital Twins List', path: '/api/digital-twins' },
    
    // SDR Teams
    { name: 'SDR Teams List', path: '/api/sdr-teams' },
    { name: 'SDR Team Members', path: '/api/sdr-team-members' },
    
    // Voice AI
    { name: 'Voice Campaigns', path: '/api/voice-campaigns' },
    { name: 'Voice Scripts', path: '/api/voice-scripts' },
    
    // Deal Intelligence
    { name: 'Deal Predictions', path: '/api/deal-predictions' },
    { name: 'Intent Signals', path: '/api/intent-signals' },
    
    // Revenue Operations
    { name: 'Pipeline Health', path: '/api/revenue-ops/pipeline-health' },
    { name: 'Deal Forensics', path: '/api/revenue-ops/deal-forensics' },
    
    // Workflows
    { name: 'Workflows List', path: '/api/workflows' },
    { name: 'Workflow Templates', path: '/api/workflow-templates' },
    
    // Sequences
    { name: 'Sequences List', path: '/api/sequences' },
    
    // Tasks
    { name: 'Tasks List', path: '/api/tasks' },
  ];
  
  // Run all tests
  for (const test of tests) {
    const result = await testEndpoint(
      test.name, 
      test.path, 
      test.expectedStatus || 200,
      test.options || {}
    );
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  // Test specific functionality
  console.log('\n🔧 Testing Feature-Specific Operations...\n');
  
  // Test creating a contact
  try {
    const contact = await makeRequest('/api/contacts', {
      method: 'POST',
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-0100'
      }
    });
    console.log('✅ Contact Creation:', contact.status === 200 ? 'Success' : `Failed (${contact.status})`);
  } catch (error) {
    console.log('❌ Contact Creation: Error -', error.message);
  }
  
  // Test creating a company
  try {
    const company = await makeRequest('/api/companies', {
      method: 'POST',
      body: {
        name: 'Test Company',
        industry: 'Technology'
      }
    });
    console.log('✅ Company Creation:', company.status === 200 ? 'Success' : `Failed (${company.status})`);
  } catch (error) {
    console.log('❌ Company Creation: Error -', error.message);
  }
  
  // Test creating an AI agent
  try {
    const agent = await makeRequest('/api/ai-agents', {
      method: 'POST',
      body: {
        name: 'Test Agent',
        type: 'lead_scoring',
        status: 'active',
        configuration: {
          goal: 'Test goal'
        }
      }
    });
    console.log('✅ AI Agent Creation:', agent.status === 200 ? 'Success' : `Failed (${agent.status})`);
  } catch (error) {
    console.log('❌ AI Agent Creation: Error -', error.message);
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up...');
  serverProcess.kill();
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  serverProcess.kill();
  process.exit(1);
});

// Timeout handler
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server failed to start within timeout');
    serverProcess.kill();
    process.exit(1);
  }
}, 30000);