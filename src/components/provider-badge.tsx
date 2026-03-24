import { useLiveQuery } from "dexie-react-hooks"
import { getProviderKey } from "@/db/schema"
import { PROVIDER_METADATA } from "@/models/provider-metadata"
import type { ProviderId } from "@/types/models"
import { Badge } from "@/components/ui/badge"

export function ProviderBadge({ provider }: { provider: ProviderId }) {
  const record = useLiveQuery(async () => await getProviderKey(provider), [provider])
  const metadata = PROVIDER_METADATA[provider]
  const label = record?.value
    ? record.value.startsWith("{")
      ? "subscription"
      : "api key"
    : "not connected"

  return (
    <Badge className={`rounded-none border px-2 py-1 ${metadata.accentClassName}`} variant="outline">
      {metadata.label} · {label}
    </Badge>
  )
}
