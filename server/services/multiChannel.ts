import { storage } from "../storage";
import { openaiClient } from "./openai";
import { 
  type Contact, 
  type ChannelConfig, 
  type MultiChannelCampaign, 
  type ChannelMessage, 
  type ChannelOrchestration,
  type InsertChannelConfig,
  type InsertMultiChannelCampaign,
  type InsertChannelMessage,
  type InsertChannelOrchestration,
} from "@shared/schema";
import { canSendEmail, incrementSendCount } from "./emailLimits";
import { generatePersonalizedEmail } from "./openai";

// Channel types
export type ChannelType = 'email' | 'linkedin' | 'sms' | 'phone' | 'physical_mail';

// Channel configuration types
export interface ChannelSettings {
  email?: {
    provider: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
  };
  linkedin?: {
    accessToken?: string;
    profileUrl?: string;
    connectionLimit?: number;
    inmailLimit?: number;
  };
  sms?: {
    provider: string;
    phoneNumber: string;
    apiKey?: string;
    complianceEnabled?: boolean;
  };
  phone?: {
    provider: string;
    phoneNumber: string;
    callTrackingEnabled?: boolean;
  };
  physical_mail?: {
    returnAddress: string;
    trackingEnabled?: boolean;
    printProvider?: string;
  };
}

// Message content structure
export interface ChannelMessageContent {
  subject?: string; // For email
  body: string;
  attachments?: any[];
  metadata?: Record<string, any>;
  
  // LinkedIn specific
  connectionNote?: string;
  inmailSubject?: string;
  
  // SMS specific
  shortCode?: string;
  optOutMessage?: string;
  
  // Physical mail specific
  letterTemplate?: string;
  envelope?: string;
  trackingCode?: string;
}

// Engagement metrics structure
export interface ChannelEngagement {
  sent?: boolean;
  delivered?: boolean;
  opened?: boolean;
  clicked?: boolean;
  replied?: boolean;
  unsubscribed?: boolean;
  bounced?: boolean;
  
  // Channel specific
  connected?: boolean; // LinkedIn
  smsDelivered?: boolean;
  callAnswered?: boolean;
  mailDelivered?: boolean;
  
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Base channel handler interface
interface IChannelHandler {
  send(contact: Contact, content: ChannelMessageContent): Promise<{ success: boolean; messageId?: string; error?: string }>;
  checkLimits(): Promise<{ canSend: boolean; reason?: string }>;
  trackEngagement(messageId: string, engagement: ChannelEngagement): Promise<void>;
  getMetrics(): Promise<Record<string, any>>;
}

// Email Handler - integrates with existing email system
class EmailHandler implements IChannelHandler {
  constructor(private config: ChannelConfig) {}
  
  async send(contact: Contact, content: ChannelMessageContent) {
    try {
      // Check email limits
      const canSend = await canSendEmail();
      if (!canSend) {
        return { success: false, error: "Daily email limit reached" };
      }
      
      // Send email (integrate with existing email service)
      await incrementSendCount();
      
      // Simulate email sending
      return { 
        success: true, 
        messageId: `email-${Date.now()}-${contact.id}` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send email" 
      };
    }
  }
  
  async checkLimits() {
    const canSend = await canSendEmail();
    return {
      canSend,
      reason: canSend ? undefined : "Daily email limit reached"
    };
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    // Track email engagement
    const message = await storage.getChannelMessage(messageId);
    if (message) {
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
    }
  }
  
  async getMetrics() {
    return {
      sentToday: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0
    };
  }
}

// LinkedIn Handler
class LinkedInHandler implements IChannelHandler {
  constructor(private config: ChannelConfig) {}
  
  async send(contact: Contact, content: ChannelMessageContent) {
    try {
      const settings = this.config.settings as any;
      
      // Check LinkedIn limits
      const limits = await this.checkLimits();
      if (!limits.canSend) {
        return { success: false, error: limits.reason };
      }
      
      // Simulate LinkedIn InMail/connection request
      const messageType = content.connectionNote ? 'connection' : 'inmail';
      
      return {
        success: true,
        messageId: `linkedin-${messageType}-${Date.now()}-${contact.id}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send LinkedIn message"
      };
    }
  }
  
  async checkLimits() {
    const settings = this.config.settings as any;
    const usage = this.config.currentUsage as any || {};
    const limits = this.config.dailyLimits as any || {};
    
    const connectionsSentToday = usage.connectionsSentToday || 0;
    const inmailsSentToday = usage.inmailsSentToday || 0;
    
    const connectionLimit = limits.connectionLimit || 100;
    const inmailLimit = limits.inmailLimit || 50;
    
    if (connectionsSentToday >= connectionLimit) {
      return {
        canSend: false,
        reason: "Daily LinkedIn connection limit reached"
      };
    }
    
    if (inmailsSentToday >= inmailLimit) {
      return {
        canSend: false,
        reason: "Daily LinkedIn InMail limit reached"
      };
    }
    
    return { canSend: true };
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    const message = await storage.getChannelMessage(messageId);
    if (message) {
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
    }
  }
  
  async getMetrics() {
    return {
      connectionsSentToday: 0,
      inmailsSentToday: 0,
      acceptanceRate: 0,
      responseRate: 0
    };
  }
}

// SMS Handler
class SMSHandler implements IChannelHandler {
  constructor(private config: ChannelConfig) {}
  
  async send(contact: Contact, content: ChannelMessageContent) {
    try {
      // Validate phone number
      if (!contact.phoneNumber) {
        return { success: false, error: "Contact has no phone number" };
      }
      
      // Check SMS compliance (TCPA)
      const isCompliant = await this.checkCompliance(contact);
      if (!isCompliant) {
        return { success: false, error: "Contact has not opted in for SMS" };
      }
      
      // Check limits
      const limits = await this.checkLimits();
      if (!limits.canSend) {
        return { success: false, error: limits.reason };
      }
      
      // Send SMS (would integrate with Twilio, etc.)
      return {
        success: true,
        messageId: `sms-${Date.now()}-${contact.id}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send SMS"
      };
    }
  }
  
  async checkLimits() {
    const usage = this.config.currentUsage as any || {};
    const limits = this.config.dailyLimits as any || {};
    
    const smsSentToday = usage.smsSentToday || 0;
    const smsLimit = limits.smsLimit || 500;
    
    if (smsSentToday >= smsLimit) {
      return {
        canSend: false,
        reason: "Daily SMS limit reached"
      };
    }
    
    return { canSend: true };
  }
  
  async checkCompliance(contact: Contact) {
    // Check TCPA compliance - contact must have opted in
    // This would check a real opt-in database
    return true; // Simplified for now
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    const message = await storage.getChannelMessage(messageId);
    if (message) {
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
    }
  }
  
  async getMetrics() {
    return {
      smsSentToday: 0,
      deliveryRate: 0,
      responseRate: 0,
      optOutRate: 0
    };
  }
}

// Phone Handler (for click-to-call tracking)
class PhoneHandler implements IChannelHandler {
  constructor(private config: ChannelConfig) {}
  
  async send(contact: Contact, content: ChannelMessageContent) {
    try {
      if (!contact.phoneNumber) {
        return { success: false, error: "Contact has no phone number" };
      }
      
      // Log call intent (actual dialing would be handled by dialer service)
      return {
        success: true,
        messageId: `call-${Date.now()}-${contact.id}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate call"
      };
    }
  }
  
  async checkLimits() {
    const usage = this.config.currentUsage as any || {};
    const limits = this.config.dailyLimits as any || {};
    
    const callsToday = usage.callsToday || 0;
    const callLimit = limits.callLimit || 200;
    
    if (callsToday >= callLimit) {
      return {
        canSend: false,
        reason: "Daily call limit reached"
      };
    }
    
    return { canSend: true };
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    const message = await storage.getChannelMessage(messageId);
    if (message) {
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
    }
  }
  
  async getMetrics() {
    return {
      callsToday: 0,
      answerRate: 0,
      averageCallDuration: 0,
      conversionRate: 0
    };
  }
}

// Physical Mail Handler
class PhysicalMailHandler implements IChannelHandler {
  constructor(private config: ChannelConfig) {}
  
  async send(contact: Contact, content: ChannelMessageContent) {
    try {
      // Generate tracking code
      const trackingCode = this.generateTrackingCode(contact.id);
      
      // Create mail piece (would integrate with print service)
      const mailPiece = {
        recipient: `${contact.firstName} ${contact.lastName}`,
        address: "Contact address would go here",
        content: content.body,
        trackingCode
      };
      
      return {
        success: true,
        messageId: `mail-${trackingCode}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send physical mail"
      };
    }
  }
  
  async checkLimits() {
    // Physical mail typically doesn't have daily limits
    return { canSend: true };
  }
  
  generateTrackingCode(contactId: string) {
    return `MAIL-${contactId}-${Date.now().toString(36).toUpperCase()}`;
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    const message = await storage.getChannelMessage(messageId);
    if (message) {
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
    }
  }
  
  async getMetrics() {
    return {
      mailSentThisMonth: 0,
      deliveryRate: 0,
      responseRate: 0,
      costPerPiece: 2.50
    };
  }
}

// Main Multi-Channel Orchestrator
export class MultiChannelOrchestrator {
  private handlers: Map<ChannelType, IChannelHandler> = new Map();
  
  async configureChannel(userId: string, channel: ChannelType, settings: ChannelSettings) {
    try {
      // Check if config exists
      const existing = await storage.getChannelConfigByUserAndChannel(userId, channel);
      
      const config: InsertChannelConfig = {
        userId,
        channel,
        settings: settings[channel] || {},
        isActive: true,
        dailyLimits: this.getDefaultLimits(channel),
        currentUsage: {},
      };
      
      if (existing) {
        return await storage.updateChannelConfig(existing.id, config);
      } else {
        return await storage.createChannelConfig(config);
      }
    } catch (error) {
      console.error("Error configuring channel:", error);
      throw error;
    }
  }
  
  async createCampaign(config: InsertMultiChannelCampaign) {
    try {
      // Create the campaign
      const campaign = await storage.createMultiChannelCampaign(config);
      
      // Create orchestration rules if provided
      if (config.channels && config.channels.length > 1) {
        const orchestration: InsertChannelOrchestration = {
          campaignId: campaign.id,
          rules: {
            maxAttemptsPerChannel: 3,
            waitBetweenChannels: 24 * 60 * 60 * 1000, // 24 hours
            switchOnNoResponse: true
          },
          priorityOrder: config.channels,
          switchConditions: {
            noResponse: { afterHours: 48 },
            bounced: { immediate: true },
            unsubscribed: { immediate: true }
          }
        };
        
        await storage.createChannelOrchestration(orchestration);
      }
      
      return campaign;
    } catch (error) {
      console.error("Error creating campaign:", error);
      throw error;
    }
  }
  
  async orchestrateOutreach(campaignId: string, contactId: string) {
    try {
      const campaign = await storage.getMultiChannelCampaign(campaignId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        throw new Error("Contact not found");
      }
      
      const orchestration = await storage.getChannelOrchestrationByCampaign(campaignId);
      const channels = orchestration?.priorityOrder || campaign.channels;
      
      // Try each channel in priority order
      for (const channel of channels) {
        const result = await this.sendToChannel(channel as ChannelType, contact, campaign);
        if (result.success) {
          return result;
        }
      }
      
      throw new Error("Failed to send through any channel");
    } catch (error) {
      console.error("Error orchestrating outreach:", error);
      throw error;
    }
  }
  
  async sendToChannel(channel: ChannelType, contact: Contact, campaign: MultiChannelCampaign) {
    try {
      // Get user's channel configuration
      const configs = await storage.getChannelConfigs(campaign.createdBy || "");
      const channelConfig = configs.find(c => c.channel === channel && c.isActive);
      
      if (!channelConfig) {
        return { success: false, error: `Channel ${channel} not configured` };
      }
      
      // Create appropriate handler
      const handler = this.createHandler(channel, channelConfig);
      
      // Prepare content based on channel
      const content = await this.prepareContent(channel, contact, campaign);
      
      // Send message
      const result = await handler.send(contact, content);
      
      if (result.success) {
        // Record the message
        const message: InsertChannelMessage = {
          campaignId: campaign.id,
          channel,
          recipientId: contact.id,
          content,
          scheduledAt: new Date(),
          status: 'sent'
        };
        
        await storage.createChannelMessage(message);
      }
      
      return result;
    } catch (error) {
      console.error(`Error sending to ${channel}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  
  private createHandler(channel: ChannelType, config: ChannelConfig): IChannelHandler {
    switch (channel) {
      case 'email':
        return new EmailHandler(config);
      case 'linkedin':
        return new LinkedInHandler(config);
      case 'sms':
        return new SMSHandler(config);
      case 'phone':
        return new PhoneHandler(config);
      case 'physical_mail':
        return new PhysicalMailHandler(config);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }
  
  private async prepareContent(channel: ChannelType, contact: Contact, campaign: MultiChannelCampaign): Promise<ChannelMessageContent> {
    // Get template from campaign steps
    const steps = campaign.sequenceSteps as any || {};
    const template = steps[channel] || steps.default || {};
    
    // Personalize content using AI
    const personalized = await this.personalizeContent(channel, contact, template);
    
    return personalized;
  }
  
  private async personalizeContent(channel: ChannelType, contact: Contact, template: any): Promise<ChannelMessageContent> {
    // Use AI to personalize based on channel
    const prompt = `Personalize this ${channel} message for ${contact.firstName} ${contact.lastName} (${contact.title || 'Contact'}):
    Template: ${JSON.stringify(template)}
    Make it natural and appropriate for ${channel} communication.`;
    
    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a sales communication expert." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content || template.body || "Default message";
      
      return {
        subject: template.subject || `Message for ${contact.firstName}`,
        body: content,
        metadata: {
          channel,
          contactId: contact.id,
          personalized: true
        }
      };
    } catch (error) {
      // Fallback to template if AI fails
      return {
        subject: template.subject,
        body: template.body || "Default message",
        metadata: { channel, contactId: contact.id }
      };
    }
  }
  
  async switchChannel(contactId: string, campaignId: string, reason: string) {
    try {
      const orchestration = await storage.getChannelOrchestrationByCampaign(campaignId);
      if (!orchestration) {
        throw new Error("No orchestration rules found");
      }
      
      // Get current channel from recent messages
      const messages = await storage.getChannelMessages({
        campaignId,
        recipientId: contactId
      });
      
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        throw new Error("No previous messages found");
      }
      
      const currentChannelIndex = orchestration.priorityOrder.indexOf(lastMessage.channel);
      const nextChannelIndex = currentChannelIndex + 1;
      
      if (nextChannelIndex >= orchestration.priorityOrder.length) {
        throw new Error("No more channels available");
      }
      
      const nextChannel = orchestration.priorityOrder[nextChannelIndex];
      const contact = await storage.getContact(contactId);
      const campaign = await storage.getMultiChannelCampaign(campaignId);
      
      if (!contact || !campaign) {
        throw new Error("Contact or campaign not found");
      }
      
      // Send through next channel
      return await this.sendToChannel(nextChannel as ChannelType, contact, campaign);
    } catch (error) {
      console.error("Error switching channel:", error);
      throw error;
    }
  }
  
  async trackEngagement(messageId: string, engagement: ChannelEngagement) {
    try {
      const message = await storage.getChannelMessage(messageId);
      if (!message) {
        throw new Error("Message not found");
      }
      
      // Update engagement data
      await storage.updateChannelMessage(messageId, {
        engagement: { ...message.engagement, ...engagement }
      });
      
      // Check if we need to switch channels based on engagement
      if (engagement.bounced || engagement.unsubscribed) {
        await this.switchChannel(
          message.recipientId || "",
          message.campaignId || "",
          engagement.bounced ? "bounced" : "unsubscribed"
        );
      }
    } catch (error) {
      console.error("Error tracking engagement:", error);
    }
  }
  
  async optimizeChannelMix(campaignId: string) {
    try {
      // Get all messages for this campaign
      const messages = await storage.getChannelMessages({ campaignId });
      
      // Calculate performance by channel
      const channelPerformance: Record<string, any> = {};
      
      for (const message of messages) {
        if (!channelPerformance[message.channel]) {
          channelPerformance[message.channel] = {
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            cost: 0
          };
        }
        
        const perf = channelPerformance[message.channel];
        perf.sent++;
        
        const engagement = message.engagement as any || {};
        if (engagement.opened) perf.opened++;
        if (engagement.clicked) perf.clicked++;
        if (engagement.replied) perf.replied++;
      }
      
      // Use AI to optimize channel mix
      const prompt = `Based on this channel performance data, recommend the optimal channel mix:
      ${JSON.stringify(channelPerformance, null, 2)}
      Consider cost, engagement rates, and response rates.`;
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a multi-channel marketing optimization expert." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
      });
      
      return {
        performance: channelPerformance,
        recommendations: response.choices[0].message.content
      };
    } catch (error) {
      console.error("Error optimizing channel mix:", error);
      throw error;
    }
  }
  
  async getChannelAnalytics(campaignId?: string) {
    try {
      const filters = campaignId ? { campaignId } : undefined;
      const messages = await storage.getChannelMessages(filters);
      
      const analytics: Record<string, any> = {};
      
      // Group by channel
      for (const message of messages) {
        if (!analytics[message.channel]) {
          analytics[message.channel] = {
            total: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            bounced: 0,
            unsubscribed: 0
          };
        }
        
        const stats = analytics[message.channel];
        stats.total++;
        
        if (message.status === 'sent') stats.sent++;
        
        const engagement = message.engagement as any || {};
        if (engagement.delivered) stats.delivered++;
        if (engagement.opened) stats.opened++;
        if (engagement.clicked) stats.clicked++;
        if (engagement.replied) stats.replied++;
        if (engagement.bounced) stats.bounced++;
        if (engagement.unsubscribed) stats.unsubscribed++;
      }
      
      // Calculate rates
      for (const channel in analytics) {
        const stats = analytics[channel];
        if (stats.sent > 0) {
          stats.deliveryRate = (stats.delivered / stats.sent * 100).toFixed(2) + '%';
          stats.openRate = (stats.opened / stats.sent * 100).toFixed(2) + '%';
          stats.clickRate = (stats.clicked / stats.sent * 100).toFixed(2) + '%';
          stats.replyRate = (stats.replied / stats.sent * 100).toFixed(2) + '%';
          stats.bounceRate = (stats.bounced / stats.sent * 100).toFixed(2) + '%';
        }
      }
      
      return analytics;
    } catch (error) {
      console.error("Error getting channel analytics:", error);
      throw error;
    }
  }
  
  private getDefaultLimits(channel: ChannelType) {
    switch (channel) {
      case 'email':
        return { dailyLimit: 450, warmupRequired: true };
      case 'linkedin':
        return { connectionLimit: 100, inmailLimit: 50 };
      case 'sms':
        return { smsLimit: 500 };
      case 'phone':
        return { callLimit: 200 };
      case 'physical_mail':
        return { monthlyLimit: 1000 };
      default:
        return {};
    }
  }
  
  async handleChannelLimits(userId: string) {
    try {
      const configs = await storage.getChannelConfigs(userId);
      
      for (const config of configs) {
        // Reset daily usage at midnight
        const usage = config.currentUsage as any || {};
        const lastReset = usage.lastReset ? new Date(usage.lastReset) : new Date(0);
        const now = new Date();
        
        if (now.getDate() !== lastReset.getDate()) {
          // Reset daily counters
          await storage.updateChannelConfig(config.id, {
            currentUsage: {
              ...usage,
              lastReset: now.toISOString(),
              emailsSentToday: 0,
              connectionsSentToday: 0,
              inmailsSentToday: 0,
              smsSentToday: 0,
              callsToday: 0
            }
          });
        }
      }
    } catch (error) {
      console.error("Error handling channel limits:", error);
    }
  }
}

// Export singleton instance
export const multiChannelOrchestrator = new MultiChannelOrchestrator();