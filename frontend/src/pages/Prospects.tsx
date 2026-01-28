import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  company?: string;
  status: string;
  icpScore?: number;
  score?: number;
  source?: string;
  linkedinUrl?: string;
  lastContactedAt?: string;
}

export default function Prospects() {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'sendgrid'>('gmail');
  const [meetingForm, setMeetingForm] = useState({ 
    summary: '', 
    startTime: '', 
    durationMinutes: 30 
  });
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    title: '',
    company: '',
  });
  const queryClient = useQueryClient();

  const { data: prospects = [], isLoading } = useQuery<Prospect[]>({
    queryKey: ['prospects', searchQuery],
    queryFn: () => api.getProspects({ search: searchQuery || undefined }),
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => api.getGoogleStatus()
  });

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations()
  });

  const { data: emailHistory = [] } = useQuery({
    queryKey: ['emailHistory', selectedProspect?.id],
    queryFn: () => api.getEmailAnalytics(),
    enabled: !!selectedProspect
  });

  const createMutation = useMutation({
    mutationFn: () => api.createProspect(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      setShowAdd(false);
      setFormData({ email: '', firstName: '', lastName: '', title: '', company: '' });
    },
  });

  const sendGmailMutation = useMutation({
    mutationFn: () => api.sendGmail({
      to: selectedProspect!.email,
      subject: emailForm.subject,
      body: emailForm.body,
      prospectId: selectedProspect!.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['emailHistory'] });
      setShowEmailModal(false);
      setEmailForm({ subject: '', body: '' });
    }
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: () => api.scheduleMeeting({
      summary: meetingForm.summary || `Meeting with ${selectedProspect!.firstName}`,
      attendeeEmail: selectedProspect!.email,
      startTime: new Date(meetingForm.startTime).toISOString(),
      durationMinutes: meetingForm.durationMinutes,
      prospectId: selectedProspect!.id
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      setShowMeetingModal(false);
      setMeetingForm({ summary: '', startTime: '', durationMinutes: 30 });
      if (data.meetLink) {
        alert(`Meeting scheduled! Google Meet link: ${data.meetLink}`);
      }
    }
  });

  const draftEmailMutation = useMutation({
    mutationFn: () => api.executeAction('draft_email', {
      prospect: selectedProspect,
      type: 'cold_intro'
    }),
    onSuccess: (data) => {
      if (data.result?.data) {
        setEmailForm({
          subject: data.result.data.subject || '',
          body: data.result.data.body || ''
        });
      }
    }
  });

  const syncContactsMutation = useMutation({
    mutationFn: () => api.syncContactsToProspects(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      alert(`Synced ${data.synced} contacts from Google!`);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-gray-100 text-gray-700',
      'contacted': 'bg-blue-100 text-blue-700',
      'replied': 'bg-green-100 text-green-700',
      'meeting_scheduled': 'bg-purple-100 text-purple-700',
      'qualified': 'bg-emerald-100 text-emerald-700',
      'lost': 'bg-red-100 text-red-700'
    };
    return colors[status] || colors.new;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">
            Manage your leads and contacts • {prospects.length} total
          </p>
        </div>
        <div className="flex gap-2">
          {googleStatus?.connected && (
            <Button 
              variant="outline" 
              onClick={() => syncContactsMutation.mutate()}
              disabled={syncContactsMutation.isPending}
            >
              {syncContactsMutation.isPending ? 'Syncing...' : '📥 Sync Google Contacts'}
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            + Add Prospect
          </Button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>✉️</span> Send Email to {selectedProspect.firstName}
              </CardTitle>
              <CardDescription>
                Sending via Gmail to {selectedProspect.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => draftEmailMutation.mutate()}
                  disabled={draftEmailMutation.isPending}
                >
                  {draftEmailMutation.isPending ? '🤖 Drafting...' : '🤖 AI Draft Email'}
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Email subject..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your email..."
                  className="mt-1 w-full p-3 border rounded-lg min-h-[200px]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEmailModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => sendEmailMutation.mutate()}
                  disabled={!emailForm.subject || !emailForm.body || sendEmailMutation.isPending}
                >
                  {sendEmailMutation.isPending ? 'Sending...' : '📤 Send via Gmail'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📅</span> Schedule Meeting
              </CardTitle>
              <CardDescription>
                With {selectedProspect.firstName} ({selectedProspect.email})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Meeting Title</label>
                <Input
                  value={meetingForm.summary}
                  onChange={(e) => setMeetingForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder={`Meeting with ${selectedProspect.firstName}`}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={meetingForm.startTime}
                  onChange={(e) => setMeetingForm(f => ({ ...f, startTime: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Duration</label>
                <select
                  value={meetingForm.durationMinutes}
                  onChange={(e) => setMeetingForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                  className="mt-1 w-full p-2 border rounded-lg"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">
                A Google Meet link will be automatically created and sent to the attendee.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowMeetingModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => scheduleMeetingMutation.mutate()}
                  disabled={!meetingForm.startTime || scheduleMeetingMutation.isPending}
                >
                  {scheduleMeetingMutation.isPending ? 'Scheduling...' : '📅 Schedule Meeting'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Prospect Form */}
      {showAdd && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Prospect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <Input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <Input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input name="title" value={formData.title} onChange={handleChange} placeholder="VP of Sales" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <Input name="company" value={formData.company} onChange={handleChange} placeholder="Acme Inc" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={() => createMutation.mutate()} disabled={!formData.email || !formData.firstName || createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Prospect'}
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Prospects</CardTitle>
              <CardDescription>Your lead database</CardDescription>
            </div>
            <Input
              placeholder="Search prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : prospects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ICP Score</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{prospect.firstName} {prospect.lastName}</div>
                        <div className="text-sm text-gray-500">{prospect.title || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">{prospect.email}</td>
                      <td className="py-3 px-4 text-gray-500 text-sm">{prospect.company || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(prospect.status)}`}>
                          {prospect.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                (prospect.icpScore || prospect.score || 0) >= 80 ? 'bg-green-500' :
                                (prospect.icpScore || prospect.score || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${prospect.icpScore || prospect.score || 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500">{prospect.icpScore || prospect.score || 0}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {googleStatus?.connected ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedProspect(prospect);
                                  setShowEmailModal(true);
                                }}
                              >
                                ✉️
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedProspect(prospect);
                                  setShowMeetingModal(true);
                                }}
                              >
                                📅
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              Connect Google
                            </Button>
                          )}
                          {prospect.linkedinUrl && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(prospect.linkedinUrl, '_blank')}
                            >
                              💼
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-4">🎯</p>
              <p className="text-lg font-medium mb-2">No prospects yet</p>
              <p className="text-sm mb-4">Add prospects manually or use AI Chat to find leads</p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => setShowAdd(true)}>+ Add Prospect</Button>
                <Button variant="outline" onClick={() => window.location.href = '/chat'}>
                  🤖 Find with AI
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
