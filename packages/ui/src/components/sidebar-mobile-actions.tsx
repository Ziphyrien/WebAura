"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Settings, Sun } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@webaura/ui/components/sidebar";
import { useSettingsDialog } from "@webaura/ui/components/settings-state";

type ThemePreference = "light" | "dark" | "system";

const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

function normalizeTheme(theme: string | undefined): ThemePreference {
  return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
}

function getNextTheme(theme: ThemePreference): ThemePreference {
  if (theme === "light") {
    return "dark";
  }
  if (theme === "dark") {
    return "system";
  }
  return "light";
}

/** Mobile sidebar only: links and actions that are hidden from the header on small screens. */
export function SidebarMobileActions() {
  const settingsDialog = useSettingsDialog();
  const { setTheme, theme } = useTheme();
  const currentTheme = normalizeTheme(theme);
  const nextTheme = getNextTheme(currentTheme);

  return (
    <div className="md:hidden">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="h-9" onClick={() => setTheme(nextTheme)}>
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {currentTheme === "system" ? (
                <Monitor className="size-4 text-sidebar-foreground" />
              ) : (
                <>
                  <Sun className="size-4 rotate-0 scale-100 text-sidebar-foreground transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute size-4 rotate-90 scale-0 text-sidebar-foreground transition-all dark:rotate-0 dark:scale-100" />
                </>
              )}
            </span>
            <span className="truncate">Theme: {THEME_LABELS[currentTheme]}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="h-9"
            onClick={() => settingsDialog.openSettings("providers")}
          >
            <Settings className="text-sidebar-foreground" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
