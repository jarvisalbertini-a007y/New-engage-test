import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ToastVariant = "info" | "success" | "warning" | "error";

interface AiToastProps {
  variant?: ToastVariant;
  title?: string;
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "secondary" | "outline";
  }>;
  onClose?: () => void;
  className?: string;
  isVisible?: boolean;
}

const variantStyles = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: Info,
    iconColor: "text-blue-600 dark:text-blue-400"
  },
  success: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    icon: CheckCircle2,
    iconColor: "text-green-600 dark:text-green-400"
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400"
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400"
  }
};

export function AiToast({
  variant = "info",
  title,
  message,
  actions = [],
  onClose,
  className,
  isVisible = true
}: AiToastProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "fixed top-4 left-1/2 z-50 w-full max-w-lg -translate-x-1/2",
            className
          )}
        >
          <div
            className={cn(
              "relative rounded-lg border p-4 shadow-lg",
              styles.bg,
              styles.border
            )}
            data-testid={`toast-${variant}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", styles.iconColor)} />
              <div className="flex-1">
                {title && (
                  <h4 className="font-semibold text-sm mb-1">{title}</h4>
                )}
                <p className="text-sm text-muted-foreground">{message}</p>
                {actions.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    {actions.map((action, index) => (
                      <Button
                        key={index}
                        variant={action.variant || "default"}
                        size="sm"
                        onClick={action.onClick}
                        className="h-7 px-3 text-xs"
                        data-testid={`toast-action-${index}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-6 w-6 rounded-full hover:bg-muted"
                  data-testid="toast-close"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}