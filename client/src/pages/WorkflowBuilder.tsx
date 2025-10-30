import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Search, Play, Save, Settings, X, ChevronRight, Bot, Mail, Phone, MessageSquare, Calendar, Users, FileText, Globe, GitBranch, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Workflow, WorkflowTemplate, AgentType } from "@shared/schema";

// Canvas node and edge types
interface CanvasNode {
  id: string;
  type: 'trigger' | 'agent' | 'action' | 'condition';
  agentType?: string;
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  icon?: any;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// Available node types for the palette
const nodeTypes = [
  { 
    category: 'Triggers',
    items: [
      { type: 'trigger', subtype: 'email_received', label: 'Email Received', icon: Mail, description: 'When a new email arrives' },
      { type: 'trigger', subtype: 'calendar_event', label: 'Calendar Event', icon: Calendar, description: 'When a meeting is scheduled' },
      { type: 'trigger', subtype: 'form_submission', label: 'Form Submission', icon: FileText, description: 'When a form is submitted' },
      { type: 'trigger', subtype: 'webhook', label: 'Webhook', icon: Globe, description: 'When webhook is called' },
      { type: 'trigger', subtype: 'schedule', label: 'Schedule', icon: Calendar, description: 'On a recurring schedule' },
    ]
  },
  {
    category: 'AI Agents',
    items: [
      { type: 'agent', subtype: 'email-composer-1', label: 'Email Composer', icon: Mail, description: 'Write personalized emails' },
      { type: 'agent', subtype: 'data-researcher-1', label: 'Data Researcher', icon: Search, description: 'Research and gather data' },
      { type: 'agent', subtype: 'lead-scorer-1', label: 'Lead Scorer', icon: Users, description: 'Score and qualify leads' },
      { type: 'agent', subtype: 'meeting-scheduler-1', label: 'Meeting Scheduler', icon: Calendar, description: 'Schedule meetings' },
      { type: 'agent', subtype: 'content-creator-1', label: 'Content Creator', icon: FileText, description: 'Create content' },
    ]
  },
  {
    category: 'Actions',
    items: [
      { type: 'action', subtype: 'send_email', label: 'Send Email', icon: Mail, description: 'Send an email' },
      { type: 'action', subtype: 'create_task', label: 'Create Task', icon: FileText, description: 'Create a new task' },
      { type: 'action', subtype: 'update_contact', label: 'Update Contact', icon: Users, description: 'Update contact info' },
      { type: 'action', subtype: 'send_slack', label: 'Send to Slack', icon: MessageSquare, description: 'Send Slack message' },
      { type: 'action', subtype: 'http_request', label: 'HTTP Request', icon: Globe, description: 'Make API call' },
    ]
  },
  {
    category: 'Flow Control',
    items: [
      { type: 'condition', subtype: 'if_else', label: 'If/Else', icon: GitBranch, description: 'Conditional logic' },
      { type: 'condition', subtype: 'wait', label: 'Wait', icon: Zap, description: 'Delay execution' },
    ]
  }
];

export default function WorkflowBuilder() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [isNLPMode, setIsNLPMode] = useState(true);
  const [nlpInput, setNlpInput] = useState("");
  const [draggedNode, setDraggedNode] = useState<any>(null);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showTemplates, setShowTemplates] = useState(false);

  // Fetch workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    enabled: true
  });

  // Fetch templates
  const { data: templates = [] } = useQuery<WorkflowTemplate[]>({
    queryKey: ['/api/workflow-templates'],
    enabled: showTemplates
  });

  // Fetch agent types
  const { data: agentTypes = [] } = useQuery<AgentType[]>({
    queryKey: ['/api/agent-types']
  });

  // Save workflow mutation
  const saveWorkflowMutation = useMutation({
    mutationFn: async (data: { id?: string; workflow: Partial<Workflow> }) => {
      const response = data.id
        ? await apiRequest('PATCH', `/api/workflows/${data.id}`, data.workflow)
        : await apiRequest('POST', '/api/workflows', data.workflow);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Workflow saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive"
      });
    }
  });

  // Parse NLP input to create workflow
  const parseNLPMutation = useMutation({
    mutationFn: async (input: string) => {
      const response = await apiRequest('POST', '/api/workflows/parse-nlp', { input });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        setIsNLPMode(false);
        toast({
          title: "Workflow created",
          description: "Your workflow has been created from the description"
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to parse workflow description",
        variant: "destructive"
      });
    }
  });

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, nodeType: any) => {
    setDraggedNode(nodeType);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNode || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - canvasPosition.x;
    const y = e.clientY - rect.top - canvasPosition.y;

    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type: draggedNode.type,
      agentType: draggedNode.subtype,
      label: draggedNode.label,
      config: {},
      position: { x, y },
      icon: draggedNode.icon
    };

    setNodes([...nodes, newNode]);
    setDraggedNode(null);
  };

  // Handle canvas panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Node connection logic
  const connectNodes = (sourceId: string, targetId: string) => {
    const newEdge: CanvasEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId
    };
    setEdges([...edges, newEdge]);
  };

  // Save current workflow
  const handleSave = () => {
    const workflowData = {
      name: "New Workflow",
      description: nlpInput || "Created with visual builder",
      nodes: nodes,
      edges: edges,
      status: 'draft' as const,
      category: 'sales' as const
    };

    saveWorkflowMutation.mutate({
      id: selectedWorkflow || undefined,
      workflow: workflowData
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Workflows List */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm md:text-base font-semibold">Workflows</h3>
          <Button
            size="sm"
            variant="ghost"
            className="hover:soft-shadow-hover transition-all-soft"
            onClick={() => {
              setSelectedWorkflow(null);
              setNodes([]);
              setEdges([]);
              setNlpInput("");
              setIsNLPMode(true);
            }}
            data-testid="button-new-workflow"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-3rem)]">
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className={`cursor-pointer rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft ${selectedWorkflow === workflow.id ? 'border-primary' : ''}`}
                onClick={() => {
                  setSelectedWorkflow(workflow.id);
                  setNodes(workflow.nodes as CanvasNode[] || []);
                  setEdges(workflow.edges as CanvasEdge[] || []);
                  setIsNLPMode(false);
                }}
                data-testid={`card-workflow-${workflow.id}`}
              >
                <CardHeader className="p-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{workflow.name}</CardTitle>
                    <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                      {workflow.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {workflow.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <Button
          className="w-full mt-4 rounded-lg hover:soft-shadow-hover transition-all-soft"
          variant="outline"
          onClick={() => setShowTemplates(true)}
          data-testid="button-browse-templates"
        >
          Browse Templates
        </Button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-auto md:h-14 border-b bg-background px-4 py-2 md:py-0 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0">
          <div className="flex items-center gap-2">
            <Button
              variant={isNLPMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsNLPMode(true)}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-nlp-mode"
            >
              <Bot className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">NLP Mode</span>
            </Button>
            <Button
              variant={!isNLPMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsNLPMode(false)}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-visual-mode"
            >
              <GitBranch className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Visual Mode</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast({
                  title: "Testing workflow",
                  description: "Workflow test execution started"
                });
              }}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-test-workflow"
            >
              <Play className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Test</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveWorkflowMutation.isPending}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-save-workflow"
            >
              <Save className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>

        {/* NLP Input Mode */}
        {isNLPMode ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8">
            <Card className="w-full max-w-2xl rounded-xl soft-shadow">
              <CardHeader>
                <CardTitle className="text-base md:text-lg">Describe Your Workflow</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Tell me what you want to automate in plain English, and I'll create the workflow for you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Example: When someone fills out our contact form, research their company, score the lead, and if they're qualified, send them a personalized email and create a task for the sales team to follow up within 2 days."
                  value={nlpInput}
                  onChange={(e) => setNlpInput(e.target.value)}
                  className="min-h-[150px]"
                  data-testid="textarea-nlp-input"
                />

                <div className="space-y-2">
                  <Label>Quick Examples:</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setNlpInput("When a new lead comes in, enrich their data, score them, and assign to the right sales rep")}
                    >
                      Lead Routing
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setNlpInput("Every morning, check for stale deals, send reminder emails to prospects, and create follow-up tasks")}
                    >
                      Daily Follow-ups
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setNlpInput("When someone books a meeting, send confirmation email, add to CRM, and notify the team on Slack")}
                    >
                      Meeting Booked
                    </Badge>
                  </div>
                </div>

                <Button
                  className="w-full rounded-lg hover:soft-shadow-hover transition-all-soft"
                  onClick={() => parseNLPMutation.mutate(nlpInput)}
                  disabled={!nlpInput || parseNLPMutation.isPending}
                  data-testid="button-create-workflow"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Visual Builder Mode */
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Node Palette */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-background p-4">
              <div className="mb-4">
                <Input
                  placeholder="Search nodes..."
                  className="w-full"
                  data-testid="input-search-nodes"
                />
              </div>

              <ScrollArea className="h-[calc(100%-3rem)]">
                <div className="space-y-4">
                  {nodeTypes.map((category) => (
                    <div key={category.category}>
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                        {category.category}
                      </h4>
                      <div className="space-y-2">
                        {category.items.map((item) => (
                          <div
                            key={`${item.type}-${item.subtype}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            className="flex items-center gap-2 p-2 rounded-lg border bg-card cursor-move hover:bg-accent soft-shadow hover:soft-shadow-hover transition-all-soft"
                            data-testid={`node-${item.subtype}`}
                          >
                            <item.icon className="h-4 w-4" />
                            <div className="flex-1">
                              <div className="text-xs md:text-sm font-medium">{item.label}</div>
                              <div className="text-xs text-muted-foreground hidden md:block">{item.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden bg-muted/20">
              <div
                ref={canvasRef}
                className="absolute inset-0"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  cursor: isPanning ? 'grabbing' : 'grab',
                  backgroundImage: 'radial-gradient(circle, #e5e5e5 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: `${canvasPosition.x}px ${canvasPosition.y}px`
                }}
              >
                {/* Render nodes */}
                {nodes.map((node) => {
                  const Icon = node.icon || Bot;
                  return (
                    <div
                      key={node.id}
                      className="absolute bg-card border-2 rounded-lg p-3 cursor-pointer hover:border-primary soft-shadow hover:soft-shadow-hover transition-all-soft"
                      style={{
                        left: node.position.x + canvasPosition.x,
                        top: node.position.y + canvasPosition.y,
                        minWidth: '150px'
                      }}
                      onClick={() => setSelectedNode(node)}
                      data-testid={`canvas-node-${node.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{node.label}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Render edges */}
                <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }}>
                  {edges.map((edge) => {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    const targetNode = nodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const x1 = sourceNode.position.x + 75 + canvasPosition.x;
                    const y1 = sourceNode.position.y + 25 + canvasPosition.y;
                    const x2 = targetNode.position.x + 75 + canvasPosition.x;
                    const y2 = targetNode.position.y + 25 + canvasPosition.y;

                    return (
                      <line
                        key={edge.id}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#888"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="10"
                      refX="10"
                      refY="5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 5, 0 10" fill="#888" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Node Configuration Panel */}
            {selectedNode && (
              <div className="w-80 border-l bg-background p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Configure Node</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedNode(null)}
                    data-testid="button-close-config"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Node Name</Label>
                    <Input
                      value={selectedNode.label}
                      onChange={(e) => {
                        const updated = { ...selectedNode, label: e.target.value };
                        setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                        setSelectedNode(updated);
                      }}
                      data-testid="input-node-name"
                    />
                  </div>

                  {selectedNode.type === 'agent' && (
                    <div>
                      <Label>Agent Type</Label>
                      <Select
                        value={selectedNode.agentType}
                        onValueChange={(value) => {
                          const updated = { ...selectedNode, agentType: value };
                          setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                          setSelectedNode(updated);
                        }}
                      >
                        <SelectTrigger data-testid="select-agent-type">
                          <SelectValue placeholder="Select agent type" />
                        </SelectTrigger>
                        <SelectContent>
                          {agentTypes.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedNode.type === 'trigger' && selectedNode.agentType === 'schedule' && (
                    <div>
                      <Label>Cron Expression</Label>
                      <Input
                        placeholder="0 9 * * *"
                        value={selectedNode.config.cron || ''}
                        onChange={(e) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, cron: e.target.value }
                          };
                          setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                          setSelectedNode(updated);
                        }}
                        data-testid="input-cron-expression"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'action' && selectedNode.agentType === 'send_email' && (
                    <>
                      <div>
                        <Label>To</Label>
                        <Input
                          placeholder="{{contact.email}}"
                          value={selectedNode.config.to || ''}
                          onChange={(e) => {
                            const updated = {
                              ...selectedNode,
                              config: { ...selectedNode.config, to: e.target.value }
                            };
                            setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                            setSelectedNode(updated);
                          }}
                          data-testid="input-email-to"
                        />
                      </div>
                      <div>
                        <Label>Subject</Label>
                        <Input
                          placeholder="Email subject"
                          value={selectedNode.config.subject || ''}
                          onChange={(e) => {
                            const updated = {
                              ...selectedNode,
                              config: { ...selectedNode.config, subject: e.target.value }
                            };
                            setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                            setSelectedNode(updated);
                          }}
                          data-testid="input-email-subject"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Human Approval Required</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selectedNode.config.requiresApproval || false}
                        onCheckedChange={(checked) => {
                          const updated = {
                            ...selectedNode,
                            config: { ...selectedNode.config, requiresApproval: checked }
                          };
                          setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                          setSelectedNode(updated);
                        }}
                        data-testid="switch-approval"
                      />
                      <span className="text-sm text-muted-foreground">
                        Pause for manual review
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setNodes(nodes.filter(n => n.id !== selectedNode.id));
                      setEdges(edges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                      setSelectedNode(null);
                    }}
                    data-testid="button-delete-node"
                  >
                    Delete Node
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Workflow Templates</DialogTitle>
            <DialogDescription>
              Start with a pre-built workflow template and customize it to your needs
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-2 gap-4 p-1">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    // Template config contains the nodes and edges
                    const templateConfig = template.config as any || {};
                    setNodes(templateConfig.nodes || []);
                    setEdges(templateConfig.edges || []);
                    setIsNLPMode(false);
                    setShowTemplates(false);
                    toast({
                      title: "Template loaded",
                      description: `"${template.name}" template has been loaded`
                    });
                  }}
                  data-testid={`card-template-${template.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="secondary">{template.difficulty}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}