"use client";

import { Settings } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@firefly/ui/components/sidebar";
import { useSettingsDialog } from "@firefly/ui/components/settings-state";

/** Mobile sidebar only: links and actions that are hidden from the header on small screens. */
export function SidebarMobileActions() {
  const settingsDialog = useSettingsDialog();

  return (
    <div className="md:hidden">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="h-9"
            onClick={() => settingsDialog.openSettings("appearance")}
          >
            <Settings className="text-sidebar-foreground" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
