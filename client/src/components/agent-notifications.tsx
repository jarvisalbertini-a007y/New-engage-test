import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, Bot, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  NOTIFICATION_ICONS,
  type AgentNotification,
  type NotificationType,
  type NotificationPriority,
} from "@/contexts/notifications-context";

const priorityStyles: Record<NotificationPriority, string> = {
  urgent: "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
  high: "border-l-4 border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10",
  normal: "border-l-4 border-l-blue-500 bg-background",
  low: "border-l-4 border-l-slate-300 bg-background",
};

const typeColors: Record<NotificationType, string> = {
  upgrade: "text-purple-600 dark:text-purple-400",
  error: "text-red-600 dark:text-red-400",
  workflow: "text-blue-600 dark:text-blue-400",
  approval: "text-green-600 dark:text-green-400",
  insight: "text-amber-600 dark:text-amber-400",
};

interface NotificationCardProps {
  notification: AgentNotification;
  onAction: (actionIndex: number) => void;
  onDismiss: () => void;
  onMarkRead: () => void;
}

function NotificationCard({ notification, onAction, onDismiss, onMarkRead }: NotificationCardProps) {
  const icon = NOTIFICATION_ICONS[notification.type];
  const isUrgent = notification.priority === "urgent";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, height: 0 }}
      transition={{ duration: 0.2 }}
      data-testid={`notification-card-${notification.id}`}
      className={cn(
        "relative p-4 rounded-lg mb-3 transition-all",
        priorityStyles[notification.priority],
        !notification.read && "shadow-sm"
      )}
      onClick={onMarkRead}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "w-10 h-10 rounded-full bg-muted flex items-center justify-center",
              typeColors[notification.type]
            )}
            data-testid={`notification-icon-${notification.id}`}
          >
            <Bot className="w-5 h-5" />
          </div>
          {isUrgent && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background"
              data-testid={`notification-urgent-badge-${notification.id}`}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1" data-testid={`notification-agent-${notification.id}`}>
                {notification.agentName}
              </p>
              <h4 className="font-medium text-sm leading-tight" data-testid={`notification-title-${notification.id}`}>
                <span className="mr-1.5">{icon}</span>
                {notification.title}
              </h4>
            </div>
            <div className="flex items-center gap-1">
              {!notification.read && (
                <span className="w-2 h-2 bg-blue-500 rounded-full" data-testid={`notification-unread-${notification.id}`} />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                data-testid={`notification-dismiss-${notification.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2" data-testid={`notification-description-${notification.id}`}>
            {notification.description}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground" data-testid={`notification-time-${notification.id}`}>
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {notification.actions.map((action, index) => (
              <Button
                key={action.label}
                variant={action.variant || "default"}
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(index);
                }}
                data-testid={`notification-action-${notification.id}-${index}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AgentNotificationsTrigger() {
  const { unreadCount, urgentCount, isOpen, setIsOpen } = useNotifications();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => setIsOpen(!isOpen)}
      data-testid="notifications-trigger"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <Badge
          variant={urgentCount > 0 ? "destructive" : "default"}
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs"
          data-testid="notifications-badge"
        >
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}

export function AgentNotificationsPanel() {
  const {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    handleAction,
  } = useNotifications();

  const urgentNotifications = notifications.filter((n) => n.priority === "urgent");
  const otherNotifications = notifications.filter((n) => n.priority !== "urgent");

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md p-0" data-testid="notifications-panel">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2" data-testid="notifications-panel-title">
              <Bell className="w-5 h-5" />
              Agent Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </SheetTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              data-testid="notifications-mark-all-read"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={clearAll}
              disabled={notifications.length === 0}
              data-testid="notifications-clear-all"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-4">
            <AnimatePresence mode="popLayout">
              {notifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                  data-testid="notifications-empty"
                >
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your agents will notify you when they need attention
                  </p>
                </motion.div>
              ) : (
                <>
                  {urgentNotifications.length > 0 && (
                    <div data-testid="notifications-urgent-section">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
                          Urgent
                        </span>
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                          {urgentNotifications.length}
                        </Badge>
                      </div>
                      {urgentNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onAction={(index) => handleAction(notification.id, index)}
                          onDismiss={() => dismissNotification(notification.id)}
                          onMarkRead={() => markAsRead(notification.id)}
                        />
                      ))}
                      {otherNotifications.length > 0 && <Separator className="my-4" />}
                    </div>
                  )}

                  {otherNotifications.length > 0 && (
                    <div data-testid="notifications-other-section">
                      {urgentNotifications.length > 0 && (
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                          Other
                        </span>
                      )}
                      {otherNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onAction={(index) => handleAction(notification.id, index)}
                          onDismiss={() => dismissNotification(notification.id)}
                          onMarkRead={() => markAsRead(notification.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function AgentNotifications() {
  return (
    <>
      <AgentNotificationsTrigger />
      <AgentNotificationsPanel />
    </>
  );
}

export default AgentNotifications;
