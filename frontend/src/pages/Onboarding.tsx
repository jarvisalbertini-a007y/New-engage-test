import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState('');
  const [research, setResearch] = useState<any>(null);
  const [icp, setIcp] = useState<any>(null);
  const [strategy, setStrategy] = useState<any>(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const researchMutation = useMutation({
    mutationFn: () => api.researchCompany({ domain }),
    onSuccess: (data) => {
      setResearch(data);
      setIcp(data.suggestedIcp);
      setStrategy(data.suggestedStrategy);
      setStep(2);
    },
  });

  const icpMutation = useMutation({
    mutationFn: () => api.approveIcp(icp),
    onSuccess: () => setStep(3),
  });

  const strategyMutation = useMutation({
    mutationFn: () => api.approveStrategy(strategy),
    onSuccess: () => setStep(4),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.completeOnboarding(),
    onSuccess: async () => {
      await refreshUser();
      navigate('/dashboard');
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to EngageAI</CardTitle>
          <CardDescription>
            Let's set up your sales engine in just a few steps.
          </CardDescription>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Tell us about your company</h3>
                <p className="text-gray-500 mb-4">
                  Enter your company's domain and our AI will research your business to suggest the perfect sales strategy.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Domain
                </label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <Button
                onClick={() => researchMutation.mutate()}
                disabled={!domain || researchMutation.isPending}
                className="w-full"
              >
                {researchMutation.isPending ? 'Researching...' : 'Research My Company'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="w-full"
              >
                Skip for now
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Review Your ICP</h3>
                <p className="text-gray-500 mb-4">
                  Based on our research, here's the suggested Ideal Customer Profile.
                </p>
              </div>
              {icp && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industries</label>
                    <div className="flex flex-wrap gap-2">
                      {icp.industries?.map((ind: string) => (
                        <span key={ind} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Titles</label>
                    <div className="flex flex-wrap gap-2">
                      {icp.titles?.map((title: string) => (
                        <span key={title} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Sizes</label>
                    <div className="flex flex-wrap gap-2">
                      {icp.companySizes?.map((size: string) => (
                        <span key={size} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {size}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <Button
                onClick={() => icpMutation.mutate()}
                disabled={icpMutation.isPending}
                className="w-full"
              >
                {icpMutation.isPending ? 'Saving...' : 'Approve ICP'}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Review Your Strategy</h3>
                <p className="text-gray-500 mb-4">
                  Here's the suggested sales strategy for your business.
                </p>
              </div>
              {strategy && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Approach</div>
                      <div className="font-medium capitalize">{strategy.approach}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Primary Channel</div>
                      <div className="font-medium capitalize">{strategy.primaryChannel}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Cadence</div>
                      <div className="font-medium capitalize">{strategy.cadence}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">Automation Level</div>
                      <div className="font-medium capitalize">{strategy.automationLevel}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Messaging Pillars</label>
                    <div className="flex flex-wrap gap-2">
                      {strategy.messagingPillars?.map((pillar: string) => (
                        <span key={pillar} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <Button
                onClick={() => strategyMutation.mutate()}
                disabled={strategyMutation.isPending}
                className="w-full"
              >
                {strategyMutation.isPending ? 'Saving...' : 'Approve Strategy'}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="text-6xl">🎉</div>
              <div>
                <h3 className="text-lg font-semibold mb-2">You're All Set!</h3>
                <p className="text-gray-500">
                  Your sales engine is configured and ready to go. Start exploring your dashboard and deploy your first agents.
                </p>
              </div>
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="w-full"
              >
                {completeMutation.isPending ? 'Finishing...' : 'Go to Dashboard'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
