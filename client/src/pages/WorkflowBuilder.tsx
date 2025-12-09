import { useState, useRef } from "react";
import { Plus, Search, Play, Save, X, Bot, Mail, Phone, MessageSquare, Clock, GitBranch, Sparkles, Linkedin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Workflow, WorkflowTemplate, AgentType } from "@shared/schema";

interface CanvasNode {
  id: string;
  type: 'email' | 'wait' | 'linkedin' | 'phone' | 'condition' | 'ai_decision' | 'trigger' | 'action' | 'agent';
  agentType?: string;
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const nodeTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  email: { bg: 'bg-cyan-50 dark:bg-cyan-950', border: 'border-cyan-400', text: 'text-cyan-700 dark:text-cyan-300' },
  wait: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-400', text: 'text-gray-700 dark:text-gray-300' },
  linkedin: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  phone: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-500', text: 'text-green-700 dark:text-green-300' },
  condition: { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-500', text: 'text-yellow-700 dark:text-yellow-300' },
  ai_decision: { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  trigger: { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
  action: { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-400', text: 'text-indigo-700 dark:text-indigo-300' },
  agent: { bg: 'bg-pink-50 dark:bg-pink-950', border: 'border-pink-400', text: 'text-pink-700 dark:text-pink-300' },
};

const nodeTypeIcons: Record<string, any> = {
  email: Mail,
  wait: Clock,
  linkedin: Linkedin,
  phone: Phone,
  condition: GitBranch,
  ai_decision: Sparkles,
  trigger: Bot,
  action: MessageSquare,
  agent: Bot,
};

const nodePalette = [
  { 
    category: 'Outreach',
    items: [
      { type: 'email', label: 'Send Email', description: 'Send personalized email' },
      { type: 'linkedin', label: 'LinkedIn Message', description: 'Send LinkedIn DM' },
      { type: 'phone', label: 'Phone Call', description: 'Schedule a call' },
    ]
  },
  {
    category: 'Flow Control',
    items: [
      { type: 'wait', label: 'Wait/Delay', description: 'Pause for duration' },
      { type: 'condition', label: 'Condition', description: 'If/else logic' },
      { type: 'ai_decision', label: 'AI Decision', description: 'AI-powered routing' },
    ]
  }
];

const aiExamples = [
  { label: "Webinar No-Shows", goal: "Follow up with webinar no-shows" },
  { label: "LinkedIn Leads", goal: "Nurture cold leads from LinkedIn" },
  { label: "Trial Expiring", goal: "Re-engage users whose trial is expiring" },
  { label: "Meeting Follow-up", goal: "Send personalized follow-up after a sales meeting" },
];

export default function WorkflowBuilder() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [isAIMode, setIsAIMode] = useState(true);
  const [aiGoal, setAiGoal] = useState("");
  const [draggedNode, setDraggedNode] = useState<any>(null);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showTemplates, setShowTemplates] = useState(false);
  const [animatingNodes, setAnimatingNodes] = useState<Set<string>>(new Set());

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
  });

  const { data: templates = [] } = useQuery<WorkflowTemplate[]>({
    queryKey: ['/api/workflow-templates'],
    enabled: showTemplates
  });

  const { data: agentTypes = [] } = useQuery<AgentType[]>({
    queryKey: ['/api/agent-types']
  });

  const saveWorkflowMutation = useMutation({
    mutationFn: async (data: { id?: string; workflow: Partial<Workflow> }) => {
      const response = data.id
        ? await apiRequest('PATCH', `/api/workflows/${data.id}`, data.workflow)
        : await apiRequest('POST', '/api/workflows', data.workflow);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Workflow saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save workflow", variant: "destructive" });
    }
  });

  const generateWorkflowMutation = useMutation({
    mutationFn: async (goal: string) => {
      const response = await apiRequest('POST', '/api/workflows/generate', { goal });
      return await response.json();
    },
    onSuccess: (data: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      if (data.nodes && data.edges) {
        setAnimatingNodes(new Set(data.nodes.map(n => n.id)));
        setNodes([]);
        setEdges([]);
        
        data.nodes.forEach((node, index) => {
          setTimeout(() => {
            setNodes(prev => [...prev, node]);
            if (index === data.nodes.length - 1) {
              setEdges(data.edges);
              setTimeout(() => setAnimatingNodes(new Set()), 300);
            }
          }, index * 150);
        });
        
        setIsAIMode(false);
        toast({ title: "Workflow Generated", description: "Your AI-generated workflow is ready to customize" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate workflow", variant: "destructive" });
    }
  });

  const handleDragStart = (e: React.DragEvent, nodeType: any) => {
    setDraggedNode(nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
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
      label: draggedNode.label,
      config: getDefaultConfig(draggedNode.type),
      position: { x: Math.max(0, x - 75), y: Math.max(0, y - 25) },
    };

    setNodes([...nodes, newNode]);
    setDraggedNode(null);
    
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}`,
        source: lastNode.id,
        target: newNode.id,
      };
      setEdges([...edges, newEdge]);
    }
  };

  const getDefaultConfig = (type: string): Record<string, any> => {
    switch (type) {
      case 'email':
        return { subject: '', body: '', template: 'default' };
      case 'wait':
        return { duration: 1, unit: 'days' };
      case 'linkedin':
        return { message: '' };
      case 'phone':
        return { script: '' };
      case 'condition':
        return { condition: '', trueLabel: 'Yes', falseLabel: 'No' };
      case 'ai_decision':
        return { criteria: '' };
      default:
        return {};
    }
  };

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

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n));
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, config: { ...selectedNode.config, ...config } });
    }
  };

  const handleSave = () => {
    const workflowData = {
      name: "New Workflow",
      description: aiGoal || "Created with visual builder",
      nodes: nodes,
      edges: edges,
      status: 'draft' as const,
      category: 'sales' as const
    };
    saveWorkflowMutation.mutate({ id: selectedWorkflow || undefined, workflow: workflowData });
  };

  const getNodeIcon = (type: string) => {
    const Icon = nodeTypeIcons[type] || Bot;
    return Icon;
  };

  const getNodeColors = (type: string) => {
    return nodeTypeColors[type] || nodeTypeColors.action;
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
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
              setAiGoal("");
              setIsAIMode(true);
            }}
            data-testid="button-new-workflow"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-6rem)]">
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className={`cursor-pointer rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft ${selectedWorkflow === workflow.id ? 'border-primary' : ''}`}
                onClick={() => {
                  setSelectedWorkflow(workflow.id);
                  setNodes(workflow.nodes as CanvasNode[] || []);
                  setEdges(workflow.edges as CanvasEdge[] || []);
                  setIsAIMode(false);
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
                  <CardDescription className="text-xs">{workflow.description}</CardDescription>
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

      <div className="flex-1 flex flex-col">
        <div className="h-auto md:h-14 border-b bg-background px-4 py-2 md:py-0 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0">
          <div className="flex items-center gap-2">
            <Button
              variant={isAIMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAIMode(true)}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-ai-mode"
            >
              <Sparkles className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">AI Generate</span>
            </Button>
            <Button
              variant={!isAIMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAIMode(false)}
              className="rounded-lg hover:soft-shadow-hover transition-all-soft"
              data-testid="button-visual-mode"
            >
              <GitBranch className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Visual Builder</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast({ title: "Testing workflow", description: "Workflow test execution started" })}
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

        {isAIMode ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8">
            <Card className="w-full max-w-2xl rounded-xl soft-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-base md:text-lg">AI Workflow Generator</CardTitle>
                </div>
                <CardDescription className="text-xs md:text-sm">
                  Describe your workflow goal and let AI build it for you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe your workflow goal... e.g., 'Follow up with webinar no-shows after 2 days, send a LinkedIn message if no reply, then schedule a call'"
                  value={aiGoal}
                  onChange={(e) => setAiGoal(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="textarea-ai-goal"
                />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Examples:</Label>
                  <div className="flex flex-wrap gap-2">
                    {aiExamples.map((example) => (
                      <Badge
                        key={example.label}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => setAiGoal(example.goal)}
                        data-testid={`badge-example-${example.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {example.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full rounded-lg hover:soft-shadow-hover transition-all-soft"
                  onClick={() => generateWorkflowMutation.mutate(aiGoal)}
                  disabled={!aiGoal.trim() || generateWorkflowMutation.isPending}
                  data-testid="button-generate-ai"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generateWorkflowMutation.isPending ? "Generating..." : "Generate with AI"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="w-full md:w-56 border-b md:border-b-0 md:border-r bg-background p-3">
              <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Node Palette</h4>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-4">
                  {nodePalette.map((category) => (
                    <div key={category.category}>
                      <h5 className="text-xs font-medium mb-2 text-muted-foreground">{category.category}</h5>
                      <div className="space-y-2">
                        {category.items.map((item) => {
                          const colors = getNodeColors(item.type);
                          const Icon = getNodeIcon(item.type);
                          return (
                            <div
                              key={item.type}
                              draggable
                              onDragStart={(e) => handleDragStart(e, item)}
                              className={`flex items-center gap-2 p-2 rounded-lg border-2 ${colors.bg} ${colors.border} cursor-grab hover:shadow-md transition-all active:cursor-grabbing`}
                              data-testid={`palette-node-${item.type}`}
                            >
                              <Icon className={`h-4 w-4 ${colors.text}`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-medium ${colors.text}`}>{item.label}</div>
                                <div className="text-xs text-muted-foreground truncate hidden md:block">{item.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

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
                  backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: `${canvasPosition.x}px ${canvasPosition.y}px`
                }}
              >
                <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                      <polygon points="0 0, 10 5, 0 10" fill="hsl(var(--muted-foreground))" />
                    </marker>
                  </defs>
                  {edges.map((edge) => {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    const targetNode = nodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const x1 = sourceNode.position.x + 75 + canvasPosition.x;
                    const y1 = sourceNode.position.y + 50 + canvasPosition.y;
                    const x2 = targetNode.position.x + 75 + canvasPosition.x;
                    const y2 = targetNode.position.y + canvasPosition.y;

                    return (
                      <g key={edge.id}>
                        <line
                          x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                        />
                        {edge.label && (
                          <text
                            x={(x1 + x2) / 2}
                            y={(y1 + y2) / 2 - 5}
                            className="text-xs fill-muted-foreground"
                            textAnchor="middle"
                          >
                            {edge.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {nodes.map((node) => {
                  const colors = getNodeColors(node.type);
                  const Icon = getNodeIcon(node.type);
                  const isAnimating = animatingNodes.has(node.id);
                  
                  return (
                    <div
                      key={node.id}
                      className={`absolute ${colors.bg} border-2 ${colors.border} rounded-xl p-3 cursor-pointer hover:shadow-lg transition-all ${
                        selectedNode?.id === node.id ? 'ring-2 ring-primary ring-offset-2' : ''
                      } ${isAnimating ? 'animate-in fade-in zoom-in duration-300' : ''}`}
                      style={{
                        left: node.position.x + canvasPosition.x,
                        top: node.position.y + canvasPosition.y,
                        minWidth: '150px',
                        zIndex: 10,
                      }}
                      onClick={() => setSelectedNode(node)}
                      data-testid={`canvas-node-${node.id}`}
                    >
                      <button
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        data-testid={`button-delete-node-${node.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${colors.text}`} />
                        <span className={`text-sm font-medium ${colors.text}`}>{node.label}</span>
                      </div>
                      {node.config.subject && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[120px]">
                          {node.config.subject}
                        </div>
                      )}
                      {node.config.duration && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {node.config.duration} {node.config.unit}
                        </div>
                      )}
                    </div>
                  );
                })}

                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Drag nodes from the palette to build your workflow</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedNode && (
              <div className="w-full md:w-72 border-t md:border-t-0 md:border-l bg-background p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Configure Node</h3>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedNode(null)} data-testid="button-close-config">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs">Node Name</Label>
                    <Input
                      value={selectedNode.label}
                      onChange={(e) => {
                        const updated = { ...selectedNode, label: e.target.value };
                        setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
                        setSelectedNode(updated);
                      }}
                      className="mt-1"
                      data-testid="input-node-name"
                    />
                  </div>

                  {selectedNode.type === 'email' && (
                    <>
                      <div>
                        <Label className="text-xs">Subject</Label>
                        <Input
                          placeholder="Email subject line"
                          value={selectedNode.config.subject || ''}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { subject: e.target.value })}
                          className="mt-1"
                          data-testid="input-email-subject"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Body</Label>
                        <Textarea
                          placeholder="Email body content..."
                          value={selectedNode.config.body || ''}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { body: e.target.value })}
                          className="mt-1 min-h-[80px]"
                          data-testid="textarea-email-body"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Template</Label>
                        <Select
                          value={selectedNode.config.template || 'default'}
                          onValueChange={(value) => updateNodeConfig(selectedNode.id, { template: value })}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-email-template">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                            <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                            <SelectItem value="meeting_request">Meeting Request</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'wait' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <Input
                          type="number"
                          min={1}
                          value={selectedNode.config.duration || 1}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { duration: parseInt(e.target.value) || 1 })}
                          className="mt-1"
                          data-testid="input-wait-duration"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={selectedNode.config.unit || 'days'}
                          onValueChange={(value) => updateNodeConfig(selectedNode.id, { unit: value })}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-wait-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'linkedin' && (
                    <div>
                      <Label className="text-xs">Message</Label>
                      <Textarea
                        placeholder="LinkedIn message content..."
                        value={selectedNode.config.message || ''}
                        onChange={(e) => updateNodeConfig(selectedNode.id, { message: e.target.value })}
                        className="mt-1 min-h-[80px]"
                        data-testid="textarea-linkedin-message"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'phone' && (
                    <div>
                      <Label className="text-xs">Call Script</Label>
                      <Textarea
                        placeholder="Call script or talking points..."
                        value={selectedNode.config.script || ''}
                        onChange={(e) => updateNodeConfig(selectedNode.id, { script: e.target.value })}
                        className="mt-1 min-h-[80px]"
                        data-testid="textarea-phone-script"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'condition' && (
                    <>
                      <div>
                        <Label className="text-xs">Condition</Label>
                        <Input
                          placeholder="e.g., replied == true"
                          value={selectedNode.config.condition || ''}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { condition: e.target.value })}
                          className="mt-1"
                          data-testid="input-condition"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">True Label</Label>
                          <Input
                            value={selectedNode.config.trueLabel || 'Yes'}
                            onChange={(e) => updateNodeConfig(selectedNode.id, { trueLabel: e.target.value })}
                            className="mt-1"
                            data-testid="input-true-label"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">False Label</Label>
                          <Input
                            value={selectedNode.config.falseLabel || 'No'}
                            onChange={(e) => updateNodeConfig(selectedNode.id, { falseLabel: e.target.value })}
                            className="mt-1"
                            data-testid="input-false-label"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'ai_decision' && (
                    <div>
                      <Label className="text-xs">Decision Criteria</Label>
                      <Textarea
                        placeholder="Describe how AI should decide..."
                        value={selectedNode.config.criteria || ''}
                        onChange={(e) => updateNodeConfig(selectedNode.id, { criteria: e.target.value })}
                        className="mt-1 min-h-[80px]"
                        data-testid="textarea-ai-criteria"
                      />
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteNode(selectedNode.id)}
                      data-testid="button-delete-selected-node"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Node
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Workflow Templates</DialogTitle>
            <DialogDescription>Start with a pre-built workflow template</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-2 gap-4 p-1">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    const templateDef = template.workflowDefinition as any || {};
                    setNodes(templateDef.nodes || []);
                    setEdges(templateDef.edges || []);
                    setIsAIMode(false);
                    setShowTemplates(false);
                    toast({ title: "Template loaded", description: `"${template.name}" template has been loaded` });
                  }}
                  data-testid={`card-template-${template.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-sm">{template.description}</CardDescription>
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
