import * as React from "react";
import { toast } from "sonner";
import { getExtensionEnabled, setExtensionEnabled } from "@webaura/pi/extensions/settings";
import type { ExtensionManifest } from "@webaura/pi/extensions/types";
import { Label } from "@webaura/ui/components/label";
import { Switch } from "@webaura/ui/components/switch";

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
    <div className="rounded-none border border-foreground/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={switchId}>{item.manifest.name}</Label>
            <span className="text-[11px] text-muted-foreground">v{item.manifest.version}</span>
          </div>
          <p className="text-xs text-muted-foreground">{item.manifest.description}</p>
        </div>
        <Switch
          checked={item.enabled}
          disabled={props.disabled}
          id={switchId}
          onCheckedChange={(enabled) => {
            void props.onToggle(item.manifest.id, enabled);
          }}
        />
      </div>

      {item.manifest.capabilities?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {item.manifest.capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
      ) : null}
    </div>
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
      <div className="rounded-none border border-destructive/30 p-4 text-sm text-destructive">
        Could not load settings for {props.item.manifest.name}: {loadError}
      </div>
    );
  }

  if (!Panel) {
    return (
      <div className="rounded-none border border-foreground/10 p-4 text-sm text-muted-foreground">
        Loading settings for {props.item.manifest.name}...
      </div>
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
    <div className="space-y-4">
      <div className="rounded-none border border-dashed border-foreground/15 p-4 text-xs text-muted-foreground">
        Extensions register AI-callable tools through WebAura's local extension API. Disabled
        extensions do not appear in the model tool list, and default chat starts with every
        extension disabled.
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-none border border-foreground/10 p-4 text-sm text-muted-foreground">
            Loading extensions...
          </div>
        ) : null}
        {!isLoading && items.length === 0 ? (
          <div className="rounded-none border border-foreground/10 p-4 text-sm text-muted-foreground">
            No extensions installed.
          </div>
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
