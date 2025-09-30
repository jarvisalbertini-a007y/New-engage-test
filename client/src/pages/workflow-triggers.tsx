import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, Settings, Activity, CheckCircle, AlertCircle,
  Mail, Users, Calendar, DollarSign, TrendingUp, Clock,
  MousePointer, FileText, Phone, MessageSquare, Target,
  Shield, Bell, Sparkles, ArrowRight, Filter, Play
} from "lucide-react";
import type { WorkflowTrigger } from "@shared/schema";

interface TriggerTemplate {
  name: string;
  icon: any;
  description: string;
  triggerType: string;
  conditions: Record<string, any>;
  actions: Array<{ type: string; label: string }>;
}

interface TriggerCategory {
  category: string;
  triggers: TriggerTemplate[];
}

// Predefined trigger templates
const triggerTemplates: TriggerCategory[] = [
  {
    category: "Engagement",
    triggers: [
      {
        name: "High-Intent Website Visit",
        icon: MousePointer,
        description: "Trigger when visitor views pricing or demo page",
        triggerType: "page_visit",
        conditions: {
          pages: ["pricing", "demo", "contact"],
          timeOnSite: 180
        },
        actions: [
          { type: "notify_rep", label: "Alert sales rep" },
          { type: "send_email", label: "Send follow-up email" },
          { type: "create_task", label: "Create follow-up task" }
        ]
      },
      {
        name: "Email Hot Lead",
        icon: Mail,
        description: "Multiple email opens and link clicks",
        triggerType: "email_engagement",
        conditions: {
          openCount: 3,
          linkClicked: true,
          withinDays: 7
        },
        actions: [
          { type: "prioritize_lead", label: "Mark as hot lead" },
          { type: "send_followup", label: "Send targeted follow-up" },
          { type: "schedule_call", label: "Schedule call task" }
        ]
      },
      {
        name: "Content Download",
        icon: FileText,
        description: "Downloaded whitepaper or case study",
        triggerType: "content_download",
        conditions: {
          contentType: ["whitepaper", "case_study", "ebook"],
          formCompleted: true
        },
        actions: [
          { type: "add_to_nurture", label: "Add to nurture sequence" },
          { type: "send_content", label: "Send related content" },
          { type: "update_score", label: "Increase lead score" }
        ]
      }
    ]
  },
  {
    category: "Qualification",
    triggers: [
      {
        name: "Lead Score Threshold",
        icon: TrendingUp,
        description: "Lead reaches qualification score",
        triggerType: "lead_score",
        conditions: {
          scoreThreshold: 75,
          scoreIncrease: 20
        },
        actions: [
          { type: "assign_to_ae", label: "Assign to account executive" },
          { type: "create_opportunity", label: "Create opportunity" },
          { type: "send_internal_alert", label: "Alert sales manager" }
        ]
      },
      {
        name: "ICP Match",
        icon: Target,
        description: "Company matches ideal customer profile",
        triggerType: "icp_match",
        conditions: {
          companySize: ["50-200", "200-500"],
          industry: ["SaaS", "Technology"],
          title: ["VP", "Director", "C-Level"]
        },
        actions: [
          { type: "fast_track", label: "Fast-track to sales" },
          { type: "personalized_outreach", label: "Send personalized message" },
          { type: "book_demo", label: "Offer calendar link" }
        ]
      },
      {
        name: "Budget Confirmed",
        icon: DollarSign,
        description: "Prospect confirms budget availability",
        triggerType: "qualification_field",
        conditions: {
          field: "budget",
          value: "confirmed",
          minAmount: 10000
        },
        actions: [
          { type: "move_to_negotiation", label: "Move to negotiation" },
          { type: "send_proposal", label: "Send proposal template" },
          { type: "schedule_close_call", label: "Schedule closing call" }
        ]
      }
    ]
  },
  {
    category: "Timing",
    triggers: [
      {
        name: "Stale Opportunity",
        icon: Clock,
        description: "No activity in last 14 days",
        triggerType: "inactivity",
        conditions: {
          daysSinceLastActivity: 14,
          stage: ["qualified", "demo", "proposal"]
        },
        actions: [
          { type: "re_engage", label: "Send re-engagement email" },
          { type: "manager_review", label: "Flag for manager review" },
          { type: "update_forecast", label: "Update forecast status" }
        ]
      },
      {
        name: "Meeting No-Show",
        icon: Calendar,
        description: "Prospect missed scheduled meeting",
        triggerType: "meeting_noshow",
        conditions: {
          meetingType: ["demo", "discovery", "closing"]
        },
        actions: [
          { type: "reschedule_email", label: "Send reschedule email" },
          { type: "sms_reminder", label: "Send SMS follow-up" },
          { type: "update_status", label: "Update opportunity status" }
        ]
      },
      {
        name: "Contract Expiry",
        icon: FileText,
        description: "Customer contract expiring soon",
        triggerType: "contract_expiry",
        conditions: {
          daysUntilExpiry: 60,
          contractValue: 5000
        },
        actions: [
          { type: "renewal_sequence", label: "Start renewal sequence" },
          { type: "customer_success_alert", label: "Alert CS team" },
          { type: "prepare_renewal", label: "Generate renewal quote" }
        ]
      }
    ]
  },
  {
    category: "Response",
    triggers: [
      {
        name: "Positive Reply",
        icon: MessageSquare,
        description: "Prospect responds with interest",
        triggerType: "email_reply",
        conditions: {
          sentiment: "positive",
          keywords: ["interested", "let's talk", "schedule", "demo"]
        },
        actions: [
          { type: "book_meeting", label: "Send calendar link" },
          { type: "notify_team", label: "Notify sales team" },
          { type: "pause_sequence", label: "Pause other sequences" }
        ]
      },
      {
        name: "Objection Detected",
        icon: AlertCircle,
        description: "Common objection in response",
        triggerType: "objection",
        conditions: {
          objectionType: ["price", "timing", "competitor", "features"]
        },
        actions: [
          { type: "objection_response", label: "Send objection handling" },
          { type: "add_resources", label: "Share relevant resources" },
          { type: "escalate_to_senior", label: "Loop in senior rep" }
        ]
      },
      {
        name: "Unsubscribe Request",
        icon: Shield,
        description: "Prospect requests to unsubscribe",
        triggerType: "unsubscribe",
        conditions: {
          explicit: true
        },
        actions: [
          { type: "remove_from_sequences", label: "Remove from all sequences" },
          { type: "update_preferences", label: "Update contact preferences" },
          { type: "confirmation_email", label: "Send confirmation" }
        ]
      }
    ]
  }
];

export function WorkflowTriggersPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TriggerTemplate | null>(null);

  // Fetch existing triggers
  const { data: triggers, isLoading } = useQuery<WorkflowTrigger[]>({
    queryKey: ["/api/workflow-triggers"],
  });

  // Create trigger mutation
  const createTrigger = useMutation({
    mutationFn: async (trigger: any) => {
      return apiRequest("/api/workflow-triggers", "POST", trigger);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-triggers"] });
      setShowCreate(false);
      setSelectedTemplate(null);
      toast({
        title: "Trigger Created!",
        description: "Your workflow trigger is now active.",
      });
    },
  });

  // Toggle trigger mutation
  const toggleTrigger = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/workflow-triggers/${id}`, "PATCH", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-triggers"] });
    },
  });

  // Delete trigger mutation
  const deleteTrigger = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/workflow-triggers/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-triggers"] });
      toast({
        title: "Trigger Deleted",
        description: "Workflow trigger has been removed.",
      });
    },
  });

  // Calculate metrics
  const activeTriggers = triggers?.filter(t => t.isActive).length || 0;
  const totalExecutions = triggers?.reduce((sum, t) => sum + (t.executionCount || 0), 0) || 0;

  const categories = ["all", "Engagement", "Qualification", "Timing", "Response"];

  const filteredTemplates = selectedCategory === "all" 
    ? triggerTemplates.flatMap(cat => cat.triggers)
    : triggerTemplates.find(cat => cat.category === selectedCategory)?.triggers || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              Workflow Triggers
            </h1>
            <p className="text-muted-foreground">
              Automate your sales process with intelligent event-driven workflows
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">
              <Activity className="h-4 w-4 mr-1" />
              {activeTriggers} Active
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Play className="h-4 w-4 mr-1" />
              {totalExecutions} Executions
            </Badge>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MousePointer className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-semibold">
                    {triggers?.filter(t => t.triggerType === 'page_visit').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Engagement</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-semibold">
                    {triggers?.filter(t => t.triggerType === 'lead_score').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Qualification</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-semibold">
                    {triggers?.filter(t => t.triggerType === 'inactivity').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Timing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-semibold">
                    {triggers?.filter(t => t.triggerType === 'email_reply').length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="active">Active Triggers</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                  data-testid={`filter-${category.toLowerCase()}`}
                >
                  {category === "all" ? "All Templates" : category}
                </Button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template, idx) => (
                <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <template.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">CONDITIONS</p>
                      <div className="space-y-1">
                        {Object.entries(template.conditions).slice(0, 2).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className="text-muted-foreground">
                              {typeof value === 'object' ? (value as any[]).join(', ') : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">ACTIONS</p>
                      <div className="flex flex-wrap gap-1">
                        {template.actions.slice(0, 3).map((action, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {action.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowCreate(true);
                      }}
                      data-testid={`button-use-${idx}`}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {triggers && triggers.length > 0 ? (
              <div className="space-y-4">
                {triggers.map((trigger) => (
                  <Card key={trigger.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {trigger.name}
                            <Badge variant={trigger.isActive ? "default" : "secondary"}>
                              {trigger.isActive ? "Active" : "Paused"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{trigger.description}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={trigger.isActive || false}
                            onCheckedChange={(checked) =>
                              toggleTrigger.mutate({ id: trigger.id, isActive: checked })
                            }
                            data-testid={`switch-trigger-${trigger.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTrigger.mutate(trigger.id)}
                            data-testid={`button-delete-${trigger.id}`}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span>Type: {trigger.triggerType}</span>
                          <span>Executions: {trigger.executionCount || 0}</span>
                          {trigger.lastExecuted && (
                            <span>Last: {new Date(trigger.lastExecuted).toLocaleDateString()}</span>
                          )}
                        </div>
                        <Button variant="outline" size="sm" data-testid={`button-edit-${trigger.id}`}>
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-3">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">No Active Triggers</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first trigger from the templates above
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="p-12">
              <div className="text-center space-y-3">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="font-semibold">Execution History</h3>
                <p className="text-sm text-muted-foreground">
                  Trigger execution history will appear here
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Trigger Modal */}
        {showCreate && selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Create Workflow Trigger</CardTitle>
                <CardDescription>
                  Configure your trigger based on the {selectedTemplate.name} template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Trigger Name</Label>
                  <Input
                    defaultValue={selectedTemplate.name}
                    data-testid="input-trigger-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    defaultValue={selectedTemplate.description}
                    data-testid="input-trigger-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Conditions</Label>
                  <Card className="p-4 bg-muted/30">
                    <div className="space-y-2">
                      {Object.entries(selectedTemplate.conditions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className="text-sm font-mono">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="space-y-2">
                  <Label>Actions (in order)</Label>
                  <div className="space-y-2">
                    {selectedTemplate.actions.map((action: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{idx + 1}.</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge>{action.label}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Label htmlFor="auto-activate">Activate immediately</Label>
                  <Switch id="auto-activate" defaultChecked data-testid="switch-auto-activate" />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      createTrigger.mutate({
                        ...selectedTemplate,
                        isActive: true
                      });
                    }}
                    data-testid="button-create-trigger"
                  >
                    Create Trigger
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false);
                      setSelectedTemplate(null);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}