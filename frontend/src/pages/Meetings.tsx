import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink?: string;
  location?: string;
}

interface ScheduledMeeting {
  id: string;
  summary: string;
  attendee: string;
  startTime: string;
  endTime: string;
  meetLink?: string;
  status: string;
  createdAt: string;
}

export default function Meetings() {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [daysAhead, setDaysAhead] = useState(7);
  const [meetingForm, setMeetingForm] = useState({
    summary: '',
    attendeeEmail: '',
    startTime: '',
    durationMinutes: 30,
    description: ''
  });
  const queryClient = useQueryClient();

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => api.getGoogleStatus()
  });

  const { data: calendarEvents = { events: [] }, isLoading: eventsLoading } = useQuery({
    queryKey: ['calendarEvents', daysAhead],
    queryFn: () => api.getCalendarEvents(daysAhead),
    enabled: googleStatus?.connected
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: () => api.scheduleMeeting({
      summary: meetingForm.summary,
      attendeeEmail: meetingForm.attendeeEmail,
      startTime: new Date(meetingForm.startTime).toISOString(),
      durationMinutes: meetingForm.durationMinutes,
      description: meetingForm.description
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      setShowScheduleModal(false);
      setMeetingForm({
        summary: '',
        attendeeEmail: '',
        startTime: '',
        durationMinutes: 30,
        description: ''
      });
      if (data.meetLink) {
        alert(`Meeting scheduled! Google Meet link: ${data.meetLink}`);
      }
    }
  });

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (dateStr: string) => {
    const date = new Date(dateStr);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const getDateLabel = (dateStr: string) => {
    if (isToday(dateStr)) return 'Today';
    if (isTomorrow(dateStr)) return 'Tomorrow';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Group events by date
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  calendarEvents.events?.forEach((event: CalendarEvent) => {
    const dateKey = new Date(event.start).toDateString();
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }
    groupedEvents[dateKey].push(event);
  });

  if (!googleStatus?.connected) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meetings & Calendar</h1>
          <p className="text-gray-500 mt-1">Schedule and track all your sales meetings</p>
        </div>

        <Card className="max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h2 className="text-xl font-semibold mb-2">Connect Google Calendar</h2>
            <p className="text-gray-500 mb-6">
              Connect your Google account to view your calendar, schedule meetings with prospects,
              and automatically create Google Meet links.
            </p>
            <Button onClick={() => window.location.href = '/integrations'}>
              Go to Integrations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="meetings-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings & Calendar</h1>
          <p className="text-gray-500 mt-1">
            Connected as {googleStatus?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>
          <Button onClick={() => setShowScheduleModal(true)} data-testid="schedule-meeting-btn">
            + Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📅</span> Schedule New Meeting
              </CardTitle>
              <CardDescription>
                Create a meeting with automatic Google Meet link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Meeting Title</label>
                <Input
                  value={meetingForm.summary}
                  onChange={(e) => setMeetingForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder="Sales Demo - Acme Corp"
                  className="mt-1"
                  data-testid="meeting-title-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Attendee Email</label>
                <Input
                  type="email"
                  value={meetingForm.attendeeEmail}
                  onChange={(e) => setMeetingForm(f => ({ ...f, attendeeEmail: e.target.value }))}
                  placeholder="prospect@company.com"
                  className="mt-1"
                  data-testid="attendee-email-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={meetingForm.startTime}
                  onChange={(e) => setMeetingForm(f => ({ ...f, startTime: e.target.value }))}
                  className="mt-1"
                  data-testid="meeting-datetime-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Duration</label>
                <select
                  value={meetingForm.durationMinutes}
                  onChange={(e) => setMeetingForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) }))}
                  className="mt-1 w-full p-2 border rounded-lg"
                  data-testid="meeting-duration-select"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(e) => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Meeting agenda..."
                  className="mt-1 w-full p-2 border rounded-lg min-h-[80px]"
                  data-testid="meeting-description-input"
                />
              </div>
              <p className="text-sm text-gray-500">
                A Google Meet link will be automatically created and sent to the attendee.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => scheduleMeetingMutation.mutate()}
                  disabled={!meetingForm.summary || !meetingForm.attendeeEmail || !meetingForm.startTime || scheduleMeetingMutation.isPending}
                  data-testid="confirm-schedule-btn"
                >
                  {scheduleMeetingMutation.isPending ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{calendarEvents.events?.length || 0}</p>
                <p className="text-sm text-gray-500">Upcoming meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {calendarEvents.events?.filter((e: CalendarEvent) => isToday(e.start)).length || 0}
                </p>
                <p className="text-sm text-gray-500">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">🔗</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {calendarEvents.events?.filter((e: CalendarEvent) => e.meetLink).length || 0}
                </p>
                <p className="text-sm text-gray-500">With Meet link</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {calendarEvents.events?.reduce((acc: number, e: CalendarEvent) => acc + (e.attendees?.length || 0), 0) || 0}
                </p>
                <p className="text-sm text-gray-500">Total attendees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Events */}
      {eventsLoading ? (
        <div className="text-center py-8 text-gray-500">Loading calendar...</div>
      ) : Object.keys(groupedEvents).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([dateKey, events]) => (
            <div key={dateKey}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                {isToday(events[0].start) && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Today</span>}
                {isTomorrow(events[0].start) && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Tomorrow</span>}
                {getDateLabel(events[0].start)}
              </h2>
              <div className="space-y-3">
                {events.map((event) => (
                  <Card key={event.id} className={`${isToday(event.start) ? 'border-green-200 bg-green-50/30' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="text-center min-w-[60px]">
                            <p className="text-lg font-bold text-gray-900">{formatTime(event.start)}</p>
                            <p className="text-xs text-gray-500">to {formatTime(event.end)}</p>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{event.summary || 'No title'}</h3>
                            {event.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                                <span>👥</span>
                                <span>{event.attendees.slice(0, 3).join(', ')}</span>
                                {event.attendees.length > 3 && <span>+{event.attendees.length - 3} more</span>}
                              </div>
                            )}
                            {event.location && (
                              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                <span>📍</span> {event.location}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {event.meetLink && (
                            <Button
                              size="sm"
                              onClick={() => window.open(event.meetLink, '_blank')}
                              data-testid={`join-meeting-${event.id}`}
                            >
                              Join Meet
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold mb-2">No upcoming meetings</h3>
            <p className="text-gray-500 mb-6">
              Your calendar is clear for the next {daysAhead} days.
              Schedule a meeting with a prospect to get started.
            </p>
            <Button onClick={() => setShowScheduleModal(true)}>
              Schedule Your First Meeting
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
