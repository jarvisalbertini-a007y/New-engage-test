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
    sequenceExecutionId?: string;
  }
): Promise<Email> {
  // Create email record
  const email = await storage.createEmail({
    contactId: emailData.contactId,
    subject: emailData.subject,
    body: emailData.body,
    status: 'sent',
    sentAt: new Date(),
    sequenceExecutionId: emailData.sequenceExecutionId,
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
  
  // Update opened timestamp
  const isFirstOpen = !email.openedAt;
  await storage.updateEmail(emailId, {
    openedAt: email.openedAt || new Date(),
    status: 'opened'
  });
  
  // If first open and we have contact, check for engagement
  if (isFirstOpen && email.contactId) {
    const contact = await storage.getContact(email.contactId);
    if (contact?.companyId) {
      // Count recent opens from this company
      const emails = await storage.getEmails({ contactId: email.contactId, limit: 10 });
      const recentOpens = emails.filter(e => e.openedAt && 
        e.openedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;
      
      // If high engagement (multiple opens recently), generate insight
      if (recentOpens >= 3) {
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
              recentOpens
            },
            timestamp: new Date()
          });
        }
      }
    }
  }
}

/**
 * Track email link clicked and generate insights
 * Since we don't have a clickedAt field, we'll use status and generate insight immediately
 */
export async function trackEmailLinkClicked(
  emailId: string,
  linkUrl: string
): Promise<void> {
  const email = await storage.getEmail(emailId);
  if (!email) return;
  
  // Update status to reflect engagement
  await storage.updateEmail(emailId, {
    status: 'clicked'
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
            linkUrl
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
    repliedAt: new Date(),
    status: 'replied'
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
  
  // Update contact verification status as a proxy for unsubscribed
  await storage.updateContact(email.contactId, {
    isVerified: false
  });
  
  // Update email status
  await storage.updateEmail(emailId, {
    status: 'unsubscribed'
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
    
    // Status-based scoring
    if (email.status === 'opened') score += 10;
    if (email.status === 'clicked') score += 30;
    if (email.status === 'replied') score += 50;
    
    // Time-based scoring (recent emails worth more)
    const daysSinceSent = email.sentAt ? 
      (Date.now() - email.sentAt.getTime()) / (1000 * 60 * 60 * 24) : 30;
    if (daysSinceSent < 7) score *= 1.5;
    else if (daysSinceSent < 14) score *= 1.2;
    
    totalScore += score;
    emailCount++;
  }
  
  return Math.round(totalScore / emailCount);
}

/**
 * Batch process email metrics for a sequence execution
 */
export async function processSequenceEmailMetrics(sequenceExecutionId: string): Promise<{
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}> {
  const emails = await storage.getEmails({ limit: 1000 });
  const sequenceEmails = emails.filter(e => e.sequenceExecutionId === sequenceExecutionId);
  
  const sent = sequenceEmails.length;
  const opened = sequenceEmails.filter(e => e.status === 'opened' || e.status === 'clicked' || e.status === 'replied').length;
  const clicked = sequenceEmails.filter(e => e.status === 'clicked' || e.status === 'replied').length;
  const replied = sequenceEmails.filter(e => e.status === 'replied').length;
  
  const metrics = {
    sent,
    opened,
    clicked,
    replied,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    replyRate: sent > 0 ? (replied / sent) * 100 : 0
  };
  
  // Generate insight for high-performing sequence
  // Note: Simplified to work without needing sequence execution details
  // High-performing sequences are tracked based on metrics alone
  if (sent >= 10 && (metrics.replyRate >= 15 || metrics.clickRate >= 30)) {
    await insightsOrchestrator.acceptTrigger({
      source: 'sequence',
      eventType: EventTypes.sequence.HIGH_ENGAGEMENT,
      companyId: '', // Sequences are not company-specific
      data: {
        sequenceExecutionId,
        metrics: {
          sent,
          replyRate: Math.round(metrics.replyRate),
          clickRate: Math.round(metrics.clickRate),
          openRate: Math.round(metrics.openRate)
        }
      },
      timestamp: new Date()
    });
  }
  
  return metrics;
}