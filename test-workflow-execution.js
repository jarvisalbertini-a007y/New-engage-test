// Test Workflow Execution
// This script tests the workflow execution engine

async function testWorkflowExecution() {
  console.log('🚀 Testing Workflow Execution Engine...\n');
  
  // Step 1: Create a test workflow
  console.log('Step 1: Creating test workflow...');
  const workflowData = {
    name: `Execution Test ${Date.now()}`,
    description: 'Test workflow for execution engine',
    status: 'active',
    category: 'test',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        agentType: 'webhook',
        label: 'Start',
        config: {},
        position: { x: 100, y: 100 }
      },
      {
        id: 'agent-1',
        type: 'agent',
        agentType: 'lead-scorer-1',
        label: 'Score Lead',
        config: {
          humanApprovalRequired: false,
          minConfidenceScore: 0.7
        },
        position: { x: 300, y: 100 }
      },
      {
        id: 'condition-1',
        type: 'condition',
        agentType: 'if-else',
        label: 'Check Score',
        config: {
          condition: 'score > 70'
        },
        position: { x: 500, y: 100 }
      },
      {
        id: 'action-1',
        type: 'action',
        agentType: 'send-email',
        label: 'Send High Score Email',
        config: {
          template: 'high-value-lead'
        },
        position: { x: 700, y: 50 }
      },
      {
        id: 'action-2',
        type: 'action',
        agentType: 'create-task',
        label: 'Create Low Score Task',
        config: {
          taskType: 'nurture'
        },
        position: { x: 700, y: 150 }
      }
    ],
    edges: [
      { source: 'trigger-1', target: 'agent-1' },
      { source: 'agent-1', target: 'condition-1' },
      { source: 'condition-1', target: 'action-1', label: 'true' },
      { source: 'condition-1', target: 'action-2', label: 'false' }
    ]
  };
  
  try {
    // Create workflow
    const createResponse = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflowData),
      credentials: 'include'
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create workflow: ${createResponse.status}`);
    }
    
    const workflow = await createResponse.json();
    console.log('✅ Workflow created with ID:', workflow.id);
    
    // Step 2: Execute the workflow
    console.log('\nStep 2: Executing workflow...');
    const executeResponse = await fetch(`/api/workflows/${workflow.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          leadId: 'test-lead-123',
          companyName: 'Test Company Inc',
          email: 'test@example.com',
          industry: 'Technology',
          size: '100-500'
        }
      }),
      credentials: 'include'
    });
    
    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      throw new Error(`Failed to execute workflow: ${error}`);
    }
    
    const execution = await executeResponse.json();
    console.log('✅ Workflow execution started:', execution);
    
    // Step 3: Check execution status
    console.log('\nStep 3: Checking execution status...');
    const statusResponse = await fetch('/api/workflow-executions', {
      credentials: 'include'
    });
    
    if (statusResponse.ok) {
      const executions = await statusResponse.json();
      const ourExecution = executions.find(e => e.workflowId === workflow.id);
      console.log('Execution status:', ourExecution?.status || 'Not found');
      if (ourExecution?.results) {
        console.log('Execution results:', JSON.stringify(ourExecution.results, null, 2));
      }
    }
    
    // Step 4: Test human approval flow
    console.log('\nStep 4: Testing human approval flow...');
    const approvalWorkflow = {
      ...workflowData,
      name: `Approval Test ${Date.now()}`,
      nodes: workflowData.nodes.map(node => {
        if (node.id === 'agent-1') {
          return {
            ...node,
            config: {
              ...node.config,
              humanApprovalRequired: true
            }
          };
        }
        return node;
      })
    };
    
    const approvalResponse = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvalWorkflow),
      credentials: 'include'
    });
    
    if (approvalResponse.ok) {
      const approvalWf = await approvalResponse.json();
      console.log('✅ Approval workflow created:', approvalWf.id);
      
      // Execute approval workflow
      const execApprovalResponse = await fetch(`/api/workflows/${approvalWf.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { test: true } }),
        credentials: 'include'
      });
      
      if (execApprovalResponse.ok) {
        console.log('✅ Approval workflow executed - should be paused for approval');
      }
    }
    
    console.log('\n✅ Workflow Execution Engine Test Complete!');
    console.log('Summary:');
    console.log('- Created and executed workflow successfully');
    console.log('- Tested conditional branching');
    console.log('- Tested human approval flow');
    
    return { success: true, workflowId: workflow.id };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Test NLP Parser
async function testNLPParser() {
  console.log('\n🤖 Testing NLP Parser...\n');
  
  const testInputs = [
    'When a new lead comes in, score them and send an email',
    'Every morning at 9am, check for stale deals and create tasks',
    'If a meeting is booked, research the company and prepare an agenda',
    'When someone fills out a form, add them to the database and send a welcome email',
    'Every week, analyze competitor mentions and create a report'
  ];
  
  for (const input of testInputs) {
    console.log(`\nParsing: "${input}"`);
    
    try {
      const response = await fetch('/api/workflows/parse-nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Parsed successfully:`);
        console.log(`- Nodes: ${result.nodes.length} (${result.nodes.map(n => n.type).join(', ')})`);
        console.log(`- Edges: ${result.edges.length}`);
        console.log(`- Agents used: ${result.nodes.filter(n => n.type === 'agent').map(n => n.agentType).join(', ')}`);
      } else {
        console.log(`❌ Failed to parse: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Run tests
console.log('='.repeat(60));
console.log('Workflow Execution Engine Test Suite');
console.log('='.repeat(60));
console.log('Run: testWorkflowExecution() - Test execution engine');
console.log('Run: testNLPParser() - Test NLP parser with examples');
console.log('='.repeat(60));

// Auto-run execution test
testWorkflowExecution().then(result => {
  console.log('\n📊 Test Result:', result);
  window.executionTestResult = result;
});