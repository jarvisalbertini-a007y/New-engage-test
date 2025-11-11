import OpenAI from "openai";
import { storage } from "../storage";
import type { Workflow, WorkflowExecution, AgentType, HumanApproval } from "@shared/schema";

// Initialize OpenAI client (will use fallback if no API key)
let openaiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Parse natural language to workflow structure
export async function parseNLPToWorkflow(input: string): Promise<{ nodes: any[], edges: any[] }> {
  if (!openaiClient) {
    // Fallback parsing without OpenAI
    return fallbackNLPParser(input);
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a workflow builder assistant. Convert natural language descriptions into workflow nodes and edges.
          
          Available node types:
          - trigger: email_received, calendar_event, form_submission, webhook, schedule
          - agent: email_composer, data_researcher, lead_scorer, meeting_scheduler, content_creator
          - action: send_email, create_task, update_contact, send_slack, http_request
          - condition: if_else, wait
          
          Return a JSON object with:
          - nodes: array of {id, type, agentType, label, config, position: {x, y}}
          - edges: array of {id, source, target, label}
          
          Position nodes vertically starting at (100, 100) with 100px spacing.`
        },
        {
          role: "user",
          content: input
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("OpenAI parsing failed, using fallback:", error);
    return fallbackNLPParser(input);
  }
}

// Fallback parser when OpenAI is not available
function fallbackNLPParser(input: string): { nodes: any[], edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const lowerInput = input.toLowerCase();
  
  let currentY = 100;
  let lastNodeId: string | null = null;

  // Parse triggers
  if (lowerInput.includes('when') || lowerInput.includes('every')) {
    const triggerId = 'trigger-1';
    let triggerType = 'webhook';
    let label = 'Trigger';
    
    if (lowerInput.includes('email')) {
      triggerType = 'email_received';
      label = 'Email Received';
    } else if (lowerInput.includes('form')) {
      triggerType = 'form_submission';
      label = 'Form Submitted';
    } else if (lowerInput.includes('calendar') || lowerInput.includes('meeting')) {
      triggerType = 'calendar_event';
      label = 'Calendar Event';
    } else if (lowerInput.includes('morning') || lowerInput.includes('daily') || lowerInput.includes('hour')) {
      triggerType = 'schedule';
      label = 'Scheduled';
    }
    
    nodes.push({
      id: triggerId,
      type: 'trigger',
      agentType: triggerType,
      label,
      config: triggerType === 'schedule' ? { cron: '0 9 * * *' } : {},
      position: { x: 100, y: currentY }
    });
    
    lastNodeId = triggerId;
    currentY += 100;
  }

  // Parse research/enrichment
  if (lowerInput.includes('research') || lowerInput.includes('enrich') || lowerInput.includes('gather')) {
    const nodeId = `agent-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'agent',
      agentType: 'data-researcher-1',
      label: 'Research Data',
      config: {},
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse lead scoring
  if (lowerInput.includes('score') || lowerInput.includes('qualify') || lowerInput.includes('prioritize')) {
    const nodeId = `agent-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'agent',
      agentType: 'lead-scorer-1',
      label: 'Score Lead',
      config: {},
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse conditions
  if (lowerInput.includes('if') || lowerInput.includes('qualified') || lowerInput.includes('check')) {
    const nodeId = `condition-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'condition',
      agentType: 'if_else',
      label: 'Check Condition',
      config: { condition: 'score > 70' },
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse email sending
  if (lowerInput.includes('send') && lowerInput.includes('email')) {
    const nodeId = `action-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'action',
      agentType: 'send_email',
      label: 'Send Email',
      config: {},
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse task creation
  if (lowerInput.includes('task') || lowerInput.includes('follow') || lowerInput.includes('reminder')) {
    const nodeId = `action-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'action',
      agentType: 'create_task',
      label: 'Create Task',
      config: {},
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse Slack notifications
  if (lowerInput.includes('slack') || lowerInput.includes('notify')) {
    const nodeId = `action-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'action',
      agentType: 'send_slack',
      label: 'Send to Slack',
      config: {},
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  // Parse wait/delay
  if (lowerInput.includes('wait') || lowerInput.includes('delay') || lowerInput.includes('after')) {
    const nodeId = `condition-${nodes.length + 1}`;
    nodes.push({
      id: nodeId,
      type: 'condition',
      agentType: 'wait',
      label: 'Wait',
      config: { duration: 86400000 }, // 1 day in ms
      position: { x: 100, y: currentY }
    });
    
    if (lastNodeId) {
      edges.push({
        id: `edge-${edges.length + 1}`,
        source: lastNodeId,
        target: nodeId
      });
    }
    lastNodeId = nodeId;
    currentY += 100;
  }

  return { nodes, edges };
}

// Execute a workflow node with a specialist AI agent
export async function executeWorkflowNode(
  node: any,
  context: Record<string, any>,
  agentType?: AgentType
): Promise<{ success: boolean; output: any; requiresApproval?: boolean }> {
  
  // Check if human approval is required
  if (node.config?.requiresApproval) {
    return {
      success: true,
      output: context,
      requiresApproval: true
    };
  }

  switch (node.type) {
    case 'trigger':
      // Triggers don't execute, they just start the workflow
      return { success: true, output: context };

    case 'agent':
      return await executeAgentNode(node, context, agentType);

    case 'action':
      return await executeActionNode(node, context);

    case 'condition':
      return await executeConditionNode(node, context);

    default:
      return { success: false, output: { error: 'Unknown node type' } };
  }
}

// Execute specialist AI agent nodes
async function executeAgentNode(
  node: any,
  context: Record<string, any>,
  agentType?: AgentType
): Promise<{ success: boolean; output: any }> {
  
  if (!openaiClient) {
    // Fallback execution without OpenAI
    return executeFallbackAgent(node, context);
  }

  const systemPrompt = agentType?.systemPrompt || getDefaultAgentPrompt(node.agentType);
  const temperature = agentType?.temperature ? parseFloat(agentType.temperature) : 0.7;
  const maxTokens = agentType?.maxTokens ? Number(agentType.maxTokens) : 2000;

  try {
    const response = await openaiClient.chat.completions.create({
      model: agentType?.modelPreference || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(context) }
      ],
      temperature,
      max_tokens: maxTokens
    });

    const output = response.choices[0].message.content;
    
    // Try to parse as JSON if possible
    let parsedOutput = output;
    try {
      parsedOutput = JSON.parse(output || "{}");
    } catch {
      // Keep as string if not JSON
    }

    return {
      success: true,
      output: { ...context, agentOutput: parsedOutput }
    };
  } catch (error) {
    console.error("Agent execution failed:", error);
    return executeFallbackAgent(node, context);
  }
}

// Get default prompts for built-in agent types
function getDefaultAgentPrompt(agentType: string): string {
  // Map both formats (with and without suffix) to the same prompts
  const normalizedType = agentType.replace(/-\d+$/, '').replace(/-/g, '_');
  
  const prompts: Record<string, string> = {
    email_composer: `You are an email composition specialist. Create personalized, engaging emails based on the context provided. Return a JSON object with 'subject' and 'body' fields.`,
    
    data_researcher: `You are a data research specialist. Enrich the provided lead/company data with relevant information. Return a JSON object with enriched data fields.`,
    
    lead_scorer: `You are a lead scoring specialist. Analyze the provided lead data and assign a score from 0-100 based on fit and intent signals. Return a JSON object with 'score' and 'reasons' fields.`,
    
    meeting_scheduler: `You are a meeting scheduling specialist. Propose optimal meeting times based on availability and context. Return a JSON object with 'proposedTimes' array and 'meetingDetails'.`,
    
    content_creator: `You are a content creation specialist. Generate relevant content based on the context and requirements. Return a JSON object with 'title', 'content', and 'metadata' fields.`
  };

  return prompts[normalizedType] || "You are an AI assistant. Process the input and provide a helpful response.";
}

// Fallback agent execution without AI
function executeFallbackAgent(node: any, context: Record<string, any>): { success: boolean; output: any } {
  // Normalize agent type ID to match mock output keys
  const normalizedType = (node.agentType || '').replace(/-\d+$/, '').replace(/-/g, '_');
  
  const mockOutputs: Record<string, any> = {
    email_composer: {
      subject: "Following up on our conversation",
      body: "Hi there,\n\nI wanted to follow up on our previous discussion. Let me know if you have any questions.\n\nBest regards"
    },
    data_researcher: {
      enrichedData: {
        industry: "Technology",
        employeeCount: "50-100",
        fundingStage: "Series A",
        technologies: ["React", "Node.js", "PostgreSQL"]
      }
    },
    lead_scorer: {
      score: 75,
      reasons: ["High engagement", "Good company fit", "Budget available"]
    },
    meeting_scheduler: {
      proposedTimes: ["2024-01-15T14:00:00Z", "2024-01-16T10:00:00Z"],
      meetingDetails: "30-minute discovery call"
    },
    content_creator: {
      title: "5 Ways to Improve Your Sales Process",
      content: "Here are five proven strategies to enhance your sales effectiveness...",
      metadata: { wordCount: 500, readingTime: "2 minutes" }
    }
  };

  return {
    success: true,
    output: { ...context, agentOutput: mockOutputs[normalizedType] || {} }
  };
}

// Execute action nodes
async function executeActionNode(
  node: any,
  context: Record<string, any>
): Promise<{ success: boolean; output: any }> {
  
  switch (node.agentType) {
    case 'send_email':
      // In production, integrate with email service
      console.log("Sending email:", node.config);
      return {
        success: true,
        output: { ...context, emailSent: true, messageId: `msg-${Date.now()}` }
      };

    case 'create_task':
      // Create task in the database
      try {
        const task = await storage.createTask({
          type: node.config.type || "follow_up",
          title: node.config.title || "Follow-up task",
          description: node.config.description || "Created by workflow",
          priority: node.config.priority || "medium",
          status: "pending",
          assignedTo: node.config.assignedTo || context.userId
        });
        return {
          success: true,
          output: { ...context, taskCreated: true, taskId: task.id }
        };
      } catch (error) {
        return {
          success: false,
          output: { ...context, error: "Failed to create task" }
        };
      }

    case 'update_contact':
      // Update contact in the database
      if (context.contactId && node.config.updates) {
        try {
          await storage.updateContact(context.contactId, node.config.updates);
          return {
            success: true,
            output: { ...context, contactUpdated: true }
          };
        } catch (error) {
          return {
            success: false,
            output: { ...context, error: "Failed to update contact" }
          };
        }
      }
      return {
        success: false,
        output: { ...context, error: "No contact ID or updates provided" }
      };

    case 'send_slack':
      // In production, integrate with Slack API
      console.log("Sending to Slack:", node.config);
      return {
        success: true,
        output: { ...context, slackSent: true }
      };

    case 'http_request':
      // Make HTTP request
      try {
        const response = await fetch(node.config.url, {
          method: node.config.method || 'POST',
          headers: node.config.headers || { 'Content-Type': 'application/json' },
          body: JSON.stringify(node.config.body || context)
        });
        const data = await response.json();
        return {
          success: response.ok,
          output: { ...context, httpResponse: data }
        };
      } catch (error) {
        return {
          success: false,
          output: { ...context, error: "HTTP request failed" }
        };
      }

    default:
      return {
        success: false,
        output: { ...context, error: "Unknown action type" }
      };
  }
}

// Execute condition nodes
async function executeConditionNode(
  node: any,
  context: Record<string, any>
): Promise<{ success: boolean; output: any }> {
  
  switch (node.agentType) {
    case 'if_else':
      // Evaluate condition
      const condition = node.config.condition || 'true';
      let result = false;
      
      try {
        // Simple condition evaluation (in production, use a safe evaluator)
        if (condition.includes('>')) {
          const [left, right] = condition.split('>').map((s: string) => s.trim());
          const leftValue = context[left] || parseInt(left);
          const rightValue = context[right] || parseInt(right);
          result = leftValue > rightValue;
        } else if (condition.includes('<')) {
          const [left, right] = condition.split('<').map((s: string) => s.trim());
          const leftValue = context[left] || parseInt(left);
          const rightValue = context[right] || parseInt(right);
          result = leftValue < rightValue;
        } else if (condition.includes('==')) {
          const [left, right] = condition.split('==').map((s: string) => s.trim());
          const leftValue = context[left] || left;
          const rightValue = context[right] || right;
          result = leftValue == rightValue;
        } else {
          result = condition === 'true';
        }
      } catch (error) {
        console.error("Condition evaluation failed:", error);
        result = false;
      }

      return {
        success: true,
        output: { ...context, conditionResult: result }
      };

    case 'wait':
      // In production, this would schedule a delayed execution
      const duration = node.config.duration || 0;
      console.log(`Waiting for ${duration}ms`);
      return {
        success: true,
        output: { ...context, waitCompleted: true, duration }
      };

    default:
      return {
        success: false,
        output: { ...context, error: "Unknown condition type" }
      };
  }
}

// Execute a complete workflow
export async function executeWorkflow(
  workflowId: string,
  initialContext: Record<string, any> = {}
): Promise<WorkflowExecution> {
  
  // Get the workflow
  const workflow = await storage.getWorkflow(workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Create execution record
  const execution = await storage.createWorkflowExecution({
    workflowId,
    status: 'running',
    context: initialContext,
    currentNodeId: null
  });

  try {
    const nodes = workflow.nodes as any[] || [];
    const edges = workflow.edges as any[] || [];
    let context = { ...initialContext };

    // Find the starting node (usually a trigger)
    const startNode = nodes.find(n => n.type === 'trigger') || nodes[0];
    if (!startNode) {
      throw new Error("No starting node found");
    }

    // Execute nodes in sequence following edges
    let currentNode = startNode;
    const visitedNodes = new Set<string>();

    while (currentNode) {
      if (visitedNodes.has(currentNode.id)) {
        console.warn("Circular reference detected, breaking loop");
        break;
      }
      visitedNodes.add(currentNode.id);

      // Update execution with current node
      await storage.updateWorkflowExecution(execution.id, {
        currentNodeId: currentNode.id
      });

      // Get agent type if it's an agent node
      let agentType: AgentType | undefined;
      if (currentNode.type === 'agent' && currentNode.agentType) {
        agentType = await storage.getAgentType(currentNode.agentType);
        if (!agentType) {
          console.warn(`Agent type ${currentNode.agentType} not found, using default configuration`);
          // Continue with undefined agentType - will use fallback
        }
      }

      // Execute the node
      const result = await executeWorkflowNode(currentNode, context, agentType);
      
      if (!result.success) {
        throw new Error(`Node ${currentNode.id} failed: ${result.output.error}`);
      }

      // Check if human approval is required
      if (result.requiresApproval) {
        // Create approval request
        await storage.createHumanApproval({
          executionId: execution.id,
          nodeId: currentNode.id,
          requestData: context,
          status: 'pending'
        });

        // Pause execution
        await storage.updateWorkflowExecution(execution.id, {
          status: 'paused',
          context: result.output,
          error: null
        });

        return await storage.getWorkflowExecution(execution.id) as WorkflowExecution;
      }

      context = result.output;

      // Find next node based on edges
      const nextEdge = edges.find(e => e.source === currentNode.id);
      
      // Handle conditional branching
      if (currentNode.type === 'condition' && currentNode.agentType === 'if_else') {
        const conditionResult = context.conditionResult;
        const trueEdge = edges.find(e => e.source === currentNode.id && e.label === 'true');
        const falseEdge = edges.find(e => e.source === currentNode.id && e.label === 'false');
        
        if (conditionResult && trueEdge) {
          currentNode = nodes.find(n => n.id === trueEdge.target);
        } else if (!conditionResult && falseEdge) {
          currentNode = nodes.find(n => n.id === falseEdge.target);
        } else if (nextEdge) {
          currentNode = nodes.find(n => n.id === nextEdge.target);
        } else {
          currentNode = null;
        }
      } else if (nextEdge) {
        currentNode = nodes.find(n => n.id === nextEdge.target);
      } else {
        currentNode = null;
      }
    }

    // Mark execution as completed
    await storage.updateWorkflowExecution(execution.id, {
      status: 'completed',
      context,
      completedAt: new Date(),
      error: null
    });

    return await storage.getWorkflowExecution(execution.id) as WorkflowExecution;
  } catch (error) {
    // Mark execution as failed
    await storage.updateWorkflowExecution(execution.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date()
    });

    throw error;
  }
}

// Resume a paused workflow after human approval
export async function resumeWorkflow(
  executionId: string,
  approvalId: string,
  approved: boolean,
  feedback?: string
): Promise<WorkflowExecution> {
  
  // Update approval
  await storage.updateHumanApproval(approvalId, {
    status: approved ? 'approved' : 'rejected',
    approvedBy: 'user', // In production, get from auth context
    respondedAt: new Date(),
    approverNotes: feedback
  });

  if (!approved) {
    // If not approved, mark execution as cancelled
    await storage.updateWorkflowExecution(executionId, {
      status: 'cancelled',
      error: 'Human approval rejected',
      completedAt: new Date()
    });
    
    return await storage.getWorkflowExecution(executionId) as WorkflowExecution;
  }

  // Resume execution from where it left off
  const execution = await storage.getWorkflowExecution(executionId);
  if (!execution) {
    throw new Error("Execution not found");
  }

  // Continue workflow execution
  // In production, this would queue the workflow to continue from the current node
  await storage.updateWorkflowExecution(executionId, {
    status: 'running'
  });

  // For now, just mark as completed
  await storage.updateWorkflowExecution(executionId, {
    status: 'completed',
    completedAt: new Date()
  });

  return await storage.getWorkflowExecution(executionId) as WorkflowExecution;
}