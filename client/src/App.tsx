import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import DashboardAi from "@/pages/dashboard-ai";
import OutreachReview from "@/pages/outreach-review";
import VisitorIntelligence from "@/pages/visitor-intelligence";
import EmailCoach from "@/pages/email-coach";
import Sequences from "@/pages/sequences";
import LeadDatabase from "@/pages/lead-database";
import Insights from "@/pages/insights";
import ContentStudio from "@/pages/content-studio";
import UnifiedInbox from "@/pages/unified-inbox";
import Personas from "@/pages/personas";
import Analytics from "@/pages/analytics";
import CloudDialer from "@/pages/cloud-dialer";
import Deliverability from "@/pages/deliverability";
import AIAgents from "@/pages/agents";
import Onboarding from "@/pages/onboarding";
import MagicSetup from "@/pages/magic-setup";
import WorkflowBuilder from "@/pages/WorkflowBuilder";
import { PlaybooksPage } from "@/pages/playbooks";
import { AutopilotPage } from "@/pages/autopilot";
import { WorkflowTriggersPage } from "@/pages/workflow-triggers";
import { LeadScoringPage } from "@/pages/lead-scoring";
import { RoleViewsPage } from "@/pages/role-views";
import { SetupAssistantPage } from "@/pages/setup-assistant";
import { PerformanceCoachingPage } from "@/pages/performance-coaching";
import { TeamCollaborationPage } from "@/pages/team-collaboration";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import CollapsibleSidebar from "@/components/collapsible-sidebar";
import MarketplacePage from "@/pages/marketplace";
import DigitalTwins from "@/pages/digital-twins";
import SDRTeamsPage from "@/pages/sdr-teams";
import DealIntelligence from "@/pages/deal-intelligence";
import RevenueOpsPage from "@/pages/revenue-ops";
import MultiChannelPage from "@/pages/multi-channel";

function Router() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Check onboarding status (only for authenticated users)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/onboarding/profile"],
    queryFn: api.getOnboardingProfile,
    enabled: isAuthenticated, // Only check if authenticated
  });
  
  useEffect(() => {
    if (isAuthenticated && !profileLoading) {
      // Redirect to onboarding if profile doesn't exist or not completed
      if ((!profile || !profile.isComplete) && location !== "/onboarding") {
        setLocation("/onboarding");
      }
    }
  }, [profile, profileLoading, location, setLocation, isAuthenticated]);

  // Show landing page for non-authenticated users
  if (authLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  // Show onboarding page without sidebar for authenticated users who need onboarding
  if (location === "/onboarding") {
    return (
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route component={Onboarding} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CollapsibleSidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-0 md:ml-0 transition-all-soft">
        <Switch>
          <Route path="/" component={DashboardAi} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard-ai" component={DashboardAi} />
          <Route path="/outreach" component={OutreachReview} />
          <Route path="/visitors" component={VisitorIntelligence} />
          <Route path="/email-coach" component={EmailCoach} />
          <Route path="/sequences" component={Sequences} />
          <Route path="/leads" component={LeadDatabase} />
          <Route path="/insights" component={Insights} />
          <Route path="/content-studio" component={ContentStudio} />
          <Route path="/inbox" component={UnifiedInbox} />
          <Route path="/personas" component={Personas} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/dialer" component={CloudDialer} />
          <Route path="/deliverability" component={Deliverability} />
          <Route path="/agents" component={AIAgents} />
          <Route path="/marketplace" component={MarketplacePage} />
          <Route path="/magic-setup" component={MagicSetup} />
          <Route path="/workflows" component={WorkflowBuilder} />
          <Route path="/playbooks" component={PlaybooksPage} />
          <Route path="/autopilot" component={AutopilotPage} />
          <Route path="/workflow-triggers" component={WorkflowTriggersPage} />
          <Route path="/lead-scoring" component={LeadScoringPage} />
          <Route path="/role-views" component={RoleViewsPage} />
          <Route path="/setup-assistant" component={SetupAssistantPage} />
          <Route path="/performance-coaching" component={PerformanceCoachingPage} />
          <Route path="/team-collaboration" component={TeamCollaborationPage} />
          <Route path="/digital-twins" component={DigitalTwins} />
          <Route path="/sdr-teams" component={SDRTeamsPage} />
          <Route path="/deal-intelligence" component={DealIntelligence} />
          <Route path="/revenue-ops" component={RevenueOpsPage} />
          <Route path="/multi-channel" component={MultiChannelPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
