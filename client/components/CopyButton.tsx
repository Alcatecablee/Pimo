import { Button, ButtonProps } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useClipboard } from "@/hooks/use-clipboard";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  text: string;
  successMessage?: string;
}

export function CopyButton({
  text,
  successMessage,
  className,
  children,
  ...props
}: CopyButtonProps) {
  const { copy, copied } = useClipboard(successMessage);

  return (
    <Button
      {...props}
      onClick={() => copy(text)}
      className={cn("gap-2", className)}
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {children || (copied ? "Copied!" : "Copy")}
    </Button>
  );
}
