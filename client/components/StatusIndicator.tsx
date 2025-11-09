import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

type Status = "online" | "offline" | "idle" | "busy" | "error" | "warning";

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  showPulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig: Record<Status, { color: string; bgColor: string; label: string }> = {
  online: {
    color: "text-green-500",
    bgColor: "bg-green-500",
    label: "Online",
  },
  offline: {
    color: "text-gray-500",
    bgColor: "bg-gray-500",
    label: "Offline",
  },
  idle: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    label: "Idle",
  },
  busy: {
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    label: "Busy",
  },
  error: {
    color: "text-red-500",
    bgColor: "bg-red-500",
    label: "Error",
  },
  warning: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    label: "Warning",
  },
};

const sizeConfig = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

export function StatusIndicator({
  status,
  label,
  showPulse = false,
  size = "md",
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <Circle
          className={cn(
            sizeConfig[size],
            config.color,
            "fill-current"
          )}
        />
        {showPulse && (
          <Circle
            className={cn(
              sizeConfig[size],
              config.bgColor,
              "absolute top-0 left-0 fill-current animate-ping opacity-75"
            )}
          />
        )}
      </div>
      {displayLabel && (
        <span className="text-sm font-medium">{displayLabel}</span>
      )}
    </div>
  );
}

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", config.color)}
    >
      <Circle className={cn("h-2 w-2 fill-current")} />
      {displayLabel}
    </Badge>
  );
}
