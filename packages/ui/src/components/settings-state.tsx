"use client";

import * as React from "react";
import type { SettingsSection } from "@firefly/ui/lib/search-state";

type SettingsDialogState = {
  closeSettings: () => void;
  open: boolean;
  openSettings: (section?: SettingsSection) => void;
  section: SettingsSection;
  setSection: (section: SettingsSection) => void;
};

const SettingsDialogContext = React.createContext<SettingsDialogState | undefined>(undefined);

export function SettingsDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<SettingsSection>("providers");

  const openSettings = React.useCallback((nextSection: SettingsSection = "providers") => {
    setSection(nextSection);
    setOpen(true);
  }, []);

  const closeSettings = React.useCallback(() => {
    setOpen(false);
  }, []);

  const value = React.useMemo<SettingsDialogState>(
    () => ({
      closeSettings,
      open,
      openSettings,
      section,
      setSection,
    }),
    [closeSettings, open, openSettings, section],
  );

  return <SettingsDialogContext.Provider value={value}>{children}</SettingsDialogContext.Provider>;
}

export function useSettingsDialog() {
  const context = React.useContext(SettingsDialogContext);

  if (!context) {
    throw new Error("useSettingsDialog must be used within SettingsDialogProvider.");
  }

  return context;
}
