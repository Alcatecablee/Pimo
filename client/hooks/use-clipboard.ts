import { useState } from "react";
import { toast } from "sonner";

/**
 * Hook for copying text to clipboard with toast notification
 */
export function useClipboard(successMessage: string = "Copied to clipboard") {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return { copy, copied };
}
