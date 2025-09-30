import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Target, Mail, Phone, Users, TrendingUp, Clock, CheckCircle,
  Building, Rocket, Calendar, Search, Filter, Sparkles, BookOpen,
  Trophy, Zap, FileText, MessageSquare, BarChart
} from "lucide-react";
import type { Playbook } from "@shared/schema";

interface PlaybookTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  targetAudience: {
    titles: string[];
    companySize: string;
    industries: string[];
  };
  sequences: Array<{
    name: string;
    steps: number;
    channels: string[];
    duration: string;
  }>;
  emailTemplates: {
    [key: string]: {
      subject: string;
      preview: string;
    };
  };
  metrics: {
    avgReplyRate: string;
    avgMeetingRate: string;
    timeToFirst: string;
  };
}

// Industry-specific playbook templates
const playbookTemplates: PlaybookTemplate[] = [
  {
    id: "saas-enterprise",
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
        subject: "Quick question about [Company]'s sales tech stack",
        preview: "Personalized opener focusing on recent company trigger..."
      },
      followUp1: {
        subject: "Thoughts on my previous note?",
        preview: "Value-add follow-up with relevant case study..."
      },
      breakup: {
        subject: "Should I close your file?",
        preview: "Final attempt with urgency and clear CTA..."
      }
    },
    metrics: {
      avgReplyRate: "32%",
      avgMeetingRate: "18%",
      timeToFirst: "2.3 days"
    }
  },
  {
    id: "smb-quick",
    name: "SMB Quick Connect",
    industry: "SMB",
    description: "High-velocity outreach for small and medium businesses",
    targetAudience: {
      titles: ["Owner", "CEO", "General Manager", "Operations Manager"],
      companySize: "10-200 employees",
      industries: ["Retail", "Professional Services", "Local Business"]
    },
    sequences: [
      {
        name: "Quick Touch",
        steps: 6,
        channels: ["Email", "Phone"],
        duration: "7 days"
      },
      {
        name: "Referral Request",
        steps: 4,
        channels: ["Email"],
        duration: "5 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "Quick idea for [Company]",
        preview: "Brief, value-focused opener with clear benefit..."
      },
      followUp1: {
        subject: "5-minute chat?",
        preview: "Direct ask with calendar link..."
      }
    },
    metrics: {
      avgReplyRate: "28%",
      avgMeetingRate: "12%",
      timeToFirst: "1.8 days"
    }
  },
  {
    id: "event-followup",
    name: "Event Follow-Up Accelerator",
    industry: "Event",
    description: "Strike while the iron is hot - convert event leads fast",
    targetAudience: {
      titles: ["Attendees", "Booth Visitors", "Session Participants"],
      companySize: "All sizes",
      industries: ["All industries"]
    },
    sequences: [
      {
        name: "Hot Lead Follow-Up",
        steps: 5,
        channels: ["Email", "Phone", "SMS"],
        duration: "3 days"
      },
      {
        name: "Warm Lead Nurture",
        steps: 7,
        channels: ["Email", "LinkedIn"],
        duration: "10 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "Great meeting you at [Event]",
        preview: "Personal reference to conversation with next steps..."
      },
      followUp1: {
        subject: "Resources from our [Event] chat",
        preview: "Value delivery with relevant materials..."
      }
    },
    metrics: {
      avgReplyRate: "45%",
      avgMeetingRate: "28%",
      timeToFirst: "0.8 days"
    }
  },
  {
    id: "product-led",
    name: "Product-Led Growth",
    industry: "PLG",
    description: "Convert free users to paid customers with targeted outreach",
    targetAudience: {
      titles: ["Power Users", "Trial Users", "Free Tier"],
      companySize: "All sizes",
      industries: ["Technology", "StartUps"]
    },
    sequences: [
      {
        name: "Trial Conversion",
        steps: 8,
        channels: ["Email", "In-app"],
        duration: "14 days"
      },
      {
        name: "Feature Upsell",
        steps: 6,
        channels: ["Email"],
        duration: "7 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "You're using [Feature] like a pro!",
        preview: "Usage-based personalization with upgrade path..."
      },
      followUp1: {
        subject: "Unlock more with [Product] Pro",
        preview: "Feature comparison with ROI focus..."
      }
    },
    metrics: {
      avgReplyRate: "38%",
      avgMeetingRate: "22%",
      timeToFirst: "1.2 days"
    }
  },
  {
    id: "account-based",
    name: "Account-Based Marketing",
    industry: "ABM",
    description: "Orchestrated multi-touch campaigns for target accounts",
    targetAudience: {
      titles: ["Multiple Stakeholders", "Buying Committee"],
      companySize: "1000+ employees",
      industries: ["Enterprise", "Fortune 500"]
    },
    sequences: [
      {
        name: "Executive Sponsorship",
        steps: 10,
        channels: ["Email", "Direct Mail", "LinkedIn"],
        duration: "30 days"
      },
      {
        name: "Champion Enablement",
        steps: 12,
        channels: ["Email", "Phone", "LinkedIn"],
        duration: "21 days"
      }
    ],
    emailTemplates: {
      initial: {
        subject: "[Company] + [YourCompany] partnership opportunity",
        preview: "Strategic alignment focus with executive positioning..."
      },
      followUp1: {
        subject: "Ideas for [Company]'s Q[X] initiatives",
        preview: "Timely value prop tied to business priorities..."
      }
    },
    metrics: {
      avgReplyRate: "42%",
      avgMeetingRate: "31%",
      timeToFirst: "3.1 days"
    }
  }
];

export function PlaybooksPage() {
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch user's custom playbooks
  const { data: customPlaybooks, isLoading } = useQuery<Playbook[]>({
    queryKey: ["/api/playbooks", { isTemplate: false }],
  });

  // Apply playbook mutation
  const applyPlaybook = useMutation({
    mutationFn: async (playbookId: string) => {
      return apiRequest(`/api/playbooks/${playbookId}/apply`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({
        title: "Playbook Applied!",
        description: "Sequences and templates have been created successfully.",
      });
    },
  });

  // Filter templates based on search and industry
  const filteredTemplates = playbookTemplates.filter(template => {
    const matchesSearch = searchQuery === "" || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIndustry = selectedIndustry === "all" || 
      template.industry === selectedIndustry;
    
    return matchesSearch && matchesIndustry;
  });

  const industries = ["all", "SaaS", "SMB", "Event", "PLG", "ABM"];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2">Sales Playbooks</h1>
            <p className="text-muted-foreground">
              Deploy battle-tested outreach strategies with one click
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-playbooks"
              />
            </div>
            <Button variant="outline" data-testid="button-create-custom">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
        </div>

        {/* Industry Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {industries.map((industry) => (
            <Button
              key={industry}
              variant={selectedIndustry === industry ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIndustry(industry)}
              className="capitalize"
              data-testid={`filter-${industry}`}
            >
              {industry === "all" ? "All Industries" : industry}
            </Button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-semibold">{playbookTemplates.length}</p>
                  <p className="text-sm text-muted-foreground">Templates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-semibold">32%</p>
                  <p className="text-sm text-muted-foreground">Avg Reply Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-semibold">1.8 days</p>
                  <p className="text-sm text-muted-foreground">Time to Reply</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-semibold">{customPlaybooks?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Playbook Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{template.industry}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Target Audience */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">TARGET AUDIENCE</p>
                  <div className="flex flex-wrap gap-1">
                    {template.targetAudience.titles.slice(0, 3).map((title) => (
                      <Badge key={title} variant="secondary" className="text-xs">
                        {title}
                      </Badge>
                    ))}
                    {template.targetAudience.titles.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.targetAudience.titles.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Sequences */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">SEQUENCES</p>
                  {template.sequences.map((sequence) => (
                    <div key={sequence.name} className="flex items-center justify-between text-sm mb-1">
                      <span>{sequence.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{sequence.steps} steps</span>
                        <span>•</span>
                        <span>{sequence.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-sm font-semibold">{template.metrics.avgReplyRate}</p>
                    <p className="text-xs text-muted-foreground">Reply</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{template.metrics.avgMeetingRate}</p>
                    <p className="text-xs text-muted-foreground">Meeting</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{template.metrics.timeToFirst}</p>
                    <p className="text-xs text-muted-foreground">Response</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3">
                  <Button 
                    className="flex-1" 
                    onClick={() => applyPlaybook.mutate(template.id)}
                    disabled={applyPlaybook.isPending}
                    data-testid={`button-apply-${template.id}`}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {applyPlaybook.isPending ? "Applying..." : "Apply Playbook"}
                  </Button>
                  <Button variant="outline" size="icon" data-testid={`button-preview-${template.id}`}>
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Playbooks Section */}
        {customPlaybooks && customPlaybooks.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-xl mb-4">Your Custom Playbooks</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customPlaybooks.map((playbook) => (
                <Card key={playbook.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{playbook.name}</CardTitle>
                    <CardDescription>{playbook.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge>{playbook.industry}</Badge>
                      <Button size="sm" variant="outline" data-testid={`button-edit-${playbook.id}`}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-3">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="font-semibold">No playbooks found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}