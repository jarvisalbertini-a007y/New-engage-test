import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: agentMetrics } = useQuery({
    queryKey: ['agentMetrics'],
    queryFn: api.getAgentMetrics,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'there'}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here's what's happening with your sales engine.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">
              {agentMetrics?.totalAgents || 0}
            </div>
            <div className="text-sm text-gray-500">Total Agents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {agentMetrics?.activeAgents || 0}
            </div>
            <div className="text-sm text-gray-500">Active Agents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {workflows?.length || 0}
            </div>
            <div className="text-sm text-gray-500">Workflows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {agentMetrics?.totalTasksCompleted || 0}
            </div>
            <div className="text-sm text-gray-500">Tasks Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/command">
              <Button className="w-full justify-start" variant="outline">
                💬 Execute a Command
              </Button>
            </Link>
            <Link to="/agents">
              <Button className="w-full justify-start" variant="outline">
                🤖 Browse Agent Catalog
              </Button>
            </Link>
            <Link to="/workflows">
              <Button className="w-full justify-start" variant="outline">
                ⚡ Create Workflow
              </Button>
            </Link>
            <Link to="/prospects">
              <Button className="w-full justify-start" variant="outline">
                👥 Add Prospects
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest agent executions</CardDescription>
          </CardHeader>
          <CardContent>
            {agents && agents.length > 0 ? (
              <div className="space-y-3">
                {agents.slice(0, 5).map((agent: any) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{agent.name}</div>
                      <div className="text-sm text-gray-500">{agent.category}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No agents yet.</p>
                <Link to="/agents">
                  <Button variant="link" className="mt-2">Create your first agent</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Categories Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Library</CardTitle>
          <CardDescription>1000+ agents across 10 categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Prospecting', icon: '🔍', color: 'bg-blue-100 text-blue-700' },
              { name: 'Research', icon: '📚', color: 'bg-purple-100 text-purple-700' },
              { name: 'Outreach', icon: '📨', color: 'bg-green-100 text-green-700' },
              { name: 'Qualification', icon: '✅', color: 'bg-yellow-100 text-yellow-700' },
              { name: 'Scheduling', icon: '📅', color: 'bg-pink-100 text-pink-700' },
              { name: 'Content', icon: '✍️', color: 'bg-indigo-100 text-indigo-700' },
              { name: 'Analysis', icon: '📊', color: 'bg-teal-100 text-teal-700' },
              { name: 'Integration', icon: '🔗', color: 'bg-orange-100 text-orange-700' },
              { name: 'Management', icon: '👥', color: 'bg-red-100 text-red-700' },
              { name: 'Data', icon: '🗃️', color: 'bg-lime-100 text-lime-700' },
            ].map((cat) => (
              <Link key={cat.name} to={`/agents?category=${cat.name.toLowerCase()}`}>
                <div className={`p-4 rounded-lg ${cat.color} hover:opacity-80 transition-opacity cursor-pointer`}>
                  <div className="text-2xl mb-2">{cat.icon}</div>
                  <div className="font-medium">{cat.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
