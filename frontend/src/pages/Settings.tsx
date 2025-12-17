import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // Velocity Control Settings
  const [velocitySettings, setVelocitySettings] = useState({
    dailyEmailLimit: 100,
    dailyLinkedInLimit: 50,
    simultaneousWorkflows: 5,
    autoThrottle: true,
    respectBusinessHours: true,
    timezone: 'America/New_York'
  });

  // Autonomous Mode Settings
  const [autonomousSettings, setAutonomousSettings] = useState({
    enabled: false,
    prospectingEnabled: true,
    autoResearch: true,
    autoOutreach: false,
    requireApprovalForSend: true,
    maxProspectsPerDay: 50,
    icpStrictness: 80 // 0-100
  });

  // A/B Testing Settings
  const [abTestSettings, setAbTestSettings] = useState({
    enabled: true,
    autoOptimize: true,
    minSampleSize: 100,
    confidenceThreshold: 95,
    testSubjectLines: true,
    testSendTimes: true,
    testContent: true
  });

  const saveSettings = async (section: string, settings: any) => {
    // In production, this would call an API
    console.log(`Saving ${section}:`, settings);
    // await api.updateSettings(section, settings);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure your sales engine preferences
        </p>
      </div>

      {/* Velocity Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🎚️</span> Velocity Control
          </CardTitle>
          <CardDescription>
            Control the speed and volume of your outreach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Daily Email Limit</label>
              <Input
                type="number"
                value={velocitySettings.dailyEmailLimit}
                onChange={(e) => setVelocitySettings(s => ({
                  ...s,
                  dailyEmailLimit: parseInt(e.target.value) || 0
                }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Max emails sent per day</p>
            </div>
            <div>
              <label className="text-sm font-medium">Daily LinkedIn Limit</label>
              <Input
                type="number"
                value={velocitySettings.dailyLinkedInLimit}
                onChange={(e) => setVelocitySettings(s => ({
                  ...s,
                  dailyLinkedInLimit: parseInt(e.target.value) || 0
                }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Max LinkedIn actions per day</p>
            </div>
            <div>
              <label className="text-sm font-medium">Simultaneous Workflows</label>
              <Input
                type="number"
                value={velocitySettings.simultaneousWorkflows}
                onChange={(e) => setVelocitySettings(s => ({
                  ...s,
                  simultaneousWorkflows: parseInt(e.target.value) || 1
                }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Max workflows running at once</p>
            </div>
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <select
                value={velocitySettings.timezone}
                onChange={(e) => setVelocitySettings(s => ({ ...s, timezone: e.target.value }))}
                className="mt-1 w-full p-2 border rounded-lg"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Asia/Singapore">Singapore</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={velocitySettings.autoThrottle}
                onChange={(e) => setVelocitySettings(s => ({ ...s, autoThrottle: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Auto-throttle on high bounce rates</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={velocitySettings.respectBusinessHours}
                onChange={(e) => setVelocitySettings(s => ({ ...s, respectBusinessHours: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Respect business hours</span>
            </label>
          </div>

          <Button onClick={() => saveSettings('velocity', velocitySettings)}>
            Save Velocity Settings
          </Button>
        </CardContent>
      </Card>

      {/* Autonomous Mode */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🤖</span> Autonomous Mode
          </CardTitle>
          <CardDescription>
            Let AI autonomously prospect and engage on your behalf
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg">
            <div>
              <h4 className="font-semibold">Self-Driving Mode</h4>
              <p className="text-sm text-gray-600">AI will autonomously find and engage prospects</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autonomousSettings.enabled}
                onChange={(e) => setAutonomousSettings(s => ({ ...s, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {autonomousSettings.enabled && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousSettings.prospectingEnabled}
                    onChange={(e) => setAutonomousSettings(s => ({ ...s, prospectingEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-discover new prospects</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousSettings.autoResearch}
                    onChange={(e) => setAutonomousSettings(s => ({ ...s, autoResearch: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-research companies</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousSettings.autoOutreach}
                    onChange={(e) => setAutonomousSettings(s => ({ ...s, autoOutreach: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-send outreach</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autonomousSettings.requireApprovalForSend}
                    onChange={(e) => setAutonomousSettings(s => ({ ...s, requireApprovalForSend: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Require approval before sending</span>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Max Prospects Per Day</label>
                <Input
                  type="number"
                  value={autonomousSettings.maxProspectsPerDay}
                  onChange={(e) => setAutonomousSettings(s => ({
                    ...s,
                    maxProspectsPerDay: parseInt(e.target.value) || 0
                  }))}
                  className="mt-1 w-48"
                />
              </div>

              <div>
                <label className="text-sm font-medium">ICP Strictness: {autonomousSettings.icpStrictness}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={autonomousSettings.icpStrictness}
                  onChange={(e) => setAutonomousSettings(s => ({
                    ...s,
                    icpStrictness: parseInt(e.target.value)
                  }))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Broader reach</span>
                  <span>Strict ICP match</span>
                </div>
              </div>
            </div>
          )}

          <Button onClick={() => saveSettings('autonomous', autonomousSettings)}>
            Save Autonomous Settings
          </Button>
        </CardContent>
      </Card>

      {/* A/B Testing & Optimization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span> A/B Testing & Self-Improvement
          </CardTitle>
          <CardDescription>
            Let AI continuously optimize your outreach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <h4 className="font-semibold">Auto-Optimization</h4>
              <p className="text-sm text-gray-600">AI will automatically test and improve your campaigns</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={abTestSettings.autoOptimize}
                onChange={(e) => setAbTestSettings(s => ({ ...s, autoOptimize: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={abTestSettings.testSubjectLines}
                onChange={(e) => setAbTestSettings(s => ({ ...s, testSubjectLines: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Test subject lines</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={abTestSettings.testSendTimes}
                onChange={(e) => setAbTestSettings(s => ({ ...s, testSendTimes: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Test send times</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={abTestSettings.testContent}
                onChange={(e) => setAbTestSettings(s => ({ ...s, testContent: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Test email content</span>
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Min Sample Size</label>
              <Input
                type="number"
                value={abTestSettings.minSampleSize}
                onChange={(e) => setAbTestSettings(s => ({
                  ...s,
                  minSampleSize: parseInt(e.target.value) || 50
                }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum sends before declaring winner</p>
            </div>
            <div>
              <label className="text-sm font-medium">Confidence Threshold</label>
              <select
                value={abTestSettings.confidenceThreshold}
                onChange={(e) => setAbTestSettings(s => ({ ...s, confidenceThreshold: parseInt(e.target.value) }))}
                className="mt-1 w-full p-2 border rounded-lg"
              >
                <option value={90}>90%</option>
                <option value={95}>95%</option>
                <option value={99}>99%</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Statistical confidence for auto-optimization</p>
            </div>
          </div>

          <Button onClick={() => saveSettings('abtest', abTestSettings)}>
            Save A/B Testing Settings
          </Button>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>👤</span> Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={user?.email || ''} disabled className="mt-1 bg-gray-50" />
            </div>
            <div>
              <label className="text-sm font-medium">Company</label>
              <Input value={user?.companyName || ''} disabled className="mt-1 bg-gray-50" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
