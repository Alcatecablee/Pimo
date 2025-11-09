import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string | React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  iconSize?: number;
}

export function HelpTooltip({
  content,
  className,
  side = "top",
  align = "center",
  iconSize = 14,
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
          aria-label="Help"
        >
          <HelpCircle size={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-sm">
        <div className="text-sm">{content}</div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LabelWithTooltipProps {
  label: string;
  tooltip: string | React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export function LabelWithTooltip({
  label,
  tooltip,
  required,
  htmlFor,
  className,
}: LabelWithTooltipProps) {
  return (
    <label htmlFor={htmlFor} className={cn("flex items-center gap-1.5", className)}>
      <span>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <HelpTooltip content={tooltip} />
    </label>
  );
}
