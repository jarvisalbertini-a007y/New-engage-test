import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { 
  Globe, 
  User, 
  Shield, 
  Building2, 
  Target, 
  Users, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  Edit2, 
  Plus, 
  X,
  ArrowRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface CompanyResearchResult {
  name: string;
  domain?: string;
  industry: string;
  size: string;
  description: string;
  valueProposition: string;
  differentiators: string[];
  competitors: string[];
  targetMarkets?: string[];
  products?: string[];
  keyPainPoints?: string[];
  typicalBuyers?: { title: string; industry: string; sizeRange: string; }[];
}

interface ICPSuggestion {
  industries: string[];
  companySizes: string[];
  roles: string[];
  regions?: string[];
}

interface PersonaSuggestion {
  title: string;
  industry: string;
  companySize?: string;
  size?: string;
  pains?: string[];
  keyPains?: string[];
  goals?: string[];
  valueProps?: string[];
  proofPoints?: string[];
  communicationStyle: string;
}

interface OnboardingStatusResponse {
  step: string;
  completed: boolean;
  hasOrg: boolean;
  hasResearch: boolean;
  privacyAccepted: boolean;
  onboardingCompleted: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  research?: CompanyResearchResult;
  icp?: ICPSuggestion;
  personas?: PersonaSuggestion[];
}

interface OnboardingState {
  currentStep: number;
  websiteUrl: string;
  userName: { firstName: string; lastName: string };
  privacyAccepted: boolean;
  bugReportingConsent: boolean;
  companyResearch: CompanyResearchResult | null;
  icpSuggestions: ICPSuggestion | null;
  selectedIndustries: string[];
  selectedSizes: string[];
  selectedRoles: string[];
  personas: PersonaSuggestion[];
  selectedPersonaIndexes: number[];
}

const steps = [
  { id: 1, title: "Website", icon: Globe },
  { id: 2, title: "Name", icon: User },
  { id: 3, title: "Privacy", icon: Shield },
  { id: 4, title: "Company", icon: Building2 },
  { id: 5, title: "ICP", icon: Target },
  { id: 6, title: "Personas", icon: Users },
  { id: 7, title: "Complete", icon: CheckCircle2 },
];

const defaultCompanySizes = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const defaultRoles = ["CEO", "CTO", "VP Sales", "Sales Director", "Account Executive", "SDR", "Marketing Director", "Product Manager"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    websiteUrl: "",
    userName: { firstName: "", lastName: "" },
    privacyAccepted: false,
    bugReportingConsent: false,
    companyResearch: null,
    icpSuggestions: null,
    selectedIndustries: [],
    selectedSizes: [],
    selectedRoles: [],
    personas: [],
    selectedPersonaIndexes: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedCompanyResearch, setEditedCompanyResearch] = useState<CompanyResearchResult | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newIndustry, setNewIndustry] = useState("");
  const [newRole, setNewRole] = useState("");
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Query to fetch onboarding status on page load
  const { data: onboardingStatus, isLoading: statusLoading } = useQuery<OnboardingStatusResponse>({
    queryKey: ['/api/onboarding/status'],
  });

  // Effect to restore state from onboarding status
  useEffect(() => {
    if (!onboardingStatus || statusLoaded) return;
    
    // If onboarding is already completed, redirect to dashboard
    if (onboardingStatus.onboardingCompleted) {
      setLocation("/dashboard");
      return;
    }
    
    // Determine the starting step based on progress
    let startingStep = 1;
    
    if (onboardingStatus.hasResearch && onboardingStatus.privacyAccepted) {
      // User has research and privacy accepted, go to ICP selection (step 5)
      startingStep = 5;
    } else if (onboardingStatus.hasResearch) {
      // Has research but not privacy, need to confirm name then privacy
      startingStep = onboardingStatus.user?.firstName ? 3 : 2;
    } else if (onboardingStatus.privacyAccepted) {
      // Privacy accepted but no research, go to company research (step 4)
      startingStep = 4;
    } else if (onboardingStatus.user?.firstName) {
      // Name confirmed, skip to privacy
      startingStep = 3;
    }
    
    // Restore state from the status response
    const restoredState: Partial<OnboardingState> = {
      currentStep: startingStep,
      privacyAccepted: onboardingStatus.privacyAccepted,
    };
    
    // Restore user name if available
    if (onboardingStatus.user?.firstName) {
      restoredState.userName = {
        firstName: onboardingStatus.user.firstName,
        lastName: onboardingStatus.user.lastName || "",
      };
    }
    
    // Restore company research if available
    if (onboardingStatus.research) {
      restoredState.companyResearch = onboardingStatus.research;
      setEditedCompanyResearch(onboardingStatus.research);
    }
    
    // Restore ICP suggestions if available
    if (onboardingStatus.icp) {
      restoredState.icpSuggestions = onboardingStatus.icp;
      restoredState.selectedIndustries = onboardingStatus.icp.industries || [];
      restoredState.selectedSizes = onboardingStatus.icp.companySizes || [];
      restoredState.selectedRoles = onboardingStatus.icp.roles || [];
    }
    
    // Restore personas if available
    if (onboardingStatus.personas && onboardingStatus.personas.length > 0) {
      restoredState.personas = onboardingStatus.personas;
      restoredState.selectedPersonaIndexes = onboardingStatus.personas.map((_, i) => i);
      // If we have personas, jump to persona selection step
      if (startingStep < 6) {
        restoredState.currentStep = 6;
      }
    }
    
    setState(prev => ({ ...prev, ...restoredState }));
    setStatusLoaded(true);
  }, [onboardingStatus, statusLoaded, setLocation]);

  const researchCompanyMutation = useMutation({
    mutationFn: api.researchCompany,
    onSuccess: (data: any) => {
      // Backend returns: { research, icp, personas, fromCache }
      const researchData = data.research || data;
      
      const companyResearch: CompanyResearchResult = {
        name: researchData.name || "Your Company",
        domain: researchData.domain,
        industry: researchData.industry || "Technology",
        size: researchData.size || "11-50",
        description: researchData.description || "A growing company focused on innovation.",
        valueProposition: researchData.valueProposition || "We help businesses succeed with cutting-edge solutions.",
        differentiators: researchData.differentiators || ["Innovative technology", "Expert team", "Customer-focused"],
        competitors: researchData.competitors || ["Competitor A", "Competitor B", "Competitor C"],
        targetMarkets: researchData.targetMarkets,
        products: researchData.products,
        keyPainPoints: researchData.keyPainPoints,
        typicalBuyers: researchData.typicalBuyers,
      };
      
      // Backend returns icp with: industries, companySizes, roles
      const icpData = data.icp || {};
      const icpSuggestions: ICPSuggestion = {
        industries: icpData.industries || ["Technology", "SaaS", "Finance", "Healthcare"],
        companySizes: icpData.companySizes || ["11-50", "51-200", "201-500"],
        roles: icpData.roles || ["VP Sales", "Sales Director", "CTO"],
        regions: icpData.regions,
      };

      // Use current user name from status, or derive from research if available
      const userName = state.userName.firstName 
        ? state.userName 
        : { firstName: "User", lastName: "" };

      setState(prev => ({ 
        ...prev, 
        companyResearch,
        icpSuggestions,
        userName: prev.userName.firstName ? prev.userName : userName,
        selectedIndustries: icpSuggestions.industries,
        selectedSizes: icpSuggestions.companySizes,
        selectedRoles: icpSuggestions.roles,
        currentStep: 2
      }));
      setEditedCompanyResearch(companyResearch);
    },
    onError: (error: any) => {
      toast({
        title: "Research Failed",
        description: error.message || "Could not research your company. Please try again.",
        variant: "destructive",
      });
    },
  });

  const confirmNameMutation = useMutation({
    mutationFn: api.confirmName,
    onSuccess: () => {
      setState(prev => ({ ...prev, currentStep: 3 }));
    },
  });

  const acceptPrivacyMutation = useMutation({
    mutationFn: api.acceptPrivacy,
    onSuccess: () => {
      setState(prev => ({ ...prev, privacyAccepted: true, currentStep: 4 }));
    },
  });

  const updateICPMutation = useMutation({
    mutationFn: api.updateICP,
    onSuccess: (data: any) => {
      const generatedPersonas: PersonaSuggestion[] = data.personas || [
        {
          title: "Enterprise Sales Leader",
          industry: state.selectedIndustries[0] || "Technology",
          size: "201-500",
          keyPains: ["Long sales cycles", "Complex decision-making", "Budget constraints"],
          communicationStyle: "Data-driven, formal, focused on ROI",
        },
        {
          title: "Startup Founder",
          industry: state.selectedIndustries[1] || "SaaS",
          size: "11-50",
          keyPains: ["Limited resources", "Need for quick wins", "Scaling challenges"],
          communicationStyle: "Direct, fast-paced, results-oriented",
        },
        {
          title: "Mid-Market Director",
          industry: state.selectedIndustries[2] || "Finance",
          size: "51-200",
          keyPains: ["Team productivity", "Process automation", "Competitive pressure"],
          communicationStyle: "Balanced, relationship-focused, value-conscious",
        },
      ];
      
      setState(prev => ({ 
        ...prev, 
        personas: generatedPersonas,
        selectedPersonaIndexes: generatedPersonas.map((_, i) => i),
        currentStep: 6 
      }));
    },
    onError: () => {
      const fallbackPersonas: PersonaSuggestion[] = [
        {
          title: "Enterprise Sales Leader",
          industry: state.selectedIndustries[0] || "Technology",
          size: "201-500",
          keyPains: ["Long sales cycles", "Complex decision-making", "Budget constraints"],
          communicationStyle: "Data-driven, formal, focused on ROI",
        },
        {
          title: "Startup Founder",
          industry: state.selectedIndustries[1] || "SaaS",
          size: "11-50",
          keyPains: ["Limited resources", "Need for quick wins", "Scaling challenges"],
          communicationStyle: "Direct, fast-paced, results-oriented",
        },
      ];
      
      setState(prev => ({ 
        ...prev, 
        personas: fallbackPersonas,
        selectedPersonaIndexes: fallbackPersonas.map((_, i) => i),
        currentStep: 6 
      }));
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: api.completeOnboarding,
    onSuccess: () => {
      setState(prev => ({ ...prev, currentStep: 7 }));
    },
    onError: () => {
      setState(prev => ({ ...prev, currentStep: 7 }));
    },
  });

  const handleResearchCompany = () => {
    if (!state.websiteUrl.trim()) {
      toast({
        title: "Website Required",
        description: "Please enter your company website URL.",
        variant: "destructive",
      });
      return;
    }
    researchCompanyMutation.mutate(state.websiteUrl);
  };

  const handleConfirmName = () => {
    confirmNameMutation.mutate(state.userName);
  };

  const handleAcceptPrivacy = () => {
    acceptPrivacyMutation.mutate({
      accepted: true,
      bugReportingConsent: state.bugReportingConsent,
    });
  };

  const handleSaveCompanyResearch = () => {
    if (editedCompanyResearch) {
      setState(prev => ({ ...prev, companyResearch: editedCompanyResearch }));
    }
    setIsEditing(false);
  };

  const handleProceedToICP = () => {
    setState(prev => ({ ...prev, currentStep: 5 }));
  };

  const handleGeneratePersonas = () => {
    updateICPMutation.mutate({
      selectedIndustries: state.selectedIndustries,
      selectedSizes: state.selectedSizes,
      selectedRoles: state.selectedRoles,
    });
  };

  const handleCreatePersonas = () => {
    completeOnboardingMutation.mutate();
  };

  const togglePersona = (index: number) => {
    setState(prev => {
      const newIndexes = prev.selectedPersonaIndexes.includes(index)
        ? prev.selectedPersonaIndexes.filter(i => i !== index)
        : [...prev.selectedPersonaIndexes, index];
      return { ...prev, selectedPersonaIndexes: newIndexes };
    });
  };

  const toggleSelection = (category: 'selectedIndustries' | 'selectedSizes' | 'selectedRoles', value: string) => {
    setState(prev => {
      const current = prev[category];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: newValues };
    });
  };

  const addCustomIndustry = () => {
    if (newIndustry.trim() && !state.selectedIndustries.includes(newIndustry.trim())) {
      setState(prev => ({
        ...prev,
        selectedIndustries: [...prev.selectedIndustries, newIndustry.trim()],
      }));
      setNewIndustry("");
    }
  };

  const addCustomRole = () => {
    if (newRole.trim() && !state.selectedRoles.includes(newRole.trim())) {
      setState(prev => ({
        ...prev,
        selectedRoles: [...prev.selectedRoles, newRole.trim()],
      }));
      setNewRole("");
    }
  };

  const renderProgressIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = step.id < state.currentStep;
          const isCurrent = step.id === state.currentStep;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: step.id <= state.currentStep ? 1 : 0.8,
                  opacity: step.id <= state.currentStep ? 1 : 0.4
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                  ${isCompleted 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : isCurrent
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-muted border-muted-foreground/30 text-muted-foreground'}`}
                data-testid={`step-indicator-${step.id}`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </motion.div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 transition-all ${
                  isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      <Progress value={(state.currentStep / steps.length) * 100} className="h-2" />
      <p className="text-center text-sm text-muted-foreground mt-2">
        Step {state.currentStep} of {steps.length}: {steps[state.currentStep - 1]?.title}
      </p>
    </div>
  );

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold" data-testid="text-step-title">Let AI Set Up Your Account</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Enter your company website and our AI will research your business, identify your ideal customers, and configure everything for you.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        <div className="relative">
          <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="url"
            placeholder="https://yourcompany.com"
            value={state.websiteUrl}
            onChange={(e) => setState(prev => ({ ...prev, websiteUrl: e.target.value }))}
            className="pl-12 h-14 text-lg"
            data-testid="input-website-url"
          />
        </div>
        
        <Button 
          onClick={handleResearchCompany}
          disabled={researchCompanyMutation.isPending}
          className="w-full h-12 text-lg"
          data-testid="button-research-company"
        >
          {researchCompanyMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Researching Your Company...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Let AI Research Your Company
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold" data-testid="text-name-confirmation">
          {isEditingName 
            ? "Update Your Name" 
            : `We think your name is ${state.userName.firstName} ${state.userName.lastName}. Correct?`}
        </h2>
      </div>

      {isEditingName ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">First Name</label>
              <Input
                value={state.userName.firstName}
                onChange={(e) => setState(prev => ({ 
                  ...prev, 
                  userName: { ...prev.userName, firstName: e.target.value } 
                }))}
                placeholder="First name"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Last Name</label>
              <Input
                value={state.userName.lastName}
                onChange={(e) => setState(prev => ({ 
                  ...prev, 
                  userName: { ...prev.userName, lastName: e.target.value } 
                }))}
                placeholder="Last name"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <Button 
            onClick={() => setIsEditingName(false)}
            className="w-full"
            data-testid="button-save-name"
          >
            <Check className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-4">
          <Button 
            onClick={handleConfirmName}
            disabled={confirmNameMutation.isPending}
            className="min-w-32"
            data-testid="button-confirm-name"
          >
            {confirmNameMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                That's Me
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsEditingName(true)}
            data-testid="button-edit-name"
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      )}
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Shield className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold" data-testid="text-privacy-title">Privacy & Terms</h2>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              {" "}and{" "}
              <a href="#" className="text-primary hover:underline">Terms of Service</a>.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="bug-reporting"
            checked={state.bugReportingConsent}
            onCheckedChange={(checked) => 
              setState(prev => ({ ...prev, bugReportingConsent: checked === true }))
            }
            data-testid="checkbox-bug-reporting"
          />
          <label 
            htmlFor="bug-reporting" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            I consent to anonymous bug reporting to help improve the platform.
          </label>
        </div>

        <Button 
          onClick={handleAcceptPrivacy}
          disabled={acceptPrivacyMutation.isPending}
          className="w-full h-12"
          data-testid="button-accept-privacy"
        >
          {acceptPrivacyMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              I Accept
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold" data-testid="text-company-title">Company Research Results</h2>
          <p className="text-muted-foreground">Review and edit what AI discovered about your company</p>
        </div>
        <Button
          variant={isEditing ? "default" : "outline"}
          onClick={() => isEditing ? handleSaveCompanyResearch() : setIsEditing(true)}
          data-testid="button-toggle-edit-company"
        >
          {isEditing ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save Changes
            </>
          ) : (
            <>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {state.companyResearch && (
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Company Name</label>
                  {isEditing ? (
                    <Input
                      value={editedCompanyResearch?.name || ""}
                      onChange={(e) => setEditedCompanyResearch(prev => 
                        prev ? { ...prev, name: e.target.value } : null
                      )}
                      className="mt-1"
                      data-testid="input-company-name"
                    />
                  ) : (
                    <p className="font-medium" data-testid="text-company-name">{state.companyResearch.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Industry</label>
                  {isEditing ? (
                    <Input
                      value={editedCompanyResearch?.industry || ""}
                      onChange={(e) => setEditedCompanyResearch(prev => 
                        prev ? { ...prev, industry: e.target.value } : null
                      )}
                      className="mt-1"
                      data-testid="input-company-industry"
                    />
                  ) : (
                    <p className="font-medium" data-testid="text-company-industry">{state.companyResearch.industry}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Size</label>
                  {isEditing ? (
                    <Input
                      value={editedCompanyResearch?.size || ""}
                      onChange={(e) => setEditedCompanyResearch(prev => 
                        prev ? { ...prev, size: e.target.value } : null
                      )}
                      className="mt-1"
                      data-testid="input-company-size"
                    />
                  ) : (
                    <p className="font-medium" data-testid="text-company-size">{state.companyResearch.size} employees</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
                {isEditing ? (
                  <textarea
                    value={editedCompanyResearch?.description || ""}
                    onChange={(e) => setEditedCompanyResearch(prev => 
                      prev ? { ...prev, description: e.target.value } : null
                    )}
                    className="w-full mt-1 p-3 rounded-md border bg-background text-sm resize-none"
                    rows={3}
                    data-testid="textarea-company-description"
                  />
                ) : (
                  <p className="text-sm" data-testid="text-company-description">{state.companyResearch.description}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Value Proposition</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <textarea
                  value={editedCompanyResearch?.valueProposition || ""}
                  onChange={(e) => setEditedCompanyResearch(prev => 
                    prev ? { ...prev, valueProposition: e.target.value } : null
                  )}
                  className="w-full p-3 rounded-md border bg-background text-sm resize-none"
                  rows={2}
                  data-testid="textarea-value-proposition"
                />
              ) : (
                <p data-testid="text-value-proposition">{state.companyResearch.valueProposition}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Differentiators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(isEditing ? editedCompanyResearch?.differentiators : state.companyResearch.differentiators)?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={item}
                            onChange={(e) => {
                              const newDiffs = [...(editedCompanyResearch?.differentiators || [])];
                              newDiffs[index] = e.target.value;
                              setEditedCompanyResearch(prev => 
                                prev ? { ...prev, differentiators: newDiffs } : null
                              );
                            }}
                            className="flex-1"
                            data-testid={`input-differentiator-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newDiffs = (editedCompanyResearch?.differentiators || []).filter((_, i) => i !== index);
                              setEditedCompanyResearch(prev => 
                                prev ? { ...prev, differentiators: newDiffs } : null
                              );
                            }}
                            data-testid={`button-remove-differentiator-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-differentiator-${index}`}>{item}</Badge>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newDiffs = [...(editedCompanyResearch?.differentiators || []), "New differentiator"];
                        setEditedCompanyResearch(prev => 
                          prev ? { ...prev, differentiators: newDiffs } : null
                        );
                      }}
                      data-testid="button-add-differentiator"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Differentiator
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Competitors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(isEditing ? editedCompanyResearch?.competitors : state.companyResearch.competitors)?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            value={item}
                            onChange={(e) => {
                              const newComps = [...(editedCompanyResearch?.competitors || [])];
                              newComps[index] = e.target.value;
                              setEditedCompanyResearch(prev => 
                                prev ? { ...prev, competitors: newComps } : null
                              );
                            }}
                            className="flex-1"
                            data-testid={`input-competitor-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newComps = (editedCompanyResearch?.competitors || []).filter((_, i) => i !== index);
                              setEditedCompanyResearch(prev => 
                                prev ? { ...prev, competitors: newComps } : null
                              );
                            }}
                            data-testid={`button-remove-competitor-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-competitor-${index}`}>{item}</Badge>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newComps = [...(editedCompanyResearch?.competitors || []), "New competitor"];
                        setEditedCompanyResearch(prev => 
                          prev ? { ...prev, competitors: newComps } : null
                        );
                      }}
                      data-testid="button-add-competitor"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Competitor
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={handleProceedToICP}
          disabled={isEditing}
          className="min-w-40"
          data-testid="button-looks-good"
        >
          Looks Good
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold" data-testid="text-icp-title">Define Your Ideal Customer Profile</h2>
        <p className="text-muted-foreground">Select the characteristics of your target customers</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Target Industries</CardTitle>
            <CardDescription>Select industries you want to target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {(state.icpSuggestions?.industries || []).map((industry) => (
                <Badge
                  key={industry}
                  variant={state.selectedIndustries.includes(industry) ? "default" : "outline"}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => toggleSelection('selectedIndustries', industry)}
                  data-testid={`badge-industry-${industry.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {industry}
                  {state.selectedIndustries.includes(industry) && (
                    <Check className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom industry..."
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomIndustry()}
                className="flex-1"
                data-testid="input-custom-industry"
              />
              <Button variant="outline" onClick={addCustomIndustry} data-testid="button-add-industry">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Company Sizes</CardTitle>
            <CardDescription>Select company sizes you want to target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaultCompanySizes.map((size) => (
                <Badge
                  key={size}
                  variant={state.selectedSizes.includes(size) ? "default" : "outline"}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => toggleSelection('selectedSizes', size)}
                  data-testid={`badge-size-${size}`}
                >
                  {size} employees
                  {state.selectedSizes.includes(size) && (
                    <Check className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Target Roles</CardTitle>
            <CardDescription>Select roles you want to engage with</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {defaultRoles.map((role) => (
                <Badge
                  key={role}
                  variant={state.selectedRoles.includes(role) ? "default" : "outline"}
                  className="cursor-pointer transition-all hover:scale-105"
                  onClick={() => toggleSelection('selectedRoles', role)}
                  data-testid={`badge-role-${role.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {role}
                  {state.selectedRoles.includes(role) && (
                    <Check className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom role..."
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomRole()}
                className="flex-1"
                data-testid="input-custom-role"
              />
              <Button variant="outline" onClick={addCustomRole} data-testid="button-add-role">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleGeneratePersonas}
          disabled={updateICPMutation.isPending || state.selectedIndustries.length === 0}
          className="min-w-48"
          data-testid="button-generate-personas"
        >
          {updateICPMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Personas...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Generate Personas
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );

  const renderStep6 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold" data-testid="text-personas-title">Generated Personas</h2>
        <p className="text-muted-foreground">Toggle personas to include or exclude them from your setup</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.personas.map((persona, index) => {
          const isSelected = state.selectedPersonaIndexes.includes(index);
          return (
            <Card 
              key={index}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'opacity-60 hover:opacity-80'
              }`}
              onClick={() => togglePersona(index)}
              data-testid={`card-persona-${index}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{persona.title}</CardTitle>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                  }`}>
                    {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                  </div>
                </div>
                <CardDescription>{persona.industry} · {persona.companySize || persona.size} employees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Key Pains</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(persona.pains || persona.keyPains || []).map((pain, i) => (
                      <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-pain-${index}-${i}`}>
                        {pain}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Communication Style</label>
                  <p className="text-sm mt-1" data-testid={`text-comm-style-${index}`}>{persona.communicationStyle}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleCreatePersonas}
          disabled={completeOnboardingMutation.isPending || state.selectedPersonaIndexes.length === 0}
          className="min-w-48"
          data-testid="button-create-personas"
        >
          {completeOnboardingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create {state.selectedPersonaIndexes.length} Persona{state.selectedPersonaIndexes.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );

  const renderStep7 = () => {
    const selectedPersonasCount = state.selectedPersonaIndexes.length;
    const suggestedSequences = Math.max(2, selectedPersonasCount);
    const contentTemplates = selectedPersonasCount * 3;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-semibold" data-testid="text-completion-title">You're All Set!</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your AI-powered sales platform is ready. Here's what we've created for you:
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="flex-1" data-testid="text-summary-profile">Company profile</span>
              <Badge variant="secondary">Created</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="flex-1" data-testid="text-summary-personas">{selectedPersonasCount} persona{selectedPersonasCount !== 1 ? 's' : ''}</span>
              <Badge variant="secondary">Created</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="flex-1" data-testid="text-summary-sequences">{suggestedSequences} suggested sequences</span>
              <Badge variant="secondary">Ready</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="flex-1" data-testid="text-summary-templates">{contentTemplates} content templates</span>
              <Badge variant="secondary">Ready</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button 
            onClick={() => setLocation("/dashboard")}
            size="lg"
            className="min-w-48"
            data-testid="button-go-to-dashboard"
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  // Show loading state while fetching onboarding status
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your onboarding progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {renderProgressIndicator()}
        
        <Card className="border bg-card/50 backdrop-blur">
          <CardContent className="pt-8 pb-8">
            <AnimatePresence mode="wait">
              {state.currentStep === 1 && renderStep1()}
              {state.currentStep === 2 && renderStep2()}
              {state.currentStep === 3 && renderStep3()}
              {state.currentStep === 4 && renderStep4()}
              {state.currentStep === 5 && renderStep5()}
              {state.currentStep === 6 && renderStep6()}
              {state.currentStep === 7 && renderStep7()}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
