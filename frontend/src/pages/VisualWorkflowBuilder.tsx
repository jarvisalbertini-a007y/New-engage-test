import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  Sparkles,
  Settings,
  RefreshCw,
  Workflow,
  GripVertical,
  Target,
  UserCheck,
  MessageSquare,
  Calendar,
  Bell,
  Filter,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo,
  Redo,
  Copy,
  Layers
} from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'email' | 'wait' | 'approval' | 'branch' | 'action' | 'end' | 'condition' | 'notification' | 'task';
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: 'default' | 'success' | 'failure';
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

interface DragState {
  type: 'node' | 'edge' | null;
  nodeId?: string;
  startPos?: { x: number; y: number };
  sourceNodeId?: string;
  mousePos?: { x: number; y: number };
}

const nodeTypeConfig: Record<string, { icon: any; color: string; label: string; description: string }> = {
  trigger: { icon: Zap, color: '#10B981', label: 'Trigger', description: 'Start the workflow' },
  email: { icon: Mail, color: '#3B82F6', label: 'Send Email', description: 'Send an email to prospect' },
  wait: { icon: Clock, color: '#F59E0B', label: 'Wait', description: 'Wait for a duration' },
  approval: { icon: CheckCircle2, color: '#8B5CF6', label: 'Approval', description: 'Wait for approval' },
  branch: { icon: GitBranch, color: '#EC4899', label: 'Branch', description: 'Conditional split' },
  condition: { icon: Filter, color: '#F97316', label: 'Condition', description: 'Check a condition' },
  action: { icon: Settings, color: '#6366F1', label: 'Action', description: 'Perform an action' },
  notification: { icon: Bell, color: '#14B8A6', label: 'Notification', description: 'Send notification' },
  task: { icon: Target, color: '#8B5CF6', label: 'Task', description: 'Create a task' },
  end: { icon: XCircle, color: '#EF4444', label: 'End', description: 'End the workflow' },
};

const triggerTypes = [
  { id: 'new_prospect', label: 'New Prospect Added', icon: UserCheck },
  { id: 'email_opened', label: 'Email Opened', icon: Mail },
  { id: 'email_clicked', label: 'Email Link Clicked', icon: Target },
  { id: 'form_submitted', label: 'Form Submitted', icon: MessageSquare },
  { id: 'scheduled', label: 'Scheduled Time', icon: Calendar },
  { id: 'manual', label: 'Manual Start', icon: Play },
];

export default function VisualWorkflowBuilder() {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ type: null });
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [history, setHistory] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tempEdge, setTempEdge] = useState<{ x: number; y: number } | null>(null);

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
          position: { x: 300, y: 80 + i * 140 }
        }));
        
        setNodes(positionedNodes);
        setEdges((workflow.edges || []).map((e: any, i: number) => ({ ...e, id: `edge_${i}` })));
        setShowAIGenerate(false);
        setAiDescription('');
        saveToHistory(positionedNodes, workflow.edges || []);
      }
    }
  });

  // Save to history for undo/redo
  const saveToHistory = useCallback((newNodes: WorkflowNode[], newEdges: WorkflowEdge[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: newNodes, edges: newEdges });
    setHistory(newHistory.slice(-20)); // Keep last 20 states
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Load workflow into editor
  const loadWorkflow = (workflow: WorkflowData) => {
    setSelectedWorkflow(workflow);
    setWorkflowName(workflow.name);
    
    const positionedNodes = workflow.nodes.map((node, i) => ({
      ...node,
      position: node.position || { x: 300, y: 80 + i * 140 }
    }));
    
    setNodes(positionedNodes);
    setEdges((workflow.edges || []).map((e, i) => ({ ...e, id: e.id || `edge_${i}` })));
    saveToHistory(positionedNodes, workflow.edges);
  };

  // Add new node
  const addNode = (type: WorkflowNode['type'], position?: { x: number; y: number }) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      label: nodeTypeConfig[type].label,
      config: type === 'wait' ? { duration: 1, unit: 'days' } : {},
      position: position || { x: 300, y: nodes.length * 140 + 80 }
    };
    
    const newNodes = [...nodes, newNode];
    let newEdges = [...edges];
    
    // Auto-connect to last node if exists
    if (nodes.length > 0 && !position) {
      const lastNode = nodes[nodes.length - 1];
      newEdges = [...edges, { id: `edge_${Date.now()}`, source: lastNode.id, target: newNode.id }];
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
    saveToHistory(newNodes, newEdges);
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    const newNodes = nodes.filter(n => n.id !== nodeId);
    const newEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    if (selectedNode === nodeId) setSelectedNode(null);
    saveToHistory(newNodes, newEdges);
  };

  // Delete edge
  const deleteEdge = (edgeId: string) => {
    const newEdges = edges.filter(e => e.id !== edgeId);
    setEdges(newEdges);
    setSelectedEdge(null);
    saveToHistory(nodes, newEdges);
  };

  // Duplicate node
  const duplicateNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const newNode: WorkflowNode = {
      ...node,
      id: `node_${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 }
    };
    
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    saveToHistory(newNodes, edges);
  };

  // Handle node drag
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDragState({
      type: 'node',
      nodeId,
      startPos: { x: e.clientX - node.position.x * zoom, y: e.clientY - node.position.y * zoom }
    });
    setSelectedNode(nodeId);
    setSelectedEdge(null);
  };

  // Handle connection start (from output handle)
  const handleConnectionStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setTempEdge({
        x: (e.clientX - rect.left) / zoom - pan.x,
        y: (e.clientY - rect.top) / zoom - pan.y
      });
    }
  };

  // Handle connection end (to input handle)
  const handleConnectionEnd = (targetNodeId: string) => {
    if (connectingFrom && connectingFrom !== targetNodeId) {
      // Check if edge already exists
      const edgeExists = edges.some(e => e.source === connectingFrom && e.target === targetNodeId);
      if (!edgeExists) {
        const newEdge: WorkflowEdge = {
          id: `edge_${Date.now()}`,
          source: connectingFrom,
          target: targetNodeId
        };
        const newEdges = [...edges, newEdge];
        setEdges(newEdges);
        saveToHistory(nodes, newEdges);
      }
    }
    setConnectingFrom(null);
    setTempEdge(null);
  };

  // Handle mouse move for dragging
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Update temp edge while connecting
    if (connectingFrom) {
      setTempEdge({
        x: (e.clientX - rect.left) / zoom - pan.x,
        y: (e.clientY - rect.top) / zoom - pan.y
      });
    }

    // Handle node dragging
    if (dragState.type === 'node' && dragState.nodeId && dragState.startPos) {
      const newX = (e.clientX - dragState.startPos.x) / zoom;
      const newY = (e.clientY - dragState.startPos.y) / zoom;
      
      setNodes(nodes.map(n =>
        n.id === dragState.nodeId
          ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : n
      ));
    }

    // Handle panning
    if (isPanning && dragState.startPos) {
      setPan({
        x: pan.x + (e.clientX - dragState.startPos.x) / zoom,
        y: pan.y + (e.clientY - dragState.startPos.y) / zoom
      });
      setDragState({ ...dragState, startPos: { x: e.clientX, y: e.clientY } });
    }
  }, [dragState, nodes, zoom, pan, isPanning, connectingFrom]);

  // Handle mouse up
  const handleCanvasMouseUp = useCallback(() => {
    if (dragState.type === 'node') {
      saveToHistory(nodes, edges);
    }
    setDragState({ type: null });
    setIsPanning(false);
    setConnectingFrom(null);
    setTempEdge(null);
  }, [dragState, nodes, edges, saveToHistory]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  };

  // Handle canvas pan start
  const handleCanvasPanStart = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setDragState({ type: null, startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  // Start new workflow
  const startNew = () => {
    setSelectedWorkflow(null);
    setWorkflowName('New Workflow');
    const initialNodes: WorkflowNode[] = [
      { id: 'start', type: 'trigger', label: 'Start', config: { triggerType: 'manual' }, position: { x: 300, y: 80 } }
    ];
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNode(null);
    setHistory([]);
    setHistoryIndex(-1);
    saveToHistory(initialNodes, []);
  };

  // Get edge path with curves
  const getEdgePath = useCallback((source: WorkflowNode, target: WorkflowNode): string => {
    const nodeWidth = 200;
    const nodeHeight = 80;
    
    const sx = source.position.x + nodeWidth / 2;
    const sy = source.position.y + nodeHeight;
    const tx = target.position.x + nodeWidth / 2;
    const ty = target.position.y;
    
    const deltaY = ty - sy;
    const controlOffset = Math.min(Math.abs(deltaY) * 0.5, 80);
    
    return `M ${sx} ${sy} C ${sx} ${sy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`;
  }, []);

  // Get temp edge path while connecting
  const getTempEdgePath = useCallback((): string => {
    if (!connectingFrom || !tempEdge) return '';
    
    const sourceNode = nodes.find(n => n.id === connectingFrom);
    if (!sourceNode) return '';
    
    const nodeWidth = 200;
    const nodeHeight = 80;
    
    const sx = sourceNode.position.x + nodeWidth / 2;
    const sy = sourceNode.position.y + nodeHeight;
    const tx = tempEdge.x;
    const ty = tempEdge.y;
    
    const deltaY = ty - sy;
    const controlOffset = Math.min(Math.abs(deltaY) * 0.5, 80);
    
    return `M ${sx} ${sy} C ${sx} ${sy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`;
  }, [connectingFrom, tempEdge, nodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) deleteNode(selectedNode);
        if (selectedEdge) deleteEdge(selectedEdge);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedNode) {
        e.preventDefault();
        duplicateNode(selectedNode);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge, undo, redo]);

  // Handle drop from palette
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as WorkflowNode['type'];
    if (!nodeType || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x - 100;
    const y = (e.clientY - rect.top) / zoom - pan.y - 40;
    
    addNode(nodeType, { x: Math.max(0, x), y: Math.max(0, y) });
  };

  // Render node
  const renderNode = (node: WorkflowNode) => {
    const config = nodeTypeConfig[node.type];
    const Icon = config.icon;
    const isSelected = selectedNode === node.id;
    const isConnecting = connectingFrom === node.id;
    
    return (
      <div
        key={node.id}
        data-testid={`workflow-node-${node.id}`}
        className={`absolute transition-all duration-150 ${isSelected ? 'z-20' : 'z-10'}`}
        style={{
          left: node.position.x,
          top: node.position.y,
          width: 200,
        }}
        onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNode(node.id);
          setSelectedEdge(null);
        }}
      >
        {/* Input Handle (top) */}
        {node.type !== 'trigger' && (
          <div
            className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 cursor-pointer transition-all ${
              connectingFrom ? 'bg-violet-500 border-violet-600 scale-125' : 'bg-white border-gray-300 hover:border-violet-500 hover:bg-violet-100'
            }`}
            onMouseUp={() => handleConnectionEnd(node.id)}
          />
        )}
        
        {/* Node Body */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 transition-all cursor-move ${
            isSelected
              ? 'border-violet-500 shadow-violet-200 dark:shadow-violet-900/50'
              : isConnecting
              ? 'border-emerald-500'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3 border-b rounded-t-xl"
            style={{ backgroundColor: `${config.color}10` }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: config.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{node.label}</p>
              <p className="text-xs text-gray-500 truncate">{config.description}</p>
            </div>
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          
          {/* Config Preview */}
          <div className="px-4 py-2 text-xs text-gray-500">
            {node.type === 'wait' && node.config.duration && (
              <span>Wait {node.config.duration} {node.config.unit || 'days'}</span>
            )}
            {node.type === 'email' && node.config.template && (
              <span>Template: {node.config.template}</span>
            )}
            {node.type === 'trigger' && node.config.triggerType && (
              <span>On: {triggerTypes.find(t => t.id === node.config.triggerType)?.label || 'Manual'}</span>
            )}
            {node.type === 'condition' && node.config.condition && (
              <span>If: {node.config.condition}</span>
            )}
            {!node.config.duration && !node.config.template && !node.config.triggerType && !node.config.condition && (
              <span className="italic">Click to configure</span>
            )}
          </div>
        </div>
        
        {/* Output Handle (bottom) */}
        {node.type !== 'end' && (
          <div
            className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 cursor-crosshair transition-all ${
              isConnecting ? 'bg-emerald-500 border-emerald-600 scale-125' : 'bg-white border-gray-300 hover:border-emerald-500 hover:bg-emerald-100'
            }`}
            onMouseDown={(e) => handleConnectionStart(node.id, e)}
          />
        )}
        
        {/* Branch Handles for branch/condition nodes */}
        {(node.type === 'branch' || node.type === 'condition') && (
          <>
            <div
              className="absolute -bottom-2 left-1/4 transform -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-600 cursor-crosshair"
              onMouseDown={(e) => handleConnectionStart(node.id, e)}
              title="Yes/True"
            />
            <div
              className="absolute -bottom-2 left-3/4 transform -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-red-600 cursor-crosshair"
              onMouseDown={(e) => handleConnectionStart(node.id, e)}
              title="No/False"
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900" data-testid="visual-workflow-builder">
      {/* Left Sidebar - Workflow List & Node Palette */}
      <div className="w-72 border-r bg-white dark:bg-gray-800 flex flex-col">
        {/* Workflow List */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Workflows</h2>
            <Button size="sm" variant="outline" onClick={startNew}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
          
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (workflows as WorkflowData[] || []).slice(0, 5).map((wf) => (
              <div
                key={wf.id}
                onClick={() => loadWorkflow(wf)}
                className={`p-2 rounded-lg border cursor-pointer transition ${
                  selectedWorkflow?.id === wf.id
                    ? 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {wf.aiGenerated && <Sparkles className="w-3 h-3 text-violet-500" />}
                  <span className="text-sm font-medium truncate text-gray-900 dark:text-white">{wf.name}</span>
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
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate with AI
          </Button>
          
          {showAIGenerate && (
            <div className="mt-3 space-y-2">
              <textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Describe your workflow in natural language...&#10;&#10;Examples:&#10;• 3-step email sequence with 2-day waits&#10;• Lead qualification with approval gate&#10;• Multi-channel outreach with branches"
                className="w-full p-3 text-sm border rounded-lg resize-none h-28 bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
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
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Node Palette */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Drag to Canvas</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(nodeTypeConfig).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('nodeType', type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing transition"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Keyboard Shortcuts */}
        <div className="p-4 border-t text-xs text-gray-500">
          <p className="font-medium mb-1">Shortcuts</p>
          <p>⌘Z Undo • ⌘⇧Z Redo</p>
          <p>⌘D Duplicate • Del Delete</p>
          <p>Alt+Drag to Pan</p>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <Workflow className="w-5 h-5 text-violet-500" />
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-64 font-medium"
            />
            <span className="text-xs text-gray-400">
              {nodes.length} steps • {edges.length} connections
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo (⌘Z)">
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (⌘⇧Z)">
              <Redo className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            
            {/* Zoom */}
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))} title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset View">
              <Maximize2 className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            
            {/* Actions */}
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate({ name: workflowName, nodes, edges })}
              disabled={saveMutation.isPending || nodes.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button disabled={nodes.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              <Play className="w-4 h-4 mr-2" />
              Test Run
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-default"
          style={{
            backgroundImage: `radial-gradient(circle, ${zoom > 0.7 ? '#d1d5db' : 'transparent'} 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`
          }}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasPanStart}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          {/* Transform container */}
          <div
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0',
              width: '100%',
              height: '100%'
            }}
          >
            {/* SVG for edges */}
            <svg
              ref={svgRef}
              className="absolute inset-0 pointer-events-none"
              style={{ width: '3000px', height: '3000px' }}
            >
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
                <marker
                  id="arrowhead-selected"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#8B5CF6" />
                </marker>
              </defs>
              
              {/* Render edges */}
              {edges.map((edge) => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                
                const isSelected = selectedEdge === edge.id;
                
                return (
                  <g key={edge.id}>
                    {/* Invisible wider path for easier selection */}
                    <path
                      d={getEdgePath(source, target)}
                      stroke="transparent"
                      strokeWidth="20"
                      fill="none"
                      className="cursor-pointer"
                      style={{ pointerEvents: 'stroke' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdge(edge.id);
                        setSelectedNode(null);
                      }}
                    />
                    {/* Visible edge */}
                    <path
                      d={getEdgePath(source, target)}
                      stroke={isSelected ? '#8B5CF6' : '#9CA3AF'}
                      strokeWidth={isSelected ? 3 : 2}
                      fill="none"
                      markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                      className="transition-all"
                    />
                  </g>
                );
              })}
              
              {/* Temp edge while connecting */}
              {connectingFrom && tempEdge && (
                <path
                  d={getTempEdgePath()}
                  stroke="#8B5CF6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                />
              )}
            </svg>

            {/* Nodes */}
            {nodes.map(renderNode)}
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Start Building Your Workflow</p>
                <p className="text-sm mt-2">Drag steps from the sidebar or generate with AI</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Node Config */}
      {selectedNode && (
        <div className="w-80 border-l bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900 dark:text-white">Configure Step</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              const node = nodes.find(n => n.id === selectedNode);
              if (!node) return null;
              
              const config = nodeTypeConfig[node.type];
              const Icon = config.icon;
              
              return (
                <div className="space-y-5">
                  {/* Node header */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}15` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{config.label}</p>
                      <p className="text-xs text-gray-500">{config.description}</p>
                    </div>
                  </div>
                  
                  {/* Label */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Step Name</label>
                    <Input
                      value={node.label}
                      onChange={(e) => {
                        setNodes(nodes.map(n =>
                          n.id === node.id ? { ...n, label: e.target.value } : n
                        ));
                      }}
                    />
                  </div>
                  
                  {/* Trigger config */}
                  {node.type === 'trigger' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trigger Type</label>
                      <select
                        className="w-full p-2.5 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                        value={node.config.triggerType || 'manual'}
                        onChange={(e) => {
                          setNodes(nodes.map(n =>
                            n.id === node.id
                              ? { ...n, config: { ...n.config, triggerType: e.target.value } }
                              : n
                          ));
                        }}
                      >
                        {triggerTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Wait config */}
                  {node.type === 'wait' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Wait Duration</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={node.config.duration || ''}
                          onChange={(e) => {
                            setNodes(nodes.map(n =>
                              n.id === node.id
                                ? { ...n, config: { ...n.config, duration: parseInt(e.target.value) || 1 } }
                                : n
                            ));
                          }}
                          className="flex-1"
                        />
                        <select
                          className="w-24 p-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                          value={node.config.unit || 'days'}
                          onChange={(e) => {
                            setNodes(nodes.map(n =>
                              n.id === node.id
                                ? { ...n, config: { ...n.config, unit: e.target.value } }
                                : n
                            ));
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  )}
                  
                  {/* Email config */}
                  {node.type === 'email' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Template</label>
                        <select
                          className="w-full p-2.5 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                          value={node.config.template || ''}
                          onChange={(e) => {
                            setNodes(nodes.map(n =>
                              n.id === node.id
                                ? { ...n, config: { ...n.config, template: e.target.value } }
                                : n
                            ));
                          }}
                        >
                          <option value="">Select template...</option>
                          <option value="intro">Introduction Email</option>
                          <option value="followup">Follow-up Email</option>
                          <option value="demo">Demo Request</option>
                          <option value="value_prop">Value Proposition</option>
                          <option value="case_study">Case Study</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject Line</label>
                        <Input
                          value={node.config.subject || ''}
                          placeholder="Email subject..."
                          onChange={(e) => {
                            setNodes(nodes.map(n =>
                              n.id === node.id
                                ? { ...n, config: { ...n.config, subject: e.target.value } }
                                : n
                            ));
                          }}
                        />
                      </div>
                    </>
                  )}
                  
                  {/* Condition config */}
                  {(node.type === 'condition' || node.type === 'branch') && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Condition</label>
                      <select
                        className="w-full p-2.5 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                        value={node.config.condition || ''}
                        onChange={(e) => {
                          setNodes(nodes.map(n =>
                            n.id === node.id
                              ? { ...n, config: { ...n.config, condition: e.target.value } }
                              : n
                          ));
                        }}
                      >
                        <option value="">Select condition...</option>
                        <option value="email_opened">Email was opened</option>
                        <option value="link_clicked">Link was clicked</option>
                        <option value="replied">Prospect replied</option>
                        <option value="no_response">No response after wait</option>
                        <option value="lead_score_high">Lead score &gt; 70</option>
                        <option value="company_size">Company size match</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Action config */}
                  {node.type === 'action' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action Type</label>
                      <select
                        className="w-full p-2.5 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
                        value={node.config.actionType || ''}
                        onChange={(e) => {
                          setNodes(nodes.map(n =>
                            n.id === node.id
                              ? { ...n, config: { ...n.config, actionType: e.target.value } }
                              : n
                          ));
                        }}
                      >
                        <option value="">Select action...</option>
                        <option value="update_status">Update prospect status</option>
                        <option value="add_tag">Add tag to prospect</option>
                        <option value="assign_owner">Assign to team member</option>
                        <option value="create_task">Create follow-up task</option>
                        <option value="enrich_data">Enrich prospect data</option>
                        <option value="webhook">Trigger webhook</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Connections info */}
                  <div className="pt-4 border-t">
                    <p className="text-xs font-medium text-gray-500 mb-2">CONNECTIONS</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Incoming: {edges.filter(e => e.target === node.id).length}</p>
                      <p>Outgoing: {edges.filter(e => e.source === node.id).length}</p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => duplicateNode(node.id)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate Step
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
        </div>
      )}
      
      {/* Selected Edge Panel */}
      {selectedEdge && !selectedNode && (
        <div className="w-72 border-l bg-white dark:bg-gray-800 p-4">
          <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">Connection</h3>
          <p className="text-sm text-gray-500 mb-4">
            This connection links two steps in your workflow.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-500 hover:bg-red-50"
            onClick={() => deleteEdge(selectedEdge)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Connection
          </Button>
        </div>
      )}
    </div>
  );
}
