/// <reference types="jest" />
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';

type AuthState = {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: jest.Mock;
  register: jest.Mock;
  logout: jest.Mock;
  refreshUser: jest.Mock;
};

let mockAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshUser: jest.fn(),
};

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthState,
}));

jest.mock('./components/ui/toaster', () => ({
  Toaster: () => null,
}));

jest.mock('./components/Layout', () => {
  const React = require('react');
  const { Outlet } = require('react-router-dom');
  return {
    __esModule: true,
    default: () => (
      <div>
        LayoutShell
        <Outlet />
      </div>
    ),
  };
});

jest.mock('./pages/Landing', () => () => <div>LandingPage</div>);
jest.mock('./pages/Login', () => () => <div>LoginPage</div>);
jest.mock('./pages/Register', () => () => <div>RegisterPage</div>);
jest.mock('./pages/Dashboard', () => () => <div>DashboardPage</div>);
jest.mock('./pages/Onboarding', () => () => <div>OnboardingPage</div>);
jest.mock('./pages/SmartOnboarding', () => () => <div>SmartOnboardingPage</div>);
jest.mock('./pages/Agents', () => () => <div>AgentsPage</div>);
jest.mock('./pages/Workflows', () => () => <div>WorkflowsPage</div>);
jest.mock('./pages/WorkflowBuilder', () => () => <div>WorkflowBuilderPage</div>);
jest.mock('./pages/Prospects', () => () => <div>ProspectsPage</div>);
jest.mock('./pages/Command', () => () => <div>CommandPage</div>);
jest.mock('./pages/UniversalChat', () => () => <div>UniversalChatPage</div>);
jest.mock('./pages/Approvals', () => () => <div>ApprovalsPage</div>);
jest.mock('./pages/Settings', () => () => <div>SettingsPage</div>);
jest.mock('./pages/KnowledgeBase', () => () => <div>KnowledgeBasePage</div>);
jest.mock('./pages/AgentTeams', () => () => <div>AgentTeamsPage</div>);
jest.mock('./pages/ActivityDashboard', () => () => <div>ActivityDashboardPage</div>);
jest.mock('./pages/Integrations', () => () => <div>IntegrationsPage</div>);
jest.mock('./pages/Meetings', () => () => <div>MeetingsPage</div>);
jest.mock('./pages/AutonomousProspecting', () => () => <div>AutonomousProspectingPage</div>);
jest.mock('./pages/EmailOptimization', () => () => <div>EmailOptimizationPage</div>);
jest.mock('./pages/EmailTemplates', () => () => <div>EmailTemplatesPage</div>);
jest.mock('./pages/SelfImprovement', () => () => <div>SelfImprovementPage</div>);
jest.mock('./pages/MultiAgent', () => () => <div>MultiAgentPage</div>);
jest.mock('./pages/AICommandCenter', () => () => <div>AICommandCenterPage</div>);
jest.mock('./pages/VisualWorkflowBuilder', () => () => <div>VisualWorkflowBuilderPage</div>);
jest.mock('./pages/SalesIntelligence', () => () => <div>SalesIntelligencePage</div>);

function createAuthenticatedState(): AuthState {
  return {
    user: {
      id: 'u1',
      email: 'seller@example.com',
      firstName: 'Seller',
      role: 'sales',
      onboardingCompleted: true,
    },
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  };
}

describe('App routing', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      const message = String(args[0] || '');
      if (message.includes('React Router Future Flag Warning')) {
        return;
      }
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  async function renderAt(pathname: string) {
    window.history.pushState({}, '', pathname);
    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('routes authenticated users to Sales Intelligence page', async () => {
    mockAuthState = createAuthenticatedState();
    await renderAt('/sales-intelligence');
    expect(container.textContent).toContain('LayoutShell');
    expect(container.textContent).toContain('SalesIntelligencePage');
  });

  it('redirects unauthenticated users from Sales Intelligence to login', async () => {
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    };
    await renderAt('/sales-intelligence');
    expect(container.textContent).toContain('LoginPage');
  });

  it('redirects authenticated root requests to AI Command Center', async () => {
    mockAuthState = createAuthenticatedState();
    await renderAt('/');
    expect(container.textContent).toContain('AICommandCenterPage');
  });
});
