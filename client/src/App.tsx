import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
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
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/sidebar";

function Router() {
  return (
    <div className="flex h-screen overflow-hidden dark">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
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
