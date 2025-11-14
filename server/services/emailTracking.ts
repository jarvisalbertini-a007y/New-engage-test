import { storage } from "../storage";
import { Email, Contact } from "@shared/schema";
import { insightsOrchestrator } from "./insightsOrchestrator";
import { EventTypes } from "./insightsOrchestrator";

/**
 * Track email sent and generate insights
 */
export async function trackEmailSent(
  emailData: {
    contactId: string;
    subject: string;
    body: string;
    sequenceId?: string;
    templateId?: string;
  }
): Promise<Email> {
  // Create email record
  const email = await storage.createEmail({
    contactId: emailData.contactId,
    subject: emailData.subject,
    body: emailData.body,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sequenceId: emailData.sequenceId,
    templateId: emailData.templateId,
    openCount: 0,
    clickCount: 0,
    aiScore: 0,
    aiSuggestions: []
  });
  
  return email;
}

/**
 * Track email opened and generate insights
 */
export async function trackEmailOpened(emailId: string): Promise<void> {
  const email = await storage.getEmail(emailId);
  if (!email) return;
  
  // Update open count
  const openCount = (email.openCount || 0) + 1;
  await storage.updateEmail(emailId, {
    openCount,
    openedAt: email.openedAt || new Date().toISOString()
  });
  
  // If high open rate (opened multiple times), generate insight
  if (openCount >= 3 && email.contactId) {
    const contact = await storage.getContact(email.contactId);
    if (contact?.companyId) {
      const company = await storage.getCompany(contact.companyId);
      if (company) {
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();
        await insightsOrchestrator.acceptTrigger({
          source: 'email',
          eventType: EventTypes.email.HIGH_OPEN_RATE,
          companyId: contact.companyId,
          companyName: company.name,
          data: {
            emailId,
            contactName,
            subject: email.subject,
            openCount
          },
          timestamp: new Date()
        });
      }
    }
  }
}

/**
 * Track email link clicked and generate insights
 */
export async function trackEmailLinkClicked(
  emailId: string,
  linkUrl: string
): Promise<void> {
  const email = await storage.getEmail(emailId);
  if (!email) return;
  
  // Update click count
  const clickCount = (email.clickCount || 0) + 1;
  await storage.updateEmail(emailId, {
    clickCount,
    clickedAt: email.clickedAt || new Date().toISOString()
  });
  
  // Generate insight for link click
  if (email.contactId) {
    const contact = await storage.getContact(email.contactId);
    if (contact?.companyId) {
      const company = await storage.getCompany(contact.companyId);
      if (company) {
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();
        await insightsOrchestrator.acceptTrigger({
          source: 'email',
          eventType: EventTypes.email.LINK_CLICKED,
          companyId: contact.companyId,
          companyName: company.name,
          data: {
            emailId,
            contactName,
            subject: email.subject,
            linkUrl,
            clickCount
          },
          timestamp: new Date()
        });
      }
    }
  }
}

/**
 * Track email reply and generate insights
 */
export async function trackEmailReply(
  emailId: string,
  replyContent: string
): Promise<void> {
  const email = await storage.getEmail(emailId);
  if (!email) return;
  
  // Update reply status
  await storage.updateEmail(emailId, {
    repliedAt: new Date().toISOString(),
    replyContent
  });
  
  // Generate insight for reply
  if (email.contactId) {
    const contact = await storage.getContact(email.contactId);
    if (contact?.companyId) {
      const company = await storage.getCompany(contact.companyId);
      if (company) {
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();
        await insightsOrchestrator.acceptTrigger({
          source: 'email',
          eventType: EventTypes.email.REPLY_RECEIVED,
          companyId: contact.companyId,
          companyName: company.name,
          data: {
            emailId,
            contactName,
            subject: email.subject,
            replyPreview: replyContent.substring(0, 100)
          },
          timestamp: new Date()
        });
      }
    }
  }
}

/**
 * Track email unsubscribe and generate insights
 */
export async function trackEmailUnsubscribe(emailId: string): Promise<void> {
  const email = await storage.getEmail(emailId);
  if (!email || !email.contactId) return;
  
  const contact = await storage.getContact(email.contactId);
  if (!contact) return;
  
  // Update contact subscription status
  await storage.updateContact(email.contactId, {
    emailVerified: false // Using this as a proxy for unsubscribed
  });
  
  // Generate insight for unsubscribe
  if (contact.companyId) {
    const company = await storage.getCompany(contact.companyId);
    if (company) {
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();
      await insightsOrchestrator.acceptTrigger({
        source: 'email',
        eventType: EventTypes.email.UNSUBSCRIBE,
        companyId: contact.companyId,
        companyName: company.name,
        data: {
          emailId,
          contactName,
          subject: email.subject
        },
        timestamp: new Date()
      });
    }
  }
}

/**
 * Calculate email engagement score for analytics
 */
export async function calculateEmailEngagementScore(contactId: string): Promise<number> {
  const emails = await storage.getEmails({ contactId, limit: 50 });
  
  if (emails.length === 0) return 0;
  
  let totalScore = 0;
  let emailCount = 0;
  
  for (const email of emails) {
    let score = 0;
    
    // Opened
    if (email.openedAt) score += 10;
    if ((email.openCount || 0) > 1) score += 5 * Math.min(email.openCount || 0, 5);
    
    // Clicked
    if (email.clickedAt) score += 20;
    if ((email.clickCount || 0) > 1) score += 10 * Math.min(email.clickCount || 0, 3);
    
    // Replied
    if (email.repliedAt) score += 50;
    
    totalScore += score;
    emailCount++;
  }
  
  return Math.round(totalScore / emailCount);
}

/**
 * Batch process email metrics for a sequence
 */
export async function processSequenceEmailMetrics(sequenceId: string): Promise<{
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}> {
  const emails = await storage.getEmails({ limit: 1000 });
  const sequenceEmails = emails.filter(e => e.sequenceId === sequenceId);
  
  const sent = sequenceEmails.length;
  const opened = sequenceEmails.filter(e => e.openedAt).length;
  const clicked = sequenceEmails.filter(e => e.clickedAt).length;
  const replied = sequenceEmails.filter(e => e.repliedAt).length;
  
  return {
    sent,
    opened,
    clicked,
    replied,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    replyRate: sent > 0 ? (replied / sent) * 100 : 0
  };
  
  // Generate insight for high-performing sequence
  if (sent >= 10 && ((replied / sent) >= 0.15 || (clicked / opened) >= 0.3)) {
    const sequence = await storage.getSequence(sequenceId);
    if (sequence) {
      await insightsOrchestrator.acceptTrigger({
        source: 'sequence',
        eventType: EventTypes.sequence.HIGH_ENGAGEMENT,
        companyId: '', // Sequences are not company-specific
        data: {
          sequenceId,
          sequenceName: sequence.name,
          metrics: {
            sent,
            replyRate: Math.round((replied / sent) * 100),
            clickRate: Math.round((clicked / opened) * 100)
          }
        },
        timestamp: new Date()
      });
    }
  }
}