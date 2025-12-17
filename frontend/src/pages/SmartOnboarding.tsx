import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function SmartOnboarding() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchData, setResearchData] = useState<any>(null);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const startMutation = useMutation({
    mutationFn: () => api.startSmartOnboarding({ email }),
    onSuccess: (data) => {
      setResearchData(data);
      setStep(2);
      setIsResearching(false);
    },
    onError: () => {
      setIsResearching(false);
    }
  });

  const approveMutation = useMutation({
    mutationFn: (data: any) => api.approveSmartOnboarding(data),
    onSuccess: async () => {
      await refreshUser();
      navigate('/dashboard');
    }
  });

  const handleStart = () => {
    setIsResearching(true);
    startMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to SalesFlow AI</CardTitle>
          <CardDescription>
            Just enter your email - AI will research everything else
          </CardDescription>
          
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-violet-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Step 1: Email Only */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold mb-2">Just Your Email</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Our AI will research your company, identify your ICP, analyze competitors, 
                  and build a personalized sales strategy - all from your email domain.
                </p>
              </div>
              
              <div className="max-w-md mx-auto">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name@company.com"
                  className="text-lg py-6 text-center"
                  disabled={user?.email ? true : false}
                />
                <p className="text-xs text-gray-400 mt-2 text-center">
                  We'll extract your name, company, and role from your email
                </p>
              </div>
              
              <Button
                onClick={handleStart}
                disabled={!email || isResearching}
                className="w-full py-6 text-lg bg-violet-600 hover:bg-violet-700"
              >
                {isResearching ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    AI is researching your company...
                  </span>
                ) : (
                  'Start AI Research'
                )}
              </Button>
              
              {isResearching && (
                <div className="mt-4 p-4 bg-violet-50 rounded-lg">
                  <p className="text-sm text-violet-700 animate-pulse">
                    🔍 Researching company profile...<br/>
                    👤 Identifying your role and focus areas...<br/>
                    🎯 Building your ideal customer profile...<br/>
                    📊 Analyzing competitors...<br/>
                    💡 Creating personalized strategy...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review Research */}
          {step === 2 && researchData && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Company Info */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-3">🏢 Company Profile</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {researchData.company?.name}</p>
                    <p><strong>Industry:</strong> {researchData.company?.industry}</p>
                    <p><strong>Size:</strong> {researchData.company?.size}</p>
                    <p><strong>Description:</strong> {researchData.company?.description}</p>
                    {researchData.company?.competitors && (
                      <p><strong>Competitors:</strong> {researchData.company.competitors.join(', ')}</p>
                    )}
                  </div>
                </div>
                
                {/* User Info */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-3">👤 Your Profile</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {researchData.user?.firstName} {researchData.user?.lastName}</p>
                    <p><strong>Likely Title:</strong> {researchData.user?.likelyTitle}</p>
                    <p><strong>Department:</strong> {researchData.user?.department}</p>
                    <p><strong>Seniority:</strong> {researchData.user?.seniority}</p>
                  </div>
                </div>
                
                {/* ICP */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-3">🎯 Suggested ICP</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Industries:</strong></p>
                    <div className="flex flex-wrap gap-1">
                      {researchData.icp?.industries?.map((i: string) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs">{i}</span>
                      ))}
                    </div>
                    <p><strong>Titles:</strong></p>
                    <div className="flex flex-wrap gap-1">
                      {researchData.icp?.titles?.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs">{t}</span>
                      ))}
                    </div>
                    <p><strong>Pain Points:</strong></p>
                    <ul className="list-disc list-inside text-xs">
                      {researchData.icp?.painPoints?.slice(0, 3).map((p: string) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Strategy */}
                <div className="p-4 bg-amber-50 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-3">📋 Suggested Strategy</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Approach:</strong> {researchData.strategy?.approach}</p>
                    <p><strong>Channel:</strong> {researchData.strategy?.primaryChannel}</p>
                    <p><strong>Personalization:</strong> {researchData.strategy?.personalization}</p>
                    <p><strong>Messaging Pillars:</strong></p>
                    <div className="flex flex-wrap gap-1">
                      {researchData.strategy?.messagingPillars?.map((m: string) => (
                        <span key={m} className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  🔄 Refresh Research
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                >
                  Looks Good - Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm & Complete */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="text-6xl">🎉</div>
              <h3 className="text-xl font-semibold">You're All Set!</h3>
              <p className="text-gray-500">
                Your sales engine is configured based on AI research. 
                Start engaging with prospects right away.
              </p>
              
              <div className="p-4 bg-gray-50 rounded-lg text-left">
                <h4 className="font-medium mb-2">What's Next:</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>✅ AI agents are configured with your ICP</li>
                  <li>✅ Messaging templates personalized for your business</li>
                  <li>✅ Workflow templates ready to deploy</li>
                  <li>✅ Command center trained on your strategy</li>
                </ul>
              </div>
              
              <Button
                onClick={() => approveMutation.mutate({
                  icp: researchData?.icp,
                  strategy: researchData?.strategy
                })}
                disabled={approveMutation.isPending}
                className="w-full py-6 text-lg bg-violet-600 hover:bg-violet-700"
              >
                {approveMutation.isPending ? 'Setting up...' : 'Launch My Sales Engine'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
