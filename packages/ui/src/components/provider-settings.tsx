import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import type { ProviderGroupId, ProviderId } from "@webaura/pi/types/models";
import {
  disconnectProvider,
  getOAuthProviderName,
  loginAndStoreOAuthProvider,
  setProviderApiKey,
  type OAuthProviderId,
} from "@webaura/pi/auth/auth-service";
import { isOAuthCredentials } from "@webaura/pi/auth/oauth-types";
import type { ManualOAuthRedirectRequest, OAuthRequestOptions } from "@webaura/pi/auth/oauth-utils";
import { db } from "@webaura/db";
import {
  getOAuthProvidersForSettings,
  getProviderGroupMetadata,
  getSortedApiKeyProvidersForSettings,
} from "@webaura/pi/models/provider-registry";
import {
  DEFAULT_PROXY_URL,
  PROXY_ENABLED_KEY,
  PROXY_URL_KEY,
  proxyConfigFromSettingsRows,
} from "@webaura/pi/proxy/settings";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

type DeviceCodePrompt = {
  userCode: string;
  verificationUri: string;
};

type ManualRedirectPrompt = ManualOAuthRedirectRequest & {
  value: string;
};

function isOAuthConnected(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && isOAuthCredentials(trimmed));
}

function apiKeyProviderLabel(provider: ProviderId): string {
  return getProviderGroupMetadata(provider as ProviderGroupId).label;
}

export function ProviderSettings(props: { onNavigateToProxy?: () => void }) {
  const providerKeys = useLiveQuery(() => db.providerKeys.toArray(), []) ?? [];
  const proxySettingRows = useLiveQuery(() =>
    db.settings.where("key").anyOf([PROXY_ENABLED_KEY, PROXY_URL_KEY]).toArray(),
  );

  const proxyConfig = React.useMemo(() => {
    if (proxySettingRows) {
      return proxyConfigFromSettingsRows(proxySettingRows);
    }

    return {
      enabled: true,
      url: DEFAULT_PROXY_URL,
    };
  }, [proxySettingRows]);

  // Reactive custom names for API keys stored in db.settings under "provider-custom-names"
  const customNamesRecord = useLiveQuery(() => db.settings.get("provider-custom-names"));
  const customNames = React.useMemo(() => {
    if (customNamesRecord?.value && typeof customNamesRecord.value === "object") {
      return customNamesRecord.value as Record<string, string>;
    }
    return {} as Record<string, string>;
  }, [customNamesRecord]);

  const [devicePrompts, setDevicePrompts] = React.useState<
    Partial<Record<OAuthProviderId, DeviceCodePrompt>>
  >({});
  const [loginErrors, setLoginErrors] = React.useState<Partial<Record<OAuthProviderId, string>>>(
    {},
  );
  const [loggingInProvider, setLoggingInProvider] = React.useState<OAuthProviderId | undefined>();
  const [manualRedirectPrompt, setManualRedirectPrompt] = React.useState<
    ManualRedirectPrompt | undefined
  >();
  const manualRedirectPromiseRef = React.useRef<
    | {
        reject: (error: Error) => void;
        resolve: (input: string) => void;
      }
    | undefined
  >(undefined);

  // Selector & inline editing states for API keys
  const [selectedProviderToAdd, setSelectedProviderToAdd] = React.useState<string>("");
  const [newKeyLabel, setNewKeyLabel] = React.useState<string>("");
  const [newKeyApiValue, setNewKeyApiValue] = React.useState<string>("");

  // Inline card editing states
  const [editingProviderId, setEditingProviderId] = React.useState<ProviderId | undefined>();
  const [editLabel, setEditLabel] = React.useState<string>("");
  const [editApiValue, setEditApiValue] = React.useState<string>("");
  const [visibleKeyProviderId, setVisibleKeyProviderId] = React.useState<ProviderId | undefined>();

  const apiKeyProviders = React.useMemo(() => getSortedApiKeyProvidersForSettings(), []);
  const subscriptionOAuthProviders = React.useMemo(() => getOAuthProvidersForSettings(), []);

  // Filter down to API key providers that do NOT have a saved key yet
  const availableProviders = React.useMemo(() => {
    return apiKeyProviders.filter(
      (provider) => !providerKeys.some((k) => k.provider === provider && !k.value.startsWith("{")),
    );
  }, [apiKeyProviders, providerKeys]);

  // Maintain selected provider choice to always point to first available item when options change
  React.useEffect(() => {
    if (availableProviders.length > 0) {
      if (!availableProviders.includes(selectedProviderToAdd as any)) {
        setSelectedProviderToAdd(availableProviders[0]);
      }
    } else {
      setSelectedProviderToAdd("");
    }
  }, [availableProviders, selectedProviderToAdd]);

  const handleOAuthLogin = async (provider: OAuthProviderId) => {
    setLoggingInProvider(provider);
    setLoginErrors((current) => ({
      ...current,
      [provider]: undefined,
    }));
    setDevicePrompts((current) => ({
      ...current,
      [provider]: undefined,
    }));

    try {
      const oauthOptions: OAuthRequestOptions = {
        ...(proxyConfig.enabled ? { proxyUrl: proxyConfig.url } : {}),
        ...(provider === "openai-codex"
          ? {
              onManualRedirect: (request: ManualOAuthRedirectRequest) =>
                new Promise<string>((resolve, reject) => {
                  manualRedirectPromiseRef.current = { reject, resolve };
                  setManualRedirectPrompt({
                    ...request,
                    value: "",
                  });
                }),
            }
          : {}),
      };

      await loginAndStoreOAuthProvider(
        provider,
        new URL("/auth/callback", window.location.origin).toString(),
        (info) => {
          setDevicePrompts((current) => ({
            ...current,
            [provider]: info,
          }));
        },
        Object.keys(oauthOptions).length > 0 ? oauthOptions : undefined,
      );
      setDevicePrompts((current) => ({
        ...current,
        [provider]: undefined,
      }));
      setManualRedirectPrompt(undefined);
      manualRedirectPromiseRef.current = undefined;
      toast.success(`Connected to ${getOAuthProviderName(provider)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete sign-in";
      setLoginErrors((current) => ({
        ...current,
        [provider]: message,
      }));
    } finally {
      setLoggingInProvider(undefined);
    }
  };

  const resolveManualRedirect = () => {
    const value = manualRedirectPrompt?.value.trim();
    if (!value) {
      return;
    }

    manualRedirectPromiseRef.current?.resolve(value);
    manualRedirectPromiseRef.current = undefined;
    setManualRedirectPrompt(undefined);
  };

  const cancelManualRedirect = () => {
    manualRedirectPromiseRef.current?.reject(new Error("OAuth login cancelled"));
    manualRedirectPromiseRef.current = undefined;
    setManualRedirectPrompt(undefined);
  };

  // Helper to save a custom label/name for a provider key
  const saveCustomName = async (providerId: string, name: string) => {
    const record = await db.settings.get("provider-custom-names");
    const current =
      record?.value && typeof record.value === "object"
        ? { ...(record.value as Record<string, string>) }
        : {};

    const trimmed = name.trim();
    if (trimmed) {
      current[providerId] = trimmed;
    } else {
      delete current[providerId];
    }

    await db.settings.put({
      key: "provider-custom-names",
      updatedAt: new Date().toISOString(),
      value: current,
    });
  };

  // Save/Add API key handler
  const handleAddApiKey = async () => {
    const provider = selectedProviderToAdd as ProviderId;
    const value = newKeyApiValue.trim();

    if (!provider) {
      toast.error("Please select a provider first");
      return;
    }

    if (!value) {
      toast.warning("Enter an API key first");
      return;
    }

    try {
      await setProviderApiKey(provider, value);
      await saveCustomName(provider, newKeyLabel);
      toast.success(`${apiKeyProviderLabel(provider)} API key saved successfully`);
      setNewKeyApiValue("");
      setNewKeyLabel("");
    } catch {
      toast.error("Could not save API key");
    }
  };

  // Delete/Clear API key handler
  const handleClearApiKey = async (provider: ProviderId) => {
    try {
      await disconnectProvider(provider);
      await saveCustomName(provider, "");
      toast.success(`${apiKeyProviderLabel(provider)} API key removed`);
    } catch {
      toast.error("Could not remove API key");
    }
  };

  // Inline card edit save handler
  const handleSaveEdit = async (provider: ProviderId) => {
    try {
      if (editApiValue.trim()) {
        await setProviderApiKey(provider, editApiValue.trim());
      }
      await saveCustomName(provider, editLabel);
      toast.success(`Updated ${apiKeyProviderLabel(provider)} settings`);
      setEditingProviderId(undefined);
      setEditApiValue("");
      setEditLabel("");
    } catch {
      toast.error("Could not save updates");
    }
  };

  const activeSavedKeys = React.useMemo(() => {
    return providerKeys.filter(
      (item) => apiKeyProviders.includes(item.provider) && !item.value.startsWith("{"),
    );
  }, [providerKeys, apiKeyProviders]);

  return (
    <div className="space-y-8">
      {/* SECTION 1: SUBSCRIPTION LOGIN (OAuth Providers) */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">Subscription Login</h3>
          <p className="text-xs text-muted-foreground leading-normal">
            Connect your existing subscriptions directly in your browser. Tokens are stored locally.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 shrink-0" />
            <p className="leading-normal">
              OAuth requests use{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {proxyConfig.url}
              </code>{" "}
              when proxying is enabled.{" "}
              {props.onNavigateToProxy ? (
                <button
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={props.onNavigateToProxy}
                  type="button"
                >
                  Change proxy settings.
                </button>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {subscriptionOAuthProviders.map((provider) => {
            const record = providerKeys.find((item) => item.provider === provider);
            const connected = isOAuthConnected(record?.value);
            const devicePrompt = devicePrompts[provider];
            const loginError = loginErrors[provider];
            const loggingIn = loggingInProvider === provider;

            return (
              <Card key={provider} size="sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-medium">
                      {getOAuthProviderName(provider)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {connected ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500 font-medium">
                          <Check className="size-3" /> Connected
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                    </CardDescription>
                  </div>

                  <CardAction>
                    {connected ? (
                      <Button
                        onClick={async () => {
                          try {
                            await disconnectProvider(provider);
                            toast.success(`${getOAuthProviderName(provider)} disconnected`);
                          } catch {
                            toast.error("Could not disconnect");
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5"
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        disabled={loggingInProvider !== undefined && !loggingIn}
                        onClick={() => void handleOAuthLogin(provider)}
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs px-2.5"
                      >
                        {loggingIn ? "Signing in..." : "Sign in"}
                      </Button>
                    )}
                  </CardAction>
                </CardHeader>

                {(!connected && devicePrompt) ||
                (!connected && manualRedirectPrompt?.provider === provider) ||
                loginError ? (
                  <CardContent className="border-t pt-3 text-xs">
                    {!connected && devicePrompt && (
                      <div className="space-y-2">
                        <p className="text-muted-foreground">Complete device sign-in:</p>
                        <div className="flex flex-col gap-1.5 font-mono">
                          <code className="rounded-md border bg-muted px-2 py-1 text-center font-bold tracking-wider text-foreground">
                            {devicePrompt.userCode}
                          </code>
                          <a
                            className="break-all py-1 text-center font-medium text-foreground underline underline-offset-4"
                            href={devicePrompt.verificationUri}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {devicePrompt.verificationUri}
                          </a>
                        </div>
                      </div>
                    )}

                    {!connected && manualRedirectPrompt?.provider === provider && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">Complete browser sign-in</p>
                          <p className="text-muted-foreground">
                            {manualRedirectPrompt.instructions}
                          </p>
                        </div>
                        <Input
                          autoComplete="off"
                          className="h-8 text-xs"
                          onChange={(event) =>
                            setManualRedirectPrompt((current) =>
                              current
                                ? {
                                    ...current,
                                    value: event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder={manualRedirectPrompt.placeholder}
                          value={manualRedirectPrompt.value}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            disabled={!manualRedirectPrompt.value.trim()}
                            onClick={resolveManualRedirect}
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                          >
                            Continue
                          </Button>
                          <Button
                            onClick={cancelManualRedirect}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <a
                            className="ml-auto text-[11px] font-medium text-foreground underline underline-offset-4"
                            href={manualRedirectPrompt.authUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Reopen window
                          </a>
                        </div>
                      </div>
                    )}

                    {loginError && (
                      <div className="flex gap-1.5 items-center text-destructive">
                        <AlertCircle className="size-3.5" />
                        <span>{loginError}</span>
                      </div>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: API KEYS */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">API Keys</h3>
          <p className="text-xs text-muted-foreground leading-normal">
            Enter API keys for cloud providers. Keys are stored locally in your browser.
          </p>
        </div>

        {/* List Active Configured Keys */}
        {activeSavedKeys.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Configured Keys ({activeSavedKeys.length})
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeSavedKeys.map((item) => {
                const provider = item.provider;
                const isEditing = editingProviderId === provider;
                const savedLabel = customNames[provider] || apiKeyProviderLabel(provider);
                const hasCustomName = Boolean(customNames[provider]);
                const isVisible = visibleKeyProviderId === provider;

                return (
                  <Card key={provider} size="sm">
                    {!isEditing ? (
                      <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <Key className="size-3.5 text-muted-foreground shrink-0" />
                            <CardTitle className="text-sm font-semibold truncate leading-none">
                              {savedLabel}
                            </CardTitle>
                          </div>
                          {hasCustomName && (
                            <CardDescription className="text-xs text-muted-foreground/80 font-mono truncate leading-none">
                              Type: {apiKeyProviderLabel(provider)}
                            </CardDescription>
                          )}
                          <div className="text-xs font-mono text-muted-foreground/70 flex items-center gap-1.5 pt-1.5 select-all">
                            <span>{isVisible ? item.value : "••••••••••••••••••••"}</span>
                            <button
                              onClick={() =>
                                setVisibleKeyProviderId(isVisible ? undefined : provider)
                              }
                              type="button"
                              className="text-muted-foreground/80 hover:text-foreground p-0.5 transition-colors"
                              title={isVisible ? "Hide API key" : "Show API key"}
                            >
                              {isVisible ? (
                                <EyeOff className="size-3" />
                              ) : (
                                <Eye className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <CardAction className="flex gap-1.5">
                          <Button
                            onClick={() => {
                              setEditingProviderId(provider);
                              setEditLabel(customNames[provider] ?? "");
                              setEditApiValue("");
                            }}
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            title="Edit"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleClearApiKey(provider)}
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/5 dark:hover:bg-destructive/10"
                            title="Remove Key"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </CardAction>
                      </CardHeader>
                    ) : (
                      <CardContent className="space-y-3 border-t pt-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            Edit {apiKeyProviderLabel(provider)} Key
                          </span>
                          <span className="text-[10px] uppercase font-mono text-muted-foreground">
                            Inline Editor
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            className="text-[11px] text-muted-foreground"
                            htmlFor={`edit-label-${provider}`}
                          >
                            Custom Name / Alias
                          </Label>
                          <Input
                            autoComplete="off"
                            className="h-8 text-xs"
                            id={`edit-label-${provider}`}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder={apiKeyProviderLabel(provider)}
                            value={editLabel}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            className="text-[11px] text-muted-foreground"
                            htmlFor={`edit-value-${provider}`}
                          >
                            Update API Key (Optional)
                          </Label>
                          <Input
                            autoComplete="off"
                            className="h-8 text-xs font-mono"
                            id={`edit-value-${provider}`}
                            onChange={(e) => setEditApiValue(e.target.value)}
                            placeholder="Enter new key, or leave blank to keep current"
                            type="password"
                            value={editApiValue}
                          />
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            onClick={() => setEditingProviderId(undefined)}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5"
                          >
                            <X className="size-3 mr-1" /> Cancel
                          </Button>
                          <Button
                            onClick={() => handleSaveEdit(provider)}
                            size="sm"
                            className="h-7 text-xs px-2.5"
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Provider Selector Form Card */}
        {availableProviders.length > 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="size-4 text-muted-foreground" />
                Configure New Provider
              </CardTitle>
              <CardDescription className="text-xs">
                Choose a provider, give the key an optional name, then save it locally.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="add-provider-select">
                    Provider
                  </Label>
                  <Select value={selectedProviderToAdd} onValueChange={setSelectedProviderToAdd}>
                    <SelectTrigger className="w-full h-8 text-xs bg-background border-border/80">
                      <SelectValue placeholder="Choose provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {apiKeyProviderLabel(provider as ProviderId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="add-provider-label">
                    Custom Alias / Nickname
                  </Label>
                  <Input
                    autoComplete="off"
                    className="h-8 text-xs bg-background border-border/80"
                    id="add-provider-label"
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={
                      selectedProviderToAdd
                        ? apiKeyProviderLabel(selectedProviderToAdd as ProviderId)
                        : "e.g. My Work Account"
                    }
                    value={newKeyLabel}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="add-provider-key">
                    API Key
                  </Label>
                  <Input
                    autoComplete="off"
                    className="h-8 text-xs font-mono bg-background border-border/80"
                    id="add-provider-key"
                    onChange={(e) => setNewKeyApiValue(e.target.value)}
                    placeholder="sk-..."
                    type="password"
                    value={newKeyApiValue}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleAddApiKey}
                  size="sm"
                  className="h-8 text-xs px-3 bg-foreground text-primary-foreground hover:bg-foreground/90 font-medium"
                >
                  <Plus className="size-3.5 mr-1" /> Configure Provider
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>All providers are configured.</EmptyTitle>
              <EmptyDescription>
                You can edit existing API keys from their cards above.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}
