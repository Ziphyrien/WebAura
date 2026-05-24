import { Check, Loader2, Share2 } from "lucide-react";
import { Button } from "@firefly/ui/components/button";
import { useEffect, useState } from "react";

type SessionUtilityActionProps = {
  disabled?: boolean;
  isSharing?: boolean;
  onShare: () => void;
};

export function SessionUtilityActions(props: SessionUtilityActionProps) {
  const [shareState, setShareState] = useState<"idle" | "sharing" | "success">("idle");

  useEffect(() => {
    if (props.isSharing) {
      setShareState("sharing");
    } else if (shareState === "sharing") {
      setShareState("success");
      const timer = setTimeout(() => {
        setShareState("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [props.isSharing]);

  return (
    <Button
      className="gap-1.5"
      disabled={props.disabled || shareState !== "idle"}
      onClick={props.onShare}
      size="sm"
      type="button"
      variant="outline"
    >
      <span className="relative flex size-3.5 items-center justify-center">
        {shareState === "sharing" ? (
          <Loader2 className="absolute size-3.5 animate-spin" />
        ) : shareState === "success" ? (
          <Check className="absolute size-3.5 text-emerald-600 animate-in fade-in-0 zoom-in-95 duration-200 dark:text-emerald-400" />
        ) : (
          <Share2 className="absolute size-3.5 animate-in fade-in-0 zoom-in-95 duration-200" />
        )}
      </span>
      <span>
        {shareState === "sharing" ? "Sharing" : shareState === "success" ? "Copied" : "Share"}
      </span>
    </Button>
  );
}
