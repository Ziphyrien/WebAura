import type { ProviderId } from "@/types/models"
import { getModels, getProviders } from "@/models/catalog"
import { PROVIDER_METADATA } from "@/models/provider-metadata"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ModelPicker(props: {
  model: string
  onChange: (provider: ProviderId, model: string) => void
  provider: ProviderId
}) {
  const providers = getProviders()
  const models = getModels(props.provider)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        onValueChange={(value) => {
          const provider = value as ProviderId
          const defaultModel = getModels(provider)[0]
          props.onChange(provider, defaultModel.id)
        }}
        value={props.provider}
      >
        <SelectTrigger className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectItem key={provider} value={provider}>
              {PROVIDER_METADATA[provider].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(value) => props.onChange(props.provider, value)}
        value={props.model}
      >
        <SelectTrigger className="min-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
