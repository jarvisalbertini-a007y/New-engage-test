import { generatePersonalizedEmail, generateInsightMessage } from "./openai";
import { storage } from "../storage";
import { type Persona, type Contact, type Company, type Insight } from "@shared/schema";

export interface ContentGenerationRequest {
  personaId?: string;
  contactId?: string;
  companyId?: string;
  insightId?: string;
  customPrompt?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'urgent';
  type: 'email' | 'linkedin' | 'cold_call_script';
}

export interface GeneratedContent {
  subject?: string;
  body: string;
  tone: string;
  personalizationElements: string[];
  confidence: number;
}

// Helper function to format value propositions as readable text
function formatValuePropositions(props: any): string {
  if (!props) return 'our AI-powered sales platform';
  
  if (Array.isArray(props)) {
    return props.length > 0 ? props.join(', ') : 'our solutions';
  } else if (typeof props === 'object') {
    const values = Object.values(props).filter(v => v);
    return values.length > 0 ? values.join(', ') : 'our solutions';
  } else if (typeof props === 'string') {
    return props;
  }
  
  return 'our AI-powered sales platform';
}

export async function generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
  // Get context data
  const persona = request.personaId ? (await storage.getPersona(request.personaId)) ?? null : null;
  const contact = request.contactId ? (await storage.getContact(request.contactId)) ?? null : null;
  const company = request.companyId ? (await storage.getCompany(request.companyId)) ?? null : null;
  const insight = request.insightId ? (await storage.getInsight(request.insightId)) ?? null : null;
  
  if (request.type === 'email') {
    return await generateEmailContent(request, persona, contact, company, insight);
  } else if (request.type === 'linkedin') {
    return await generateLinkedInContent(request, persona, contact, company, insight);
  } else if (request.type === 'cold_call_script') {
    return await generateCallScript(request, persona, contact, company, insight);
  }
  
  throw new Error('Unsupported content type');
}

async function generateEmailContent(
  request: ContentGenerationRequest,
  persona: Persona | null,
  contact: Contact | null,
  company: Company | null,
  insight: Insight | null
): Promise<GeneratedContent> {
  const context = {
    firstName: contact?.firstName || 'there',
    company: company?.name || 'your company',
    industry: company?.industry || undefined,
    title: contact?.title || undefined,
    insight: insight?.description,
    valueProposition: persona?.valuePropositions ? 
      formatValuePropositions(persona.valuePropositions) : 
      'our AI-powered sales platform that increases reply rates by 40%',
    tone: request.tone || 'professional'
  };
  
  const generated = await generatePersonalizedEmail(context);
  
  const personalizationElements = [];
  if (contact?.firstName) personalizationElements.push('First name');
  if (company?.name) personalizationElements.push('Company name');
  if (company?.industry) personalizationElements.push('Industry');
  if (contact?.title) personalizationElements.push('Job title');
  if (insight) personalizationElements.push('Recent insight');
  
  return {
    subject: generated.subject,
    body: generated.body,
    tone: request.tone || 'professional',
    personalizationElements,
    confidence: calculateConfidence(personalizationElements.length, !!persona, !!insight)
  };
}

async function generateLinkedInContent(
  request: ContentGenerationRequest,
  persona: Persona | null,
  contact: Contact | null,
  company: Company | null,
  insight: Insight | null
): Promise<GeneratedContent> {
  // LinkedIn messages are typically shorter and more casual
  const context = {
    firstName: contact?.firstName || 'there',
    company: company?.name || 'your company',
    industry: company?.industry || undefined,
    title: contact?.title || undefined,
    insight: insight?.description,
    valueProposition: persona?.valuePropositions ? 
      formatValuePropositions(persona.valuePropositions) : 
      'AI-powered sales automation',
    tone: 'friendly' // LinkedIn is generally more casual
  };
  
  const generated = await generatePersonalizedEmail(context);
  
  // Make LinkedIn message shorter and more conversational
  const linkedInBody = generated.body
    .split('\n')
    .slice(0, 3) // Keep first 3 paragraphs
    .join('\n')
    .replace(/Best regards,.*$/i, 'Would love to connect!')
    .replace(/Sincerely,.*$/i, 'Looking forward to hearing from you!');
  
  const personalizationElements = [];
  if (contact?.firstName) personalizationElements.push('First name');
  if (company?.name) personalizationElements.push('Company name');
  if (company?.industry) personalizationElements.push('Industry');
  if (contact?.title) personalizationElements.push('Job title');
  if (insight) personalizationElements.push('Recent insight');
  
  return {
    body: linkedInBody,
    tone: 'friendly',
    personalizationElements,
    confidence: calculateConfidence(personalizationElements.length, !!persona, !!insight)
  };
}

async function generateCallScript(
  request: ContentGenerationRequest,
  persona: Persona | null,
  contact: Contact | null,
  company: Company | null,
  insight: Insight | null
): Promise<GeneratedContent> {
  const companyName = company?.name || 'your company';
  const firstName = contact?.firstName || 'there';
  const title = contact?.title || 'decision maker';
  const insightText = insight?.description || '';
  
  const script = `Hi ${firstName}, this is [Your Name] from SalesAI Pro. 

I hope I'm not catching you at a bad time. I'm reaching out because I noticed ${companyName} has been ${insightText || 'growing rapidly in the ' + (company?.industry || 'industry')}.

We've been helping similar ${company?.industry || ''} companies like yours streamline their sales processes with AI-powered automation. In fact, our clients typically see a 40% increase in reply rates within the first month.

I know you're busy as ${title}, but I'd love to show you how this could specifically benefit ${companyName}. Do you have 15 minutes this week for a quick demo?

[PAUSE FOR RESPONSE]

Great! I have some time available [mention specific times]. What works better for you?

[HANDLE OBJECTIONS]
- If "not interested": I understand. May I ask what you're currently using for sales outreach?
- If "no time": No problem. Would a 5-minute overview via email work better?
- If "send info": Absolutely. What's the best email to send that to?

[CLOSING]
Perfect! I'll send you a calendar link and a brief overview of what we'll cover. Thanks for your time, ${firstName}!`;

  const personalizationElements = [];
  if (contact?.firstName) personalizationElements.push('First name');
  if (company?.name) personalizationElements.push('Company name');
  if (company?.industry) personalizationElements.push('Industry');
  if (contact?.title) personalizationElements.push('Job title');
  if (insight) personalizationElements.push('Recent insight');
  
  return {
    body: script,
    tone: request.tone || 'professional',
    personalizationElements,
    confidence: calculateConfidence(personalizationElements.length, !!persona, !!insight)
  };
}

function calculateConfidence(
  personalizationCount: number,
  hasPersona: boolean,
  hasInsight: boolean
): number {
  let confidence = 60; // Base confidence
  
  // Add points for personalization
  confidence += personalizationCount * 8;
  
  // Bonus for persona
  if (hasPersona) confidence += 15;
  
  // Bonus for recent insight
  if (hasInsight) confidence += 20;
  
  return Math.min(100, confidence);
}

export async function generateSequenceSteps(
  personaId: string,
  sequenceType: 'email_only' | 'multi_channel',
  stepCount: number = 5
): Promise<Array<{
  stepNumber: number;
  type: 'email' | 'linkedin' | 'phone' | 'wait';
  delay: number; // days
  subject?: string;
  template: string;
}>> {
  const persona = await storage.getPersona(personaId);
  if (!persona) throw new Error('Persona not found');
  
  const steps = [];
  
  for (let i = 1; i <= stepCount; i++) {
    if (sequenceType === 'email_only') {
      steps.push({
        stepNumber: i,
        type: 'email' as const,
        delay: i === 1 ? 0 : i * 3, // 0, 3, 6, 9, 12 days
        subject: `Email ${i} - ${persona.name} Sequence`,
        template: await generateStepTemplate(i, stepCount, persona, 'email')
      });
    } else {
      // Multi-channel sequence
      const stepType = getMultiChannelStepType(i);
      steps.push({
        stepNumber: i,
        type: stepType,
        delay: i === 1 ? 0 : i * 2, // 0, 2, 4, 6, 8 days
        subject: stepType === 'email' ? `${persona.name} - Follow up ${i}` : undefined,
        template: await generateStepTemplate(i, stepCount, persona, stepType)
      });
    }
  }
  
  return steps;
}

function getMultiChannelStepType(stepNumber: number): 'email' | 'linkedin' | 'phone' | 'wait' {
  const pattern = ['email', 'linkedin', 'email', 'phone', 'email'];
  return pattern[stepNumber - 1] as 'email' | 'linkedin' | 'phone' | 'wait';
}

async function generateStepTemplate(
  stepNumber: number,
  totalSteps: number,
  persona: Persona,
  type: 'email' | 'linkedin' | 'phone' | 'wait'
): Promise<string> {
  const isFirstStep = stepNumber === 1;
  const isLastStep = stepNumber === totalSteps;
  
  const valueProps = formatValuePropositions(persona.valuePropositions);
  
  if (type === 'email') {
    if (isFirstStep) {
      return `Hi {{firstName}},

I noticed {{company}} has been {{insight}} and thought you might be interested in how we've helped similar {{industry}} companies.

Our focus areas include: ${valueProps}

Would you be open to a quick 15-minute conversation this week?

Best regards,
{{senderName}}`;
    } else if (isLastStep) {
      return `Hi {{firstName}},

I've reached out a few times about how we can help {{company}} with ${valueProps}.

If this isn't a priority right now, no worries! I'll check back in a few months.

If you are interested but the timing isn't right, just let me know when would be better.

Best,
{{senderName}}`;
    } else {
      return `Hi {{firstName}},

Following up on my previous email about {{company}}'s {{insight}}.

I'd love to show you specifically how we've helped {{industry}} companies like yours achieve similar results.

Are you available for a brief call this week?

Best regards,
{{senderName}}`;
    }
  } else if (type === 'linkedin') {
    return `Hi {{firstName}}, I noticed we're both in the {{industry}} space. I've been helping companies like {{company}} with ${valueProps}. Would love to connect and share some insights that might be relevant to your work at {{company}}.`;
  } else if (type === 'phone') {
    return `Cold call script for {{firstName}} at {{company}}. Reference previous emails and {{insight}}. Offer brief demo of how we help {{industry}} companies with ${valueProps}.`;
  }
  
  return 'Wait step - no action required';
}
