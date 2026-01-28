import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function Integrations() {
  const [sendgridKey, setSendgridKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [showSendgridForm, setShowSendgridForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations()
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => api.getGoogleStatus()
  });

  const saveSendgridMutation = useMutation({
    mutationFn: (data: { api_key: string; from_email: string }) =>
      api.saveSendgridIntegration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setShowSendgridForm(false);
      setSendgridKey('');
    }
  });

  const removeSendgridMutation = useMutation({
    mutationFn: () => api.removeSendgridIntegration(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }
  });

  const initGoogleOAuthMutation = useMutation({
    mutationFn: (data: { client_id: string; client_secret: string }) =>
      api.initGoogleOAuth(data),
    onSuccess: (data) => {
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    }
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => api.disconnectGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
    }
  });

  const integrationsList = [
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Send emails with open and click tracking',
      icon: '📧',
      configured: integrations?.sendgrid_configured,
      category: 'Email'
    },
    {
      id: 'google',
      name: 'Google Workspace',
      description: 'Gmail, Calendar, and Contacts integration',
      icon: '🔷',
      configured: googleStatus?.connected,
      category: 'Email',
      comingSoon: false
    },
    {
      id: 'apollo',
      name: 'Apollo.io',
      description: 'Access millions of verified B2B contacts',
      icon: '🚀',
      configured: false,
      category: 'Data',
      comingSoon: true
    },
    {
      id: 'clearbit',
      name: 'Clearbit',
      description: 'Company and contact data enrichment',
      icon: '🔍',
      configured: false,
      category: 'Data',
      comingSoon: true
    },
    {
      id: 'crunchbase',
      name: 'Crunchbase',
      description: 'Funding and company intelligence',
      icon: '💰',
      configured: false,
      category: 'Data',
      comingSoon: true
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Sales Navigator',
      description: 'Advanced lead discovery and outreach',
      icon: '💼',
      configured: false,
      category: 'Social',
      comingSoon: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and alerts in Slack',
      icon: '💬',
      configured: false,
      category: 'Notifications',
      comingSoon: true
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Sync meetings and schedule follow-ups',
      icon: '📅',
      configured: false,
      category: 'Scheduling',
      comingSoon: true
    }
  ];

  const categories = [...new Set(integrationsList.map(i => i.category))];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Connect your tools to power real-world sales execution
        </p>
      </div>

      {/* Google OAuth Setup Modal */}
      {showGoogleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🔷</span> Connect Google Workspace
              </CardTitle>
              <CardDescription>
                Connect your Google account for Gmail, Calendar, and Contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p className="font-medium text-blue-800 mb-2">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                  <li>Create a new project or select existing</li>
                  <li>Enable Gmail, Calendar, and Contacts APIs</li>
                  <li>Create OAuth 2.0 credentials (Web Application)</li>
                  <li>Add redirect URI: <code className="bg-blue-100 px-1 text-xs break-all">{process.env.REACT_APP_BACKEND_URL}/api/google/oauth/callback</code></li>
                </ol>
              </div>
              <div>
                <label className="text-sm font-medium">OAuth Client ID</label>
                <Input
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">OAuth Client Secret</label>
                <Input
                  type="password"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxxxxxx"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGoogleForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => initGoogleOAuthMutation.mutate({
                    client_id: googleClientId,
                    client_secret: googleClientSecret
                  })}
                  disabled={!googleClientId || !googleClientSecret || initGoogleOAuthMutation.isPending}
                  className="flex-1"
                >
                  {initGoogleOAuthMutation.isPending ? 'Connecting...' : 'Connect Google'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SendGrid Setup Modal */}
      {showSendgridForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Connect SendGrid</CardTitle>
              <CardDescription>
                Enter your SendGrid API key to enable email sending with tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={sendgridKey}
                  onChange={(e) => setSendgridKey(e.target.value)}
                  placeholder="SG.xxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://app.sendgrid.com/settings/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    SendGrid Settings
                  </a>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">From Email</label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be a verified sender in SendGrid
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSendgridForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveSendgridMutation.mutate({
                    api_key: sendgridKey,
                    from_email: fromEmail
                  })}
                  disabled={!sendgridKey || saveSendgridMutation.isPending}
                  className="flex-1"
                >
                  {saveSendgridMutation.isPending ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Integrations */}
      {(integrations?.sendgrid_configured || googleStatus?.connected) && (
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>✅</span> Active Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Google Integration */}
            {googleStatus?.connected && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  {googleStatus.picture && (
                    <img src={googleStatus.picture} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <h4 className="font-medium">Google Workspace</h4>
                    <p className="text-sm text-gray-500">
                      {googleStatus.email} • Gmail, Calendar, Contacts
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectGoogleMutation.mutate()}
                >
                  Disconnect
                </Button>
              </div>
            )}
            
            {/* SendGrid Integration */}
            {integrations?.sendgrid_configured && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <h4 className="font-medium">SendGrid</h4>
                    <p className="text-sm text-gray-500">
                      API Key: {integrations.sendgrid_api_key}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeSendgridMutation.mutate()}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Integrations by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{category}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrationsList
              .filter(i => i.category === category)
              .map(integration => (
                <Card
                  key={integration.id}
                  className={integration.comingSoon ? 'opacity-60' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{integration.name}</h3>
                          {integration.configured && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              Connected
                            </span>
                          )}
                          {integration.comingSoon && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {integration.description}
                        </p>
                        {!integration.comingSoon && !integration.configured && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              if (integration.id === 'sendgrid') {
                                setShowSendgridForm(true);
                              } else if (integration.id === 'google') {
                                setShowGoogleForm(true);
                              }
                            }}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}

      {/* Web Scraping Info */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🌐</span> Built-in Web Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            SalesFlow AI includes built-in web scraping and AI research capabilities:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              AI-powered lead discovery from the web
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Company website scraping for research
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Automatic email pattern detection
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Social profile discovery
            </li>
          </ul>
          <p className="mt-3 text-sm text-blue-700">
            No additional setup required - just use the AI Chat to find leads!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
