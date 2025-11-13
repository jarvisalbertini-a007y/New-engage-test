import { openAIClient } from "./openaiClient";
import { storage } from "../storage";
import { type Persona, type Contact, type Company, type Insight, type ContentTemplate, type TemplateVersion } from "@shared/schema";

export interface ContentGenerationRequest {
  personaId?: string;
  contactId?: string;
  companyId?: string;
  insightId?: string;
  customPrompt?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'urgent';
  type: 'email' | 'linkedin' | 'cold_call_script';
  templateId?: string; // Optional specific template to use
  audienceSegmentId?: string; // Optional audience segment for template selection
}

export interface GeneratedContent {
  subject?: string;
  body: string;
  tone: string;
  personalizationElements: string[];
  confidence: number;
  templateUsed?: string; // Track which template was used
  versionUsed?: string; // Track which version was used
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

// Fetch appropriate template from storage based on type and audience
async function fetchTemplate(
  type: string,
  tone: string,
  audienceSegmentId?: string,
  templateId?: string
): Promise<{ template: ContentTemplate | null; version: TemplateVersion | null }> {
  try {
    // If specific template ID is provided, use that
    if (templateId) {
      const templateData = await storage.getTemplateWithRelations(templateId);
      if (templateData) {
        // Get the latest published version
        const publishedVersion = templateData.versions.find(v => v.publishedAt !== null);
        if (publishedVersion) {
          return { 
            template: templateData.template, 
            version: publishedVersion 
          };
        }
      }
    }
    
    // Otherwise, find best matching template
    const templates = await storage.listTemplates({
      status: 'active',
      includeArchived: false
    });
    
    // Filter templates by type and tone
    const matchingTemplates = templates.filter(t => 
      t.contentType === type && 
      (t.defaultTone === tone || !tone)
    );
    
    // If audience segment is specified, prefer templates with that segment
    if (audienceSegmentId && matchingTemplates.length > 0) {
      for (const template of matchingTemplates) {
        const templateData = await storage.getTemplateWithRelations(template.id);
        if (templateData) {
          const hasSegment = templateData.segments.some(s => s.id === audienceSegmentId);
          if (hasSegment) {
            const publishedVersion = templateData.versions.find(v => v.publishedAt !== null);
            if (publishedVersion) {
              return { 
                template: templateData.template, 
                version: publishedVersion 
              };
            }
          }
        }
      }
    }
    
    // Fall back to first matching template
    if (matchingTemplates.length > 0) {
      const templateData = await storage.getTemplateWithRelations(matchingTemplates[0].id);
      if (templateData) {
        const publishedVersion = templateData.versions.find(v => v.publishedAt !== null);
        if (publishedVersion) {
          return { 
            template: templateData.template, 
            version: publishedVersion 
          };
        }
      }
    }
    
    return { template: null, version: null };
  } catch (error) {
    console.error('Error fetching template:', error);
    return { template: null, version: null };
  }
}

// Track template usage metrics
async function trackTemplateUsage(
  templateId: string,
  versionId: string,
  type: string
): Promise<void> {
  try {
    await storage.recordTemplateMetricEvent({
      templateVersionId: versionId,
      channel: type,
      eventType: 'generated',
      value: 1,
      occurredAt: new Date()
    });
  } catch (error) {
    console.error('Error tracking template usage:', error);
  }
}

// Personalize template content with placeholders
function personalizeTemplate(
  content: string,
  variables: Record<string, string | undefined>
): string {
  let personalizedContent = content;
  
  // Replace all placeholders in format {{variableName}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'gi');
    personalizedContent = personalizedContent.replace(regex, value || '');
  });
  
  // Also handle common variations like {variableName} and [[variableName]]
  Object.entries(variables).forEach(([key, value]) => {
    const regex1 = new RegExp(`{${key}}`, 'gi');
    const regex2 = new RegExp(`\\[\\[${key}\\]\\]`, 'gi');
    personalizedContent = personalizedContent.replace(regex1, value || '');
    personalizedContent = personalizedContent.replace(regex2, value || '');
  });
  
  return personalizedContent;
}

// Generate personalized email with AI or fallback to templates
async function generatePersonalizedEmail(context: {
  firstName: string;
  company: string;
  industry?: string;
  title?: string;
  insight?: string;
  valueProposition: string;
  tone: string;
}): Promise<{ subject: string; body: string }> {
  // Try AI generation first if available
  if (openAIClient.isAvailable()) {
    const prompt = `Generate a personalized sales email with the following context:
- Recipient: ${context.firstName} at ${context.company}
- Industry: ${context.industry || 'Unknown'}
- Title: ${context.title || 'Unknown'}
- Recent Insight: ${context.insight || 'No specific insight'}
- Value Proposition: ${context.valueProposition}
- Tone: ${context.tone}

Generate a JSON response with:
- subject: Compelling email subject line (max 60 characters)
- body: Complete email body (3-4 paragraphs, personalized, value-focused)

Focus on value over features. Be concise and action-oriented.`;

    const systemPrompt = `You are an expert B2B sales copywriter. Generate personalized, high-converting sales emails.
Return valid JSON with 'subject' and 'body' fields only.`;

    const response = await openAIClient.generateJSON<{ subject: string; body: string }>(
      prompt,
      systemPrompt,
      {
        feature: 'email-generation',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 800,
        fallback: null
      }
    );
    
    if (response.success && response.data) {
      return response.data;
    }
  }
  
  // Fallback to template-based generation
  const templates = {
    professional: {
      subject: `Quick question about ${context.company}'s growth strategy`,
      body: `Hi ${context.firstName},

I noticed ${context.company} ${context.insight || 'has been making impressive progress'} and thought you might be interested in how we're helping similar ${context.industry || 'companies'} achieve even better results.

Our ${context.valueProposition} has helped companies in your space increase reply rates by 40% and book 3x more qualified meetings.

Would you be open to a quick 15-minute call this week to explore if we could help ${context.company} achieve similar results?

Best regards,
{{senderName}}`
    },
    casual: {
      subject: `${context.firstName}, quick thought about ${context.company}`,
      body: `Hey ${context.firstName},

Just came across ${context.company} and ${context.insight || "love what you're doing"}!

We've been working with a lot of ${context.industry || 'companies like yours'} on ${context.valueProposition}, and the results have been pretty amazing - talking 40% better engagement rates.

Worth a quick chat to see if we could help you too?

Cheers,
{{senderName}}`
    },
    friendly: {
      subject: `Idea for ${context.company}'s sales team`,
      body: `Hi ${context.firstName}!

Hope this finds you well! I've been following ${context.company}'s journey and ${context.insight || "I'm really impressed by your growth"}.

I'd love to share how we're helping ${context.industry || 'teams like yours'} with ${context.valueProposition}. Our clients typically see 40% improvement in their outreach effectiveness.

Do you have 15 minutes this week for a friendly chat about how we might be able to help ${context.company}?

Looking forward to connecting!
{{senderName}}`
    },
    urgent: {
      subject: `Time-sensitive opportunity for ${context.company}`,
      body: `${context.firstName},

I'll keep this brief - ${context.company} ${context.insight || 'is at a critical growth stage'} and I believe we can help you capitalize on this momentum.

Our ${context.valueProposition} is designed specifically for ${context.industry || 'fast-growing companies'} like yours. We've helped similar companies increase their pipeline by 3x in just 60 days.

Can we schedule a 15-minute call tomorrow or Thursday to discuss?

Best,
{{senderName}}`
    }
  };
  
  const selectedTemplate = templates[context.tone as keyof typeof templates] || templates.professional;
  return selectedTemplate;
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
  const tone = request.tone || 'professional';
  
  // First, try to fetch a template from storage
  const { template, version } = await fetchTemplate(
    'email',
    tone,
    request.audienceSegmentId,
    request.templateId
  );
  
  let subject: string | undefined;
  let body: string;
  let templateUsed: string | undefined;
  let versionUsed: string | undefined;
  
  if (template && version) {
    // Use the template version content
    const variables = {
      firstName: contact?.firstName || 'there',
      company: company?.name || 'your company',
      industry: company?.industry || 'your industry',
      title: contact?.title || 'professional',
      insight: insight?.description || 'recent developments',
      valueProposition: persona?.valuePropositions ? 
        formatValuePropositions(persona.valuePropositions) : 
        'our AI-powered sales platform',
      senderName: '{{senderName}}'  // Will be replaced by sender
    };
    
    // Personalize the template content
    subject = version.subject ? personalizeTemplate(version.subject, variables) : undefined;
    body = personalizeTemplate(version.body, variables);
    
    // Track template usage
    await trackTemplateUsage(template.id, version.id, 'email');
    
    templateUsed = template.id;
    versionUsed = version.id;
  } else {
    // Fall back to AI generation or default templates
    const context = {
      firstName: contact?.firstName || 'there',
      company: company?.name || 'your company',
      industry: company?.industry || undefined,
      title: contact?.title || undefined,
      insight: insight?.description,
      valueProposition: persona?.valuePropositions ? 
        formatValuePropositions(persona.valuePropositions) : 
        'our AI-powered sales platform that increases reply rates by 40%',
      tone
    };
    
    const generated = await generatePersonalizedEmail(context);
    subject = generated.subject;
    body = generated.body;
  }
  
  const personalizationElements = [];
  if (contact?.firstName) personalizationElements.push('First name');
  if (company?.name) personalizationElements.push('Company name');
  if (company?.industry) personalizationElements.push('Industry');
  if (contact?.title) personalizationElements.push('Job title');
  if (insight) personalizationElements.push('Recent insight');
  
  return {
    subject,
    body,
    tone,
    personalizationElements,
    confidence: calculateConfidence(personalizationElements.length, !!persona, !!insight),
    templateUsed,
    versionUsed
  };
}

async function generateLinkedInContent(
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
      'AI-powered sales automation'
  };
  
  // Generate LinkedIn-specific content with AI if available
  let linkedInBody: string;
  
  if (openAIClient.isAvailable()) {
    const prompt = `Generate a brief LinkedIn message for sales outreach:
- Recipient: ${context.firstName} at ${context.company}
- Title: ${context.title || 'Unknown'}
- Industry: ${context.industry || 'Unknown'}
- Insight: ${context.insight || 'No specific insight'}
- Value: ${context.valueProposition}

Create a natural, conversational LinkedIn message (2-3 sentences max). Be casual and focus on connection, not selling.`;

    const response = await openAIClient.generateText(
      prompt,
      'You are a B2B sales professional writing casual LinkedIn messages. Keep it brief and conversational.',
      {
        feature: 'linkedin-generation',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 200,
        fallback: null
      }
    );
    
    if (response.success && response.data) {
      linkedInBody = response.data;
    } else {
      // Fallback to template
      linkedInBody = `Hi ${context.firstName}, noticed ${context.company} ${context.insight || 'is doing great things'}. We're helping ${context.industry || 'companies like yours'} with ${context.valueProposition}. Would love to connect and share some insights!`;
    }
  } else {
    // No AI available, use template
    linkedInBody = `Hi ${context.firstName}, noticed ${context.company} ${context.insight || 'is doing great things'}. We're helping ${context.industry || 'companies like yours'} with ${context.valueProposition}. Would love to connect and share some insights!`;
  }
  
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
  
  // Generate base deterministic steps
  const baseSteps = [];
  
  for (let i = 1; i <= stepCount; i++) {
    if (sequenceType === 'email_only') {
      baseSteps.push({
        stepNumber: i,
        type: 'email' as const,
        delay: i === 1 ? 0 : i * 3, // 0, 3, 6, 9, 12 days
        subject: `Email ${i} - ${persona.name} Sequence`,
        template: await generateStepTemplate(i, stepCount, persona, 'email')
      });
    } else {
      // Multi-channel sequence
      const stepType = getMultiChannelStepType(i);
      baseSteps.push({
        stepNumber: i,
        type: stepType,
        delay: i === 1 ? 0 : i * 2, // 0, 2, 4, 6, 8 days
        subject: stepType === 'email' ? `${persona.name} - Follow up ${i}` : undefined,
        template: await generateStepTemplate(i, stepCount, persona, stepType)
      });
    }
  }
  
  // Apply AI personalization to enhance steps
  const enhancedSteps = await personalizeSequenceSteps(baseSteps, persona);
  
  return enhancedSteps;
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

// AI enhancement cache with TTL to reduce repeated API calls
// Singleton cache instance persists across requests
interface CachedEnhancement {
  data: StepEnhancement;
  expiry: number;
}

class EnhancementCache {
  private cache = new Map<string, CachedEnhancement>();
  private readonly TTL = 3600000; // 1 hour in milliseconds
  
  get(key: string): StepEnhancement | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(key: string, data: StepEnhancement): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.TTL
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Singleton cache instance
const enhancementCache = new EnhancementCache();

interface StepEnhancement {
  subject?: string;
  opening: string;
  cta: string;
  personalizationNotes: string[];
}

async function personalizeSequenceSteps(
  baseSteps: Array<{
    stepNumber: number;
    type: 'email' | 'linkedin' | 'phone' | 'wait';
    delay: number;
    subject?: string;
    template: string;
  }>,
  persona: Persona
): Promise<typeof baseSteps> {
  // Only personalize email and linkedin steps
  const stepsToPersonalize = baseSteps.filter(
    step => step.type === 'email' || step.type === 'linkedin'
  );
  
  // If no OpenAI API key or no steps to personalize, return base steps
  if (!openAIClient.isAvailable() || stepsToPersonalize.length === 0) {
    return baseSteps;
  }
  
  const enhancedSteps = [...baseSteps];
  
  // Process each step that needs personalization
  for (const step of stepsToPersonalize) {
    // Create a cache key based on persona + step type + step position
    // We cache the AI enhancement data, not the enhanced step itself
    const cacheKey = `${persona.id}_${step.type}_${step.stepNumber}_${isFirstStep(step.stepNumber)}_${isLastStep(step.stepNumber, baseSteps.length)}`;
    
    // Check cache for enhancement data only
    let enhancement = enhancementCache.get(cacheKey);
    
    if (!enhancement) {
      // Generate AI enhancement
      enhancement = await generateStepEnhancement(step, persona);
      
      // Cache the enhancement data only, not the full step
      if (enhancement) {
        enhancementCache.set(cacheKey, enhancement);
      }
    }
    
    // Always apply enhancement to the base step (cached or fresh)
    if (enhancement) {
      const stepIndex = baseSteps.indexOf(step);
      // Apply enhancement creates a new enhanced step each time
      enhancedSteps[stepIndex] = applyEnhancement(step, enhancement);
    }
  }
  
  function isFirstStep(stepNumber: number): boolean {
    return stepNumber === 1;
  }
  
  function isLastStep(stepNumber: number, totalSteps: number): boolean {
    return stepNumber === totalSteps;
  }
  
  return enhancedSteps;
}

async function generateStepEnhancement(
  step: {
    stepNumber: number;
    type: 'email' | 'linkedin' | 'phone' | 'wait';
    subject?: string;
    template: string;
  },
  persona: Persona
): Promise<StepEnhancement | null> {
  const valueProps = formatValuePropositions(persona.valuePropositions);
  const isFirstStep = step.stepNumber === 1;
  
  // Create channel-specific prompt for AI enhancement
  const isLinkedIn = step.type === 'linkedin';
  const prompt = isLinkedIn ? 
    `Generate a personalized LinkedIn message for sales outreach.

Persona: ${persona.name}
Industry: ${persona.industries?.[0] || 'B2B'}
Value Propositions: ${valueProps}
Step Number: ${step.stepNumber} (${isFirstStep ? 'First connection' : 'Follow-up'})

Generate a JSON response with:
- opening: Brief, conversational opening that feels natural on LinkedIn (max 80 chars)
- cta: Soft call-to-action appropriate for LinkedIn (max 60 chars)
- personalizationNotes: Array of 2-3 LinkedIn-specific personalization tips

Keep it short, casual, and focused on connection rather than selling. LinkedIn messages should be 2-3 sentences max.` :
    `Generate personalized email components for a sales sequence.

Persona: ${persona.name}
Industry: ${persona.industries?.[0] || 'B2B'}
Value Propositions: ${valueProps}
Step Number: ${step.stepNumber} (${isFirstStep ? 'First touch' : 'Follow-up'})

Generate a JSON response with:
- subject: Compelling subject line (max 60 chars)
- opening: Engaging first sentence that hooks the reader (max 100 chars)
- cta: Clear call-to-action that drives action (max 80 chars)
- personalizationNotes: Array of 2-3 personalization tips for the SDR

The tone should be professional but conversational. Focus on value, not features.`;

  const systemPrompt = `You are an expert sales copywriter specializing in B2B outreach. 
Generate compelling, personalized sales messaging that converts.
Keep subject lines under 60 characters, openings under 100 characters, and CTAs under 80 characters.
Return valid JSON only.`;

  // Use the new OpenAI client with proper token management
  const response = await openAIClient.generateJSON<StepEnhancement>(
    prompt,
    systemPrompt,
    {
      feature: 'sequence-personalization',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 500,
      fallback: null
    }
  );
  
  if (response.success && response.data) {
    return response.data;
  }
  
  // Return null on failure (will use base template)
  return null;
}

function applyEnhancement(
  step: {
    stepNumber: number;
    type: 'email' | 'linkedin' | 'phone' | 'wait';
    delay: number;
    subject?: string;
    template: string;
  },
  enhancement: StepEnhancement
): typeof step {
  const enhanced = { ...step };
  
  // Apply subject for email steps
  if (step.type === 'email' && enhancement.subject) {
    enhanced.subject = enhancement.subject;
  }
  
  // Enhance template with AI-generated opening and CTA
  let enhancedTemplate = step.template;
  
  // Replace generic opening with AI-generated one
  if (enhancement.opening) {
    // For emails, replace the first line after greeting
    if (step.type === 'email') {
      enhancedTemplate = enhancedTemplate.replace(
        /Hi {{firstName}},\n\n.*/,
        (match) => {
          const lines = match.split('\n');
          lines[2] = enhancement.opening; // Replace first content line
          return lines.join('\n');
        }
      );
    } else if (step.type === 'linkedin') {
      // For LinkedIn, replace opening after greeting
      enhancedTemplate = enhancedTemplate.replace(
        /Hi {{firstName}}, .*/,
        `Hi {{firstName}}, ${enhancement.opening}`
      );
    }
  }
  
  // Replace generic CTA with AI-generated one
  if (enhancement.cta) {
    // Look for question marks or common CTA patterns
    enhancedTemplate = enhancedTemplate.replace(
      /(Would you be .*\?|Are you available.*\?|Would love to .*)/i,
      enhancement.cta
    );
  }
  
  // Add personalization notes as comments at the end
  if (enhancement.personalizationNotes && enhancement.personalizationNotes.length > 0) {
    enhancedTemplate += `\n\n<!-- Personalization Tips:\n${enhancement.personalizationNotes.map(note => `• ${note}`).join('\n')}\n-->`;
  }
  
  enhanced.template = enhancedTemplate;
  return enhanced;
}
