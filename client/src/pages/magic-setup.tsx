import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Linkedin, Wand2, Zap, Target, Brain, CheckCircle2, ArrowRight, Settings, Rocket, Loader2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MagicSetup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupSteps, setSetupSteps] = useState<string[]>([]);
  
  // Fetch existing config
  const { data: existingConfig } = useQuery<any>({
    queryKey: ["/api/platform-config"]
  });
  
  // Fetch available playbooks
  const { data: playbooks } = useQuery<any[]>({
    queryKey: ["/api/playbooks", { isTemplate: true }]
  });
  
  // Magic Setup mutation
  const magicSetupMutation = useMutation({
    mutationFn: async (data: { linkedinUrl: string }) => {
      setSetupProgress(10);
      setSetupSteps(["Analyzing LinkedIn profile..."]);
      
      const response = await apiRequest("POST", "/api/magic-setup", data);
      
      // Simulate progressive setup steps
      const steps = [
        "Extracting industry insights...",
        "Configuring email templates...",
        "Building outreach sequences...",
        "Setting up workflow triggers...",
        "Creating industry playbooks...",
        "Optimizing lead scoring rules...",
        "Finalizing configuration..."
      ];
      
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setSetupProgress((i + 2) * 12);
        setSetupSteps(prev => [...prev, steps[i]]);
      }
      
      setSetupProgress(100);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✨ Magic Setup Complete!",
        description: `Your platform is now configured for ${data.profile.industry} sales`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-config"] });
      setTimeout(() => navigate("/dashboard-ai"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Could not complete magic setup",
        variant: "destructive"
      });
      setSetupProgress(0);
      setSetupSteps([]);
    }
  });
  
  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PATCH", "/api/platform-config", updates);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your configuration has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-config"] });
    }
  });
  
  // Apply playbook mutation
  const applyPlaybookMutation = useMutation({
    mutationFn: async (playbookId: string) => {
      const response = await apiRequest("POST", `/api/playbooks/${playbookId}/apply`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Playbook Applied",
        description: `Created ${data.applied.sequencesCreated} sequences and ${data.applied.templatesCreated} templates`,
      });
    }
  });

  if (existingConfig) {
    // Show configuration dashboard if already set up
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-h1 text-3xl">Platform Configuration</h1>
              <p className="text-muted-foreground mt-1">Manage your sales automation settings</p>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard-ai")}>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Send Limit</p>
                    <p className="text-2xl font-bold">{existingConfig.dailySendLimit || 50}</p>
                  </div>
                  <Zap className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="text-2xl font-bold">{existingConfig.linkedinProfile?.industry || "Not Set"}</p>
                  </div>
                  <Target className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Autopilot</p>
                    <Badge variant={existingConfig.autopilotEnabled ? "default" : "secondary"}>
                      {existingConfig.autopilotEnabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Brain className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Playbook</p>
                    <p className="text-2xl font-bold">{existingConfig.industryPlaybook || "Custom"}</p>
                  </div>
                  <Rocket className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Tabs */}
          <Tabs defaultValue="automation" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="automation">Automation</TabsTrigger>
              <TabsTrigger value="limits">Limits & Safety</TabsTrigger>
              <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
            </TabsList>

            <TabsContent value="automation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Automation Settings</CardTitle>
                  <CardDescription>Configure how your AI agents operate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Autopilot Mode</Label>
                      <p className="text-sm text-muted-foreground">AI autonomously finds and engages prospects</p>
                    </div>
                    <Switch
                      data-testid="switch-autopilot"
                      checked={existingConfig.autopilotEnabled}
                      onCheckedChange={(checked) => 
                        updateConfigMutation.mutate({ autopilotEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto Follow-Up</Label>
                      <p className="text-sm text-muted-foreground">Automatically send follow-ups to engaged prospects</p>
                    </div>
                    <Switch
                      data-testid="switch-auto-followup"
                      checked={existingConfig.autoFollowUp}
                      onCheckedChange={(checked) => 
                        updateConfigMutation.mutate({ autoFollowUp: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Smart Scheduling</Label>
                      <p className="text-sm text-muted-foreground">AI picks optimal times for outreach</p>
                    </div>
                    <Switch
                      data-testid="switch-smart-scheduling"
                      checked={existingConfig.smartScheduling}
                      onCheckedChange={(checked) => 
                        updateConfigMutation.mutate({ smartScheduling: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sending Limits & Safety</CardTitle>
                  <CardDescription>Protect your domain reputation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Daily Email Send Limit</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Input
                        data-testid="input-send-limit"
                        type="number"
                        value={existingConfig.dailySendLimit}
                        onChange={(e) => 
                          updateConfigMutation.mutate({ dailySendLimit: parseInt(e.target.value) })
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">emails per day</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Warming</Label>
                      <p className="text-sm text-muted-foreground">Gradually increase sending volume</p>
                    </div>
                    <Switch
                      data-testid="switch-warmup"
                      checked={existingConfig.warmupEnabled}
                      onCheckedChange={(checked) => 
                        updateConfigMutation.mutate({ warmupEnabled: checked })
                      }
                    />
                  </div>

                  <div>
                    <Label>Email Domain</Label>
                    <Input
                      data-testid="input-email-domain"
                      value={existingConfig.emailDomain || ""}
                      onChange={(e) => 
                        updateConfigMutation.mutate({ emailDomain: e.target.value })
                      }
                      placeholder="yourdomain.com"
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="playbooks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Industry Playbooks</CardTitle>
                  <CardDescription>Apply proven strategies for your industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {playbooks?.map((playbook: any) => (
                      <div key={playbook.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{playbook.name}</h3>
                            <Badge variant="secondary">{playbook.industry}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{playbook.description}</p>
                        </div>
                        <Button
                          data-testid={`button-apply-${playbook.id}`}
                          size="sm"
                          onClick={() => applyPlaybookMutation.mutate(playbook.id)}
                          disabled={applyPlaybookMutation.isPending}
                        >
                          {applyPlaybookMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Show initial setup if no config exists
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-h1 text-3xl">Magic Setup</CardTitle>
          <CardDescription className="text-base mt-2">
            Configure your entire sales platform in seconds with your LinkedIn profile
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {magicSetupMutation.isPending ? (
            <div className="space-y-4">
              <Progress value={setupProgress} className="h-2" />
              <div className="space-y-2">
                {setupSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                      <Linkedin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="linkedin"
                        data-testid="input-linkedin-url"
                        placeholder="https://linkedin.com/in/yourprofile"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      data-testid="button-magic-setup"
                      onClick={() => magicSetupMutation.mutate({ linkedinUrl })}
                      disabled={!linkedinUrl || magicSetupMutation.isPending}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      Start Magic Setup
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">What Magic Setup Does:</h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Analyzes Your Profile</p>
                      <p className="text-sm text-muted-foreground">Extracts industry, role, and company information</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Configures Email Templates</p>
                      <p className="text-sm text-muted-foreground">Creates industry-specific outreach templates</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Builds Sequences</p>
                      <p className="text-sm text-muted-foreground">Sets up multi-channel engagement campaigns</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Creates Workflow Triggers</p>
                      <p className="text-sm text-muted-foreground">Automates follow-ups and lead scoring</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Applies Industry Playbooks</p>
                      <p className="text-sm text-muted-foreground">Uses proven strategies for your market</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate("/dashboard-ai")}
                >
                  Skip Setup
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}