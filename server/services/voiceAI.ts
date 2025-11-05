import { storage } from '../storage';
import { 
  type VoiceCall, 
  type InsertVoiceCall,
  type VoiceCampaign, 
  type InsertVoiceCampaign,
  type VoiceScript, 
  type InsertVoiceScript,
  type CallAnalytics,
  type InsertCallAnalytics
} from '@shared/schema';
import OpenAI from 'openai';

// Initialize OpenAI client for AI features
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
});

export interface VoiceSettings {
  voiceType: 'professional' | 'friendly' | 'enthusiastic' | 'warm' | 'confident';
  speed: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 2.0
  language: string;
  gender: 'male' | 'female' | 'neutral';
}

export interface ConversationContext {
  callId: string;
  contactId: string;
  scriptId: string;
  currentStep: string;
  objectionCount: number;
  positiveSignals: string[];
  negativeSignals: string[];
  keyMoments: string[];
  conversationHistory: Array<{
    speaker: 'ai' | 'prospect';
    message: string;
    timestamp: Date;
    sentiment?: string;
  }>;
}

export class VoiceAIManager {
  private activeContexts: Map<string, ConversationContext> = new Map();
  
  /**
   * Initiate an AI phone call to a contact
   */
  async initiateCall(
    contactId: string, 
    scriptId: string,
    campaignId?: string,
    voiceSettings?: VoiceSettings
  ): Promise<VoiceCall> {
    try {
      // Get contact information
      const contact = await storage.getContact(contactId);
      if (!contact) {
        throw new Error('Contact not found');
      }
      
      // Get script
      const script = await storage.getVoiceScript(scriptId);
      if (!script) {
        throw new Error('Script not found');
      }
      
      // Create call record
      const newCall: InsertVoiceCall = {
        campaignId,
        contactId,
        phoneNumber: contact.phoneNumber || '',
        callStatus: 'initiated',
        consentObtained: false,
        doNotCallStatus: false,
      };
      
      const call = await storage.createVoiceCall(newCall);
      
      // Initialize conversation context
      const context: ConversationContext = {
        callId: call.id,
        contactId,
        scriptId,
        currentStep: 'introduction',
        objectionCount: 0,
        positiveSignals: [],
        negativeSignals: [],
        keyMoments: [],
        conversationHistory: [],
      };
      
      this.activeContexts.set(call.id, context);
      
      // Simulate call initiation (in production, this would connect to telephony API)
      setTimeout(async () => {
        await this.simulateCallProgress(call.id);
      }, 2000);
      
      return call;
    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }
  
  /**
   * Handle real-time conversation flow
   */
  async handleConversation(callId: string, input: string): Promise<string> {
    const context = this.activeContexts.get(callId);
    if (!context) {
      throw new Error('Call context not found');
    }
    
    // Add user input to history
    context.conversationHistory.push({
      speaker: 'prospect',
      message: input,
      timestamp: new Date(),
      sentiment: await this.analyzeSentiment(input),
    });
    
    // Detect intent and generate response
    const intent = await this.detectIntent(input);
    const response = await this.generateResponse(context, intent, input);
    
    // Add AI response to history
    context.conversationHistory.push({
      speaker: 'ai',
      message: response,
      timestamp: new Date(),
    });
    
    // Update context based on conversation
    await this.updateContext(context, intent, input);
    
    return response;
  }
  
  /**
   * Detect intent from prospect's response
   */
  async detectIntent(transcript: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Classify the intent of this sales call response into one of: interest, objection, question, scheduling, not_interested, callback_request, or unclear"
          },
          {
            role: "user",
            content: transcript
          }
        ],
        temperature: 0.3,
        max_tokens: 50,
      });
      
      return completion.choices[0]?.message?.content || 'unclear';
    } catch (error) {
      console.error('Error detecting intent:', error);
      return 'unclear';
    }
  }
  
  /**
   * Handle objections dynamically
   */
  async handleObjections(objection: string, scriptId: string): Promise<string> {
    const script = await storage.getVoiceScript(scriptId);
    if (!script) {
      return "I understand your concern. Let me address that for you.";
    }
    
    // Check if we have a pre-defined handler for this objection
    const objectionHandlers = script.objectionHandlers as any || {};
    
    // Use AI to match objection to handler or generate response
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a professional sales representative. Handle this objection professionally and empathetically. Available handlers: ${JSON.stringify(objectionHandlers)}`
          },
          {
            role: "user",
            content: `Objection: ${objection}`
          }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });
      
      return completion.choices[0]?.message?.content || "I understand your concern. Could you tell me more about what specifically worries you?";
    } catch (error) {
      console.error('Error handling objection:', error);
      return "I understand your concern. Let me address that for you.";
    }
  }
  
  /**
   * Schedule a callback with the contact
   */
  async scheduleCallback(contactId: string, time: Date, notes?: string): Promise<boolean> {
    try {
      // In a real implementation, this would integrate with a calendar system
      console.log(`Scheduling callback for contact ${contactId} at ${time}`);
      
      // Update the call record to reflect callback scheduled
      const calls = await storage.getVoiceCalls({ contactId });
      if (calls.length > 0) {
        const latestCall = calls[calls.length - 1];
        await storage.updateVoiceCall(latestCall.id, {
          outcome: 'callback_scheduled',
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error scheduling callback:', error);
      return false;
    }
  }
  
  /**
   * Transcribe call audio to text
   */
  async transcribeCall(audioUrl: string): Promise<string> {
    // In production, this would use speech-to-text API
    // For demo, return simulated transcript
    return `
Agent: Hi, this is Sarah from TechCorp Solutions. I'm calling about our new productivity suite that can help streamline your team's workflow. Do you have a moment to chat?

Prospect: Um, I'm actually in the middle of something. What's this about exactly?

Agent: I understand you're busy, and I'll be brief. We've helped companies similar to yours reduce project completion time by 30%. I was wondering if improving team efficiency is a priority for your organization?

Prospect: Well, efficiency is always important, but we already have tools in place.

Agent: That's great to hear! Many of our clients were using other tools before switching. What they found valuable was our AI-powered automation that eliminated about 2 hours of manual work per day. Would saving that kind of time be beneficial for your team?

Prospect: That does sound interesting. How much does this cost?

Agent: I appreciate you asking. Our pricing is customized based on team size and needs. Most teams your size invest between $500-$1000 per month. However, the ROI typically covers this within the first month through time savings alone. Would you like to see a quick demo to evaluate if it's a fit?

Prospect: I'd need to discuss this with my team first.

Agent: Of course! Team buy-in is crucial. How about I send you a brief case study from a similar company, and we can schedule a follow-up call next week when you've had a chance to review it with your team?

Prospect: That works. Send it to my email.

Agent: Perfect! I'll send that over today. What day next week works best for a brief follow-up call?
    `.trim();
  }
  
  /**
   * Analyze call performance and extract insights
   */
  async analyzeCall(callId: string): Promise<CallAnalytics> {
    const call = await storage.getVoiceCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }
    
    const context = this.activeContexts.get(callId);
    
    // Calculate metrics
    const analytics: InsertCallAnalytics = {
      callId,
      keyMoments: context?.keyMoments || [],
      speakingRatio: 0.45, // Simulated: ideal is around 40-60% prospect speaking
      interruptionCount: 2,
      talkSpeed: 140, // Words per minute
      emotionalTone: {
        positive: 0.6,
        neutral: 0.3,
        negative: 0.1,
      },
      conversionPoints: context?.positiveSignals || [],
      objectionCount: context?.objectionCount || 0,
      positiveSignals: context?.positiveSignals.length || 0,
      negativeSignals: context?.negativeSignals.length || 0,
      nextBestAction: this.determineNextAction(call, context),
    };
    
    const savedAnalytics = await storage.createCallAnalytics(analytics);
    
    // Clear context after analysis
    if (callId) {
      this.activeContexts.delete(callId);
    }
    
    return savedAnalytics;
  }
  
  /**
   * Generate simulated conversation for demo purposes
   */
  async generateSimulatedConversation(scriptType: string): Promise<string> {
    const prompts = {
      cold_call: "Generate a realistic cold call conversation between a sales agent and a prospect, including objections and responses",
      follow_up: "Generate a follow-up call conversation where the agent checks in after sending information",
      demo_booking: "Generate a conversation where the agent successfully books a product demo",
    };
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Generate a realistic B2B sales call transcript. Include natural dialogue with hesitations, objections, and a clear outcome."
          },
          {
            role: "user",
            content: prompts[scriptType as keyof typeof prompts] || prompts.cold_call
          }
        ],
        temperature: 0.8,
        max_tokens: 500,
      });
      
      return completion.choices[0]?.message?.content || this.getDefaultTranscript();
    } catch (error) {
      console.error('Error generating conversation:', error);
      return this.getDefaultTranscript();
    }
  }
  
  /**
   * Detect voicemail and leave appropriate message
   */
  async detectVoicemail(audioPattern: any): Promise<boolean> {
    // In production, this would analyze audio patterns
    // For demo, simulate detection
    const isVoicemail = Math.random() > 0.7; // 30% chance of voicemail
    return isVoicemail;
  }
  
  /**
   * Check compliance and do-not-call status
   */
  async checkCompliance(phoneNumber: string): Promise<{ canCall: boolean; reason?: string }> {
    // In production, check against actual DNC lists and compliance rules
    // For demo, simulate compliance check
    
    // Simulate time-based compliance (no calls outside business hours)
    const hour = new Date().getHours();
    if (hour < 9 || hour > 17) {
      return { canCall: false, reason: 'Outside calling hours (9 AM - 5 PM)' };
    }
    
    // Simulate DNC check (5% chance of being on DNC list)
    if (Math.random() < 0.05) {
      return { canCall: false, reason: 'Number is on Do Not Call list' };
    }
    
    return { canCall: true };
  }
  
  // Private helper methods
  
  private async simulateCallProgress(callId: string) {
    // Simulate call ringing
    await storage.updateVoiceCall(callId, {
      callStatus: 'ringing',
      startTime: new Date(),
    });
    
    // Simulate answer or voicemail after 5 seconds
    setTimeout(async () => {
      const answered = Math.random() > 0.3; // 70% answer rate
      
      if (answered) {
        await storage.updateVoiceCall(callId, {
          callStatus: 'answered',
        });
        
        // Simulate call duration
        setTimeout(async () => {
          await this.endCall(callId);
        }, 30000 + Math.random() * 120000); // 30s to 2.5 minutes
      } else {
        await storage.updateVoiceCall(callId, {
          callStatus: 'voicemail',
          outcome: 'voicemail_left',
        });
        
        await this.endCall(callId);
      }
    }, 5000);
  }
  
  private async endCall(callId: string) {
    const call = await storage.getVoiceCall(callId);
    if (call && call.startTime) {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - new Date(call.startTime).getTime()) / 1000);
      
      await storage.updateVoiceCall(callId, {
        endTime,
        duration,
        transcript: await this.generateSimulatedConversation('cold_call'),
        recordingUrl: `https://recordings.example.com/${callId}`,
      });
      
      // Analyze the call
      await this.analyzeCall(callId);
    }
  }
  
  private async generateResponse(context: ConversationContext, intent: string, input: string): Promise<string> {
    const script = await storage.getVoiceScript(context.scriptId);
    
    if (intent === 'objection') {
      return await this.handleObjections(input, context.scriptId);
    }
    
    if (intent === 'not_interested') {
      return "I understand, and I appreciate your time. If circumstances change, we're here to help. Have a great day!";
    }
    
    if (intent === 'scheduling') {
      return "Excellent! I have availability tomorrow at 2 PM or Thursday at 10 AM. Which works better for you?";
    }
    
    // Generate contextual response
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a professional sales representative following this script: ${script?.mainContent}. Respond naturally and professionally.`
          },
          {
            role: "user",
            content: input
          }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });
      
      return completion.choices[0]?.message?.content || "Could you tell me more about that?";
    } catch (error) {
      console.error('Error generating response:', error);
      return "I understand. Could you elaborate on that?";
    }
  }
  
  private async updateContext(context: ConversationContext, intent: string, input: string) {
    if (intent === 'objection') {
      context.objectionCount++;
      context.negativeSignals.push(input);
    }
    
    if (intent === 'interest' || intent === 'scheduling') {
      context.positiveSignals.push(input);
      context.keyMoments.push(`Positive signal: ${input}`);
    }
    
    if (intent === 'not_interested') {
      context.negativeSignals.push(input);
      context.currentStep = 'closing';
    }
  }
  
  private async analyzeSentiment(text: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze the sentiment of this text. Return only: positive, negative, or neutral"
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 10,
      });
      
      return completion.choices[0]?.message?.content?.toLowerCase().trim() || 'neutral';
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return 'neutral';
    }
  }
  
  private determineNextAction(call: VoiceCall, context?: ConversationContext): string {
    if (!context) {
      return 'Review call transcript and plan follow-up';
    }
    
    if (context.positiveSignals.length > context.negativeSignals.length) {
      return 'Send follow-up email with requested information';
    }
    
    if (context.objectionCount > 3) {
      return 'Mark as not qualified and update CRM';
    }
    
    if (call.outcome === 'callback_scheduled') {
      return 'Prepare for scheduled callback with relevant materials';
    }
    
    return 'Nurture lead with educational content';
  }
  
  private getDefaultTranscript(): string {
    return `
Agent: Hello, this is Alex from TechCorp. I'm reaching out to businesses in your industry about our new efficiency platform. Do you have a moment?

Prospect: What's this regarding?

Agent: We help companies reduce operational costs by automating routine tasks. I noticed your company is growing rapidly, and I thought this might be relevant. Are you currently looking at ways to scale operations efficiently?

Prospect: We're always interested in efficiency, but we're pretty happy with our current setup.

Agent: That's great to hear! Many of our successful clients felt the same way initially. What changed their mind was seeing how much time they could save - typically 10-15 hours per week. Would that level of time savings be valuable for your team?

Prospect: I suppose it would depend on the cost and implementation time.

Agent: Absolutely, those are important factors. Implementation typically takes just 2 weeks with our guided onboarding, and most clients see ROI within the first month. Would you be open to a brief 15-minute demo next week to see if it's a fit?

Prospect: I'll need to check with my team first.

Agent: Of course! I'll send you a one-page overview you can share with them. When would be a good time to follow up?

Prospect: Try me next Friday.

Agent: Perfect! I'll call you next Friday at this same time. I'll also send that overview to your email right after this call. Thanks for your time today!
    `.trim();
  }
}

// Export singleton instance
export const voiceAIManager = new VoiceAIManager();

// Export helper functions for voice campaigns
export async function createVoiceCampaign(data: InsertVoiceCampaign): Promise<VoiceCampaign> {
  return await storage.createVoiceCampaign(data);
}

export async function getVoiceCampaigns(filters?: { status?: string; createdBy?: string }): Promise<VoiceCampaign[]> {
  return await storage.getVoiceCampaigns(filters);
}

export async function createVoiceScript(data: InsertVoiceScript): Promise<VoiceScript> {
  return await storage.createVoiceScript(data);
}

export async function getVoiceScripts(filters?: { scriptType?: string; isActive?: boolean }): Promise<VoiceScript[]> {
  return await storage.getVoiceScripts(filters);
}

export async function getCallAnalytics(callId: string): Promise<CallAnalytics | undefined> {
  return await storage.getCallAnalytics(callId);
}

export async function getCampaignAnalytics(campaignId: string): Promise<CallAnalytics[]> {
  return await storage.getCallAnalyticsByCampaign(campaignId);
}