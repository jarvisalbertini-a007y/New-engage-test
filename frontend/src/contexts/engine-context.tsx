import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type EngineStatus = 'idle' | 'warming' | 'running' | 'optimizing';
export type VelocityMode = 'warmup' | 'safe' | 'aggressive' | 'ludicrous';

export interface EngineLog {
  id: string;
  timestamp: string;
  type: 'success' | 'action' | 'optimization' | 'warning';
  message: string;
  emoji?: string;
}

export interface EngineStats {
  actionsThisSession: number;
  leadsFound: number;
  emailsSent: number;
  optimizationsMade: number;
}

export interface EngineState {
  isRunning: boolean;
  status: EngineStatus;
  velocity: VelocityMode;
  selfOptimization: boolean;
  stats: EngineStats;
  logs: EngineLog[];
}

export interface EngineContextType extends EngineState {
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  setVelocity: (velocity: VelocityMode) => Promise<void>;
  setSelfOptimization: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

const defaultState: EngineState = {
  isRunning: false,
  status: 'idle',
  velocity: 'safe',
  selfOptimization: true,
  stats: {
    actionsThisSession: 0,
    leadsFound: 0,
    emailsSent: 0,
    optimizationsMade: 0,
  },
  logs: [],
};

const EngineContext = createContext<EngineContextType | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EngineState>(defaultState);
  const [isLoading, setIsLoading] = useState(false);

  const { data: statusData, refetch: refetchStatus } = useQuery<EngineState>({
    queryKey: ['/api/engine/status'],
    refetchInterval: state.isRunning ? 2000 : false,
  });

  const { data: logsData } = useQuery<EngineLog[]>({
    queryKey: ['/api/engine/logs'],
    refetchInterval: state.isRunning ? 1000 : false,
  });

  useEffect(() => {
    if (statusData) {
      setState(prev => ({
        ...prev,
        ...statusData,
      }));
    }
  }, [statusData]);

  useEffect(() => {
    if (logsData) {
      setState(prev => ({
        ...prev,
        logs: logsData,
      }));
    }
  }, [logsData]);

  const startEngine = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/engine/start');
      const data = await res.json();
      setState(prev => ({
        ...prev,
        isRunning: true,
        status: 'warming',
        ...data,
      }));
      await refetchStatus();
    } finally {
      setIsLoading(false);
    }
  }, [refetchStatus]);

  const stopEngine = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('POST', '/api/engine/stop');
      const data = await res.json();
      setState(prev => ({
        ...prev,
        isRunning: false,
        status: 'idle',
        ...data,
      }));
      await refetchStatus();
    } finally {
      setIsLoading(false);
    }
  }, [refetchStatus]);

  const setVelocity = useCallback(async (velocity: VelocityMode) => {
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/engine/settings', { velocity });
      setState(prev => ({ ...prev, velocity }));
      await refetchStatus();
    } finally {
      setIsLoading(false);
    }
  }, [refetchStatus]);

  const setSelfOptimization = useCallback(async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/engine/settings', { selfOptimization: enabled });
      setState(prev => ({ ...prev, selfOptimization: enabled }));
      await refetchStatus();
    } finally {
      setIsLoading(false);
    }
  }, [refetchStatus]);

  return (
    <EngineContext.Provider
      value={{
        ...state,
        startEngine,
        stopEngine,
        setVelocity,
        setSelfOptimization,
        isLoading,
      }}
    >
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error("useEngine must be used within an EngineProvider");
  }
  return context;
}
