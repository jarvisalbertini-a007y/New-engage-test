import { storage } from "../storage";
import { type PhoneCall, type InsertPhoneCall, type CallScript, type InsertCallScript, type Voicemail, type InsertVoicemail } from "@shared/schema";
import { generatePersonalizedEmail } from "./openai";

// Mock Twilio configuration (in real app, would use actual Twilio SDK)
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || 'mock_account',
  authToken: process.env.TWILIO_AUTH_TOKEN || 'mock_token',
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+15555551234',
};

// AI-generated talk track templates
const TALK_TRACK_TEMPLATES = {
  cold_call: {
    opening: "Hi {firstName}, this is {repName} from SalesAI Pro. I know you're busy, so I'll keep this brief. We help {industry} companies like yours increase sales efficiency by 40% through AI automation. Is that something that could be valuable for {companyName}?",
    valueProps: [
      "Automate 80% of outbound prospecting tasks",
      "Increase reply rates by 3x with AI personalization",
      "Save 20+ hours per week on manual research"
    ],
    questions: [
      "What's your current sales team size?",
      "How many leads are you working with monthly?",
      "What's your biggest challenge in outbound sales?"
    ],
    objectionHandlers: {
      "not interested": "I understand. Before I let you go, can I ask what your team is currently doing for lead generation?",
      "no time": "I appreciate that. Would it make sense to schedule just 15 minutes next week when things are less hectic?",
      "already have solution": "That's great! Which solution are you using? We often complement existing tools by adding AI capabilities they don't have.",
      "too expensive": "I hear that a lot. Most of our customers actually save money within 60 days by reducing manual work. Can I share a quick ROI calculation?",
      "send email": "I'd be happy to. But to make sure I send relevant information, can you tell me your main priority for improving sales this quarter?"
    },
    closing: "Based on what you've shared, I think we could really help {companyName} accelerate growth. Would you be open to a brief 20-minute demo next Tuesday or Wednesday?"
  },
  follow_up: {
    opening: "Hi {firstName}, it's {repName} from SalesAI Pro following up on our conversation last week. You mentioned {previousContext}. Have you had a chance to think about it?",
    valueProps: [
      "Quick implementation - live in under 2 weeks",
      "Dedicated success manager for onboarding",
      "ROI guarantee in first 90 days"
    ],
    questions: [
      "What questions came up after our last call?",
      "Who else would need to be involved in evaluating this?",
      "What's your timeline for making a decision?"
    ],
    objectionHandlers: {
      "need more time": "Of course. What specific information would help you make the best decision?",
      "budget concerns": "I understand budget is always a consideration. Would it help if I could show you how other {industry} companies funded this through efficiency gains?",
      "need approval": "That makes sense. Would it be helpful if I prepared a one-page executive summary for your {stakeholder}?"
    },
    closing: "It sounds like the next logical step would be to get you and {stakeholder} on a call together. Does Thursday at 2pm or Friday at 10am work better?"
  },
  demo_booking: {
    opening: "Hi {firstName}, this is {repName} from SalesAI Pro. I'm calling because you downloaded our {resource} about {topic}. I wanted to see if you found it helpful and if you had any questions?",
    valueProps: [
      "See real results from companies in your industry",
      "Live demonstration of AI prospecting in action",
      "Custom ROI calculation for your team size"
    ],
    questions: [
      "What prompted you to download the {resource}?",
      "What's your current process for {painPoint}?",
      "How important is solving this in the next quarter?"
    ],
    objectionHandlers: {
      "just researching": "That's smart. What specific areas are you researching?",
      "not decision maker": "I appreciate that. Who typically evaluates sales tools in your organization?",
      "not ready yet": "No problem. When do you think you'll be actively looking at solutions?"
    },
    closing: "Based on your interest in {topic}, I'd love to show you exactly how we solve that. I have slots available tomorrow at 3pm or Wednesday at 11am. Which works better for you?"
  }
};

export async function initiateCall(contactId: string, userId: string, scriptType: string = 'cold_call'): Promise<PhoneCall> {
  const contact = await storage.getContact(contactId);
  if (!contact) {
    throw new Error("Contact not found");
  }

  // Get or generate call script
  const script = await getOrGenerateCallScript(scriptType, contact);

  // Create phone call record
  const phoneCall: InsertPhoneCall = {
    contactId,
    userId,
    phoneNumber: contact.phoneNumber || '+15555550000',
    direction: 'outbound',
    status: 'initiated',
    talkTrackId: script.id,
    scheduledAt: new Date(),
    startedAt: new Date(),
  };

  const call = await storage.createPhoneCall(phoneCall);

  // Simulate call connection (in production, would use Twilio API)
  setTimeout(() => simulateCallProgress(call.id), 2000);

  return call;
}

async function simulateCallProgress(callId: string) {
  // Simulate ringing
  await storage.updatePhoneCall(callId, { status: 'ringing' });
  
  // Simulate connection or voicemail (70% connect rate)
  setTimeout(async () => {
    const connected = Math.random() > 0.3;
    
    if (connected) {
      await storage.updatePhoneCall(callId, { 
        status: 'connected'
      });
      
      // Simulate call duration (30 seconds to 5 minutes)
      const duration = Math.floor(Math.random() * 270) + 30;
      
      setTimeout(async () => {
        await storage.updatePhoneCall(callId, {
          status: 'completed',
          duration,
          endedAt: new Date(),
          sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as any,
          notes: 'Call completed successfully. Prospect showed interest in demo.'
        });
      }, 5000);
    } else {
      // Leave voicemail
      await storage.updatePhoneCall(callId, { 
        status: 'voicemail'
      });
      
      const call = await storage.getPhoneCall(callId);
      if (call) {
        await dropVoicemail(call);
      }
    }
  }, 3000);
}

export async function dropVoicemail(call: PhoneCall): Promise<Voicemail> {
  const script = call.talkTrackId ? await storage.getCallScript(call.talkTrackId) : null;
  
  const voicemail: InsertVoicemail = {
    callId: call.id,
    contactId: call.contactId || undefined,
    scriptId: script?.id,
    transcription: script ? 
      `Hi, this is [Your Name] from SalesAI Pro. I'm calling about helping your sales team increase efficiency with AI automation. ${script.closing || 'Please call me back at your convenience.'}` :
      "Hi, this is a message from SalesAI Pro. Please call us back at your convenience.",
    duration: Math.floor(Math.random() * 30) + 15, // 15-45 seconds
    audioUrl: '/mock-voicemail.mp3'
  };

  return await storage.createVoicemail(voicemail);
}

export async function getOrGenerateCallScript(type: string, contact: any): Promise<CallScript> {
  // Check if we already have a script for this type
  const existingScripts = await storage.getCallScripts({ type });
  
  if (existingScripts.length > 0 && Math.random() > 0.5) {
    // Use existing script 50% of the time
    return existingScripts[Math.floor(Math.random() * existingScripts.length)];
  }

  // Generate new AI script
  const template = TALK_TRACK_TEMPLATES[type as keyof typeof TALK_TRACK_TEMPLATES] || TALK_TRACK_TEMPLATES.cold_call;
  
  const company = contact.companyId ? await storage.getCompany(contact.companyId) : null;
  
  // Personalize the script
  const personalizedScript = {
    opening: template.opening
      .replace('{firstName}', contact.firstName || 'there')
      .replace('{companyName}', company?.name || 'your company')
      .replace('{industry}', company?.industry || 'businesses')
      .replace('{repName}', '[Your Name]'),
    valueProps: template.valueProps,
    questions: template.questions,
    objectionHandlers: template.objectionHandlers,
    closing: template.closing
      .replace('{companyName}', company?.name || 'your company')
      .replace('{industry}', company?.industry || 'your industry')
  };

  const newScript: InsertCallScript = {
    name: `${type} - ${company?.name || 'General'} - ${new Date().toISOString().split('T')[0]}`,
    type,
    opening: personalizedScript.opening,
    valueProps: personalizedScript.valueProps,
    questions: personalizedScript.questions,
    objectionHandlers: personalizedScript.objectionHandlers,
    closing: personalizedScript.closing,
    aiGenerated: true,
    successRate: "0.00",
    usageCount: 0
  };

  return await storage.createCallScript(newScript);
}

export async function getCallAnalytics(userId?: string): Promise<{
  totalCalls: number;
  connectedCalls: number;
  voicemails: number;
  avgDuration: number;
  connectRate: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
}> {
  const calls = await storage.getPhoneCalls({ userId });
  
  const totalCalls = calls.length;
  const connectedCalls = calls.filter(c => c.status === 'connected' || c.status === 'completed').length;
  const voicemails = calls.filter(c => c.status === 'voicemail').length;
  
  const completedCalls = calls.filter(c => c.duration && c.duration > 0);
  const avgDuration = completedCalls.length > 0 
    ? completedCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / completedCalls.length 
    : 0;
  
  const connectRate = totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0;
  
  const sentimentBreakdown = {
    positive: calls.filter(c => c.sentiment === 'positive').length,
    neutral: calls.filter(c => c.sentiment === 'neutral').length,
    negative: calls.filter(c => c.sentiment === 'negative').length,
  };
  
  return {
    totalCalls,
    connectedCalls,
    voicemails,
    avgDuration: Math.round(avgDuration),
    connectRate: Math.round(connectRate),
    sentimentBreakdown
  };
}

export async function scheduleCallCampaign(contactIds: string[], userId: string, scriptType: string): Promise<PhoneCall[]> {
  const scheduledCalls: PhoneCall[] = [];
  
  // Schedule calls with delays to simulate parallel dialing
  for (let i = 0; i < contactIds.length; i++) {
    setTimeout(async () => {
      const call = await initiateCall(contactIds[i], userId, scriptType);
      scheduledCalls.push(call);
    }, i * 1000); // 1 second delay between calls
  }
  
  return scheduledCalls;
}