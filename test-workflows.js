// Comprehensive Workflow Automation Test Script
// Run this in the browser console after logging into the application

async function runWorkflowTests() {
  console.log('🚀 Starting Workflow Automation Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Helper function to test API endpoint
  async function testAPI(name, method, url, body = null) {
    console.log(`Testing: ${name}`);
    try {
      const options = {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : {}
      };
      if (body) options.body = JSON.stringify(body);
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) throw new Error(`Status ${response.status}: ${JSON.stringify(data)}`);
      
      console.log(`✅ PASSED: ${name}`);
      console.log('Response:', data);
      results.passed++;
      results.tests.push({ name, status: 'passed', data });
      return data;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error('Error:', error.message);
      results.failed++;
      results.tests.push({ name, status: 'failed', error: error.message });
      return null;
    }
  }
  
  // Test 1: Get Workflow Templates
  console.log('\n=== TEST 1: Workflow Templates ===');
  const templates = await testAPI(
    'Get workflow templates',
    'GET',
    '/api/workflow-templates'
  );
  if (templates && templates.length >= 5) {
    console.log(`✅ Found ${templates.length} templates (expected at least 5)`);
    console.log('Templates:', templates.map(t => t.name));
  } else {
    console.log(`❌ Template count issue: found ${templates?.length || 0}`);
  }
  
  // Test 2: Get Agent Types
  console.log('\n=== TEST 2: Agent Types ===');
  const agentTypes = await testAPI(
    'Get agent types',
    'GET',
    '/api/agent-types'
  );
  if (agentTypes && agentTypes.length >= 5) {
    console.log(`✅ Found ${agentTypes.length} agent types (expected at least 5)`);
    console.log('Agent Types:', agentTypes.map(a => ({ 
      id: a.id, 
      name: a.name, 
      successRate: a.successRate 
    })));
  } else {
    console.log(`❌ Agent type count issue: found ${agentTypes?.length || 0}`);
  }
  
  // Test 3: NLP Parser - Simple Workflow
  console.log('\n=== TEST 3: NLP Parser - Simple Workflow ===');
  const nlpSimple = await testAPI(
    'Parse simple NLP workflow',
    'POST',
    '/api/workflows/parse-nlp',
    { input: 'When a new lead comes in, score them and send an email' }
  );
  if (nlpSimple?.nodes && nlpSimple?.edges) {
    console.log(`✅ Created workflow with ${nlpSimple.nodes.length} nodes and ${nlpSimple.edges.length} edges`);
    console.log('Node types:', nlpSimple.nodes.map(n => n.type));
  }
  
  // Test 4: NLP Parser - Complex Workflow
  console.log('\n=== TEST 4: NLP Parser - Complex Workflow ===');
  const nlpComplex = await testAPI(
    'Parse complex NLP workflow',
    'POST',
    '/api/workflows/parse-nlp',
    { 
      input: 'Every morning at 9am, check for stale deals older than 30 days, research the companies, and if they are still active, send a follow-up email and create a task for the sales rep'
    }
  );
  if (nlpComplex?.nodes && nlpComplex?.edges) {
    console.log(`✅ Created workflow with ${nlpComplex.nodes.length} nodes and ${nlpComplex.edges.length} edges`);
    const nodeTypes = {};
    nlpComplex.nodes.forEach(n => {
      nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
    });
    console.log('Node breakdown:', nodeTypes);
  }
  
  // Test 5: Create Workflow
  console.log('\n=== TEST 5: Create Workflow ===');
  const testWorkflow = await testAPI(
    'Create test workflow',
    'POST',
    '/api/workflows',
    {
      name: `Test Workflow ${Date.now()}`,
      description: 'Automated test workflow',
      status: 'draft',
      category: 'sales',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          agentType: 'webhook',
          label: 'Webhook Trigger',
          config: { url: '/test-webhook' },
          position: { x: 100, y: 100 }
        },
        {
          id: 'agent-1',
          type: 'agent',
          agentType: 'lead-scorer-1',
          label: 'Score Lead',
          config: {},
          position: { x: 300, y: 100 }
        },
        {
          id: 'action-1',
          type: 'action',
          agentType: 'send-email',
          label: 'Send Email',
          config: { template: 'welcome' },
          position: { x: 500, y: 100 }
        }
      ],
      edges: [
        { source: 'trigger-1', target: 'agent-1' },
        { source: 'agent-1', target: 'action-1' }
      ]
    }
  );
  
  // Test 6: Get All Workflows
  console.log('\n=== TEST 6: Get All Workflows ===');
  const allWorkflows = await testAPI(
    'Get all workflows',
    'GET',
    '/api/workflows'
  );
  if (allWorkflows && allWorkflows.length > 0) {
    console.log(`✅ Found ${allWorkflows.length} workflows`);
    console.log('Workflow names:', allWorkflows.map(w => w.name));
  }
  
  // Test 7: Update Workflow (if we created one)
  if (testWorkflow?.id) {
    console.log('\n=== TEST 7: Update Workflow ===');
    const updatedWorkflow = await testAPI(
      'Update workflow',
      'PATCH',
      `/api/workflows/${testWorkflow.id}`,
      {
        name: `Updated Test Workflow ${Date.now()}`,
        status: 'active'
      }
    );
  }
  
  // Test 8: Create Workflow Execution
  if (testWorkflow?.id) {
    console.log('\n=== TEST 8: Create Workflow Execution ===');
    const execution = await testAPI(
      'Create workflow execution',
      'POST',
      '/api/workflow-executions',
      {
        workflowId: testWorkflow.id,
        status: 'pending',
        context: { test: true, timestamp: Date.now() }
      }
    );
    
    // Test 9: Execute Workflow
    console.log('\n=== TEST 9: Execute Workflow ===');
    const executeResult = await testAPI(
      'Execute workflow',
      'POST',
      `/api/workflows/${testWorkflow.id}/execute`,
      { context: { leadId: 'test-lead-123' } }
    );
  }
  
  // Test 10: Get Human Approvals
  console.log('\n=== TEST 10: Get Human Approvals ===');
  const approvals = await testAPI(
    'Get human approvals',
    'GET',
    '/api/human-approvals'
  );
  
  // Test Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  console.log('\n📝 Detailed Results:');
  results.tests.forEach(test => {
    console.log(`- ${test.status === 'passed' ? '✅' : '❌'} ${test.name}`);
  });
  
  return results;
}

// UI Navigation Tests
async function testWorkflowUI() {
  console.log('\n🎨 Starting UI Tests...\n');
  
  console.log('Please perform these manual UI tests:');
  console.log('1. Navigate to Workflow Builder from sidebar');
  console.log('2. Enter NLP text: "When a new lead comes in, score them and send email"');
  console.log('3. Click "Create Workflow" - verify nodes appear');
  console.log('4. Click "Browse Templates" - verify 5 templates show');
  console.log('5. Click a template - verify it loads to canvas');
  console.log('6. Drag an agent from palette to canvas');
  console.log('7. Click on a node - verify config panel opens');
  console.log('8. Connect two nodes by dragging from handle to handle');
  console.log('9. Save the workflow - verify success message');
  console.log('10. Refresh page - verify saved workflow appears in sidebar');
}

// Run all tests
console.log('🎯 Workflow Automation Test Suite');
console.log('=====================================');
console.log('Run: runWorkflowTests() for API tests');
console.log('Run: testWorkflowUI() for UI test guide');
console.log('=====================================');

// Auto-run API tests
runWorkflowTests().then(results => {
  console.log('\n✨ Tests Complete! Check results above.');
  window.testResults = results;
  console.log('Results saved to window.testResults');
});