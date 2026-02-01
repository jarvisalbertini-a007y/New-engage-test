import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Play,
  Plus,
  Save,
  Trash2,
  Zap,
  Mail,
  Clock,
  GitBranch,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  MousePointer2,
  Settings,
  RefreshCw,
  ChevronRight,
  Workflow
} from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'email' | 'wait' | 'approval' | 'branch' | 'action' | 'end';
  label: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  trigger?: { type: string; config: any };
  status: string;
  aiGenerated?: boolean;
  createdAt: string;
}

const nodeTypeConfig = {
  trigger: { icon: Zap, color: '#10B981', label: 'Trigger' },
  email: { icon: Mail, color: '#3B82F6', label: 'Send Email' },
  wait: { icon: Clock, color: '#F59E0B', label: 'Wait' },
  approval: { icon: CheckCircle2, color: '#8B5CF6', label: 'Approval' },
  branch: { icon: GitBranch, color: '#EC4899', label: 'Branch' },
  action: { icon: Settings, color: '#6366F1', label: 'Action' },
  end: { icon: XCircle, color: '#EF4444', label: 'End' },
};

export default function VisualWorkflowBuilder() {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [workflowName, setWorkflowName] = useState('New Workflow');
  
  // Fetch workflows
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows-visual'],
    queryFn: async () => {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/workflows`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    }
  });

  // Save workflow mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: data.name,
          description: '',
          nodes: data.nodes,
          edges: data.edges,
          category: 'custom',
          status: 'draft'
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows-visual'] });
    }
  });

  // AI Generate workflow mutation
  const aiGenerateMutation = useMutation({
    mutationFn: (description: string) => api.aiCreateWorkflow?.({ description }) || Promise.resolve({}),
    onSuccess: (data: any) => {
      if (data.workflow) {
        const workflow = data.workflow;
        setWorkflowName(workflow.name || 'AI Generated Workflow');
        
        // Position nodes in a vertical flow
        const positionedNodes = (workflow.nodes || []).map((node: any, i: number) => ({
          ...node,
          position: { x: 400, y: 100 + i * 120 }
        }));
        
        setNodes(positionedNodes);
        setEdges(workflow.edges || []);
        setShowAIGenerate(false);
        setAiDescription('');
      }
    }
  });

  // Load workflow into editor
  const loadWorkflow = (workflow: WorkflowData) => {
    setSelectedWorkflow(workflow);
    setWorkflowName(workflow.name);
    
    // Position nodes if not already positioned
    const positionedNodes = workflow.nodes.map((node, i) => ({
      ...node,
      position: node.position || { x: 400, y: 100 + i * 120 }
    }));
    
    setNodes(positionedNodes);
    setEdges(workflow.edges);
  };

  // Add new node
  const addNode = (type: WorkflowNode['type']) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      label: nodeTypeConfig[type].label,
      config: {},
      position: { x: 400, y: nodes.length * 120 + 100 }
    };
    
    setNodes([...nodes, newNode]);
    
    // Auto-connect to last node if exists
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setEdges([...edges, { source: lastNode.id, target: newNode.id }]);
    }
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvas.left - 80;
    const y = e.clientY - canvas.top - 30;
    
    setNodes(nodes.map(n => 
      n.id === nodeId ? { ...n, position: { x, y } } : n
    ));
  }, [nodes]);

  // Start new workflow
  const startNew = () => {
    setSelectedWorkflow(null);
    setWorkflowName('New Workflow');
    setNodes([
      { id: 'start', type: 'trigger', label: 'Start', config: {}, position: { x: 400, y: 100 } }
    ]);
    setEdges([]);
    setSelectedNode(null);
  };

  // Calculate edge path
  const getEdgePath = (source: WorkflowNode, target: WorkflowNode) => {
    if (!source.position || !target.position) return '';
    
    const sx = source.position.x + 80;
    const sy = source.position.y + 30;
    const tx = target.position.x + 80;
    const ty = target.position.y + 30;
    
    // Curved path
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy + 30} Q ${sx} ${midY} ${(sx + tx) / 2} ${midY} Q ${tx} ${midY} ${tx} ${ty - 30}`;
  };

  return (
    <div className="flex h-full" data-testid="visual-workflow-builder">
      {/* Left Sidebar - Workflow List & Node Palette */}
      <div className="w-72 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Workflow List */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Workflows</h2>
            <Button size="sm" variant="outline" onClick={startNew}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (workflows as WorkflowData[] || []).slice(0, 5).map((wf) => (
              <div
                key={wf.id}
                onClick={() => loadWorkflow(wf)}
                className={`p-2 rounded-lg border cursor-pointer transition ${
                  selectedWorkflow?.id === wf.id
                    ? 'bg-violet-50 border-violet-200 dark:bg-violet-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {wf.aiGenerated && <Sparkles className="w-3 h-3 text-violet-500" />}
                  <span className="text-sm font-medium truncate">{wf.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {wf.nodes?.length || 0} steps
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* AI Generate */}
        <div className="p-4 border-b">
          <Button
            onClick={() => setShowAIGenerate(!showAIGenerate)}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate with AI
          </Button>
          
          {showAIGenerate && (
            <div className="mt-3 space-y-2">
              <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Describe your workflow... e.g., 'Email sequence: intro, wait 2 days, follow-up'"
                className="w-full p-2 text-sm border rounded-lg resize-none h-20"
              />
              <Button
                size="sm"
                onClick={() => aiGenerateMutation.mutate(aiDescription)}
                disabled={!aiDescription.trim() || aiGenerateMutation.isPending}
                className="w-full"
              >
                {aiGenerateMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  'Generate'
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Node Palette */}
        <div className="p-4 flex-1">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Add Step</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(nodeTypeConfig).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => addNode(type as WorkflowNode['type'])}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <span className="text-xs">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <Workflow className="w-5 h-5 text-violet-500" />
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-64 font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ name: workflowName, nodes, edges })}
              disabled={saveMutation.isPending || nodes.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button disabled={nodes.length === 0}>
              <Play className="w-4 h-4 mr-2" />
              Test Run
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative bg-gray-100 dark:bg-gray-900 overflow-auto"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* SVG for edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const source = nodes.find(n => n.id === edge.source);
              const target = nodes.find(n => n.id === edge.target);
              if (!source || !target) return null;
              
              return (
                <path
                  key={i}
                  d={getEdgePath(source, target)}
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const config = nodeTypeConfig[node.type];
            const Icon = config.icon;
            
            return (
              <div
                key={node.id}
                className={`absolute cursor-move transition-shadow ${
                  selectedNode === node.id ? 'ring-2 ring-violet-500 ring-offset-2' : ''
                }`}
                style={{
                  left: node.position?.x || 0,
                  top: node.position?.y || 0,
                  width: 160,
                }}
                onClick={() => setSelectedNode(node.id)}
                onMouseDown={() => setDraggedNode(node.id)}
                onMouseMove={(e) => draggedNode === node.id && handleNodeDrag(node.id, e)}
                onMouseUp={() => setDraggedNode(null)}
                onMouseLeave={() => setDraggedNode(null)}
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <span className="text-sm font-medium truncate">{node.label}</span>
                  </div>
                  
                  {selectedNode === node.id && (
                    <div className="flex gap-1 mt-2 pt-2 border-t">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className="flex-1 p-1 text-xs text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3 mx-auto" />
                      </button>
                      <button className="flex-1 p-1 text-xs text-gray-500 hover:bg-gray-50 rounded">
                        <Settings className="w-3 h-3 mx-auto" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Workflow className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Start Building Your Workflow</p>
                <p className="text-sm mt-2">Add steps from the sidebar or generate with AI</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Node Config */}
      {selectedNode && (
        <div className="w-72 border-l bg-white dark:bg-gray-800 p-4">
          <h3 className="font-semibold mb-4">Configure Step</h3>
          {(() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            const config = nodeTypeConfig[node.type];
            const Icon = config.icon;
            
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-gray-500">ID: {node.id}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={node.label}
                    onChange={(e) => {
                      setNodes(nodes.map(n =>
                        n.id === node.id ? { ...n, label: e.target.value } : n
                      ));
                    }}
                  />
                </div>
                
                {node.type === 'wait' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Wait Duration</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="3"
                        value={node.config.duration || ''}
                        onChange={(e) => {
                          setNodes(nodes.map(n =>
                            n.id === node.id 
                              ? { ...n, config: { ...n.config, duration: e.target.value } } 
                              : n
                          ));
                        }}
                      />
                      <select
                        className="px-3 border rounded-md"
                        value={node.config.unit || 'days'}
                        onChange={(e) => {
                          setNodes(nodes.map(n =>
                            n.id === node.id 
                              ? { ...n, config: { ...n.config, unit: e.target.value } } 
                              : n
                          ));
                        }}
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {node.type === 'email' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Template</label>
                    <select className="w-full p-2 border rounded-md">
                      <option value="">Select template...</option>
                      <option value="intro">Introduction Email</option>
                      <option value="followup">Follow-up Email</option>
                      <option value="demo">Demo Request</option>
                    </select>
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 hover:bg-red-50"
                    onClick={() => deleteNode(node.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Step
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
