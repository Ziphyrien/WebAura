import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckIcon, Plus } from "lucide-react";
import { db } from "@firefly/db";
import type { ProviderGroupId } from "@firefly/pi/types/models";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@firefly/ui/components/ai-elements/model-selector";
import { PromptInputButton } from "@firefly/ui/components/ai-elements/prompt-input";
import {
  getConnectedProviders,
  getDefaultModelForGroup,
  getModelForGroup,
  getModelsForGroup,
  getProviderGroupMetadata,
  getVisibleProviderGroups,
} from "@firefly/pi/models/catalog";
import { cn } from "@firefly/ui/lib/utils";
import { useSettingsDialog } from "@firefly/ui/components/settings-state";

export function ChatModelSelector(props: {
  disabled?: boolean;
  model: string;
  onSelect: (providerGroup: ProviderGroupId, modelId: string) => void;
  providerGroup: ProviderGroupId;
}) {
  const [open, setOpen] = React.useState(false);
  const settingsDialog = useSettingsDialog();
  const providerKeysResult = useLiveQuery(() => db.providerKeys.toArray(), []);
  const providerKeys = Array.isArray(providerKeysResult) ? providerKeysResult : [];
  const connectedProviders = getConnectedProviders(providerKeys);
  const providerGroups = getVisibleProviderGroups(connectedProviders);
  const activeProviderGroup = providerGroups.includes(props.providerGroup)
    ? props.providerGroup
    : (providerGroups[0] ?? props.providerGroup);
  const activeModelId =
    activeProviderGroup === props.providerGroup
      ? props.model
      : getDefaultModelForGroup(activeProviderGroup).id;
  const selectedModel = getModelForGroup(activeProviderGroup, activeModelId);
  const hasConfiguredProvider = providerGroups.length > 0;

  const triggerButton = (
    <PromptInputButton disabled={props.disabled} size="sm" type="button">
      {hasConfiguredProvider ? (
        <>
          <ModelSelectorLogo className="size-3.5 shrink-0" provider={selectedModel.provider} />
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </>
      ) : (
        <>
          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          <ModelSelectorName>Add provider</ModelSelectorName>
        </>
      )}
    </PromptInputButton>
  );

  if (!hasConfiguredProvider) {
    return (
      <div
        onClick={() => {
          if (props.disabled) return;
          settingsDialog.openSettings("providers");
        }}
      >
        {triggerButton}
      </div>
    );
  }

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>{triggerButton}</ModelSelectorTrigger>

      <ModelSelectorContent className="max-h-[min(420px,70vh)]">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {providerGroups.map((groupId) => (
            <ModelSelectorGroup heading={getProviderGroupMetadata(groupId).label} key={groupId}>
              {getModelsForGroup(groupId).map((model) => {
                const value = `${groupId}:${model.id}`;
                const isSelected = groupId === activeProviderGroup && model.id === activeModelId;

                return (
                  <ModelSelectorItem
                    className={cn("gap-2")}
                    key={value}
                    onSelect={() => {
                      props.onSelect(groupId, model.id);
                      setOpen(false);
                    }}
                    value={value}
                  >
                    <ModelSelectorLogo className="size-3.5 shrink-0" provider={model.provider} />
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    <CheckIcon
                      className={cn(
                        "ml-auto size-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </ModelSelectorItem>
                );
              })}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
