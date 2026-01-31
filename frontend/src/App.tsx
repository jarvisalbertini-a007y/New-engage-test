import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import SmartOnboarding from './pages/SmartOnboarding';
import Agents from './pages/Agents';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import Prospects from './pages/Prospects';
import Command from './pages/Command';
import UniversalChat from './pages/UniversalChat';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import KnowledgeBase from './pages/KnowledgeBase';
import AgentTeams from './pages/AgentTeams';
import ActivityDashboard from './pages/ActivityDashboard';
import Integrations from './pages/Integrations';
import Meetings from './pages/Meetings';
import AutonomousProspecting from './pages/AutonomousProspecting';
import EmailOptimization from './pages/EmailOptimization';
import EmailTemplates from './pages/EmailTemplates';
import SelfImprovement from './pages/SelfImprovement';
import MultiAgent from './pages/MultiAgent';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while auth state is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
      
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } />
      
      <Route path="/smart-onboarding" element={
        <ProtectedRoute>
          <SmartOnboarding />
        </ProtectedRoute>
      } />
      
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agent-teams" element={<AgentTeams />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflow-builder" element={<WorkflowBuilder />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/prospects" element={<Prospects />} />
        <Route path="/command" element={<Command />} />
        <Route path="/chat" element={<UniversalChat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/activity" element={<ActivityDashboard />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/autonomous" element={<AutonomousProspecting />} />
        <Route path="/email-optimization" element={<EmailOptimization />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/self-improvement" element={<SelfImprovement />} />
        <Route path="/multi-agent" element={<MultiAgent />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
