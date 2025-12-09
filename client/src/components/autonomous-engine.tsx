import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEngine, type VelocityMode, type EngineLog } from "@/contexts/engine-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Square, 
  Zap, 
  Brain, 
  Activity,
  Users,
  Mail,
  Sparkles,
  Gauge,
  Power
} from "lucide-react";

const velocityConfig = {
  warmup: { label: "Warmup", actionsPerHour: 10, description: "Safe, slow", color: "text-emerald-400" },
  safe: { label: "Safe", actionsPerHour: 50, description: "Balanced", color: "text-cyan-400" },
  aggressive: { label: "Aggressive", actionsPerHour: 200, description: "High volume", color: "text-orange-400" },
  ludicrous: { label: "Ludicrous", actionsPerHour: 500, description: "Maximum", color: "text-red-400" },
};

const velocityOrder: VelocityMode[] = ['warmup', 'safe', 'aggressive', 'ludicrous'];

const statusConfig = {
  idle: { label: "Idle", color: "bg-gray-500", textColor: "text-gray-400" },
  warming: { label: "Warming Up", color: "bg-amber-500", textColor: "text-amber-400" },
  running: { label: "Running", color: "bg-emerald-500", textColor: "text-emerald-400" },
  optimizing: { label: "Optimizing", color: "bg-purple-500", textColor: "text-purple-400" },
};

const logTypeColors = {
  success: "text-emerald-400",
  action: "text-cyan-400",
  optimization: "text-purple-400",
  warning: "text-orange-400",
};

function LogEntry({ log, index }: { log: EngineLog; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-start gap-3 py-2 px-3 rounded-lg bg-black/20 border border-white/5"
    >
      <span className="text-lg">{log.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-mono ${logTypeColors[log.type]}`}>
          {log.message}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(log.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: typeof Activity; 
  label: string; 
  value: number; 
  color: string;
}) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-black/30 border border-white/10">
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <span className="text-2xl font-bold font-mono text-white">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export function AutonomousEngine() {
  const {
    isRunning,
    status,
    velocity,
    selfOptimization,
    stats,
    logs,
    startEngine,
    stopEngine,
    setVelocity,
    setSelfOptimization,
    isLoading,
  } = useEngine();

  const velocityIndex = velocityOrder.indexOf(velocity);
  const currentVelocityConfig = velocityConfig[velocity];
  const currentStatusConfig = statusConfig[status];

  const handleVelocityChange = (value: number[]) => {
    const newVelocity = velocityOrder[value[0]];
    if (newVelocity !== velocity) {
      setVelocity(newVelocity);
    }
  };

  const handleToggleEngine = () => {
    if (isRunning) {
      stopEngine();
    } else {
      startEngine();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white">
              <Zap className="w-6 h-6 text-cyan-400" />
              Autonomous Engine
            </CardTitle>
            <Badge 
              variant="outline" 
              className={`${currentStatusConfig.textColor} border-current`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatusConfig.color} mr-2 ${isRunning ? 'animate-pulse' : ''}`} />
              {currentStatusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center">
            <motion.button
              onClick={handleToggleEngine}
              disabled={isLoading}
              className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                isRunning 
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg shadow-emerald-500/30' 
                  : 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              data-testid="button-engine-toggle"
            >
              {isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-emerald-400"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.8, 0, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              <Power className={`w-12 h-12 ${isRunning ? 'text-white' : 'text-gray-400'}`} />
            </motion.button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              {isRunning ? 'Engine is actively processing' : 'Click to start the engine'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-white text-lg">
            <Gauge className="w-5 h-5 text-cyan-400" />
            Velocity Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`text-lg font-semibold ${currentVelocityConfig.color}`}>
                {currentVelocityConfig.label} Mode
              </span>
              <span className="text-sm text-gray-400">
                {currentVelocityConfig.actionsPerHour} actions/hour
              </span>
            </div>
            
            <Slider
              value={[velocityIndex]}
              min={0}
              max={3}
              step={1}
              onValueChange={handleVelocityChange}
              disabled={isLoading}
              className="py-4"
              data-testid="slider-velocity"
            />
            
            <div className="flex justify-between text-xs text-gray-500">
              {velocityOrder.map((v) => (
                <span key={v} className={velocity === v ? velocityConfig[v].color : ''}>
                  {velocityConfig[v].label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            {currentVelocityConfig.description}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white text-lg">
              <Brain className="w-5 h-5 text-purple-400" />
              Self-Optimization
            </CardTitle>
            <Switch
              checked={selfOptimization}
              onCheckedChange={setSelfOptimization}
              disabled={isLoading}
              data-testid="switch-self-optimization"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Enable A/B testing</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Auto-switch to better variants</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>Show optimization wins in logs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-white text-lg">
            <Activity className="w-5 h-5 text-cyan-400" />
            Engine Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Activity}
              label="Actions"
              value={stats.actionsThisSession}
              color="text-cyan-400"
            />
            <StatCard
              icon={Users}
              label="Leads Found"
              value={stats.leadsFound}
              color="text-emerald-400"
            />
            <StatCard
              icon={Mail}
              label="Emails Sent"
              value={stats.emailsSent}
              color="text-blue-400"
            />
            <StatCard
              icon={Sparkles}
              label="Optimizations"
              value={stats.optimizationsMade}
              color="text-purple-400"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-white text-lg">
            <Activity className="w-5 h-5 text-emerald-400" />
            Live Activity Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 pr-4" data-testid="scroll-activity-logs">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <LogEntry key={log.id} log={log} index={index} />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-48 text-gray-500"
                  >
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No activity yet</p>
                    <p className="text-xs mt-1">Start the engine to see logs</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default AutonomousEngine;
