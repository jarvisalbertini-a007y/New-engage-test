import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { Bot, Building, Target, Users, Zap, Settings, CheckCircle, ArrowRight, Loader2, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const steps = [
  { id: 1, title: "Company Info", icon: Building },
  { id: 2, title: "Sales Goals", icon: Target },
  { id: 3, title: "Target Market", icon: Users },
  { id: 4, title: "AI Configuration", icon: Bot },
  { id: 5, title: "Launch", icon: Rocket },
];

const industries = [
  "Technology", "Healthcare", "Finance", "E-commerce", "Education",
  "Manufacturing", "Real Estate", "Consulting", "Marketing", "Legal"
];

const companySizes = [
  { value: "1-10", label: "Startup (1-10)" },
  { value: "11-50", label: "Small (11-50)" },
  { value: "51-200", label: "Medium (51-200)" },
  { value: "201-500", label: "Mid-Market (201-500)" },
  { value: "500+", label: "Enterprise (500+)" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    industry: "",
    companySize: "",
    targetMarket: "B2B",
    salesCycle: "medium",
    primaryGoal: "all",
    currentCRM: "none",
    teamSize: 5,
    monthlyLeadTarget: 100,
    avgDealSize: 5000,
  });
  const [aiConfig, setAiConfig] = useState<any>(null);

  // Check if user has already completed onboarding
  const { data: profile } = useQuery({
    queryKey: ["/api/onboarding/profile"],
    queryFn: api.getOnboardingProfile,
  });

  useEffect(() => {
    if (profile?.isComplete) {
      setLocation("/dashboard");
    } else if (profile?.onboardingStep) {
      setCurrentStep(profile.onboardingStep);
      // Pre-fill form with existing data
      if (profile.companyName) setFormData(prev => ({ ...prev, ...profile }));
    }
  }, [profile, setLocation]);

  const createProfileMutation = useMutation({
    mutationFn: api.createOnboardingProfile,
    onSuccess: () => {
      toast({
        title: "Profile Created",
        description: "Your company profile has been saved.",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: api.updateOnboardingProfile,
    onSuccess: () => {
      if (currentStep === 5) {
        toast({
          title: "Welcome to Sales Engage!",
          description: "Your AI-powered sales platform is ready.",
        });
        setLocation("/dashboard");
      }
    },
  });

  const autoConfigureMutation = useMutation({
    mutationFn: api.autoConfigureOnboarding,
    onSuccess: (data: any) => {
      setAiConfig(data);
      setIsConfiguring(false);
      toast({
        title: "AI Configuration Complete",
        description: `Created ${data.personas?.length || 0} personas, ${data.sequences?.length || 0} sequences, and ${data.agents?.length || 0} AI agents.`,
      });
    },
  });

  const applyConfigMutation = useMutation({
    mutationFn: api.applyOnboardingConfig,
    onSuccess: () => {
      updateProfileMutation.mutate({
        onboardingStep: 5,
        isComplete: true,
        completedAt: new Date().toISOString(),
      });
    },
  });

  const handleNext = async () => {
    // Save progress at each step
    if (currentStep === 1 && !profile?.id) {
      await createProfileMutation.mutateAsync({
        ...formData,
        onboardingStep: 2,
      });
    } else {
      await updateProfileMutation.mutateAsync({
        ...formData,
        onboardingStep: currentStep + 1,
      });
    }

    if (currentStep === 3) {
      // Trigger AI auto-configuration
      setIsConfiguring(true);
      autoConfigureMutation.mutate({
        industry: formData.industry,
        companySize: formData.companySize,
        targetMarket: formData.targetMarket,
        primaryGoal: formData.primaryGoal,
      });
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleApplyConfiguration = () => {
    if (aiConfig) {
      applyConfigMutation.mutate({
        personas: aiConfig.personas,
        sequences: aiConfig.sequences,
        agents: aiConfig.agents,
      });
    }
  };

  const handleSkip = () => {
    updateProfileMutation.mutate({
      onboardingStep: 5,
      isComplete: true,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                      scale: step.id <= currentStep ? 1 : 0.8,
                      opacity: step.id <= currentStep ? 1 : 0.5
                    }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 
                      ${step.id < currentStep 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : step.id === currentStep
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-muted border-muted-foreground/30 text-muted-foreground'}`}
                  >
                    {step.id < currentStep ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </motion.div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 w-full mx-2 ${
                      step.id < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={(currentStep / steps.length) * 100} className="h-2" />
        </div>

        {/* Main Content */}
        <Card className="border-2">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary mr-2" />
              <CardTitle className="text-3xl">AI-Powered Setup</CardTitle>
            </div>
            <CardDescription className="text-lg">
              {currentStep === 1 && "Tell us about your company"}
              {currentStep === 2 && "Define your sales objectives"}
              {currentStep === 3 && "Identify your target market"}
              {currentStep === 4 && "AI is configuring your platform"}
              {currentStep === 5 && "Your platform is ready!"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Company Info */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Acme Corp"
                      data-testid="input-company-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyWebsite">Website</Label>
                    <Input
                      id="companyWebsite"
                      value={formData.companyWebsite}
                      onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                      placeholder="https://example.com"
                      data-testid="input-company-website"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Select 
                      value={formData.industry}
                      onValueChange={(value) => setFormData({ ...formData, industry: value })}
                    >
                      <SelectTrigger id="industry" data-testid="select-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="companySize">Company Size</Label>
                    <Select 
                      value={formData.companySize}
                      onValueChange={(value) => setFormData({ ...formData, companySize: value })}
                    >
                      <SelectTrigger id="companySize" data-testid="select-company-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {companySizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="teamSize">Sales Team Size</Label>
                    <Input
                      id="teamSize"
                      type="number"
                      value={formData.teamSize}
                      onChange={(e) => setFormData({ ...formData, teamSize: parseInt(e.target.value) })}
                      placeholder="5"
                      data-testid="input-team-size"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currentCRM">Current CRM</Label>
                    <Select 
                      value={formData.currentCRM}
                      onValueChange={(value) => setFormData({ ...formData, currentCRM: value })}
                    >
                      <SelectTrigger id="currentCRM" data-testid="select-crm">
                        <SelectValue placeholder="Select CRM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="salesforce">Salesforce</SelectItem>
                        <SelectItem value="hubspot">HubSpot</SelectItem>
                        <SelectItem value="pipedrive">Pipedrive</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Sales Goals */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <Label>Primary Sales Goal</Label>
                  <RadioGroup 
                    value={formData.primaryGoal}
                    onValueChange={(value) => setFormData({ ...formData, primaryGoal: value })}
                  >
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="lead_gen" />
                        <div>
                          <p className="font-medium">Lead Generation</p>
                          <p className="text-sm text-muted-foreground">Find and qualify new prospects</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="closing" />
                        <div>
                          <p className="font-medium">Deal Closing</p>
                          <p className="text-sm text-muted-foreground">Convert leads to customers</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="nurturing" />
                        <div>
                          <p className="font-medium">Lead Nurturing</p>
                          <p className="text-sm text-muted-foreground">Build relationships over time</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="all" />
                        <div>
                          <p className="font-medium">Full Pipeline</p>
                          <p className="text-sm text-muted-foreground">End-to-end sales automation</p>
                        </div>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthlyLeadTarget">Monthly Lead Target</Label>
                    <Input
                      id="monthlyLeadTarget"
                      type="number"
                      value={formData.monthlyLeadTarget}
                      onChange={(e) => setFormData({ ...formData, monthlyLeadTarget: parseInt(e.target.value) })}
                      placeholder="100"
                      data-testid="input-lead-target"
                    />
                  </div>
                  <div>
                    <Label htmlFor="avgDealSize">Average Deal Size ($)</Label>
                    <Input
                      id="avgDealSize"
                      type="number"
                      value={formData.avgDealSize}
                      onChange={(e) => setFormData({ ...formData, avgDealSize: parseInt(e.target.value) })}
                      placeholder="5000"
                      data-testid="input-deal-size"
                    />
                  </div>
                </div>

                <div>
                  <Label>Sales Cycle Length</Label>
                  <RadioGroup 
                    value={formData.salesCycle}
                    onValueChange={(value) => setFormData({ ...formData, salesCycle: value })}
                  >
                    <div className="flex space-x-4 mt-2">
                      <label className="flex items-center space-x-2">
                        <RadioGroupItem value="short" />
                        <span>Short (&lt; 30 days)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" />
                        <span>Medium (30-90 days)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <RadioGroupItem value="long" />
                        <span>Long (&gt; 90 days)</span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              </motion.div>
            )}

            {/* Step 3: Target Market */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <Label>Target Market</Label>
                  <RadioGroup 
                    value={formData.targetMarket}
                    onValueChange={(value) => setFormData({ ...formData, targetMarket: value })}
                  >
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="B2B" />
                        <div>
                          <p className="font-medium">B2B</p>
                          <p className="text-sm text-muted-foreground">Sell to businesses</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="B2C" />
                        <div>
                          <p className="font-medium">B2C</p>
                          <p className="text-sm text-muted-foreground">Sell to consumers</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="Enterprise" />
                        <div>
                          <p className="font-medium">Enterprise</p>
                          <p className="text-sm text-muted-foreground">Large organizations</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                        <RadioGroupItem value="SMB" />
                        <div>
                          <p className="font-medium">SMB</p>
                          <p className="text-sm text-muted-foreground">Small & medium businesses</p>
                        </div>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="bg-primary/10 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Bot className="h-5 w-5 text-primary mr-2" />
                    <p className="font-medium">AI will automatically create:</p>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-7">
                    <li>• Buyer personas for your target market</li>
                    <li>• Email sequences optimized for your goals</li>
                    <li>• AI agents to automate prospecting</li>
                    <li>• Templates personalized for your industry</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Step 4: AI Configuration */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {isConfiguring ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-lg font-medium mb-2">AI is configuring your platform...</p>
                    <p className="text-muted-foreground">This will only take a moment</p>
                  </div>
                ) : aiConfig ? (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <CheckCircle className="h-12 w-12 text-chart-1 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Configuration Complete!</h3>
                      <p className="text-muted-foreground">AI has prepared everything for you</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Users className="h-5 w-5 text-primary" />
                            <Badge variant="secondary">{aiConfig.personas.length}</Badge>
                          </div>
                          <p className="font-medium">Buyer Personas</p>
                          <p className="text-sm text-muted-foreground">Target profiles created</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <Badge variant="secondary">{aiConfig.sequences.length}</Badge>
                          </div>
                          <p className="font-medium">Sequences</p>
                          <p className="text-sm text-muted-foreground">Automated workflows</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <Badge variant="secondary">{aiConfig.agents.length}</Badge>
                          </div>
                          <p className="font-medium">AI Agents</p>
                          <p className="text-sm text-muted-foreground">Autonomous workers</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Settings className="h-5 w-5 text-primary" />
                            <Badge variant="secondary">{aiConfig.templates.length}</Badge>
                          </div>
                          <p className="font-medium">Templates</p>
                          <p className="text-sm text-muted-foreground">Email templates ready</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm">
                        <span className="font-medium">Next step:</span> Click "Apply Configuration" to activate your AI-powered sales platform.
                        You can customize everything later from the dashboard.
                      </p>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* Step 5: Launch */}
            {currentStep === 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <Rocket className="h-16 w-16 text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-4">You're All Set!</h3>
                <p className="text-lg text-muted-foreground mb-8">
                  Your AI-powered sales platform is ready to accelerate your growth.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => setLocation("/dashboard")}
                  className="px-8"
                  data-testid="button-go-dashboard"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            )}
          </CardContent>

          {/* Actions */}
          {currentStep < 5 && (
            <div className="flex justify-between p-6 border-t">
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={currentStep === 4 && isConfiguring}
              >
                Skip Setup
              </Button>
              <div className="space-x-2">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={currentStep === 4 && isConfiguring}
                  >
                    Back
                  </Button>
                )}
                {currentStep === 4 && aiConfig ? (
                  <Button 
                    onClick={handleApplyConfiguration}
                    disabled={applyConfigMutation.isPending}
                    data-testid="button-apply-config"
                  >
                    {applyConfigMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>Apply Configuration</>
                    )}
                  </Button>
                ) : currentStep < 4 ? (
                  <Button 
                    onClick={handleNext}
                    disabled={
                      (currentStep === 1 && (!formData.companyName || !formData.industry)) ||
                      updateProfileMutation.isPending
                    }
                    data-testid="button-next"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}