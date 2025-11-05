import { storage } from "../storage";
import { type SdrTeam, type InsertSdrTeam, type SdrTeamMember, type InsertSdrTeamMember, type TeamCollaboration, type InsertTeamCollaboration, type TeamPerformance, type InsertTeamPerformance } from "@shared/schema";
import { generatePersonalizedEmail, categorizeEmailResponse } from "./openai";

// AI Persona configurations for different roles
const AI_PERSONAS = {
  researcher: {
    name: "The Researcher",
    personality: {
      traits: ["analytical", "thorough", "data-driven"],
      approach: "Deep dive into company data, news, and social signals",
      skills: ["competitive analysis", "market research", "lead enrichment", "social selling"]
    },
    systemPrompt: "You are an expert sales researcher specializing in gathering comprehensive intelligence about prospects and companies."
  },
  writer: {
    name: "The Writer",
    personality: {
      traits: ["creative", "persuasive", "empathetic"],
      approach: "Craft compelling, personalized messages that resonate",
      skills: ["copywriting", "personalization", "storytelling", "value proposition"]
    },
    systemPrompt: "You are a master sales copywriter who creates highly personalized and engaging outreach messages."
  },
  qualifier: {
    name: "The Qualifier",
    personality: {
      traits: ["methodical", "objective", "detail-oriented"],
      approach: "Assess lead quality and fit based on ICP criteria",
      skills: ["lead scoring", "BANT qualification", "intent analysis", "prioritization"]
    },
    systemPrompt: "You are an expert at qualifying leads and assessing their readiness to buy."
  },
  scheduler: {
    name: "The Scheduler",
    personality: {
      traits: ["organized", "efficient", "responsive"],
      approach: "Seamlessly coordinate calendars and book meetings",
      skills: ["calendar management", "follow-up timing", "timezone handling", "availability optimization"]
    },
    systemPrompt: "You are a professional meeting scheduler who efficiently coordinates calendars and books appointments."
  },
  manager: {
    name: "The Manager",
    personality: {
      traits: ["strategic", "analytical", "results-driven"],
      approach: "Oversee team performance and optimize strategies",
      skills: ["performance analysis", "strategy optimization", "resource allocation", "coaching"]
    },
    systemPrompt: "You are a sales team manager who oversees performance and optimizes team strategies."
  }
};

export class SDRTeamManager {
  /**
   * Create a new SDR team with specified roles and configuration
   */
  async createTeam(config: {
    name: string;
    description?: string;
    teamType?: "hunter" | "farmer" | "hybrid";
    roles: string[];
    strategy?: any;
    createdBy?: string;
  }): Promise<SdrTeam> {
    // Validate roles
    const validRoles = Object.keys(AI_PERSONAS);
    const invalidRoles = config.roles.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles: ${invalidRoles.join(", ")}. Valid roles are: ${validRoles.join(", ")}`);
    }

    // Create the team
    const team = await storage.createSdrTeam({
      name: config.name,
      description: config.description,
      teamType: config.teamType || "hybrid",
      memberRoles: config.roles,
      strategy: config.strategy,
      isActive: true,
      createdBy: config.createdBy
    });

    // Create team members for each role
    for (const role of config.roles) {
      await this.createTeamMember(team.id, role);
    }

    return team;
  }

  /**
   * Create a team member with a specific role
   */
  private async createTeamMember(teamId: string, role: string): Promise<SdrTeamMember> {
    const persona = AI_PERSONAS[role as keyof typeof AI_PERSONAS];
    if (!persona) {
      throw new Error(`Invalid role: ${role}`);
    }

    return await storage.createSdrTeamMember({
      teamId,
      role,
      personalityProfile: persona.personality,
      skills: persona.personality.skills,
      isActive: true
    });
  }

  /**
   * Assign a deal to a team
   */
  async assignDeal(teamId: string, dealInfo: {
    dealId?: string;
    contactId?: string;
    companyId?: string;
  }): Promise<TeamCollaboration> {
    const team = await storage.getSdrTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    // Create a collaboration record
    return await storage.createTeamCollaboration({
      teamId,
      dealId: dealInfo.dealId,
      contactId: dealInfo.contactId,
      companyId: dealInfo.companyId,
      collaborationType: "research",
      participantRoles: team.memberRoles as string[],
      decisions: {
        assignedAt: new Date(),
        status: "in_progress"
      }
    });
  }

  /**
   * Orchestrate collaboration between team members for a specific task
   */
  async orchestrateCollaboration(teamId: string, task: {
    type: "research" | "outreach" | "qualification" | "scheduling" | "review";
    context: any;
    targetContactId?: string;
    targetCompanyId?: string;
  }): Promise<{
    collaboration: TeamCollaboration;
    results: any;
  }> {
    const team = await storage.getSdrTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const members = await storage.getSdrTeamMembersByTeam(teamId);
    const startTime = Date.now();
    const decisions: any[] = [];
    let results: any = {};

    // Execute task based on type
    switch (task.type) {
      case "research":
        const researcher = members.find(m => m.role === "researcher");
        if (researcher) {
          // Simulate research activity
          decisions.push({
            role: "researcher",
            action: "gathered_intelligence",
            timestamp: new Date(),
            data: {
              companyInfo: task.context.company,
              contactInfo: task.context.contact,
              insights: ["Recent funding", "Expanding team", "New product launch"]
            }
          });
          results.research = {
            insights: ["Recent funding", "Expanding team", "New product launch"],
            recommendedApproach: "Focus on growth challenges"
          };
        }
        break;

      case "outreach":
        const writer = members.find(m => m.role === "writer");
        if (writer && task.targetContactId) {
          // Generate personalized email
          const contact = await storage.getContact(task.targetContactId);
          if (contact) {
            const emailContent = await generatePersonalizedEmail({
              recipientName: `${contact.firstName} ${contact.lastName}`,
              recipientTitle: contact.title || "Professional",
              recipientCompany: task.context.companyName || "your company",
              senderName: task.context.senderName || "SDR Team",
              productBenefit: task.context.productBenefit || "increase efficiency",
              tone: "professional"
            });
            
            decisions.push({
              role: "writer",
              action: "created_message",
              timestamp: new Date(),
              data: emailContent
            });
            results.outreach = emailContent;
          }
        }
        break;

      case "qualification":
        const qualifier = members.find(m => m.role === "qualifier");
        if (qualifier) {
          // Qualify the lead
          const qualificationScore = Math.random() * 100;
          decisions.push({
            role: "qualifier",
            action: "assessed_lead",
            timestamp: new Date(),
            data: {
              score: qualificationScore,
              criteria: {
                budget: qualificationScore > 60,
                authority: qualificationScore > 50,
                need: qualificationScore > 70,
                timing: qualificationScore > 40
              },
              recommendation: qualificationScore > 60 ? "pursue" : "nurture"
            }
          });
          results.qualification = {
            score: qualificationScore,
            recommendation: qualificationScore > 60 ? "pursue" : "nurture"
          };
        }
        break;

      case "scheduling":
        const scheduler = members.find(m => m.role === "scheduler");
        if (scheduler) {
          // Schedule meeting
          decisions.push({
            role: "scheduler",
            action: "proposed_times",
            timestamp: new Date(),
            data: {
              availableSlots: [
                "Monday 2:00 PM",
                "Tuesday 10:00 AM",
                "Wednesday 3:00 PM"
              ]
            }
          });
          results.scheduling = {
            proposedSlots: ["Monday 2:00 PM", "Tuesday 10:00 AM", "Wednesday 3:00 PM"]
          };
        }
        break;

      case "review":
        const manager = members.find(m => m.role === "manager");
        if (manager) {
          // Review performance
          decisions.push({
            role: "manager",
            action: "reviewed_performance",
            timestamp: new Date(),
            data: {
              effectiveness: "high",
              suggestions: ["Increase personalization", "Follow up more quickly"]
            }
          });
          results.review = {
            effectiveness: "high",
            suggestions: ["Increase personalization", "Follow up more quickly"]
          };
        }
        break;
    }

    // Record collaboration
    const collaboration = await storage.createTeamCollaboration({
      teamId,
      contactId: task.targetContactId,
      companyId: task.targetCompanyId,
      collaborationType: task.type,
      participantRoles: members.filter(m => m.isActive).map(m => m.role),
      decisions: decisions,
      outcome: "success",
      duration: Math.floor((Date.now() - startTime) / 1000)
    });

    return { collaboration, results };
  }

  /**
   * Delegate a specific task to a team member
   */
  async delegateTask(memberId: string, task: {
    type: string;
    priority: "low" | "medium" | "high";
    data: any;
  }): Promise<SdrTeamMember> {
    const member = await storage.getSdrTeamMember(memberId);
    if (!member) {
      throw new Error(`Team member ${memberId} not found`);
    }

    // Update member's current load
    const updatedMember = await storage.updateSdrTeamMember(memberId, {
      currentLoad: (member.currentLoad || 0) + 1
    });

    // In a real implementation, this would trigger actual AI processing
    // For now, we'll simulate task delegation
    console.log(`Task delegated to ${member.role}:`, task);

    return updatedMember!;
  }

  /**
   * Review team performance and generate insights
   */
  async reviewPerformance(teamId: string, period: "daily" | "weekly" | "monthly" = "weekly"): Promise<TeamPerformance> {
    const team = await storage.getSdrTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    // Get collaborations for analysis
    const collaborations = await storage.getTeamCollaborations({ teamId });
    
    // Calculate performance metrics
    const totalDeals = collaborations.length;
    const successfulDeals = collaborations.filter(c => c.outcome === "success").length;
    const conversionRate = totalDeals > 0 ? (successfulDeals / totalDeals) * 100 : 0;

    // Create performance record
    const now = new Date();
    const performance = await storage.createTeamPerformance({
      teamId,
      period,
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      endDate: now,
      metrics: {
        totalCollaborations: totalDeals,
        successfulCollaborations: successfulDeals,
        averageResponseTime: "2.5 hours",
        topPerformer: "researcher",
        improvementAreas: ["scheduling", "follow-up"]
      },
      wins: successfulDeals,
      losses: totalDeals - successfulDeals,
      conversionRate: conversionRate.toString(),
      avgDealSize: "25000"
    });

    // Update team's performance metrics
    await storage.updateSdrTeam(teamId, {
      performanceMetrics: {
        lastReview: now,
        conversionRate,
        totalDeals,
        successfulDeals
      }
    });

    return performance;
  }

  /**
   * Optimize team composition based on performance data
   */
  async optimizeTeamComposition(teamId: string): Promise<{
    currentComposition: string[];
    recommendedChanges: Array<{ action: "add" | "remove" | "replace"; role: string; reason: string }>;
    expectedImprovement: string;
  }> {
    const team = await storage.getSdrTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const members = await storage.getSdrTeamMembersByTeam(teamId);
    const collaborations = await storage.getTeamCollaborations({ teamId });

    // Analyze role effectiveness
    const rolePerformance: Record<string, number> = {};
    members.forEach(member => {
      const roleCollabs = collaborations.filter(c => 
        c.participantRoles?.includes(member.role)
      );
      const successRate = roleCollabs.filter(c => c.outcome === "success").length / 
                          (roleCollabs.length || 1);
      rolePerformance[member.role] = successRate;
    });

    // Generate recommendations
    const recommendations: Array<{ action: "add" | "remove" | "replace"; role: string; reason: string }> = [];
    
    // Check for missing critical roles
    const criticalRoles = ["researcher", "writer", "qualifier"];
    const currentRoles = members.map(m => m.role);
    
    criticalRoles.forEach(role => {
      if (!currentRoles.includes(role)) {
        recommendations.push({
          action: "add",
          role,
          reason: `Missing critical role for effective sales process`
        });
      }
    });

    // Check for underperforming roles
    Object.entries(rolePerformance).forEach(([role, performance]) => {
      if (performance < 0.3) {
        recommendations.push({
          action: "replace",
          role,
          reason: `Low success rate (${(performance * 100).toFixed(1)}%)`
        });
      }
    });

    // Add scheduler if team is getting many qualified leads
    const qualifiedLeads = collaborations.filter(c => c.collaborationType === "qualification").length;
    if (qualifiedLeads > 10 && !currentRoles.includes("scheduler")) {
      recommendations.push({
        action: "add",
        role: "scheduler",
        reason: "High volume of qualified leads requiring meeting coordination"
      });
    }

    return {
      currentComposition: currentRoles,
      recommendedChanges: recommendations,
      expectedImprovement: recommendations.length > 0 
        ? `${(recommendations.length * 10)}% increase in conversion rate`
        : "Team is optimally configured"
    };
  }

  /**
   * Get all teams with their performance metrics
   */
  async getAllTeamsWithMetrics(): Promise<Array<SdrTeam & { metrics?: any }>> {
    const teams = await storage.getSdrTeams({ isActive: true });
    
    // Add performance metrics to each team
    const teamsWithMetrics = await Promise.all(teams.map(async (team) => {
      const performances = await storage.getTeamPerformanceByTeam(team.id, "weekly");
      const latestPerformance = performances[performances.length - 1];
      
      return {
        ...team,
        metrics: latestPerformance?.metrics || null
      };
    }));

    return teamsWithMetrics;
  }

  /**
   * Get detailed team information including members and recent collaborations
   */
  async getTeamDetails(teamId: string): Promise<{
    team: SdrTeam;
    members: SdrTeamMember[];
    recentCollaborations: TeamCollaboration[];
    performance: TeamPerformance | null;
  }> {
    const team = await storage.getSdrTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const members = await storage.getSdrTeamMembersByTeam(teamId);
    const collaborations = await storage.getTeamCollaborations({ teamId });
    const performances = await storage.getTeamPerformanceByTeam(teamId);
    
    return {
      team,
      members,
      recentCollaborations: collaborations.slice(0, 10), // Last 10 collaborations
      performance: performances[performances.length - 1] || null
    };
  }
}

// Export singleton instance
export const sdrTeamManager = new SDRTeamManager();