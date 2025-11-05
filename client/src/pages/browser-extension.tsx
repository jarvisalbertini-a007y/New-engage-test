import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Globe2, 
  Download, 
  Settings, 
  Activity, 
  Zap, 
  Copy, 
  RefreshCw,
  Users,
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Send,
  Calendar,
  TrendingUp,
  Shield,
  ChevronRight,
  ExternalLink,
  Search,
  Filter,
  Clock,
  BarChart3,
  Linkedin,
  Twitter,
  Github,
  Chrome,
  Code,
  Database,
  UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';

export function BrowserExtension() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiKey, setApiKey] = useState('');
  const [mockUrl, setMockUrl] = useState('');
  const [enrichmentType, setEnrichmentType] = useState('profile');
  
  // Fetch extension settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/extension/settings'],
    retry: false
  });
  
  // Fetch extension stats
  const { data: stats } = useQuery({
    queryKey: ['/api/extension/stats']
  });
  
  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ['/api/extension/activities', { limit: 10 }]
  });
  
  // Fetch quick actions history
  const { data: quickActions } = useQuery({
    queryKey: ['/api/extension/quick-actions', { limit: 10 }]
  });
  
  // Generate API key mutation
  const generateApiKeyMutation = useMutation({
    mutationFn: () => apiRequest('/api/extension/auth', 'POST'),
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      toast({
        title: "API Key Generated",
        description: "Your extension API key has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extension/settings'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate API key.",
        variant: "destructive"
      });
    }
  });
  
  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: any) => 
      apiRequest('/api/extension/settings', 'PATCH', newSettings),
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your extension settings have been saved."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extension/settings'] });
    }
  });
  
  // Mock enrichment mutation
  const mockEnrichMutation = useMutation({
    mutationFn: (data: { url?: string; domain?: string; type: string }) =>
      apiRequest('/api/extension/enrich', 'POST', data),
    onSuccess: (data) => {
      toast({
        title: "Enrichment Complete",
        description: "Data has been enriched successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extension/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/extension/stats'] });
    },
    onError: () => {
      toast({
        title: "Enrichment Failed",
        description: "Unable to enrich the provided URL or domain.",
        variant: "destructive"
      });
    }
  });
  
  // Execute quick action mutation
  const executeActionMutation = useMutation({
    mutationFn: (data: { action: string; data: any }) =>
      apiRequest('/api/extension/action', 'POST', data),
    onSuccess: () => {
      toast({
        title: "Action Executed",
        description: "Quick action has been performed successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extension/quick-actions'] });
    }
  });
  
  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({
        title: "Copied!",
        description: "API key copied to clipboard."
      });
    }
  };
  
  const handleMockEnrichment = () => {
    if (!mockUrl) {
      toast({
        title: "URL Required",
        description: "Please enter a URL or domain to enrich.",
        variant: "destructive"
      });
      return;
    }
    
    const data: any = { type: enrichmentType };
    if (enrichmentType === 'company' || enrichmentType === 'technologies') {
      // Extract domain from URL
      try {
        const url = new URL(mockUrl.includes('://') ? mockUrl : `https://${mockUrl}`);
        data.domain = url.hostname;
      } catch {
        data.domain = mockUrl;
      }
    } else {
      data.url = mockUrl;
    }
    
    mockEnrichMutation.mutate(data);
  };
  
  return (
    <div className="container mx-auto py-6 px-6 lg:px-8 max-w-7xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Browser Extension
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Enrich prospects instantly while browsing LinkedIn and company websites
            </p>
          </div>
          {settings && (
            <Badge 
              className={settings.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}
              variant={settings.isActive ? "default" : "secondary"}
              data-testid="status-extension-active"
            >
              {settings.isActive ? 'Active' : 'Inactive'}
            </Badge>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <Activity className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-6">
            {/* Installation Guide */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Chrome className="h-5 w-5" />
                  Installation Guide
                </CardTitle>
                <CardDescription>
                  Get started with the browser extension in 3 easy steps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!settings?.extensionId ? (
                  <>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">1</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">Generate API Key</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Create your unique API key to authenticate the extension
                        </p>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => generateApiKeyMutation.mutate()}
                          disabled={generateApiKeyMutation.isPending}
                          data-testid="button-generate-api-key"
                        >
                          {generateApiKeyMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Shield className="h-4 w-4 mr-2" />
                          )}
                          Generate API Key
                        </Button>
                      </div>
                    </div>
                    
                    {apiKey && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">
                          Your API Key (copy this now, it won't be shown again):
                        </p>
                        <div className="flex items-center gap-2">
                          <Input 
                            value={apiKey} 
                            readOnly 
                            className="font-mono text-xs"
                            data-testid="input-api-key"
                          />
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={copyApiKey}
                            data-testid="button-copy-api-key"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">2</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">Install Extension</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Download and install the browser extension from Chrome Web Store
                        </p>
                        <Button 
                          size="sm" 
                          className="mt-2"
                          variant="outline"
                          disabled
                          data-testid="button-install-extension"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Coming Soon
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">3</Badge>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">Configure & Start</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Enter your API key in the extension and start enriching prospects
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="font-medium text-sm text-green-800 dark:text-green-300">
                        Extension is installed and active
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Usage Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total Enrichments</p>
                      <p className="text-2xl font-semibold mt-1" data-testid="text-total-enrichments">
                        {stats?.totalEnrichments || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Saved Leads</p>
                      <p className="text-2xl font-semibold mt-1" data-testid="text-saved-leads">
                        {stats?.savedLeads || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <Save className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Quick Actions</p>
                      <p className="text-2xl font-semibold mt-1" data-testid="text-quick-actions">
                        {stats?.quickActions || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Companies Found</p>
                      <p className="text-2xl font-semibold mt-1" data-testid="text-companies-found">
                        {stats?.companiesEnriched || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                      <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Recent Activity Feed */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Your latest enrichment activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activities && activities.length > 0 ? (
                    activities.map((activity: any) => (
                      <div 
                        key={activity.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        data-testid={`activity-item-${activity.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {activity.activityType === 'enrich' ? (
                            <Search className="h-4 w-4 text-blue-600" />
                          ) : activity.activityType === 'save' ? (
                            <Save className="h-4 w-4 text-green-600" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {activity.domain || activity.url}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {activity.activityType} • {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {activity.enrichedData && (
                          <Badge variant="secondary" className="text-xs">
                            Enriched
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Auto-Enrichment Rules</CardTitle>
                <CardDescription>Configure automatic data enrichment triggers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-linkedin">Auto-enrich LinkedIn profiles</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Automatically enrich when viewing LinkedIn profiles
                    </p>
                  </div>
                  <Switch 
                    id="auto-linkedin"
                    checked={settings?.autoEnrichLinkedIn || false}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ autoEnrichLinkedIn: checked })
                    }
                    data-testid="switch-auto-linkedin"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-company">Auto-enrich company websites</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Automatically enrich when visiting company websites
                    </p>
                  </div>
                  <Switch 
                    id="auto-company"
                    checked={settings?.autoEnrichCompany || false}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ autoEnrichCompany: checked })
                    }
                    data-testid="switch-auto-company"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-save">Auto-save enriched leads</Label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Automatically save enriched data to your CRM
                    </p>
                  </div>
                  <Switch 
                    id="auto-save"
                    checked={settings?.autoSave || false}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ autoSave: checked })
                    }
                    data-testid="switch-auto-save"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Data Fields</CardTitle>
                <CardDescription>Select which data fields to capture during enrichment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'name', label: 'Full Name' },
                    { id: 'email', label: 'Email Address' },
                    { id: 'phone', label: 'Phone Number' },
                    { id: 'title', label: 'Job Title' },
                    { id: 'company', label: 'Company' },
                    { id: 'location', label: 'Location' },
                    { id: 'linkedin', label: 'LinkedIn URL' },
                    { id: 'twitter', label: 'Twitter Handle' },
                    { id: 'website', label: 'Website' },
                    { id: 'technologies', label: 'Tech Stack' },
                    { id: 'employees', label: 'Employee Count' },
                    { id: 'revenue', label: 'Revenue Range' }
                  ].map((field) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Switch 
                        id={field.id}
                        checked={settings?.dataFields?.[field.id] !== false}
                        onCheckedChange={(checked) => {
                          const newFields = { ...settings?.dataFields, [field.id]: checked };
                          updateSettingsMutation.mutate({ dataFields: newFields });
                        }}
                        data-testid={`switch-field-${field.id}`}
                      />
                      <Label htmlFor={field.id} className="text-sm cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Configure quick actions available in the extension</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-gray-600" />
                    <div>
                      <Label>Add to Sequence</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Quick-add prospects to email sequences
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings?.quickActions?.addToSequence !== false}
                    onCheckedChange={(checked) => {
                      const newActions = { ...settings?.quickActions, addToSequence: checked };
                      updateSettingsMutation.mutate({ quickActions: newActions });
                    }}
                    data-testid="switch-action-sequence"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-600" />
                    <div>
                      <Label>Send Email</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Compose and send emails directly
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings?.quickActions?.sendEmail !== false}
                    onCheckedChange={(checked) => {
                      const newActions = { ...settings?.quickActions, sendEmail: checked };
                      updateSettingsMutation.mutate({ quickActions: newActions });
                    }}
                    data-testid="switch-action-email"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <div>
                      <Label>Schedule Meeting</Label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Book meetings with prospects
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings?.quickActions?.scheduleMeeting !== false}
                    onCheckedChange={(checked) => {
                      const newActions = { ...settings?.quickActions, scheduleMeeting: checked };
                      updateSettingsMutation.mutate({ quickActions: newActions });
                    }}
                    data-testid="switch-action-meeting"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Enrichment History</CardTitle>
                    <CardDescription>View all your past enrichment activities</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" data-testid="button-export-history">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-filter-history">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activities?.map((activity: any) => (
                    <div 
                      key={activity.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      data-testid={`history-item-${activity.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {activity.activityType === 'enrich' && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                Enriched
                              </Badge>
                            )}
                            {activity.activityType === 'save' && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                Saved
                              </Badge>
                            )}
                            {activity.activityType === 'view' && (
                              <Badge variant="secondary">Viewed</Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-medium text-sm mb-1">
                            {activity.domain || activity.url}
                          </p>
                          {activity.enrichedData && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                              <p>• Name: {activity.enrichedData.name || 'N/A'}</p>
                              <p>• Title: {activity.enrichedData.title || 'N/A'}</p>
                              <p>• Company: {activity.enrichedData.company || 'N/A'}</p>
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          data-testid={`button-view-details-${activity.id}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(!activities || activities.length === 0) && (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No enrichment history yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions Log</CardTitle>
                <CardDescription>History of quick actions executed from the extension</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quickActions?.map((action: any) => (
                    <div 
                      key={action.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      data-testid={`quick-action-${action.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {action.actionType === 'add_to_sequence' && (
                          <Send className="h-4 w-4 text-blue-600" />
                        )}
                        {action.actionType === 'send_email' && (
                          <Mail className="h-4 w-4 text-green-600" />
                        )}
                        {action.actionType === 'save_lead' && (
                          <Save className="h-4 w-4 text-purple-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {action.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(action.executedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {action.result?.success && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  ))}
                  
                  {(!quickActions || quickActions.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No quick actions executed yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Extension Preview</CardTitle>
                <CardDescription>
                  Try out the extension features without installing the browser extension
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mock Extension UI */}
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-600 rounded">
                      <Globe2 className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-sm">Sales Extension</span>
                    <Badge variant="secondary" className="ml-auto text-xs">Demo Mode</Badge>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="mock-url" className="text-xs mb-2">
                        Enter URL or Domain to Enrich
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                          id="mock-url"
                          placeholder="linkedin.com/in/johndoe or example.com"
                          value={mockUrl}
                          onChange={(e) => setMockUrl(e.target.value)}
                          className="flex-1"
                          data-testid="input-mock-url"
                        />
                        <Select value={enrichmentType} onValueChange={setEnrichmentType}>
                          <SelectTrigger className="w-32" data-testid="select-enrichment-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="profile">Profile</SelectItem>
                            <SelectItem value="company">Company</SelectItem>
                            <SelectItem value="technologies">Tech Stack</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={handleMockEnrichment}
                      disabled={mockEnrichMutation.isPending || !mockUrl}
                      data-testid="button-enrich-now"
                    >
                      {mockEnrichMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Enrich Now
                    </Button>
                    
                    {mockEnrichMutation.isSuccess && mockEnrichMutation.data && (
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-medium text-sm mb-2">Enriched Data:</h4>
                        
                        {/* Profile Data */}
                        {mockEnrichMutation.data.profile && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">
                                {mockEnrichMutation.data.profile.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                              <p>Title: {mockEnrichMutation.data.profile.title}</p>
                              <p>Company: {mockEnrichMutation.data.profile.company}</p>
                              <p>Email: {mockEnrichMutation.data.profile.email}</p>
                              <p>Location: {mockEnrichMutation.data.profile.location}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Company Data */}
                        {mockEnrichMutation.data.company && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">
                                {mockEnrichMutation.data.company.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-6">
                              <p>Industry: {mockEnrichMutation.data.company.industry}</p>
                              <p>Employees: {mockEnrichMutation.data.company.employees}</p>
                              <p>Revenue: {mockEnrichMutation.data.company.revenue}</p>
                              <p>Website: {mockEnrichMutation.data.company.website}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Technologies */}
                        {mockEnrichMutation.data.technologies && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">Technologies</span>
                            </div>
                            <div className="flex flex-wrap gap-1 ml-6">
                              {mockEnrichMutation.data.technologies.map((tech: string) => (
                                <Badge key={tech} variant="secondary" className="text-xs">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Social Profiles */}
                        {mockEnrichMutation.data.socialProfiles && (
                          <div className="space-y-2">
                            <span className="text-sm font-medium">Social Profiles</span>
                            <div className="flex items-center gap-3 ml-6">
                              {mockEnrichMutation.data.socialProfiles.linkedin && (
                                <Linkedin className="h-4 w-4 text-blue-600" />
                              )}
                              {mockEnrichMutation.data.socialProfiles.twitter && (
                                <Twitter className="h-4 w-4 text-blue-400" />
                              )}
                              {mockEnrichMutation.data.socialProfiles.github && (
                                <Github className="h-4 w-4 text-gray-600" />
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Quick Actions */}
                        <div className="border-t pt-3 flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => executeActionMutation.mutate({
                              action: 'save_lead',
                              data: mockEnrichMutation.data
                            })}
                            data-testid="button-save-lead"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => executeActionMutation.mutate({
                              action: 'add_to_sequence',
                              data: mockEnrichMutation.data
                            })}
                            data-testid="button-add-sequence"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Add to Sequence
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => executeActionMutation.mutate({
                              action: 'send_email',
                              data: mockEnrichMutation.data
                            })}
                            data-testid="button-send-email"
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Feature Showcase */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <Linkedin className="h-8 w-8 text-blue-600 mb-3" />
                    <h4 className="font-medium text-sm mb-1">LinkedIn Enrichment</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Instantly capture profile data, contact info, and professional details
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <Building2 className="h-8 w-8 text-green-600 mb-3" />
                    <h4 className="font-medium text-sm mb-1">Company Intelligence</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Get company size, revenue, industry, and key decision makers
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <Database className="h-8 w-8 text-purple-600 mb-3" />
                    <h4 className="font-medium text-sm mb-1">Tech Stack Detection</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Identify technologies used by the company for better targeting
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <Zap className="h-8 w-8 text-orange-600 mb-3" />
                    <h4 className="font-medium text-sm mb-1">Quick Actions</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Save leads, add to sequences, or send emails with one click
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}