import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';

interface Approval {
  id: string;
  title: string;
  description: string;
  type: string;
  content: any;
  context: any;
  status: string;
  createdAt: string;
  workflowId?: string;
  nodeId?: string;
}

export default function Approvals() {
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['pendingApprovals'],
    queryFn: () => api.getPendingApprovals(),
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      api.respondToApproval(id, { action, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      setSelectedApproval(null);
      setComment('');
    }
  });

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'content': '📝',
      'action': '⚡',
      'send': '📤',
      'workflow': '🔄',
      'default': '📋'
    };
    return icons[type] || icons.default;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'content': 'bg-blue-100 text-blue-800',
      'action': 'bg-purple-100 text-purple-800',
      'send': 'bg-green-100 text-green-800',
      'workflow': 'bg-amber-100 text-amber-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors.default;
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Approval Center</h1>
        <p className="text-gray-500 mt-1">
          Review and approve pending workflow actions
        </p>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              All caught up!
            </h3>
            <p className="text-gray-500">
              No pending approvals. Your workflows are running smoothly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Approval List */}
          <div className="lg:col-span-2 space-y-4">
            {approvals.map((approval) => (
              <Card
                key={approval.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedApproval?.id === approval.id
                    ? 'ring-2 ring-primary'
                    : ''
                }`}
                onClick={() => setSelectedApproval(approval)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTypeIcon(approval.type)}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {approval.title}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {approval.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getTypeColor(approval.type)}`}>
                            {approval.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(approval.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          respondMutation.mutate({ id: approval.id, action: 'reject' });
                        }}
                        disabled={respondMutation.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          respondMutation.mutate({ id: approval.id, action: 'approve' });
                        }}
                        disabled={respondMutation.isPending}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedApproval ? (
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-lg">Approval Details</CardTitle>
                  <CardDescription>{selectedApproval.title}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Content Preview */}
                  {selectedApproval.content && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h5>
                      <div className="p-3 bg-gray-50 rounded-lg text-sm">
                        <pre className="whitespace-pre-wrap">
                          {typeof selectedApproval.content === 'string'
                            ? selectedApproval.content
                            : JSON.stringify(selectedApproval.content, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Context Info */}
                  {selectedApproval.context && Object.keys(selectedApproval.context).length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Context</h5>
                      <div className="p-3 bg-blue-50 rounded-lg text-sm">
                        {Object.entries(selectedApproval.context).map(([key, value]) => (
                          <div key={key} className="flex justify-between py-1">
                            <span className="text-gray-600">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comment */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Add Comment (optional)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-lg text-sm"
                      rows={3}
                      placeholder="Add notes or modifications..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => respondMutation.mutate({
                        id: selectedApproval.id,
                        action: 'reject',
                        comment
                      })}
                      disabled={respondMutation.isPending}
                    >
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => respondMutation.mutate({
                        id: selectedApproval.id,
                        action: 'approve',
                        comment
                      })}
                      disabled={respondMutation.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <p>Select an approval to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
