import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Brain,
  Mail,
  ArrowRight,
  Play,
  Pause,
  Activity,
  Users,
  Target,
  Calendar,
  RefreshCw,
  Zap,
} from "lucide-react";

type AgentStatus = "idle" | "working" | "waiting" | "optimizing";
type AgentType = "scraper" | "strategist" | "closer";

interface AgentState {
  id: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  currentTask: string | null;
  metrics: {
    primary: { label: string; value: number };
    secondary: { label: string; value: number };
  };
  icon: typeof Search;
  color: string;
  bgGradient: string;
}

interface HandoffEvent {
  id: string;
  from: AgentType;
  to: AgentType;
  description: string;
  timestamp: Date;
  data?: string;
}

interface ActivityLog {
  id: string;
  agent: AgentType;
  type: "action" | "handoff" | "success" | "optimization";
  message: string;
  timestamp: Date;
  emoji: string;
}

const agentConfig: Record<AgentType, Omit<AgentState, "status" | "currentTask" | "metrics">> = {
  scraper: {
    id: "scraper",
    name: "The Scraper",
    description: "Research & Intel",
    icon: Search,
    color: "cyan",
    bgGradient: "from-cyan-500/20 to-cyan-600/10",
  },
  strategist: {
    id: "strategist",
    name: "The Strategist",
    description: "Analysis & Planning",
    icon: Brain,
    color: "purple",
    bgGradient: "from-purple-500/20 to-purple-600/10",
  },
  closer: {
    id: "closer",
    name: "The Closer",
    description: "Outreach & Booking",
    icon: Mail,
    color: "emerald",
    bgGradient: "from-emerald-500/20 to-emerald-600/10",
  },
};

const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string }> = {
  working: { label: "Working", color: "text-emerald-400", bgColor: "bg-emerald-500" },
  idle: { label: "Idle", color: "text-blue-400", bgColor: "bg-blue-500" },
  waiting: { label: "Waiting", color: "text-amber-400", bgColor: "bg-amber-500" },
  optimizing: { label: "Optimizing", color: "text-purple-400", bgColor: "bg-purple-500" },
};

const mockTasks = {
  scraper: [
    "Researching TechCorp website...",
    "Scanning LinkedIn for decision makers...",
    "Analyzing Acme Inc tech stack...",
    "Gathering intel on StartupXYZ...",
    "Mining contacts from Crunchbase...",
  ],
  strategist: [
    "Scoring lead: TechCorp (92 points)",
    "Creating outreach plan for Acme Inc...",
    "Analyzing buying signals...",
    "Optimizing ICP match algorithm...",
    "Ranking 15 new leads...",
  ],
  closer: [
    "Drafting personalized email for John D...",
    "Following up with Sarah M (2nd touch)...",
    "Booking meeting with Mike R...",
    "Sending proposal to TechCorp...",
    "Handling objection response...",
  ],
};

function AgentCard({
  agent,
  isActive,
  onHandoffReceived,
}: {
  agent: AgentState;
  isActive: boolean;
  onHandoffReceived: boolean;
}) {
  const config = agentConfig[agent.id];
  const status = statusConfig[agent.status];
  const Icon = config.icon;

  const colorClasses = {
    cyan: {
      border: "border-cyan-500/30",
      glow: "shadow-cyan-500/20",
      text: "text-cyan-400",
      bg: "bg-cyan-500",
    },
    purple: {
      border: "border-purple-500/30",
      glow: "shadow-purple-500/20",
      text: "text-purple-400",
      bg: "bg-purple-500",
    },
    emerald: {
      border: "border-emerald-500/30",
      glow: "shadow-emerald-500/20",
      text: "text-emerald-400",
      bg: "bg-emerald-500",
    },
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {onHandoffReceived && (
        <motion.div
          className={`absolute inset-0 rounded-xl ${colors.bg} opacity-30`}
          initial={{ scale: 1.1, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      )}
      <Card
        className={`relative overflow-hidden bg-gradient-to-br ${config.bgGradient} border ${colors.border} ${
          agent.status === "working" ? `shadow-lg ${colors.glow}` : ""
        }`}
        data-testid={`card-agent-${agent.id}`}
      >
        {agent.status === "working" && (
          <motion.div
            className={`absolute inset-0 ${colors.bg} opacity-5`}
            animate={{ opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-10 h-10 rounded-lg ${colors.bg}/20 flex items-center justify-center`}
                animate={agent.status === "working" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Icon className={`w-5 h-5 ${colors.text}`} />
              </motion.div>
              <div>
                <CardTitle className="text-base text-white">{config.name}</CardTitle>
                <p className="text-xs text-gray-400">{config.description}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`${status.color} border-current text-xs`}
              data-testid={`badge-status-${agent.id}`}
            >
              <motion.span
                className={`w-1.5 h-1.5 rounded-full ${status.bgColor} mr-1.5`}
                animate={agent.status === "working" ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="min-h-[40px]">
            {agent.currentTask ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2"
              >
                <Activity className={`w-4 h-4 ${colors.text} mt-0.5 flex-shrink-0`} />
                <p className="text-sm text-gray-300" data-testid={`text-task-${agent.id}`}>
                  {agent.currentTask}
                </p>
              </motion.div>
            ) : (
              <p className="text-sm text-gray-500 italic">No active task</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold font-mono text-white" data-testid={`metric-primary-${agent.id}`}>
                {agent.metrics.primary.value}
              </p>
              <p className="text-xs text-gray-400">{agent.metrics.primary.label}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <p className="text-xl font-bold font-mono text-white" data-testid={`metric-secondary-${agent.id}`}>
                {agent.metrics.secondary.value}
              </p>
              <p className="text-xs text-gray-400">{agent.metrics.secondary.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HandoffArrow({
  from,
  to,
  isActive,
}: {
  from: AgentType;
  to: AgentType;
  isActive: boolean;
}) {
  const fromConfig = agentConfig[from];
  const toConfig = agentConfig[to];

  const colorClasses = {
    cyan: "from-cyan-400",
    purple: "from-purple-400 to-purple-400",
    emerald: "to-emerald-400",
  };

  return (
    <div className="flex flex-col items-center justify-center px-2">
      <motion.div
        className={`flex items-center gap-1 ${isActive ? "opacity-100" : "opacity-40"}`}
        animate={isActive ? { x: [0, 5, 0] } : {}}
        transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
      >
        <motion.div
          className={`h-0.5 w-8 bg-gradient-to-r ${colorClasses[fromConfig.color as keyof typeof colorClasses]} ${
            colorClasses[toConfig.color as keyof typeof colorClasses]
          }`}
          animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <ArrowRight
          className={`w-4 h-4 ${
            isActive
              ? toConfig.color === "emerald"
                ? "text-emerald-400"
                : toConfig.color === "purple"
                ? "text-purple-400"
                : "text-cyan-400"
              : "text-gray-600"
          }`}
        />
      </motion.div>
      {isActive && (
        <motion.div
          className="mt-1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        >
          <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
        </motion.div>
      )}
    </div>
  );
}

function ActivityFeed({
  logs,
  filter,
}: {
  logs: ActivityLog[];
  filter: AgentType | "all";
}) {
  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.agent === filter);

  const agentColors = {
    scraper: "text-cyan-400",
    strategist: "text-purple-400",
    closer: "text-emerald-400",
  };

  const typeColors = {
    action: "border-gray-700",
    handoff: "border-amber-500/50",
    success: "border-emerald-500/50",
    optimization: "border-purple-500/50",
  };

  return (
    <ScrollArea className="h-80" data-testid="scroll-activity-feed">
      <div className="space-y-2 pr-4">
        <AnimatePresence mode="popLayout">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.03 }}
                className={`flex items-start gap-3 p-3 rounded-lg bg-black/30 border ${typeColors[log.type]}`}
                data-testid={`log-item-${log.id}`}
              >
                <span className="text-lg">{log.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{log.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${agentColors[log.agent]}`}>
                      {agentConfig[log.agent].name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Start simulation to see agent activities</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}

export function AgentTeams() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([
    {
      ...agentConfig.scraper,
      status: "idle",
      currentTask: null,
      metrics: {
        primary: { label: "Leads Found", value: 0 },
        secondary: { label: "Sites Scanned", value: 0 },
      },
    },
    {
      ...agentConfig.strategist,
      status: "idle",
      currentTask: null,
      metrics: {
        primary: { label: "Leads Scored", value: 0 },
        secondary: { label: "Plans Created", value: 0 },
      },
    },
    {
      ...agentConfig.closer,
      status: "idle",
      currentTask: null,
      metrics: {
        primary: { label: "Emails Sent", value: 0 },
        secondary: { label: "Meetings Booked", value: 0 },
      },
    },
  ]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activeHandoff, setActiveHandoff] = useState<{ from: AgentType; to: AgentType } | null>(null);
  const [recentHandoff, setRecentHandoff] = useState<AgentType | null>(null);
  const [activityFilter, setActivityFilter] = useState<AgentType | "all">("all");

  const addLog = useCallback((agent: AgentType, type: ActivityLog["type"], message: string, emoji: string) => {
    const newLog: ActivityLog = {
      id: `${Date.now()}-${Math.random()}`,
      agent,
      type,
      message,
      timestamp: new Date(),
      emoji,
    };
    setActivityLogs((prev) => [newLog, ...prev].slice(0, 50));
  }, []);

  const updateAgentStatus = useCallback((agentId: AgentType, status: AgentStatus, task: string | null = null) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId ? { ...agent, status, currentTask: task } : agent
      )
    );
  }, []);

  const incrementMetric = useCallback((agentId: AgentType, metricType: "primary" | "secondary", amount: number = 1) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              metrics: {
                ...agent.metrics,
                [metricType]: {
                  ...agent.metrics[metricType],
                  value: agent.metrics[metricType].value + amount,
                },
              },
            }
          : agent
      )
    );
  }, []);

  const triggerHandoff = useCallback((from: AgentType, to: AgentType, description: string) => {
    setActiveHandoff({ from, to });
    setRecentHandoff(to);
    addLog(from, "handoff", `🔄 ${agentConfig[from].name} → ${agentConfig[to].name}: ${description}`, "🔄");
    setTimeout(() => {
      setActiveHandoff(null);
      setRecentHandoff(null);
    }, 1500);
  }, [addLog]);

  useEffect(() => {
    if (!isSimulating) return;

    const scraperInterval = setInterval(() => {
      const task = mockTasks.scraper[Math.floor(Math.random() * mockTasks.scraper.length)];
      updateAgentStatus("scraper", "working", task);
      addLog("scraper", "action", task, "🔍");

      setTimeout(() => {
        incrementMetric("scraper", "secondary");
        if (Math.random() > 0.5) {
          incrementMetric("scraper", "primary");
          addLog("scraper", "success", "Found qualified lead: " + task.split(" ").slice(-1)[0], "✅");
          
          setTimeout(() => {
            updateAgentStatus("scraper", "waiting");
            triggerHandoff("scraper", "strategist", "Lead analysis for " + task.split(" ").slice(-1)[0]);
          }, 500);
        }
      }, 2000);
    }, 4000);

    const strategistInterval = setInterval(() => {
      const task = mockTasks.strategist[Math.floor(Math.random() * mockTasks.strategist.length)];
      updateAgentStatus("strategist", "working", task);
      addLog("strategist", "action", task, "🧠");

      setTimeout(() => {
        incrementMetric("strategist", "primary");
        if (Math.random() > 0.6) {
          incrementMetric("strategist", "secondary");
          addLog("strategist", "success", "Created outreach plan", "📋");
          
          setTimeout(() => {
            updateAgentStatus("strategist", "waiting");
            triggerHandoff("strategist", "closer", "Ready for outreach to " + task.split(" ").slice(-1)[0]);
          }, 500);
        }
      }, 2500);
    }, 5000);

    const closerInterval = setInterval(() => {
      const task = mockTasks.closer[Math.floor(Math.random() * mockTasks.closer.length)];
      updateAgentStatus("closer", "working", task);
      addLog("closer", "action", task, "✉️");

      setTimeout(() => {
        incrementMetric("closer", "primary");
        if (Math.random() > 0.7) {
          incrementMetric("closer", "secondary");
          addLog("closer", "success", "Meeting booked! 🎉", "📅");
        }
        updateAgentStatus("closer", "idle", null);
      }, 3000);
    }, 6000);

    const optimizationInterval = setInterval(() => {
      const agentToOptimize = ["scraper", "strategist", "closer"][Math.floor(Math.random() * 3)] as AgentType;
      updateAgentStatus(agentToOptimize, "optimizing", "Self-optimizing patterns...");
      addLog(agentToOptimize, "optimization", "Optimizing performance patterns", "⚡");
      
      setTimeout(() => {
        updateAgentStatus(agentToOptimize, "idle", null);
      }, 2000);
    }, 15000);

    return () => {
      clearInterval(scraperInterval);
      clearInterval(strategistInterval);
      clearInterval(closerInterval);
      clearInterval(optimizationInterval);
    };
  }, [isSimulating, updateAgentStatus, addLog, incrementMetric, triggerHandoff]);

  const handleToggleSimulation = () => {
    if (isSimulating) {
      setAgents((prev) =>
        prev.map((agent) => ({ ...agent, status: "idle" as AgentStatus, currentTask: null }))
      );
    }
    setIsSimulating(!isSimulating);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-white">
                <Users className="w-5 h-5 text-cyan-400" />
                Multi-Agent Teams
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Specialized AI agents working together with intelligent handoffs
              </p>
            </div>
            <Button
              onClick={handleToggleSimulation}
              variant={isSimulating ? "destructive" : "default"}
              className={isSimulating ? "" : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"}
              data-testid="button-toggle-simulation"
            >
              {isSimulating ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Simulation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Simulation
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {agents.map((agent, index) => (
          <div key={agent.id} className="flex items-center">
            <div className="flex-1 min-w-[280px]">
              <AgentCard
                agent={agent}
                isActive={isSimulating}
                onHandoffReceived={recentHandoff === agent.id}
              />
            </div>
            {index < agents.length - 1 && (
              <HandoffArrow
                from={agents[index].id}
                to={agents[index + 1].id}
                isActive={
                  activeHandoff?.from === agents[index].id &&
                  activeHandoff?.to === agents[index + 1].id
                }
              />
            )}
          </div>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white text-lg">
              <Zap className="w-5 h-5 text-amber-400" />
              Agent Activity Feed
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as AgentType | "all")}>
            <TabsList className="mb-4 bg-black/30">
              <TabsTrigger value="all" data-testid="tab-filter-all">
                All Agents
              </TabsTrigger>
              <TabsTrigger value="scraper" data-testid="tab-filter-scraper" className="text-cyan-400">
                <Search className="w-3 h-3 mr-1" />
                Scraper
              </TabsTrigger>
              <TabsTrigger value="strategist" data-testid="tab-filter-strategist" className="text-purple-400">
                <Brain className="w-3 h-3 mr-1" />
                Strategist
              </TabsTrigger>
              <TabsTrigger value="closer" data-testid="tab-filter-closer" className="text-emerald-400">
                <Mail className="w-3 h-3 mr-1" />
                Closer
              </TabsTrigger>
            </TabsList>
            <TabsContent value={activityFilter}>
              <ActivityFeed logs={activityLogs} filter={activityFilter} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-cyan-900/30 to-gray-900 border-cyan-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white" data-testid="metric-total-leads">
                  {agents.find((a) => a.id === "scraper")?.metrics.primary.value || 0}
                </p>
                <p className="text-xs text-gray-400">Total Leads Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-900/30 to-gray-900 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white" data-testid="metric-total-scored">
                  {agents.find((a) => a.id === "strategist")?.metrics.primary.value || 0}
                </p>
                <p className="text-xs text-gray-400">Leads Scored</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-900/30 to-gray-900 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white" data-testid="metric-total-meetings">
                  {agents.find((a) => a.id === "closer")?.metrics.secondary.value || 0}
                </p>
                <p className="text-xs text-gray-400">Meetings Booked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AgentTeams;
