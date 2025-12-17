import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: { text: string; action: string }[];
  actions?: any[];
  timestamp: Date;
}

export default function UniversalChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to SalesFlow AI! I'm your autonomous sales assistant.\n\nJust tell me what you need in plain English:\n• "Find 50 VPs of Sales at Series B companies"\n• "Create an outreach sequence for CFOs"\n• "Research Acme Corp before my call"\n• "Draft a follow-up email for cold leads"\n\nWhat would you like to accomplish today?`,
      suggestions: [
        { text: 'Find new prospects', action: 'prospect_search' },
        { text: 'Create outreach campaign', action: 'create_workflow' },
        { text: 'Check pipeline status', action: 'status' }
      ],
      timestamp: new Date()
    }]);
  }, []);

  const chatMutation = useMutation({
    mutationFn: (message: string) => 
      api.sendChatMessage({ message, sessionId }),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        suggestions: data.suggestions,
        actions: data.actions,
        timestamp: new Date()
      }]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }]);

    chatMutation.mutate(input);
    setInput('');
  };

  const handleSuggestionClick = (suggestion: { text: string; action: string }) => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: suggestion.text,
      timestamp: new Date()
    }]);
    chatMutation.mutate(suggestion.text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600">
        <h1 className="text-xl font-bold text-white">SalesFlow AI Command Center</h1>
        <p className="text-violet-100 text-sm">NLP-first autonomous sales engagement</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                message.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Action results */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">Actions Executed:</p>
                  {message.actions.map((action, idx) => (
                    <p key={idx} className="text-sm text-green-600">
                      ✓ {action.message || action.action}
                    </p>
                  ))}
                </div>
              )}
              
              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 text-sm bg-violet-100 text-violet-700 rounded-full hover:bg-violet-200 transition-colors"
                    >
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <div className="animate-pulse flex gap-1">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-sm text-gray-500">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you want to do... (e.g., 'Find 20 CTOs at fintech startups')"
            className="flex-1 text-lg py-6"
            disabled={chatMutation.isPending}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || chatMutation.isPending}
            className="px-8 bg-violet-600 hover:bg-violet-700"
          >
            Send
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">Quick actions:</span>
          {[
            'Find prospects',
            'Create sequence',
            'Draft email',
            'Research company'
          ].map((action) => (
            <button
              key={action}
              onClick={() => setInput(action)}
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
