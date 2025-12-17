import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function Command() {
  const [command, setCommand] = useState('');
  const [response, setResponse] = useState<any>(null);

  const { data: suggestions } = useQuery({
    queryKey: ['commandSuggestions'],
    queryFn: api.getCommandSuggestions,
  });

  const { data: history } = useQuery({
    queryKey: ['commandHistory'],
    queryFn: () => api.getCommandHistory(10),
  });

  const executeMutation = useMutation({
    mutationFn: (cmd: string) => api.executeCommand(cmd),
    onSuccess: (data) => {
      setResponse(data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      executeMutation.mutate(command);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    setCommand(suggestion.command);
    executeMutation.mutate(suggestion.command);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-500 mt-1">
          Control your sales engine with natural language commands.
        </p>
      </div>

      {/* Command Input */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Tell me what you want to do... e.g., 'Find 50 prospects in tech industry'"
              className="flex-1"
            />
            <Button type="submit" disabled={!command.trim() || executeMutation.isPending}>
              {executeMutation.isPending ? 'Executing...' : 'Execute'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800">{response.message}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Action: {response.action}</h4>
                {response.suggestedAgents && response.suggestedAgents.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Suggested Agents:</p>
                    <div className="flex flex-wrap gap-2">
                      {response.suggestedAgents.map((agent: string) => (
                        <span key={agent} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>Suggested Commands</CardTitle>
            <CardDescription>Quick actions to get started</CardDescription>
          </CardHeader>
          <CardContent>
            {suggestions && suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.map((suggestion: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left p-4 border rounded-lg hover:border-primary hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{suggestion.command}</div>
                    <div className="text-sm text-gray-500 mt-1">{suggestion.description}</div>
                    <span className="text-xs text-gray-400 mt-2 inline-block capitalize">
                      {suggestion.category}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">Loading suggestions...</div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Commands</CardTitle>
            <CardDescription>Your command history</CardDescription>
          </CardHeader>
          <CardContent>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((item: any) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 text-sm">{item.command}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No commands yet. Try one of the suggestions!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
