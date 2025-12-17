import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

export type NotificationType = "upgrade" | "error" | "workflow" | "approval" | "insight";

export type NotificationPriority = "urgent" | "high" | "normal" | "low";

export interface NotificationAction {
  label: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick?: () => void;
}

export interface AgentNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  title: string;
  description: string;
  actions: NotificationAction[];
  timestamp: Date;
  read: boolean;
  dismissed: boolean;
}

interface NotificationsContextType {
  notifications: AgentNotification[];
  unreadCount: number;
  urgentCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addNotification: (notification: Omit<AgentNotification, "id" | "timestamp" | "read" | "dismissed">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  handleAction: (notificationId: string, actionIndex: number) => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  upgrade: "🚀",
  error: "⚠️",
  workflow: "🔄",
  approval: "✅",
  insight: "💡",
};

const mockNotifications: Omit<AgentNotification, "id" | "timestamp" | "read" | "dismissed">[] = [
  {
    type: "approval",
    priority: "urgent",
    agentId: "email-agent",
    agentName: "Email Outreach Agent",
    title: "Ready to send 50 emails to Series B CFOs. Approve?",
    description: "Campaign 'Q4 CFO Outreach' is queued and ready. Recipients have been verified.",
    actions: [
      { label: "Send All", variant: "default" },
      { label: "Review First", variant: "outline" },
      { label: "Cancel", variant: "ghost" },
    ],
  },
  {
    type: "error",
    priority: "urgent",
    agentId: "linkedin-agent",
    agentName: "LinkedIn Prospector",
    title: "LinkedIn API rate limit reached. Pausing for 10m.",
    description: "429 error received. Auto-resuming at 2:45 PM.",
    actions: [
      { label: "Retry Now", variant: "default" },
      { label: "Wait", variant: "outline" },
    ],
  },
  {
    type: "upgrade",
    priority: "high",
    agentId: "capacity-agent",
    agentName: "Capacity Optimizer",
    title: "I can increase capacity by 20%. Authorize?",
    description: "Detected underutilized resources. Upgrading will process 150 more leads/day.",
    actions: [
      { label: "Authorize", variant: "default" },
      { label: "Decline", variant: "outline" },
    ],
  },
  {
    type: "workflow",
    priority: "normal",
    agentId: "engagement-agent",
    agentName: "Engagement Analyst",
    title: "Open rates are low. Suggest adding a video step.",
    description: "Current open rate: 12%. Similar campaigns with video see 28% average.",
    actions: [
      { label: "Apply", variant: "default" },
      { label: "Ignore", variant: "ghost" },
    ],
  },
  {
    type: "insight",
    priority: "normal",
    agentId: "timing-agent",
    agentName: "Send Time Optimizer",
    title: "Best send time detected: Tuesdays at 10am",
    description: "Analysis of 2,400 emails shows 3.2x higher response rate at this time.",
    actions: [
      { label: "Apply to All", variant: "default" },
      { label: "Dismiss", variant: "ghost" },
    ],
  },
  {
    type: "insight",
    priority: "low",
    agentId: "research-agent",
    agentName: "Lead Research Agent",
    title: "Found 12 new decision-makers at target accounts",
    description: "Added to your lead database. 8 match your ideal customer profile.",
    actions: [
      { label: "View Leads", variant: "default" },
      { label: "Dismiss", variant: "ghost" },
    ],
  },
];

let notificationIdCounter = 0;
function generateId() {
  notificationIdCounter += 1;
  return `notification-${notificationIdCounter}`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const initialNotifications: AgentNotification[] = mockNotifications.map((n, index) => ({
      ...n,
      id: generateId(),
      timestamp: new Date(Date.now() - index * 1000 * 60 * 5),
      read: false,
      dismissed: false,
    }));
    setNotifications(initialNotifications);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;
  const urgentCount = notifications.filter((n) => n.priority === "urgent" && !n.dismissed).length;

  const addNotification = useCallback(
    (notification: Omit<AgentNotification, "id" | "timestamp" | "read" | "dismissed">) => {
      const newNotification: AgentNotification = {
        ...notification,
        id: generateId(),
        timestamp: new Date(),
        read: false,
        dismissed: false,
      };
      setNotifications((prev) => [newNotification, ...prev]);

      if (notification.priority === "urgent") {
        toast({
          title: `${NOTIFICATION_ICONS[notification.type]} ${notification.title}`,
          description: notification.description,
        });
      }
    },
    [toast]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })));
  }, []);

  const handleAction = useCallback((notificationId: string, actionIndex: number) => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification) {
      const action = notification.actions[actionIndex];
      if (action.onClick) {
        action.onClick();
      }
      markAsRead(notificationId);
      if (actionIndex > 0 || action.label.toLowerCase().includes("dismiss") || action.label.toLowerCase().includes("cancel")) {
        dismissNotification(notificationId);
      }
    }
  }, [notifications, markAsRead, dismissNotification]);

  const sortedNotifications = [...notifications]
    .filter((n) => !n.dismissed)
    .sort((a, b) => {
      const priorityOrder: Record<NotificationPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  return (
    <NotificationsContext.Provider
      value={{
        notifications: sortedNotifications,
        unreadCount,
        urgentCount,
        isOpen,
        setIsOpen,
        addNotification,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        clearAll,
        handleAction,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}

export { NOTIFICATION_ICONS };
