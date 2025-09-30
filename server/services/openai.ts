import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const hasOpenAIKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
const openai = hasOpenAIKey ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
}) : null;

export async function analyzeEmailDraft(emailText: string): Promise<{
  score: number;
  suggestions: string[];
  improvements: { type: string; message: string; }[];
}> {
  if (!openai) {
    // Return mock analysis when OpenAI is not configured
    return {
      score: 75,
      suggestions: [
        "Add a clear value proposition in the opening",
        "Include specific metrics or case studies",
        "Create a stronger call-to-action",
        "Personalize with recipient's company context"
      ],
      improvements: [
        { type: "clarity", message: "Simplify complex sentences for better readability" },
        { type: "engagement", message: "Add questions to encourage response" },
        { type: "personalization", message: "Reference recent company news or achievements" }
      ]
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert email coach. Analyze the email draft and provide a score (1-100), specific suggestions for improvement, and actionable improvements. Respond with JSON in this format: { 'score': number, 'suggestions': string[], 'improvements': [{'type': string, 'message': string}] }"
        },
        {
          role: "user",
          content: `Analyze this email draft: ${emailText}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to analyze email: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function generatePersonalizedEmail(context: {
  firstName: string;
  company: string;
  industry?: string;
  title?: string;
  insight?: string;
  valueProposition: string;
  tone?: string;
}): Promise<{ subject: string; body: string; }> {
  if (!openai) {
    // Return mock personalized email when OpenAI is not configured
    return {
      subject: `${context.firstName}, let's discuss how we can help ${context.company} ${context.valueProposition}`,
      body: `Hi ${context.firstName},\n\nI noticed ${context.company} is in the ${context.industry || 'your'} industry${context.insight ? ` and ${context.insight}` : ''}.\n\n${context.valueProposition}\n\nWould you be open to a brief 15-minute call next week to discuss how we can help ${context.company}?\n\nBest regards`
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert sales email writer. Generate a personalized email with subject and body. Keep it concise, professional, and focused on value. Respond with JSON in this format: { 'subject': string, 'body': string }"
        },
        {
          role: "user",
          content: `Generate a personalized email for:
          - Contact: ${context.firstName} at ${context.company}
          - Industry: ${context.industry || 'Not specified'}
          - Title: ${context.title || 'Not specified'}
          - Insight: ${context.insight || 'None'}
          - Value Proposition: ${context.valueProposition}
          - Tone: ${context.tone || 'Professional'}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to generate email: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function improveEmailDraft(emailText: string): Promise<{ improvedSubject: string; improvedBody: string; }> {
  if (!openai) {
    // Return mock improved email when OpenAI is not configured
    const lines = emailText.split('\n');
    const subject = lines[0] || "Partnership Opportunity";
    const body = lines.slice(1).join('\n') || emailText;
    
    return {
      improvedSubject: `Quick question about ${subject}`,
      improvedBody: `${body}\n\nP.S. I'll keep this brief - just 15 minutes to show you how we've helped similar companies achieve [specific result].`
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert email coach. Improve the given email draft by making it more engaging, personalized, and likely to get a positive response. Maintain the original intent but enhance clarity, impact, and call-to-action. Respond with JSON in this format: { 'improvedSubject': string, 'improvedBody': string }"
        },
        {
          role: "user",
          content: `Improve this email draft: ${emailText}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to improve email: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function generateInsightMessage(insight: {
  companyName: string;
  insightType: string;
  insightDescription: string;
  contactName?: string;
  valueProposition: string;
}): Promise<{ subject: string; message: string; }> {
  if (!openai) {
    // Return mock insight message when OpenAI is not configured
    return {
      subject: `Congrats on ${insight.insightType} at ${insight.companyName}`,
      message: `${insight.contactName ? `Hi ${insight.contactName},\n\n` : ''}Congratulations on ${insight.insightDescription}!\n\n${insight.valueProposition}\n\nWould you be interested in learning more?`
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert at crafting personalized sales messages based on company insights. Create a compelling message that references the specific insight and connects it to the value proposition. Respond with JSON in this format: { 'subject': string, 'message': string }"
        },
        {
          role: "user",
          content: `Generate a message based on this insight:
          - Company: ${insight.companyName}
          - Insight Type: ${insight.insightType}
          - Insight: ${insight.insightDescription}
          - Contact: ${insight.contactName || 'Team'}
          - Value Proposition: ${insight.valueProposition}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to generate insight message: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function categorizeEmailResponse(emailContent: string): Promise<{
  category: 'interested' | 'follow_up' | 'unsubscribe' | 'objection' | 'out_of_office' | 'other';
  confidence: number;
  nextAction: string;
}> {
  if (!openai) {
    // Return mock categorization when OpenAI is not configured
    const lowerContent = emailContent.toLowerCase();
    
    if (lowerContent.includes('interested') || lowerContent.includes('yes') || lowerContent.includes('schedule')) {
      return { category: 'interested', confidence: 0.8, nextAction: 'Schedule a meeting' };
    } else if (lowerContent.includes('unsubscribe') || lowerContent.includes('remove')) {
      return { category: 'unsubscribe', confidence: 0.9, nextAction: 'Remove from list' };
    } else if (lowerContent.includes('not interested') || lowerContent.includes('no thanks')) {
      return { category: 'objection', confidence: 0.7, nextAction: 'Handle objection' };
    } else if (lowerContent.includes('out of office') || lowerContent.includes('vacation')) {
      return { category: 'out_of_office', confidence: 0.9, nextAction: 'Follow up later' };
    } else {
      return { category: 'follow_up', confidence: 0.6, nextAction: 'Send follow-up email' };
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Analyze the email response and categorize it. Categories: interested, follow_up, unsubscribe, objection, out_of_office, other. Provide confidence (0-1) and suggested next action. Respond with JSON in this format: { 'category': string, 'confidence': number, 'nextAction': string }"
        },
        {
          role: "user",
          content: `Categorize this email response: ${emailContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("Failed to categorize email: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
