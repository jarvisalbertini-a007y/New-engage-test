import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function analyzeEmailDraft(emailText: string): Promise<{
  score: number;
  suggestions: string[];
  improvements: { type: string; message: string; }[];
}> {
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
    throw new Error("Failed to analyze email: " + error.message);
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
    throw new Error("Failed to generate email: " + error.message);
  }
}

export async function improveEmailDraft(emailText: string): Promise<{ improvedSubject: string; improvedBody: string; }> {
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
    throw new Error("Failed to improve email: " + error.message);
  }
}

export async function generateInsightMessage(insight: {
  companyName: string;
  insightType: string;
  insightDescription: string;
  contactName?: string;
  valueProposition: string;
}): Promise<{ subject: string; message: string; }> {
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
    throw new Error("Failed to generate insight message: " + error.message);
  }
}

export async function categorizeEmailResponse(emailContent: string): Promise<{
  category: 'interested' | 'follow_up' | 'unsubscribe' | 'objection' | 'out_of_office' | 'other';
  confidence: number;
  nextAction: string;
}> {
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
    throw new Error("Failed to categorize email: " + error.message);
  }
}
