import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Building2, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AiCardProps {
  title: string;
  meta?: string;
  preview: string;
  avatar?: {
    src?: string;
    fallback: string;
  };
  badges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  }>;
  onSkip?: () => void;
  onEdit?: () => void;
  onApprove?: () => void;
  onSwipe?: (direction: "left" | "right" | "up") => void;
  className?: string;
  index?: number;
  isTop?: boolean;
}

export function AiCard({
  title,
  meta,
  preview,
  avatar,
  badges = [],
  onSkip,
  onEdit,
  onApprove,
  onSwipe,
  className,
  index = 0,
  isTop = false
}: AiCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100;
    
    if (Math.abs(info.offset.x) > swipeThreshold) {
      const direction = info.offset.x > 0 ? "right" : "left";
      if (onSwipe) onSwipe(direction);
      if (direction === "left" && onSkip) onSkip();
      if (direction === "right" && onApprove) onApprove();
    } else if (info.offset.y < -swipeThreshold) {
      if (onSwipe) onSwipe("up");
      if (onEdit) onEdit();
    } else {
      // Snap back
      x.set(0);
      y.set(0);
    }
  };

  const getIntentIcon = () => {
    if (meta?.includes("High intent")) return <TrendingUp className="h-4 w-4 text-positive" />;
    if (meta?.includes("Medium intent")) return <Clock className="h-4 w-4 text-warning" />;
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <motion.div
      className={cn(
        "absolute w-full max-w-[560px] bg-card rounded-2xl shadow-lg border border-border p-5",
        className
      )}
      style={{
        x,
        y,
        rotate,
        opacity,
        zIndex: isTop ? 10 : 9 - index,
        cursor: isTop ? "grab" : "default"
      }}
      drag={isTop}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ 
        scale: 1 - index * 0.05, 
        opacity: 1,
        y: index * 10 
      }}
      whileDrag={{ cursor: "grabbing" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      data-testid={`ai-card-${index}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {avatar && (
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatar.src} />
              <AvatarFallback>{avatar.fallback}</AvatarFallback>
            </Avatar>
          )}
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            {meta && (
              <div className="flex items-center gap-2 mt-1">
                {getIntentIcon()}
                <p className="text-sm text-muted-foreground">{meta}</p>
              </div>
            )}
          </div>
        </div>
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Body */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>
        {badges.length > 0 && (
          <div className="flex gap-2 mt-3">
            {badges.map((badge, i) => (
              <Badge key={i} variant={badge.variant || "secondary"} className="text-xs">
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {isTop && (
        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground"
            data-testid="card-skip"
          >
            Skip
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
              data-testid="card-edit"
            >
              Edit
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onApprove}
              data-testid="card-approve"
            >
              Approve & Send
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}