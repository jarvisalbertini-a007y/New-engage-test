import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Shield, 
  FileText, 
  Users, 
  Palette,
  Lock,
  Eye,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Settings,
  Key,
  Globe,
  Cpu,
  Activity,
  ShieldCheck,
  UserCheck,
  FileCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";

// Demo organization ID for testing
const DEMO_ORG_ID = "org-demo-001";

export default function EnterprisePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("white-label");
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [auditFilters, setAuditFilters] = useState({
    resource: "",
    action: "",
    dateRange: "7d"
  });

  // White-label configuration state
  const [whiteLabelConfig, setWhiteLabelConfig] = useState({
    organizationId: DEMO_ORG_ID,
    brandName: "",
    logoUrl: "",
    primaryColor: "#0066FF",
    secondaryColor: "#00D4FF",
    customDomain: "",
    customCSS: "",
    features: {}
  });

  // Security configuration state
  const [securityConfig, setSecurityConfig] = useState({
    organizationId: DEMO_ORG_ID,
    ssoEnabled: false,
    ssoProvider: "",
    ipWhitelist: [] as string[],
    mfaRequired: false,
    dataResidency: "us",
    auditLogRetention: 90,
    complianceMode: "none"
  });

  // Access control state
  const [newRole, setNewRole] = useState({
    organizationId: DEMO_ORG_ID,
    roleName: "",
    description: "",
    permissions: [] as string[]
  });

  // Fetch white-label configuration
  const { data: whiteLabel, isLoading: loadingWhiteLabel } = useQuery({
    queryKey: ["/api/enterprise/white-label", DEMO_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/enterprise/white-label/${DEMO_ORG_ID}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch white-label config");
      return response.json();
    }
  });

  // Fetch security settings
  const { data: security, isLoading: loadingSecurity } = useQuery({
    queryKey: ["/api/enterprise/security", DEMO_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/enterprise/security/${DEMO_ORG_ID}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch security settings");
      return response.json();
    }
  });

  // Fetch audit logs
  const { data: auditLogs = [], isLoading: loadingAuditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["/api/enterprise/audit-log", auditFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        organizationId: DEMO_ORG_ID,
        ...auditFilters
      });
      const response = await fetch(`/api/enterprise/audit-log?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    }
  });

  // Fetch access control roles
  const { data: roles = [], isLoading: loadingRoles, refetch: refetchRoles } = useQuery({
    queryKey: ["/api/enterprise/roles", DEMO_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/enterprise/roles/${DEMO_ORG_ID}`);
      if (!response.ok) throw new Error("Failed to fetch roles");
      return response.json();
    }
  });

  // Fetch compliance report
  const { data: complianceReport, refetch: refetchCompliance } = useQuery({
    queryKey: ["/api/enterprise/compliance", DEMO_ORG_ID],
    queryFn: async () => {
      const response = await fetch(`/api/enterprise/compliance?organizationId=${DEMO_ORG_ID}`);
      if (!response.ok) throw new Error("Failed to fetch compliance report");
      return response.json();
    },
    enabled: false // Only fetch on demand
  });

  // Update white-label configuration
  const updateWhiteLabel = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest("/api/enterprise/white-label", "POST", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/white-label"] });
      toast({
        title: "White-label configuration updated",
        description: "Your branding has been successfully updated."
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating white-label",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update security settings
  const updateSecurity = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest("/api/enterprise/security", "POST", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/security"] });
      toast({
        title: "Security settings updated",
        description: "Your security configuration has been updated."
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating security",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Create access control role
  const createRole = useMutation({
    mutationFn: async (role: any) => {
      return apiRequest("/api/enterprise/roles", "POST", role);
    },
    onSuccess: () => {
      refetchRoles();
      setNewRole({
        organizationId: DEMO_ORG_ID,
        roleName: "",
        description: "",
        permissions: []
      });
      toast({
        title: "Role created",
        description: "The access control role has been created."
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating role",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete access control role
  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      return apiRequest(`/api/enterprise/roles/${roleId}`, "DELETE");
    },
    onSuccess: () => {
      refetchRoles();
      toast({
        title: "Role deleted",
        description: "The access control role has been deleted."
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting role",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update white-label state when data is fetched
  useEffect(() => {
    if (whiteLabel) {
      setWhiteLabelConfig(whiteLabel);
    }
  }, [whiteLabel]);

  // Update security state when data is fetched
  useEffect(() => {
    if (security) {
      setSecurityConfig({
        ...security,
        ipWhitelist: security.ipWhitelist || []
      });
    }
  }, [security]);

  // Apply white-label preview styles
  useEffect(() => {
    if (previewMode && whiteLabelConfig) {
      document.documentElement.style.setProperty('--primary', whiteLabelConfig.primaryColor);
      document.documentElement.style.setProperty('--secondary', whiteLabelConfig.secondaryColor);
      
      if (whiteLabelConfig.customCSS) {
        const style = document.createElement('style');
        style.textContent = whiteLabelConfig.customCSS;
        style.id = 'white-label-preview';
        document.head.appendChild(style);
      }
    } else {
      // Reset to defaults
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--secondary');
      const previewStyle = document.getElementById('white-label-preview');
      if (previewStyle) {
        previewStyle.remove();
      }
    }

    return () => {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--secondary');
      const previewStyle = document.getElementById('white-label-preview');
      if (previewStyle) {
        previewStyle.remove();
      }
    };
  }, [previewMode, whiteLabelConfig]);

  const allPermissions = [
    "contacts:create", "contacts:read", "contacts:update", "contacts:delete",
    "sequences:create", "sequences:read", "sequences:update", "sequences:delete",
    "emails:create", "emails:read", "emails:update", "emails:delete",
    "analytics:read", "settings:read", "settings:update",
    "users:create", "users:read", "users:update", "users:delete",
    "billing:read", "billing:update",
    "*:*" // Super admin
  ];

  const complianceFrameworks = [
    { value: "none", label: "None", icon: Shield },
    { value: "soc2", label: "SOC 2 Type II", icon: ShieldCheck },
    { value: "gdpr", label: "GDPR", icon: FileCheck },
    { value: "ccpa", label: "CCPA", icon: UserCheck },
    { value: "hipaa", label: "HIPAA", icon: Lock }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-600 dark:text-red-400";
      case "error": return "text-orange-600 dark:text-orange-400";
      case "warning": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-blue-600 dark:text-blue-400";
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Enterprise Control Center
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage white-label branding, security, compliance, and access controls
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchCompliance()}
              data-testid="button-generate-report"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button
              variant={previewMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              data-testid="button-preview-mode"
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? "Exit Preview" : "Preview Mode"}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="white-label" data-testid="tab-white-label">
              <Palette className="h-4 w-4 mr-2" />
              White-Label
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <FileText className="h-4 w-4 mr-2" />
              Audit & Compliance
            </TabsTrigger>
            <TabsTrigger value="access" data-testid="tab-access">
              <Users className="h-4 w-4 mr-2" />
              Access Control
            </TabsTrigger>
          </TabsList>

          {/* White-Label Configuration */}
          <TabsContent value="white-label" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Brand Customization</CardTitle>
                <CardDescription>
                  Configure your white-label branding and appearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Brand Name</Label>
                    <Input
                      id="brand-name"
                      placeholder="Your Company Name"
                      value={whiteLabelConfig.brandName}
                      onChange={(e) => setWhiteLabelConfig({
                        ...whiteLabelConfig,
                        brandName: e.target.value
                      })}
                      data-testid="input-brand-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="custom-domain">Custom Domain</Label>
                    <Input
                      id="custom-domain"
                      placeholder="app.yourcompany.com"
                      value={whiteLabelConfig.customDomain}
                      onChange={(e) => setWhiteLabelConfig({
                        ...whiteLabelConfig,
                        customDomain: e.target.value
                      })}
                      data-testid="input-custom-domain"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="logo-url">Logo URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="logo-url"
                        placeholder="https://yourcompany.com/logo.png"
                        value={whiteLabelConfig.logoUrl}
                        onChange={(e) => setWhiteLabelConfig({
                          ...whiteLabelConfig,
                          logoUrl: e.target.value
                        })}
                        data-testid="input-logo-url"
                      />
                      <Button variant="outline" size="icon">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Brand Colors</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Primary</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={whiteLabelConfig.primaryColor}
                            onChange={(e) => setWhiteLabelConfig({
                              ...whiteLabelConfig,
                              primaryColor: e.target.value
                            })}
                            className="w-12 h-10 p-1 cursor-pointer"
                            data-testid="input-primary-color"
                          />
                          <Input
                            value={whiteLabelConfig.primaryColor}
                            onChange={(e) => setWhiteLabelConfig({
                              ...whiteLabelConfig,
                              primaryColor: e.target.value
                            })}
                            placeholder="#0066FF"
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Secondary</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={whiteLabelConfig.secondaryColor}
                            onChange={(e) => setWhiteLabelConfig({
                              ...whiteLabelConfig,
                              secondaryColor: e.target.value
                            })}
                            className="w-12 h-10 p-1 cursor-pointer"
                            data-testid="input-secondary-color"
                          />
                          <Input
                            value={whiteLabelConfig.secondaryColor}
                            onChange={(e) => setWhiteLabelConfig({
                              ...whiteLabelConfig,
                              secondaryColor: e.target.value
                            })}
                            placeholder="#00D4FF"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-css">Custom CSS</Label>
                  <Textarea
                    id="custom-css"
                    placeholder="/* Add custom CSS overrides here */"
                    value={whiteLabelConfig.customCSS}
                    onChange={(e) => setWhiteLabelConfig({
                      ...whiteLabelConfig,
                      customCSS: e.target.value
                    })}
                    rows={6}
                    className="font-mono text-sm"
                    data-testid="textarea-custom-css"
                  />
                </div>
                
                {whiteLabelConfig.logoUrl && (
                  <div className="border rounded-lg p-4">
                    <Label className="text-sm mb-2">Logo Preview</Label>
                    <img
                      src={whiteLabelConfig.logoUrl}
                      alt="Brand Logo"
                      className="h-12 object-contain"
                      data-testid="img-logo-preview"
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (whiteLabel) {
                        setWhiteLabelConfig(whiteLabel);
                      }
                    }}
                    data-testid="button-reset-branding"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => updateWhiteLabel.mutate(whiteLabelConfig)}
                    disabled={updateWhiteLabel.isPending}
                    data-testid="button-save-branding"
                  >
                    Save Branding
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Configuration</CardTitle>
                <CardDescription>
                  Configure authentication, access control, and compliance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* SSO Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Single Sign-On (SSO)</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable SSO for secure authentication
                      </p>
                    </div>
                    <Switch
                      checked={securityConfig.ssoEnabled}
                      onCheckedChange={(checked) => setSecurityConfig({
                        ...securityConfig,
                        ssoEnabled: checked
                      })}
                      data-testid="switch-sso"
                    />
                  </div>
                  
                  {securityConfig.ssoEnabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sso-provider">SSO Provider</Label>
                        <Select
                          value={securityConfig.ssoProvider}
                          onValueChange={(value) => setSecurityConfig({
                            ...securityConfig,
                            ssoProvider: value
                          })}
                        >
                          <SelectTrigger id="sso-provider" data-testid="select-sso-provider">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="saml">SAML 2.0</SelectItem>
                            <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                            <SelectItem value="okta">Okta</SelectItem>
                            <SelectItem value="azure-ad">Azure AD</SelectItem>
                            <SelectItem value="google">Google Workspace</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>SSO Configuration</Label>
                        <Button variant="outline" className="w-full" data-testid="button-configure-sso">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure SSO
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* MFA Settings */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Multi-Factor Authentication (MFA)</Label>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for all users
                    </p>
                  </div>
                  <Switch
                    checked={securityConfig.mfaRequired}
                    onCheckedChange={(checked) => setSecurityConfig({
                      ...securityConfig,
                      mfaRequired: checked
                    })}
                    data-testid="switch-mfa"
                  />
                </div>

                {/* IP Whitelist */}
                <div className="space-y-2">
                  <Label>IP Whitelist</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict access to specific IP addresses (one per line)
                  </p>
                  <Textarea
                    placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                    value={securityConfig.ipWhitelist.join('\n')}
                    onChange={(e) => setSecurityConfig({
                      ...securityConfig,
                      ipWhitelist: e.target.value.split('\n').filter(ip => ip.trim())
                    })}
                    rows={4}
                    className="font-mono text-sm"
                    data-testid="textarea-ip-whitelist"
                  />
                </div>

                {/* Data Residency */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="data-residency">Data Residency</Label>
                    <Select
                      value={securityConfig.dataResidency}
                      onValueChange={(value) => setSecurityConfig({
                        ...securityConfig,
                        dataResidency: value
                      })}
                    >
                      <SelectTrigger id="data-residency" data-testid="select-data-residency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="eu">European Union</SelectItem>
                        <SelectItem value="asia">Asia Pacific</SelectItem>
                        <SelectItem value="custom">Custom (On-Premise)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="audit-retention">Audit Log Retention (days)</Label>
                    <Input
                      id="audit-retention"
                      type="number"
                      min="7"
                      max="2555"
                      value={securityConfig.auditLogRetention}
                      onChange={(e) => setSecurityConfig({
                        ...securityConfig,
                        auditLogRetention: parseInt(e.target.value)
                      })}
                      data-testid="input-audit-retention"
                    />
                  </div>
                </div>

                {/* Compliance Mode */}
                <div className="space-y-2">
                  <Label>Compliance Framework</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {complianceFrameworks.map(framework => {
                      const Icon = framework.icon;
                      return (
                        <Button
                          key={framework.value}
                          variant={securityConfig.complianceMode === framework.value ? "default" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => setSecurityConfig({
                            ...securityConfig,
                            complianceMode: framework.value
                          })}
                          data-testid={`button-compliance-${framework.value}`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {framework.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (security) {
                        setSecurityConfig({
                          ...security,
                          ipWhitelist: security.ipWhitelist || []
                        });
                      }
                    }}
                    data-testid="button-reset-security"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => updateSecurity.mutate(securityConfig)}
                    disabled={updateSecurity.isPending}
                    data-testid="button-save-security"
                  >
                    Save Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Infrastructure & SLA */}
            <Card>
              <CardHeader>
                <CardTitle>Infrastructure & SLA</CardTitle>
                <CardDescription>
                  Dedicated resources and service level agreements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Cpu className="h-8 w-8 text-muted-foreground" />
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      <p className="text-sm font-medium">Dedicated Infrastructure</p>
                      <p className="text-xs text-muted-foreground">Isolated compute resources</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-8 w-8 text-muted-foreground" />
                        <Badge variant="secondary">99.9%</Badge>
                      </div>
                      <p className="text-sm font-medium">SLA Guarantee</p>
                      <p className="text-xs text-muted-foreground">Uptime commitment</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                        <Badge variant="secondary">10,000/min</Badge>
                      </div>
                      <p className="text-sm font-medium">API Rate Limit</p>
                      <p className="text-xs text-muted-foreground">Per organization</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit & Compliance */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>
                  Track all system activities and user actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Search by resource..."
                      value={auditFilters.resource}
                      onChange={(e) => setAuditFilters({
                        ...auditFilters,
                        resource: e.target.value
                      })}
                      className="max-w-xs"
                      data-testid="input-audit-search"
                    />
                    <Select
                      value={auditFilters.action}
                      onValueChange={(value) => setAuditFilters({
                        ...auditFilters,
                        action: value
                      })}
                    >
                      <SelectTrigger className="w-[150px]" data-testid="select-audit-action">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={auditFilters.dateRange}
                      onValueChange={(value) => setAuditFilters({
                        ...auditFilters,
                        dateRange: value
                      })}
                    >
                      <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1d">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => refetchAuditLogs()}
                      data-testid="button-refresh-audit"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" data-testid="button-export-audit">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                {/* Audit Log Table */}
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingAuditLogs ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            Loading audit logs...
                          </TableCell>
                        </TableRow>
                      ) : auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.userId || 'System'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{log.resource}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {log.resourceId || '-'}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium ${getSeverityColor(log.severity)}`}>
                                {log.severity}
                              </span>
                            </TableCell>
                            <TableCell>
                              {log.outcome === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Compliance Report */}
            {complianceReport && (
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Report</CardTitle>
                  <CardDescription>
                    Current compliance status and recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-2xl font-bold">
                          {complianceReport.summary?.totalEvents || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Events</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-2xl font-bold">
                          {complianceReport.summary?.uniqueUsers || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Active Users</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-2xl font-bold">
                          {complianceReport.summary?.criticalEvents || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Critical Events</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-2xl font-bold">
                          {complianceReport.summary?.failedActions || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Failed Actions</p>
                      </CardContent>
                    </Card>
                  </div>

                  {complianceReport.complianceChecks && (
                    <div className="space-y-2">
                      <Label>Compliance Checks</Label>
                      <div className="space-y-2">
                        {complianceReport.complianceChecks.passed?.map((check: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>{check}</span>
                          </div>
                        ))}
                        {complianceReport.complianceChecks.failed?.map((check: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span>{check}</span>
                          </div>
                        ))}
                        {complianceReport.complianceChecks.warnings?.map((check: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <span>{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Access Control */}
          <TabsContent value="access" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Role Management</CardTitle>
                <CardDescription>
                  Define roles and permissions for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create New Role */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <Label>Create New Role</Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="role-name" className="text-sm">Role Name</Label>
                      <Input
                        id="role-name"
                        placeholder="e.g., Sales Manager"
                        value={newRole.roleName}
                        onChange={(e) => setNewRole({
                          ...newRole,
                          roleName: e.target.value
                        })}
                        data-testid="input-role-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-description" className="text-sm">Description</Label>
                      <Input
                        id="role-description"
                        placeholder="Role description..."
                        value={newRole.description}
                        onChange={(e) => setNewRole({
                          ...newRole,
                          description: e.target.value
                        })}
                        data-testid="input-role-description"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Permissions</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {allPermissions.map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`perm-${permission}`}
                            checked={newRole.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRole({
                                  ...newRole,
                                  permissions: [...newRole.permissions, permission]
                                });
                              } else {
                                setNewRole({
                                  ...newRole,
                                  permissions: newRole.permissions.filter(p => p !== permission)
                                });
                              }
                            }}
                            className="h-4 w-4"
                            data-testid={`checkbox-permission-${permission}`}
                          />
                          <Label
                            htmlFor={`perm-${permission}`}
                            className="text-xs cursor-pointer"
                          >
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => createRole.mutate(newRole)}
                    disabled={!newRole.roleName || createRole.isPending}
                    className="w-full"
                    data-testid="button-create-role"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </div>

                {/* Existing Roles */}
                <div className="space-y-2">
                  <Label>Existing Roles</Label>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {loadingRoles ? (
                        <div className="text-center py-4">Loading roles...</div>
                      ) : roles.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No roles configured yet
                        </div>
                      ) : (
                        roles.map((role: any) => (
                          <div
                            key={role.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{role.roleName}</p>
                                {role.isSystemRole && (
                                  <Badge variant="secondary" className="text-xs">System</Badge>
                                )}
                              </div>
                              {role.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {role.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(role.permissions as string[])?.slice(0, 3).map((perm: string) => (
                                  <Badge key={perm} variant="outline" className="text-xs">
                                    {perm}
                                  </Badge>
                                ))}
                                {(role.permissions as string[])?.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{(role.permissions as string[]).length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedRole(role)}
                                data-testid={`button-edit-role-${role.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {!role.isSystemRole && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteRole.mutate(role.id)}
                                  data-testid={`button-delete-role-${role.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}