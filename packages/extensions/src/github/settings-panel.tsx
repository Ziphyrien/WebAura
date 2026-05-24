import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  GITHUB_CREATE_PAT_URL,
  getGithubPersonalAccessToken,
  setGithubPersonalAccessToken,
  validateGithubPersonalAccessToken,
} from "./token";
import { Alert, AlertDescription } from "@firefly/ui/components/alert";
import { Button } from "@firefly/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@firefly/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@firefly/ui/components/field";
import { Input } from "@firefly/ui/components/input";

function GithubTokenSettings(props: { disabled?: boolean }) {
  const [token, setToken] = React.useState("");
  const [hasSavedToken, setHasSavedToken] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;

    void (async () => {
      const stored = await getGithubPersonalAccessToken();

      if (disposed) {
        return;
      }

      const present = Boolean(stored?.trim());
      setToken(stored ?? "");
      setHasSavedToken(present);
      setIsLoading(false);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Use a GitHub Personal Access Token</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Alert className="border-dashed">
            <AlertDescription>
              Optional. Store a token locally for the GitHub extension. Default chat does not use
              GitHub access unless this extension is enabled.
            </AlertDescription>
          </Alert>

          {!isLoading && !hasSavedToken ? (
            <Button
              className="w-full gap-1 sm:w-fit"
              disabled={props.disabled || isSaving}
              onClick={() => {
                window.open(GITHUB_CREATE_PAT_URL, "_blank", "noopener,noreferrer");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Generate Personal Access Token
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          ) : null}

          <Field>
            <FieldLabel htmlFor="github-extension-pat">GitHub Personal Access Token</FieldLabel>
            <Input
              autoComplete="off"
              disabled={props.disabled || isLoading || isSaving}
              id="github-extension-pat"
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_..."
              type="password"
              value={token}
            />
            <FieldDescription>Stored only in this browser.</FieldDescription>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={props.disabled || isLoading || isSaving}
              onClick={async () => {
                const next = token.trim();
                setIsSaving(true);
                try {
                  if (!next) {
                    setToken("");
                    await setGithubPersonalAccessToken(undefined);
                    setHasSavedToken(false);
                    toast.success("Personal Access Token deleted");
                    return;
                  }

                  const result = await validateGithubPersonalAccessToken(next);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }

                  await setGithubPersonalAccessToken(next);
                  setHasSavedToken(true);
                  toast.success(`Personal Access Token saved for @${result.login}`);
                } catch {
                  toast.error("Could not save Personal Access Token");
                } finally {
                  setIsSaving(false);
                }
              }}
              size="sm"
              type="button"
            >
              Save Personal Access Token
            </Button>
            {!isLoading && hasSavedToken ? (
              <Button
                disabled={props.disabled || isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    setToken("");
                    await setGithubPersonalAccessToken(undefined);
                    setHasSavedToken(false);
                    toast.success("Personal Access Token deleted");
                  } catch {
                    toast.error("Could not delete Personal Access Token");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Delete Personal Access Token
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

export function GithubExtensionSettings(props: { disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-medium">GitHub credentials</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Used only by the GitHub extension tools when the extension is enabled.
        </p>
      </div>
      <GithubTokenSettings disabled={props.disabled} />
    </div>
  );
}
