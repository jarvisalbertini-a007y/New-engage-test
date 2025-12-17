import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';

interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface AbTest {
  id: string;
  name: string;
  type: string;
  status: string;
  winner: string | null;
  confidenceLevel: number;
  metrics: {
    variants: Record<string, {
      sent: number;
      opened: number;
      clicked: number;
      replied: number;
      openRate: number;
      replyRate: number;
    }>;
  };
}

export default function ActivityDashboard() {
  const [isAutonomousRunning, setIsAutonomousRunning] = useState(false);
  const queryClient = useQueryClient();

  // Fetch autonomous activity
  const { data: activity = [], refetch: refetchActivity } = useQuery<Activity[]>({
    queryKey: ['autonomousActivity'],
    queryFn: () => api.getExecutionActivity(),
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Fetch A/B tests
  const { data: abTests = [] } = useQuery<AbTest[]>({
    queryKey: ['abTests'],
    queryFn: () => api.getAbTests(),
    refetchInterval: 10000
  });

  // Fetch optimization log
  const { data: optimizations = [] } = useQuery<any[]>({
    queryKey: ['optimizationLog'],
    queryFn: () => api.getOptimizationLog()
  });

  const startMutation = useMutation({
    mutationFn: () => api.startAutonomous(),
    onSuccess: () => {
      setIsAutonomousRunning(true);
      refetchActivity();
    }
  });

  const stopMutation = useMutation({
    mutationFn: () => api.stopAutonomous(),
    onSuccess: () => {
      setIsAutonomousRunning(false);
    }
  });

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      'prospect_discovery': '🔍',
      'company_research': '🏢',
      'email_drafted': '✉️',
      'approval_created': '✅',
      'mode_toggle': '⚡',
      'error': '❌',
      'default': '📋'
    };
    return icons[type] || icons.default;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Real-time view of autonomous execution and self-improvement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            isAutonomousRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isAutonomousRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></span>
            {isAutonomousRunning ? 'Autonomous Running' : 'Autonomous Stopped'}
          </div>
          {isAutonomousRunning ? (
            <Button
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              Start Autonomous
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚡</span> Live Activity Feed
              </CardTitle>
              <CardDescription>
                Real-time actions being executed by your AI agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">🤖</p>
                  <p>No activity yet. Start autonomous mode to see actions.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {activity.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg animate-fadeIn"
                    >
                      <span className="text-2xl">{getActivityIcon(item.type)}</span>
                      <div className="flex-1">
                        <p className="text-gray-800">{item.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(item.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.type === 'error' 
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.type.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* A/B Tests */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📊</span> A/B Tests
              </CardTitle>
              <CardDescription>
                Active experiments and optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abTests.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active A/B tests</p>
              ) : (
                <div className="space-y-4">
                  {abTests.map(test => (
                    <div key={test.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{test.name}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          test.status === 'running' 
                            ? 'bg-blue-100 text-blue-700'
                            : test.winner 
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {test.winner ? `Winner: ${test.winner}` : test.status}
                        </span>
                      </div>
                      
                      {/* Variant comparison */}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {Object.entries(test.metrics?.variants || {}).map(([variant, metrics]) => (
                          <div key={variant} className="p-2 bg-gray-50 rounded text-center">
                            <p className="font-medium text-xs text-gray-600">{variant}</p>
                            <p className="text-lg font-bold">
                              {(metrics as any).openRate?.toFixed(1) || 0}%
                            </p>
                            <p className="text-xs text-gray-500">open rate</p>
                            <p className="text-xs mt-1">
                              {(metrics as any).sent || 0} sent
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Confidence bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Confidence</span>
                          <span>{test.confidenceLevel}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              test.confidenceLevel >= 95 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${test.confidenceLevel}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats & Optimizations */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Prospects Found</span>
                  <span className="font-bold text-lg">
                    {activity.filter(a => a.type === 'prospect_discovery').length * 5}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Companies Researched</span>
                  <span className="font-bold text-lg">
                    {activity.filter(a => a.type === 'company_research').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Emails Drafted</span>
                  <span className="font-bold text-lg">
                    {activity.filter(a => a.type === 'email_drafted').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pending Approvals</span>
                  <span className="font-bold text-lg text-amber-600">
                    {activity.filter(a => a.type === 'approval_created').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Self-Improvement Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>🧠</span> AI Optimizations
              </CardTitle>
              <CardDescription>
                Improvements made by self-learning
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optimizations.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">
                  AI is learning... optimizations will appear here
                </p>
              ) : (
                <div className="space-y-3">
                  {optimizations.slice(0, 5).map((opt, idx) => (
                    <div key={idx} className="p-3 bg-green-50 rounded-lg text-sm">
                      <p className="font-medium text-green-800">
                        {opt.type.replace('_', ' ')} optimized
                      </p>
                      <p className="text-green-600 text-xs mt-1">
                        Winner: {opt.winner} ({opt.improvement})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Action Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                  <span>Email approvals pending</span>
                  <span className="font-medium">
                    {activity.filter(a => a.type === 'approval_created').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span>Research in queue</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <span>Scheduled follow-ups</span>
                  <span className="font-medium">0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
