import { storage } from "../storage.js";
import type { InsertPlaybook } from "@shared/schema";

// Helper to ensure Json compatibility for JSONB fields
function toJson(obj: any): any {
  return obj ? JSON.parse(JSON.stringify(obj)) : null;
}

// Template playbook data
const templatePlaybooks: Omit<InsertPlaybook, 'createdBy'>[] = [
  {
    name: "Enterprise SaaS Outreach",
    industry: "SaaS",
    description: "High-touch multi-channel sequence for enterprise software sales",
    targetAudience: {
      titles: ["VP Sales", "CRO", "Head of Sales", "Sales Director"],
      companySize: "500+ employees",
      industries: ["Technology", "Financial Services", "Healthcare"]
    },
    sequences: [
      {
        name: "Executive Outreach",
        steps: 12,
        channels: ["Email", "LinkedIn", "Phone"],
        duration: "21 days"
      },
      {
        name: "Champion Building",
        steps: 8,
        channels: ["Email", "LinkedIn"],
        duration: "14 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "Quick question about {{company}}'s sales tech stack",
        preview: "Hi {{firstName}},\n\nI noticed {{company}} has been expanding rapidly. Many companies at your stage struggle with sales efficiency.\n\nWould you be open to learning how similar companies increased their pipeline velocity by 40%?"
      },
      followUp1: {
        subject: "Thoughts on my previous note?",
        preview: "Hi {{firstName}},\n\nI wanted to follow up on my previous email. I've helped companies like yours streamline their sales process.\n\nWould a 15-minute call next week be valuable to discuss your current sales challenges?"
      },
      breakup: {
        subject: "Should I close your file?",
        preview: "Hi {{firstName}},\n\nI haven't heard back from you, so I'll assume the timing isn't right.\n\nIf priorities change and you'd like to explore improving sales efficiency, I'm here.\n\nBest wishes for continued success!"
      }
    },
    successMetrics: {
      avgReplyRate: "18%",
      avgMeetingRate: "8%",
      timeToFirst: "2.3 days"
    },
    isTemplate: true
  },
  {
    name: "SMB Quick Win",
    industry: "SMB",
    description: "Fast-moving sequence for small business decision makers",
    targetAudience: {
      titles: ["Owner", "CEO", "Founder", "President"],
      companySize: "1-50 employees",
      industries: ["Retail", "Professional Services", "Manufacturing"]
    },
    sequences: [
      {
        name: "Fast Track",
        steps: 5,
        channels: ["Email", "Phone"],
        duration: "7 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "Quick win for {{company}}",
        preview: "Hi {{firstName}},\n\nI help businesses like yours save 10+ hours per week on sales tasks.\n\n15-minute call tomorrow to see if it's a fit?"
      },
      followUp1: {
        subject: "{{company}} + 10 hours saved per week",
        preview: "Hi {{firstName}},\n\nJust following up - we've helped 200+ SMBs automate their sales process.\n\nCan we chat for 15 minutes this week?"
      }
    },
    successMetrics: {
      avgReplyRate: "25%",
      avgMeetingRate: "15%",
      timeToFirst: "1.2 days"
    },
    isTemplate: true
  },
  {
    name: "Event Follow-up",
    industry: "Event",
    description: "Post-event nurture sequence for warm leads",
    targetAudience: {
      titles: ["VP Marketing", "CMO", "Marketing Director"],
      companySize: "100+ employees",
      industries: ["All Industries"]
    },
    sequences: [
      {
        name: "Event Nurture",
        steps: 6,
        channels: ["Email"],
        duration: "10 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "Great meeting you at {{eventName}}",
        preview: "Hi {{firstName}},\n\nIt was great connecting at {{eventName}}! As promised, here's the resource we discussed about improving sales efficiency.\n\nWould you like to continue our conversation over a quick call?"
      },
      followUp1: {
        subject: "Following up from {{eventName}}",
        preview: "Hi {{firstName}},\n\nHope you're settling back in after {{eventName}}. \n\nI wanted to share a case study relevant to our conversation. When would be a good time for that follow-up call we discussed?"
      }
    },
    successMetrics: {
      avgReplyRate: "35%",
      avgMeetingRate: "22%",
      timeToFirst: "1.8 days"
    },
    isTemplate: true
  },
  {
    name: "PLG User Activation",
    industry: "PLG",
    description: "Convert free users to paid customers through targeted outreach",
    targetAudience: {
      titles: ["Product Manager", "Engineering Manager", "CTO"],
      companySize: "50+ employees",
      industries: ["Technology", "SaaS"]
    },
    sequences: [
      {
        name: "Free to Paid",
        steps: 7,
        channels: ["Email", "In-app"],
        duration: "14 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "You're using 60% of {{product}} - unlock full potential?",
        preview: "Hi {{firstName}},\n\nI noticed your team has been actively using {{product}}. You're already seeing great results!\n\nWould you like to see how the premium features could 3x your current impact?"
      },
      followUp1: {
        subject: "{{company}}'s usage is growing - need more power?",
        preview: "Hi {{firstName}},\n\nYour team's usage has grown 40% this month! That's fantastic.\n\nLet me show you how premium features can handle this scale better. 15 minutes tomorrow?"
      }
    },
    successMetrics: {
      avgReplyRate: "28%",
      avgMeetingRate: "18%",
      timeToFirst: "1.5 days"
    },
    isTemplate: true
  },
  {
    name: "ABM Enterprise",
    industry: "ABM",
    description: "Account-based approach for strategic enterprise accounts",
    targetAudience: {
      titles: ["C-Suite", "VP+", "Director+"],
      companySize: "1000+ employees",
      industries: ["Fortune 500", "Enterprise"]
    },
    sequences: [
      {
        name: "Strategic Account",
        steps: 15,
        channels: ["Email", "LinkedIn", "Direct Mail", "Phone"],
        duration: "30 days"
      },
      {
        name: "Executive Alignment",
        steps: 12,
        channels: ["Email", "Phone", "LinkedIn"],
        duration: "21 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "[Company] + [YourCompany] partnership opportunity",
        preview: "Hi {{firstName}},\n\nI've been following {{company}}'s impressive growth trajectory. Your recent expansion into {{newMarket}} aligns perfectly with our expertise.\n\nWe've helped similar enterprises reduce sales cycle by 30%. Worth exploring a strategic partnership?"
      },
      followUp1: {
        subject: "Ideas for {{company}}'s Q{{quarter}} initiatives",
        preview: "Hi {{firstName}},\n\nI've prepared some ideas specifically for {{company}}'s upcoming initiatives based on your recent earnings call.\n\nCould we schedule a brief executive briefing to discuss strategic alignment?"
      }
    },
    successMetrics: {
      avgReplyRate: "42%",
      avgMeetingRate: "31%",
      timeToFirst: "3.1 days"
    },
    isTemplate: true
  }
];

export async function initializePlaybookTemplates(): Promise<void> {
  try {
    // Check if templates already exist - idempotent check by name
    const existingTemplates = await storage.getPlaybooks({ isTemplate: true });
    const existingNames = new Set(existingTemplates.map(t => t.name));
    
    // Only seed templates that don't exist yet
    const templatesToSeed = templatePlaybooks.filter(t => !existingNames.has(t.name));
    
    if (templatesToSeed.length === 0) {
      console.log(`[PlaybookSeeder] All templates already exist (${existingTemplates.length} found)`);
      return;
    }

    // Create missing templates with Json-compatible data
    const createdTemplates = await Promise.all(
      templatesToSeed.map(template => 
        storage.createPlaybook({
          name: template.name,
          industry: template.industry,
          description: template.description,
          targetAudience: toJson(template.targetAudience),
          sequences: toJson(template.sequences),
          emailTemplates: toJson(template.emailTemplates),
          callScripts: toJson(template.callScripts),
          objectionHandling: toJson(template.objectionHandling),
          successMetrics: toJson(template.successMetrics),
          isTemplate: template.isTemplate,
          createdBy: null // System-created templates
        })
      )
    );

    console.log(`[PlaybookSeeder] Successfully seeded ${createdTemplates.length} new playbook templates`);
  } catch (error) {
    console.error('[PlaybookSeeder] Failed to seed playbook templates:', error);
    // Don't throw - allow server to start even if seeding fails
  }
}

// Function to duplicate a template for user customization
export async function duplicatePlaybookTemplate(templateId: string, userId: string): Promise<any> {
  try {
    const template = await storage.getPlaybook(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Create a copy with user ownership using Json-compatible data
    const userPlaybook = await storage.createPlaybook({
      name: `${template.name} (Copy)`,
      industry: template.industry,
      description: template.description || undefined,
      targetAudience: toJson(template.targetAudience),
      sequences: toJson(template.sequences),
      emailTemplates: toJson(template.emailTemplates),
      callScripts: toJson(template.callScripts),
      objectionHandling: toJson(template.objectionHandling),
      successMetrics: toJson(template.successMetrics),
      isTemplate: false, // User copy is not a template
      createdBy: userId
    });

    return userPlaybook;
  } catch (error) {
    console.error('Failed to duplicate playbook template:', error);
    throw error;
  }
}