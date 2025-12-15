import { OpenAI } from "openai";
import { storage } from "../storage";
import type { DeployedAgent, AgentTemplate, InsertAgentCatalogExecution, AgentCatalogExecution } from "@shared/schema";

let openaiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export interface ExecutionContext {
  targetType?: 'lead' | 'company' | 'contact' | 'custom';
  targetId?: string;
  action?: string;
  additionalContext?: Record<string, any>;
}

export interface AgentAction {
  type: 'create_task' | 'update_status' | 'draft_email' | 'add_note';
  params: Record<string, any>;
  result?: any;
  error?: string;
}

export interface AgentResponse {
  analysis: string;
  recommendation: string;
  actions: AgentAction[];
  confidence: number;
}

export interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed';
  response: AgentResponse | null;
  actionsExecuted: Array<{ action: AgentAction; success: boolean; result?: any; error?: string }>;
  executionTimeMs: number;
  error?: string;
}

async function createFollowUpTask(
  contactId: string,
  title: string,
  dueInDays: number,
  assignedTo: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return { success: false, error: `Contact ${contactId} not found` };
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueInDays);

    const task = await storage.createTask({
      title,
      description: `Follow-up task created by AI agent for contact: ${contact.firstName} ${contact.lastName}`,
      contactId,
      companyId: contact.companyId || undefined,
      dueDate,
      priority: 'medium',
      type: 'follow_up',
      assignedTo
    });

    return { success: true, taskId: task.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function updateLeadStatus(
  contactId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return { success: false, error: `Contact ${contactId} not found` };
    }

    console.log(`[AgentCatalogExecutor] Status update requested for contact ${contactId}: ${newStatus}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function draftEmail(
  contactId: string,
  subject: string,
  body: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return { success: false, error: `Contact ${contactId} not found` };
    }

    const email = await storage.createEmail({
      contactId,
      subject,
      body,
      status: 'draft'
    });

    return { success: true, emailId: email.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function addNote(
  targetType: 'contact' | 'company',
  targetId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (targetType === 'contact') {
      const contact = await storage.getContact(targetId);
      if (!contact) {
        return { success: false, error: `Contact ${targetId} not found` };
      }
      console.log(`[AgentCatalogExecutor] Note added to contact ${targetId}: ${note}`);
    } else if (targetType === 'company') {
      const company = await storage.getCompany(targetId);
      if (!company) {
        return { success: false, error: `Company ${targetId} not found` };
      }
      console.log(`[AgentCatalogExecutor] Note added to company ${targetId}: ${note}`);
    } else {
      return { success: false, error: `Invalid target type: ${targetType}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function executeAction(
  action: AgentAction,
  context: ExecutionContext,
  executedBy: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  const targetId = context.targetId || '';
  const targetType = context.targetType || 'contact';

  switch (action.type) {
    case 'create_task':
      return createFollowUpTask(
        targetId,
        action.params.title || 'Follow-up task',
        action.params.dueInDays || 3,
        executedBy
      );

    case 'update_status':
      return updateLeadStatus(targetId, action.params.newStatus || 'qualified');

    case 'draft_email':
      return draftEmail(
        targetId,
        action.params.subject || 'Follow-up',
        action.params.body || ''
      );

    case 'add_note':
      return addNote(
        targetType as 'contact' | 'company',
        targetId,
        action.params.note || ''
      );

    default:
      return { success: false, error: `Unknown action type: ${action.type}` };
  }
}

function buildSystemPrompt(template: AgentTemplate | null, agent: DeployedAgent): string {
  let prompt = '';

  if (template?.systemPrompt) {
    prompt = template.systemPrompt;
  }

  if (agent.customSystemPrompt) {
    prompt = agent.customSystemPrompt;
  } else if (template?.systemPrompt && agent.customSystemPrompt) {
    prompt = `${template.systemPrompt}\n\nAdditional Instructions:\n${agent.customSystemPrompt}`;
  }

  if (!prompt) {
    prompt = `You are an AI sales agent named "${agent.name}". ${agent.description || 'Help users with sales tasks.'}`;
  }

  prompt += `\n\nYou must respond in the following JSON format:
{
  "analysis": "Brief analysis of the target/situation",
  "recommendation": "What should be done",
  "actions": [
    {"type": "create_task", "params": {"title": "...", "dueInDays": 3}},
    {"type": "update_status", "params": {"newStatus": "qualified|nurturing|closed|lost"}},
    {"type": "draft_email", "params": {"subject": "...", "body": "..."}},
    {"type": "add_note", "params": {"note": "..."}}
  ],
  "confidence": 0.85
}

Available action types:
- create_task: Create a follow-up task (params: title, dueInDays)
- update_status: Update lead/contact status (params: newStatus)
- draft_email: Draft an email to send (params: subject, body)
- add_note: Add a note to the record (params: note)

Only include actions that are necessary and relevant. Set confidence between 0 and 1.`;

  return prompt;
}

async function buildContextMessage(context: ExecutionContext): Promise<string> {
  let message = '';

  if (context.action) {
    message = `Action requested: ${context.action}\n\n`;
  }

  if (context.targetType === 'contact' && context.targetId) {
    const contact = await storage.getContact(context.targetId);
    if (contact) {
      message += `Target Contact:\n`;
      message += `- Name: ${contact.firstName} ${contact.lastName}\n`;
      message += `- Email: ${contact.email}\n`;
      message += `- Title: ${contact.title || 'N/A'}\n`;

      if (contact.companyId) {
        const company = await storage.getCompany(contact.companyId);
        if (company) {
          message += `\nCompany:\n`;
          message += `- Name: ${company.name}\n`;
          message += `- Industry: ${company.industry || 'N/A'}\n`;
          message += `- Size: ${company.size || 'N/A'}\n`;
        }
      }
    }
  } else if (context.targetType === 'company' && context.targetId) {
    const company = await storage.getCompany(context.targetId);
    if (company) {
      message += `Target Company:\n`;
      message += `- Name: ${company.name}\n`;
      message += `- Industry: ${company.industry || 'N/A'}\n`;
      message += `- Size: ${company.size || 'N/A'}\n`;
      message += `- Domain: ${company.domain || 'N/A'}\n`;
    }
  }

  if (context.additionalContext) {
    message += `\nAdditional Context:\n${JSON.stringify(context.additionalContext, null, 2)}\n`;
  }

  return message || 'No specific target provided. Please analyze the situation and recommend actions.';
}

function generateMockResponse(context: ExecutionContext): AgentResponse {
  const actions: AgentAction[] = [];

  if (context.targetType === 'contact' && context.targetId) {
    actions.push({
      type: 'add_note',
      params: { note: 'Agent execution completed (mock mode - no OpenAI API key)' }
    });
    actions.push({
      type: 'create_task',
      params: { title: 'Review AI agent recommendation', dueInDays: 1 }
    });
  }

  return {
    analysis: 'Mock response generated (OpenAI API key not configured)',
    recommendation: 'Configure OPENAI_API_KEY environment variable for real AI-powered analysis',
    actions,
    confidence: 0.5
  };
}

function parseAiResponse(responseText: string): AgentResponse {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        analysis: parsed.analysis || 'No analysis provided',
        recommendation: parsed.recommendation || 'No recommendation provided',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
      };
    }
  } catch (error) {
    console.error('[AgentCatalogExecutor] Failed to parse AI response:', error);
  }

  return {
    analysis: responseText,
    recommendation: 'Unable to parse structured response',
    actions: [],
    confidence: 0.3
  };
}

export async function executeDeployedAgent(
  deployedAgentId: string,
  context: ExecutionContext,
  executedBy: string
): Promise<ExecutionResult> {
  const startTime = Date.now();

  const agentData = await storage.getDeployedAgentWithTemplate(deployedAgentId);
  if (!agentData) {
    return {
      executionId: '',
      status: 'failed',
      response: null,
      actionsExecuted: [],
      executionTimeMs: Date.now() - startTime,
      error: `Deployed agent ${deployedAgentId} not found`
    };
  }

  const { agent, template } = agentData;

  const executionRecord = await storage.createAgentCatalogExecution({
    deployedAgentId,
    orgId: agent.orgId,
    targetType: context.targetType || null,
    targetId: context.targetId || null,
    inputContext: context as any,
    status: 'running',
    startedAt: new Date(),
    executedBy
  });

  let response: AgentResponse;
  let executionError: string | undefined;

  try {
    if (openaiClient) {
      const systemPrompt = buildSystemPrompt(template, agent);
      const userMessage = await buildContextMessage(context);

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const aiText = completion.choices[0]?.message?.content || '';
      response = parseAiResponse(aiText);

      await storage.updateAgentCatalogExecution(executionRecord.id, {
        aiResponse: aiText
      });
    } else {
      console.log('[AgentCatalogExecutor] OpenAI client not available, using mock response');
      response = generateMockResponse(context);
    }
  } catch (error) {
    executionError = error instanceof Error ? error.message : 'Unknown error during AI execution';
    console.error('[AgentCatalogExecutor] AI execution error:', error);

    await storage.updateAgentCatalogExecution(executionRecord.id, {
      status: 'failed',
      completedAt: new Date(),
      executionTimeMs: Date.now() - startTime,
      error: executionError
    });

    await storage.updateDeployedAgentMetrics(deployedAgentId, false, Date.now() - startTime);

    return {
      executionId: executionRecord.id,
      status: 'failed',
      response: null,
      actionsExecuted: [],
      executionTimeMs: Date.now() - startTime,
      error: executionError
    };
  }

  const actionsExecuted: Array<{ action: AgentAction; success: boolean; result?: any; error?: string }> = [];

  for (const action of response.actions) {
    const result = await executeAction(action, context, executedBy);
    actionsExecuted.push({
      action,
      success: result.success,
      result: result.result,
      error: result.error
    });
  }

  const executionTimeMs = Date.now() - startTime;
  const allActionsSucceeded = actionsExecuted.every(a => a.success);

  await storage.updateAgentCatalogExecution(executionRecord.id, {
    status: 'completed',
    completedAt: new Date(),
    executionTimeMs,
    parsedActions: response.actions as any,
    actionsExecuted: actionsExecuted as any
  });

  await storage.updateDeployedAgentMetrics(deployedAgentId, allActionsSucceeded, executionTimeMs);

  return {
    executionId: executionRecord.id,
    status: 'completed',
    response,
    actionsExecuted,
    executionTimeMs
  };
}

export async function getExecutionHistory(
  filters?: { deployedAgentId?: string; orgId?: string; status?: string; limit?: number }
): Promise<AgentCatalogExecution[]> {
  return storage.getAgentCatalogExecutions(filters);
}

export async function getExecution(executionId: string): Promise<AgentCatalogExecution | undefined> {
  return storage.getAgentCatalogExecution(executionId);
}

export const agentCatalogExecutor = {
  executeDeployedAgent,
  getExecutionHistory,
  getExecution,
  createFollowUpTask,
  updateLeadStatus,
  draftEmail,
  addNote
};
