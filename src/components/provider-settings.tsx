import * as React from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  disconnectProvider,
  isOAuthProvider,
  oauthLogin,
  setProviderApiKey,
} from "@/auth/auth-service"
import { listProviderKeys } from "@/db/schema"
import { getProviders } from "@/models/catalog"
import { PROVIDER_METADATA } from "@/models/provider-metadata"
import { getProxyConfig } from "@/proxy/settings"
import type { ProviderId } from "@/types/models"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ProviderSettings() {
  const providerKeys = useLiveQuery(async () => await listProviderKeys(), [])
  const [draftValues, setDraftValues] = React.useState<
    Partial<Record<ProviderId, string>>
  >({})
  const [deviceFlowInfo, setDeviceFlowInfo] = React.useState<
    Partial<
      Record<
        ProviderId,
        {
          userCode: string
          verificationUri: string
        }
      >
    >
  >({})

  React.useEffect(() => {
    setDraftValues(
      Object.fromEntries(
        (providerKeys ?? []).map((record) => [record.provider, record.value])
      ) as Partial<Record<ProviderId, string>>
    )
  }, [providerKeys])

  const redirectUri =
    typeof window === "undefined"
      ? "/auth/callback"
      : `${window.location.origin}/auth/callback`

  return (
    <div className="space-y-4">
      {getProviders().map((provider) => {
        const record = providerKeys?.find((item) => item.provider === provider)
        const authLabel = !record?.value
          ? "not connected"
          : record.value.startsWith("{")
            ? "subscription"
            : "api key"

        return (
          <div className="border border-foreground/10 p-4" key={provider}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {PROVIDER_METADATA[provider].label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {PROVIDER_METADATA[provider].description}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {authLabel}
              </div>
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {record?.updatedAt
                ? `updated ${new Date(record.updatedAt).toLocaleString()}`
                : "never connected"}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Input
                onChange={(event) =>
                  setDraftValues((current) => ({
                    ...current,
                    [provider]: event.target.value,
                  }))
                }
                placeholder={`Paste ${PROVIDER_METADATA[provider].label} API key`}
                value={draftValues[provider] ?? ""}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    const value = draftValues[provider]?.trim()

                    if (!value) {
                      return
                    }

                    await setProviderApiKey(provider, value)
                  }}
                  size="sm"
                >
                  Save API key
                </Button>
                {isOAuthProvider(provider) ? (
                <Button
                  onClick={async () => {
                    const proxy = await getProxyConfig()
                    const credentials = await oauthLogin(
                      provider,
                      redirectUri,
                      (info) =>
                        setDeviceFlowInfo((current) => ({
                          ...current,
                          [provider]: info,
                        })),
                      provider === "anthropic" && proxy.enabled
                        ? { proxyUrl: proxy.url }
                        : undefined
                    )

                    await setProviderApiKey(provider, JSON.stringify(credentials))
                  }}
                    size="sm"
                    variant="outline"
                  >
                    Connect subscription
                  </Button>
                ) : null}
                <Button
                  onClick={async () => {
                    await disconnectProvider(provider)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Disconnect
                </Button>
              </div>
              {deviceFlowInfo[provider] ? (
                <div className="border border-dashed border-foreground/10 p-3 text-xs text-muted-foreground">
                  Enter code <span className="font-medium text-foreground">{deviceFlowInfo[provider]?.userCode}</span> at{" "}
                  <a
                    className="underline underline-offset-4"
                    href={deviceFlowInfo[provider]?.verificationUri}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {deviceFlowInfo[provider]?.verificationUri}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
