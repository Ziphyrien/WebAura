import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  type AuthDialogMode,
  type AuthDialogReason,
  type AuthDialogVariant,
  useGitHubAuthContext,
} from "@gitinspect/ui/components/github-auth-context";
import { Button } from "@gitinspect/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@gitinspect/ui/components/dialog";
import { Icons } from "@gitinspect/ui/components/icons";
import { Separator } from "@gitinspect/ui/components/separator";
import { AUTH_STORAGE_SUMMARY, LOCAL_TOKEN_SUMMARY } from "@gitinspect/ui/lib/auth-copy";

function getDialogContent(input: {
  mode: AuthDialogMode;
  reason: AuthDialogReason;
  session: "signed-in" | "signed-out";
  variant: AuthDialogVariant;
}): {
  body: string;
  primaryLabel: string;
  showFallbacks: boolean;
  showGuestAction: boolean;
  title: string;
} {
  const showGuestAction = input.variant === "first-message";
  const showFallbacks = input.mode === "full" || input.reason === "private-repo-access";

  if (input.reason === "private-repo-access" && input.session === "signed-in") {
    return {
      body: "Private repo access failed. Try again.",
      primaryLabel: "Reconnect GitHub",
      showFallbacks: true,
      showGuestAction: false,
      title: "Reconnect GitHub",
    };
  }

  return {
    body: "Use free models and private repos.",
    primaryLabel: "Sign in with GitHub",
    showFallbacks,
    showGuestAction,
    title: "Sign in with GitHub",
  };
}

export function AuthDialog(props: {
  mode: AuthDialogMode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reason: AuthDialogReason;
  variant: AuthDialogVariant;
}) {
  const auth = useGitHubAuthContext();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGuestLoading, setIsGuestLoading] = React.useState(false);

  if (!auth) {
    return null;
  }

  const dialog = getDialogContent({
    mode: props.mode,
    reason: props.reason,
    session: auth.authState.session,
    variant: props.variant,
  });

  const handlePrimaryAction = async () => {
    setIsLoading(true);

    try {
      if (props.reason === "private-repo-access" && auth.authState.session === "signed-in") {
        await auth.ensureRepoAccess();
      } else {
        await auth.signIn();
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not start the GitHub flow");
      setIsLoading(false);
    }
  };

  const handlePatFallback = () => {
    props.onOpenChange(false);
    auth.openGithubSettings();
  };

  const handleContinueWithoutToken = async () => {
    if (!dialog.showGuestAction) {
      props.onOpenChange(false);
      return;
    }

    setIsGuestLoading(true);

    try {
      await auth.continueAsGuest();
    } catch (error) {
      console.error(error);
      toast.error("Could not continue without signing in");
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialog.title}</DialogTitle>
          <DialogDescription className="space-y-1 pt-1 text-left">
            <span className="block font-medium text-foreground">{dialog.body}</span>
            <span className="block">{AUTH_STORAGE_SUMMARY}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            className="w-full gap-2"
            disabled={isLoading || isGuestLoading}
            onClick={() => void handlePrimaryAction()}
            size="lg"
            type="button"
          >
            <Icons.gitHub className="size-4" />
            <span>{dialog.primaryLabel}</span>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          </Button>

          {dialog.showFallbacks ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1" />
                  <span>or</span>
                  <Separator className="flex-1" />
                </div>
                <div className="space-y-1 text-left">
                  <button
                    className="font-medium text-foreground underline underline-offset-4"
                    disabled={isLoading || isGuestLoading}
                    onClick={handlePatFallback}
                    type="button"
                  >
                    Use Personal Access Token instead
                  </button>
                  <span className="block text-sm text-muted-foreground">{LOCAL_TOKEN_SUMMARY}</span>
                </div>
              </div>

              {dialog.showGuestAction ? (
                <div className="text-center text-xs text-muted-foreground">
                  <button
                    className="font-medium text-foreground underline underline-offset-4"
                    disabled={isLoading || isGuestLoading}
                    onClick={() => void handleContinueWithoutToken()}
                    type="button"
                  >
                    {isGuestLoading ? "Continuing…" : "Continue without signing in"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
