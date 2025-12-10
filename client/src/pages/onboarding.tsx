import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { 
  Globe, 
  Loader2, 
  Sparkles, 
  Check,
  Rocket,
  Users,
  Target,
  Mail,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface GeniusSetupResult {
  success: boolean;
  companyName: string;
  personas: { id: string; name: string }[];
  sequence: { id: string; name: string } | null;
  targetCompaniesCount: number;
}

interface OnboardingStatusResponse {
  onboardingCompleted: boolean;
}

const aiSteps = [
  { id: 1, label: "Analyzing your website...", icon: Globe },
  { id: 2, label: "Identifying your ideal customers...", icon: Target },
  { id: 3, label: "Creating buyer personas...", icon: Users },
  { id: 4, label: "Writing your first outreach sequence...", icon: Mail },
  { id: 5, label: "Finalizing your setup...", icon: Rocket },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [aiProgress, setAiProgress] = useState(0);
  const [completedAiSteps, setCompletedAiSteps] = useState<number[]>([]);
  const [setupResult, setSetupResult] = useState<GeniusSetupResult | null>(null);

  const { data: onboardingStatus, isLoading: statusLoading } = useQuery<OnboardingStatusResponse>({
    queryKey: ['/api/onboarding/status'],
  });

  useEffect(() => {
    if (onboardingStatus?.onboardingCompleted) {
      setLocation("/pulse");
    }
  }, [onboardingStatus, setLocation]);

  const geniusSetupMutation = useMutation({
    mutationFn: api.geniusSetup,
    onSuccess: (data: GeniusSetupResult) => {
      setSetupResult(data);
      setAiProgress(100);
      setCompletedAiSteps([1, 2, 3, 4, 5]);
      setTimeout(() => setCurrentStep(3), 500);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Could not complete setup. Please try again.",
        variant: "destructive",
      });
      setCurrentStep(1);
      setAiProgress(0);
      setCompletedAiSteps([]);
    },
  });

  useEffect(() => {
    if (currentStep === 2 && !setupResult) {
      const interval = setInterval(() => {
        setAiProgress(prev => {
          const next = prev + Math.random() * 8 + 2;
          return Math.min(next, 90);
        });
      }, 400);

      const stepInterval = setInterval(() => {
        setCompletedAiSteps(prev => {
          if (prev.length < 5) {
            return [...prev, prev.length + 1];
          }
          return prev;
        });
      }, 1800);

      return () => {
        clearInterval(interval);
        clearInterval(stepInterval);
      };
    }
  }, [currentStep, setupResult]);

  const handleStartSetup = () => {
    if (!websiteUrl.trim()) {
      toast({
        title: "Website Required",
        description: "Please enter your company website URL.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(2);
    setAiProgress(5);
    setCompletedAiSteps([]);
    geniusSetupMutation.mutate(websiteUrl);
  };

  const handleGoToPulse = () => {
    setLocation("/pulse");
  };

  const renderStep1 = () => (
    <motion.div
      key="step1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
    >
      <div className="text-center space-y-4 max-w-lg">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-headline">
          Let's get you started in 30 seconds
        </h1>
        <p className="text-muted-foreground text-lg">
          Just paste your website URL. Our AI will handle the rest.
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="relative">
          <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="url"
            placeholder="https://yourcompany.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartSetup()}
            className="pl-12 h-14 text-lg rounded-xl"
            data-testid="input-website-url"
          />
        </div>
        
        <Button 
          onClick={handleStartSetup}
          disabled={!websiteUrl.trim()}
          className="w-full h-12 text-lg rounded-xl"
          data-testid="button-start-setup"
        >
          <Rocket className="mr-2 h-5 w-5" />
          Start My AI Setup
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-sm">
        By continuing, you agree to our{" "}
        <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
        {" "}and{" "}
        <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
      </p>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-ai-working">
          AI is setting up your account
        </h1>
        <p className="text-muted-foreground">
          This usually takes about 10-15 seconds...
        </p>
      </div>

      <div className="w-full max-w-md space-y-6">
        <Progress value={aiProgress} className="h-2" />
        
        <div className="space-y-3">
          {aiSteps.map((step) => {
            const isCompleted = completedAiSteps.includes(step.id);
            const isActive = completedAiSteps.length === step.id - 1;
            const Icon = step.icon;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: isCompleted || isActive || completedAiSteps.length >= step.id - 1 ? 1 : 0.4,
                  x: 0 
                }}
                transition={{ duration: 0.3, delay: step.id * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isCompleted ? 'bg-green-500/10' : isActive ? 'bg-primary/5' : ''
                }`}
                data-testid={`ai-step-${step.id}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isActive 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  isCompleted ? 'text-green-600 dark:text-green-400' : isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
    >
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4"
        >
          <Check className="h-10 w-10 text-green-500" />
        </motion.div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-ready">
          You're all set! 🎉
        </h1>
        <p className="text-muted-foreground text-lg">
          We analyzed <span className="font-medium text-foreground">{setupResult?.companyName || 'your company'}</span> and created:
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="pt-6 space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium" data-testid="text-personas-count">
                {setupResult?.personas?.length || 3} Buyer Personas
              </p>
              <p className="text-sm text-muted-foreground">
                {setupResult?.personas?.map(p => p.name.split(' - ')[0]).join(', ') || 'Custom personas for your ICP'}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium" data-testid="text-sequence-name">
                1 Outreach Sequence
              </p>
              <p className="text-sm text-muted-foreground">
                {setupResult?.sequence?.name || 'AI-generated outreach sequence'}
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium" data-testid="text-companies-count">
                {setupResult?.targetCompaniesCount || 50}+ Target Companies
              </p>
              <p className="text-sm text-muted-foreground">
                Identified based on your ICP
              </p>
            </div>
          </motion.div>
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button 
          onClick={handleGoToPulse}
          size="lg"
          className="min-w-48 h-12 text-lg rounded-xl"
          data-testid="button-go-to-pulse"
        >
          <Rocket className="mr-2 h-5 w-5" />
          Go to Mission Control
        </Button>
      </motion.div>
    </motion.div>
  );

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </AnimatePresence>
      </div>
    </div>
  );
}
