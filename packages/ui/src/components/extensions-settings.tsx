import * as React from "react";
import { toast } from "sonner";
import { getExtensionEnabled, setExtensionEnabled } from "@firefly/pi/extensions/settings";
import type { ExtensionManifest } from "@firefly/pi/extensions/types";
import { Alert, AlertDescription } from "@firefly/ui/components/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@firefly/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@firefly/ui/components/empty";
import { Label } from "@firefly/ui/components/label";
import { Switch } from "@firefly/ui/components/switch";

export type ExtensionSettingsPanel = React.ComponentType<{ disabled?: boolean }>;

export type ExtensionSettingsEntry = {
  defaultEnabled?: boolean;
  loadSettingsPanel?: () => Promise<ExtensionSettingsPanel>;
  manifest: ExtensionManifest;
};

type ExtensionCatalogItem = ExtensionSettingsEntry & {
  enabled: boolean;
};

function ExtensionCard(props: {
  disabled?: boolean;
  item: ExtensionCatalogItem;
  onToggle: (extensionId: string, enabled: boolean) => Promise<void>;
}) {
  const { item } = props;
  const switchId = `extension-${item.manifest.id}`;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Label htmlFor={switchId}>{item.manifest.name}</Label>
          <span className="text-[11px] text-muted-foreground">v{item.manifest.version}</span>
        </CardTitle>
        <CardDescription className="text-xs">{item.manifest.description}</CardDescription>
        <CardAction>
          <Switch
            checked={item.enabled}
            disabled={props.disabled}
            id={switchId}
            onCheckedChange={(enabled) => {
              void props.onToggle(item.manifest.id, enabled);
            }}
          />
        </CardAction>
      </CardHeader>

      {item.manifest.capabilities?.length ? (
        <CardContent>
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {item.manifest.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

function ExtensionSettingsPanelSlot(props: { disabled?: boolean; item: ExtensionCatalogItem }) {
  const [Panel, setPanel] = React.useState<ExtensionSettingsPanel | undefined>();
  const [loadError, setLoadError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let disposed = false;
    setPanel(undefined);
    setLoadError(undefined);

    if (!props.item.loadSettingsPanel) {
      return () => {
        disposed = true;
      };
    }

    void (async () => {
      try {
        const SettingsPanel = await props.item.loadSettingsPanel?.();

        if (!disposed) {
          setPanel(() => SettingsPanel);
        }
      } catch (error) {
        if (!disposed) {
          const nextError = error instanceof Error ? error.message : String(error);
          setLoadError(nextError);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [props.item]);

  if (!props.item.loadSettingsPanel) {
    return null;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load settings for {props.item.manifest.name}: {loadError}
        </AlertDescription>
      </Alert>
    );
  }

  if (!Panel) {
    return (
      <Alert>
        <AlertDescription>Loading settings for {props.item.manifest.name}...</AlertDescription>
      </Alert>
    );
  }

  return <Panel disabled={props.disabled} />;
}

export function ExtensionsSettings(props: {
  disabled?: boolean;
  extensions?: readonly ExtensionSettingsEntry[];
}) {
  const extensions = React.useMemo(() => props.extensions ?? [], [props.extensions]);
  const [items, setItems] = React.useState<ExtensionCatalogItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [savingExtensionId, setSavingExtensionId] = React.useState<string | undefined>();

  React.useEffect(() => {
    let disposed = false;
    setIsLoading(true);

    void (async () => {
      const catalog = await Promise.all(
        extensions.map(async (extension) => ({
          ...extension,
          enabled: await getExtensionEnabled(extension),
        })),
      );

      if (disposed) {
        return;
      }

      setItems(catalog);
      setIsLoading(false);
    })();

    return () => {
      disposed = true;
    };
  }, [extensions]);

  const handleToggle = async (extensionId: string, enabled: boolean) => {
    setItems((current) =>
      current.map((item) =>
        item.manifest.id === extensionId
          ? {
              ...item,
              enabled,
            }
          : item,
      ),
    );
    setSavingExtensionId(extensionId);

    try {
      await setExtensionEnabled(extensionId, enabled);
      toast.success(enabled ? "Extension enabled" : "Extension disabled");
    } catch {
      setItems((current) =>
        current.map((item) =>
          item.manifest.id === extensionId
            ? {
                ...item,
                enabled: !enabled,
              }
            : item,
        ),
      );
      toast.error("Could not save extension setting");
    } finally {
      setSavingExtensionId(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert className="border-dashed">
        <AlertDescription className="text-xs">
          Extensions register AI-callable tools through Firefly's local extension API. Disabled
          extensions do not appear in the model tool list, and default chat starts with every
          extension disabled.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <Alert>
            <AlertDescription>Loading extensions...</AlertDescription>
          </Alert>
        ) : null}
        {!isLoading && items.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No extensions installed.</EmptyTitle>
              <EmptyDescription>
                Optional extensions can register AI-callable tools when installed and enabled.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {items.map((item) => (
          <ExtensionCard
            disabled={props.disabled || savingExtensionId === item.manifest.id}
            item={item}
            key={item.manifest.id}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {items.map((item) =>
        item.enabled ? (
          <ExtensionSettingsPanelSlot
            disabled={props.disabled}
            item={item}
            key={`${item.manifest.id}-settings`}
          />
        ) : null,
      )}
    </div>
  );
}
