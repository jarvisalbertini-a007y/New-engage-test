import OpenAI from "openai";
import { storage } from "../storage";
import type { 
  DigitalTwin, 
  TwinInteraction, 
  TwinPrediction,
  Contact,
  Company 
} from "@shared/schema";

const hasOpenAIKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
const openai = hasOpenAIKey ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
}) : null;

export class DigitalTwinEngine {
  // Create a new digital twin from contact data
  async createTwin(contactId: string): Promise<DigitalTwin> {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Check if twin already exists
    const existingTwin = await storage.getDigitalTwinByContact(contactId);
    if (existingTwin) {
      return existingTwin;
    }

    // Get company data if available
    let company: Company | undefined;
    if (contact.companyId) {
      company = await storage.getCompany(contact.companyId);
    }

    // Generate initial personality model
    const initialModel = await this.generateInitialModel(contact, company);
    
    // Create the twin
    const twin = await storage.createDigitalTwin({
      contactId,
      companyId: contact.companyId,
      ...initialModel
    });

    return twin;
  }

  // Generate initial model from available data
  private async generateInitialModel(contact: Contact, company?: Company): Promise<any> {
    if (!openai) {
      // Return default model when OpenAI is not configured
      return {
        communicationStyle: "professional",
        personalityTraits: {
          decision_style: "analytical",
          risk_tolerance: "moderate",
          engagement_level: "medium",
          response_time: "standard"
        },
        interests: ["efficiency", "innovation", "ROI"],
        values: ["reliability", "quality", "growth"],
        painPoints: ["time management", "scalability", "integration"],
        preferredChannels: ["email"],
        bestEngagementTime: "9:00 AM - 11:00 AM",
        contentPreferences: ["case studies", "whitepapers"],
        buyingStageIndicators: {
          stage: "awareness",
          signals: ["browsing content", "initial research"]
        },
        objectionsHistory: {},
        modelConfidence: 30
      };
    }

    try {
      const prompt = `
        Based on the following contact and company information, generate an initial psychological and behavioral model for this prospect:
        
        Contact: ${JSON.stringify({
          name: `${contact.firstName} ${contact.lastName}`,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          linkedin: contact.linkedinUrl
        })}
        
        Company: ${company ? JSON.stringify({
          name: company.name,
          industry: company.industry,
          size: company.size,
          revenue: company.revenue,
          technologies: company.technologies
        }) : "Not available"}
        
        Create a model with:
        - Communication style (formal/casual/technical/friendly)
        - Personality traits (decision_style, risk_tolerance, engagement_level)
        - Likely interests and values
        - Potential pain points
        - Preferred communication channels
        - Best engagement time
        - Content preferences
        - Buying stage indicators
        
        Return as JSON.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert in buyer psychology and sales intelligence. Create detailed prospect models based on available data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const model = JSON.parse(response.choices[0].message.content || "{}");
      return {
        ...model,
        modelConfidence: 50 // Initial confidence with AI generation
      };
    } catch (error) {
      console.error("Error generating initial model:", error);
      // Fallback to default model
      return {
        communicationStyle: "professional",
        personalityTraits: {
          decision_style: "analytical",
          risk_tolerance: "moderate",
          engagement_level: "medium",
          response_time: "standard"
        },
        interests: ["efficiency", "innovation", "ROI"],
        values: ["reliability", "quality", "growth"],
        painPoints: ["time management", "scalability", "integration"],
        preferredChannels: ["email"],
        bestEngagementTime: "9:00 AM - 11:00 AM",
        contentPreferences: ["case studies", "whitepapers"],
        buyingStageIndicators: {
          stage: "awareness",
          signals: ["browsing content", "initial research"]
        },
        objectionsHistory: {},
        modelConfidence: 30
      };
    }
  }

  // Update twin model based on new interaction
  async updateTwin(twinId: string, interaction: TwinInteraction): Promise<DigitalTwin> {
    const twin = await storage.getDigitalTwin(twinId);
    if (!twin) {
      throw new Error("Digital twin not found");
    }

    // Get recent interactions for context
    const recentInteractions = await storage.getTwinInteractions(twinId, 10);
    
    // Analyze patterns and update model
    const updates = await this.analyzeAndUpdateModel(twin, interaction, recentInteractions);
    
    // Update twin
    const updatedTwin = await storage.updateDigitalTwin(twinId, updates);
    if (!updatedTwin) {
      throw new Error("Failed to update twin");
    }

    return updatedTwin;
  }

  // Analyze interaction patterns and update model
  private async analyzeAndUpdateModel(
    twin: DigitalTwin, 
    newInteraction: TwinInteraction,
    recentInteractions: TwinInteraction[]
  ): Promise<Partial<DigitalTwin>> {
    if (!openai) {
      // Simple rule-based updates when OpenAI is not available
      const updates: Partial<DigitalTwin> = {};
      
      // Update model confidence based on interaction
      if (newInteraction.engagementScore && newInteraction.engagementScore > 0.7) {
        updates.modelConfidence = Math.min(100, twin.modelConfidence + 5);
      }
      
      return updates;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert in behavioral analysis. Update the prospect model based on new interactions."
          },
          {
            role: "user",
            content: `
              Current model: ${JSON.stringify(twin)}
              New interaction: ${JSON.stringify(newInteraction)}
              Recent interactions: ${JSON.stringify(recentInteractions)}
              
              Analyze patterns and provide updates to the model. Focus on:
              - Communication style adjustments
              - Updated personality traits
              - New interests or pain points discovered
              - Buying stage progression
              - Confidence level changes
              
              Return only the fields that should be updated as JSON.
            `
          }
        ],
        response_format: { type: "json_object" }
      });

      const updates = JSON.parse(response.choices[0].message.content || "{}");
      return updates;
    } catch (error) {
      console.error("Error updating model:", error);
      return {};
    }
  }

  // Predict best approach for messaging
  async predictBestApproach(twinId: string, messageType: string): Promise<{
    approach: string;
    tone: string;
    keyPoints: string[];
    timing: string;
    channel: string;
  }> {
    const twin = await storage.getDigitalTwin(twinId);
    if (!twin) {
      throw new Error("Digital twin not found");
    }

    if (!openai) {
      // Return default approach when OpenAI is not available
      return {
        approach: "consultative",
        tone: twin.communicationStyle || "professional",
        keyPoints: [
          "Focus on value proposition",
          "Address potential pain points",
          "Provide social proof"
        ],
        timing: twin.bestEngagementTime || "9:00 AM - 11:00 AM",
        channel: twin.preferredChannels?.[0] || "email"
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert sales strategist. Provide personalized messaging strategies."
          },
          {
            role: "user",
            content: `
              Based on this prospect model: ${JSON.stringify(twin)}
              Message type: ${messageType}
              
              Recommend the best approach including:
              - Overall approach strategy
              - Communication tone
              - Key points to emphasize
              - Optimal timing
              - Best channel
              
              Return as JSON.
            `
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (error) {
      console.error("Error predicting approach:", error);
      return {
        approach: "consultative",
        tone: twin.communicationStyle || "professional",
        keyPoints: [
          "Focus on value proposition",
          "Address potential pain points",
          "Provide social proof"
        ],
        timing: twin.bestEngagementTime || "9:00 AM - 11:00 AM",
        channel: twin.preferredChannels?.[0] || "email"
      };
    }
  }

  // Analyze response patterns
  async analyzeResponsePatterns(twinId: string): Promise<{
    patterns: string[];
    preferences: string[];
    triggers: string[];
    recommendations: string[];
  }> {
    const interactions = await storage.getTwinInteractions(twinId, 50);
    
    if (!openai || interactions.length === 0) {
      return {
        patterns: ["Limited data available"],
        preferences: ["Gather more interaction data"],
        triggers: ["Monitor response rates"],
        recommendations: ["Continue tracking engagement"]
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert in communication pattern analysis. Identify patterns in prospect behavior."
          },
          {
            role: "user",
            content: `
              Analyze these interactions: ${JSON.stringify(interactions)}
              
              Identify:
              - Communication patterns
              - Content preferences
              - Engagement triggers
              - Strategic recommendations
              
              Return as JSON with patterns, preferences, triggers, and recommendations arrays.
            `
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    } catch (error) {
      console.error("Error analyzing patterns:", error);
      return {
        patterns: ["Analysis unavailable"],
        preferences: ["Error in processing"],
        triggers: [],
        recommendations: []
      };
    }
  }

  // Generate personalized content
  async generatePersonalizedContent(twinId: string, template: string): Promise<string> {
    const twin = await storage.getDigitalTwin(twinId);
    if (!twin) {
      throw new Error("Digital twin not found");
    }

    const contact = await storage.getContact(twin.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    if (!openai) {
      // Simple template replacement when OpenAI is not available
      return template
        .replace("{{firstName}}", contact.firstName)
        .replace("{{lastName}}", contact.lastName)
        .replace("{{company}}", contact.companyId || "your company")
        .replace("{{title}}", contact.title || "")
        .replace("{{painPoint}}", twin.painPoints?.[0] || "business challenges")
        .replace("{{value}}", twin.values?.[0] || "success");
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert copywriter. Personalize content based on prospect models."
          },
          {
            role: "user",
            content: `
              Template: ${template}
              Contact: ${JSON.stringify(contact)}
              Model: ${JSON.stringify(twin)}
              
              Personalize this template based on the prospect's profile.
              Maintain the structure but adapt:
              - Tone to match communication style
              - Examples to match interests
              - Benefits to address pain points
              - Language complexity to match preferences
              
              Return only the personalized content.
            `
          }
        ]
      });

      return response.choices[0].message.content || template;
    } catch (error) {
      console.error("Error generating personalized content:", error);
      return template;
    }
  }

  // Predict buying stage
  async predictBuyingStage(twinId: string): Promise<{
    stage: string;
    confidence: number;
    signals: string[];
    nextSteps: string[];
  }> {
    const twin = await storage.getDigitalTwin(twinId);
    if (!twin) {
      throw new Error("Digital twin not found");
    }

    const interactions = await storage.getTwinInteractions(twinId, 20);

    if (!openai) {
      return {
        stage: twin.buyingStageIndicators?.stage || "awareness",
        confidence: 60,
        signals: twin.buyingStageIndicators?.signals || [],
        nextSteps: ["Continue nurturing", "Provide valuable content"]
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert in sales psychology. Predict buying stage based on behavior."
          },
          {
            role: "user",
            content: `
              Model: ${JSON.stringify(twin)}
              Recent interactions: ${JSON.stringify(interactions)}
              
              Predict:
              - Current buying stage (awareness/interest/consideration/intent/evaluation/purchase)
              - Confidence level (0-100)
              - Supporting signals
              - Recommended next steps
              
              Return as JSON.
            `
          }
        ],
        response_format: { type: "json_object" }
      });

      const prediction = JSON.parse(response.choices[0].message.content || "{}");
      
      // Store prediction
      await storage.createTwinPrediction({
        twinId,
        predictionType: "buying_stage",
        prediction: prediction,
        confidence: prediction.confidence || 50
      });

      return prediction;
    } catch (error) {
      console.error("Error predicting buying stage:", error);
      return {
        stage: "unknown",
        confidence: 0,
        signals: [],
        nextSteps: []
      };
    }
  }

  // Recommend next action
  async recommendNextAction(twinId: string): Promise<{
    action: string;
    priority: string;
    reason: string;
    expectedOutcome: string;
    alternativeActions: string[];
  }> {
    const twin = await storage.getDigitalTwin(twinId);
    if (!twin) {
      throw new Error("Digital twin not found");
    }

    const interactions = await storage.getTwinInteractions(twinId, 10);
    const predictions = await storage.getTwinPredictions(twinId);

    if (!openai) {
      return {
        action: "Send follow-up email",
        priority: "medium",
        reason: "Maintain engagement",
        expectedOutcome: "Continued conversation",
        alternativeActions: ["Schedule call", "Share case study", "Connect on LinkedIn"]
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert sales strategist. Recommend optimal next actions."
          },
          {
            role: "user",
            content: `
              Model: ${JSON.stringify(twin)}
              Recent interactions: ${JSON.stringify(interactions)}
              Predictions: ${JSON.stringify(predictions)}
              
              Recommend:
              - Primary action to take
              - Priority level
              - Reasoning
              - Expected outcome
              - Alternative actions
              
              Return as JSON.
            `
          }
        ],
        response_format: { type: "json_object" }
      });

      const recommendation = JSON.parse(response.choices[0].message.content || "{}");
      
      // Store as prediction
      await storage.createTwinPrediction({
        twinId,
        predictionType: "next_action",
        prediction: recommendation,
        confidence: 80
      });

      return recommendation;
    } catch (error) {
      console.error("Error recommending action:", error);
      return {
        action: "Continue engagement",
        priority: "medium",
        reason: "Maintain relationship",
        expectedOutcome: "Ongoing conversation",
        alternativeActions: []
      };
    }
  }

  // Get aggregate insights across all twins
  async getAggregateInsights(): Promise<{
    totalTwins: number;
    averageConfidence: number;
    topPatterns: string[];
    commonPainPoints: string[];
    stageDistribution: Record<string, number>;
  }> {
    const twins = await storage.getDigitalTwins();
    
    if (twins.length === 0) {
      return {
        totalTwins: 0,
        averageConfidence: 0,
        topPatterns: [],
        commonPainPoints: [],
        stageDistribution: {}
      };
    }

    // Calculate average confidence
    const averageConfidence = twins.reduce((sum, t) => sum + t.modelConfidence, 0) / twins.length;

    // Extract common pain points
    const painPointCounts: Record<string, number> = {};
    twins.forEach(twin => {
      twin.painPoints?.forEach(painPoint => {
        painPointCounts[painPoint] = (painPointCounts[painPoint] || 0) + 1;
      });
    });
    const commonPainPoints = Object.entries(painPointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([painPoint]) => painPoint);

    // Calculate stage distribution
    const stageDistribution: Record<string, number> = {};
    twins.forEach(twin => {
      const stage = twin.buyingStageIndicators?.stage || "unknown";
      stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
    });

    return {
      totalTwins: twins.length,
      averageConfidence,
      topPatterns: ["Email preferred", "Morning engagement", "Value-focused"],
      commonPainPoints,
      stageDistribution
    };
  }
}

export const digitalTwinEngine = new DigitalTwinEngine();