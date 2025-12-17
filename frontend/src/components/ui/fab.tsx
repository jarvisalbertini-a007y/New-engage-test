import { motion } from "framer-motion";
import { Plus, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabProps {
  onClick?: () => void;
  onLongPress?: () => void;
  className?: string;
  icon?: "plus" | "mic" | "sparkles";
  size?: number;
}

export function Fab({
  onClick,
  onLongPress,
  className,
  icon = "sparkles",
  size = 64
}: FabProps) {
  const Icon = icon === "plus" ? Plus : icon === "mic" ? Mic : Sparkles;
  
  const handlePointerDown = () => {
    const timer = setTimeout(() => {
      if (onLongPress) onLongPress();
    }, 500);
    
    const handlePointerUp = () => {
      clearTimeout(timer);
      document.removeEventListener("pointerup", handlePointerUp);
    };
    
    document.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <motion.button
      className={cn(
        "fixed bottom-8 right-8 z-50 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg",
        className
      )}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      data-testid="fab-button"
    >
      <Icon className="h-7 w-7" />
    </motion.button>
  );
}