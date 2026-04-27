import * as React from "react";
import { ChatModelSelector } from "./chat-model-selector";
import type { ChatStatus } from "ai";
import type { PromptInputMessage } from "@gitaura/ui/components/ai-elements/prompt-input";
import type { ProviderGroupId, ThinkingLevel } from "@gitaura/pi/types/models";
import { getModelForGroup } from "@gitaura/pi/models/catalog";
import {
  clampThinkingLevel,
  formatThinkingLevelLabel,
  getAvailableThinkingLevels,
} from "@gitaura/pi/agent/thinking-levels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@gitaura/ui/components/select";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@gitaura/ui/components/ai-elements/attachments";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
} from "@gitaura/ui/components/ai-elements/prompt-input";

function ChatComposerInner(props: {
  composerDisabled?: boolean;
  disabledReason?: string;
  isStreaming: boolean;
  model: string;
  onAbort: () => void;
  onSelectModel: (providerGroup: ProviderGroupId, modelId: string) => Promise<void> | void;
  onSend: (value: string) => Promise<void> | void;
  onThinkingLevelChange: (level: ThinkingLevel) => Promise<void> | void;
  placeholder?: string;
  providerGroup: ProviderGroupId;
  thinkingLevel: ThinkingLevel;
  utilityActions?: React.ReactNode;
}) {
  const { textInput } = usePromptInputController();
  const text = textInput.value;
  const locked = props.composerDisabled === true;

  const handleSubmit = React.useCallback(
    (message: PromptInputMessage) => {
      if (locked) {
        return;
      }

      const next = message.text.trim();

      if (!next || props.isStreaming) {
        return;
      }

      void props.onSend(next);
    },
    [locked, props.isStreaming, props.onSend],
  );

  const submitStatus: ChatStatus = props.isStreaming ? "streaming" : "ready";

  const currentModel = getModelForGroup(props.providerGroup, props.model);
  const thinkingLevels = getAvailableThinkingLevels(currentModel);
  const supportsThinking = thinkingLevels.some((level) => level !== "off");
  const selectedThinkingLevel = clampThinkingLevel(props.thinkingLevel, currentModel);
  const controlsDisabled = locked || props.isStreaming;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputHeader>
          <PromptInputAttachmentsRow />
        </PromptInputHeader>

        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-[4.5rem] text-sm font-medium leading-6 text-foreground placeholder:text-muted-foreground md:text-base"
            disabled={locked}
            placeholder={
              locked
                ? (props.disabledReason ?? "Select a repository to get started")
                : (props.placeholder ?? "What would you like to know?")
            }
          />
        </PromptInputBody>

        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                aria-label="Add attachments"
                disabled={locked}
                tooltip={{
                  content:
                    "Add files for local preview. Only message text is sent in this version.",
                }}
              />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>

            <ChatModelSelector
              disabled={controlsDisabled}
              model={props.model}
              onSelect={props.onSelectModel}
              providerGroup={props.providerGroup}
            />

            {supportsThinking ? (
              <Select
                disabled={controlsDisabled}
                onValueChange={(value) => {
                  void props.onThinkingLevelChange(value as ThinkingLevel);
                }}
                value={selectedThinkingLevel}
              >
                <SelectTrigger aria-label="Thinking mode" className="min-w-24" size="sm">
                  <SelectValue placeholder="Thinking" />
                </SelectTrigger>
                <SelectContent>
                  {thinkingLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatThinkingLevelLabel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </PromptInputTools>

          {props.utilityActions ? (
            <div className="ml-auto shrink-0">{props.utilityActions}</div>
          ) : null}

          <PromptInputSubmit
            disabled={locked || (!text.trim() && !props.isStreaming)}
            onStop={props.onAbort}
            status={submitStatus}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

function PromptInputAttachmentsRow() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((file) => (
        <Attachment data={file} key={file.id} onRemove={() => attachments.remove(file.id)}>
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

export function ChatComposer(props: {
  composerDisabled?: boolean;
  disabledReason?: string;
  initialInput?: string;
  isStreaming: boolean;
  model: string;
  onAbort: () => void;
  onSelectModel: (providerGroup: ProviderGroupId, modelId: string) => Promise<void> | void;
  onSend: (value: string) => Promise<void> | void;
  onThinkingLevelChange: (level: ThinkingLevel) => Promise<void> | void;
  placeholder?: string;
  providerGroup: ProviderGroupId;
  thinkingLevel: ThinkingLevel;
  utilityActions?: React.ReactNode;
}) {
  return (
    <PromptInputProvider initialInput={props.initialInput} key={props.initialInput ?? ""}>
      <ChatComposerInner {...props} />
    </PromptInputProvider>
  );
}
