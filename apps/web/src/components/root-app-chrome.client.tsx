import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { RootGuard } from "./root-guard";
import { WEB_EXTENSION_SETTINGS } from "../extensions/ui";
import { SidebarInset, SidebarProvider } from "@firefly/ui/components/sidebar";
import { AppSettingsDialog } from "@firefly/ui/components/settings-dialog";
import { SettingsDialogProvider } from "@firefly/ui/components/settings-state";
import { CustomCSSInjector } from "@firefly/ui/components/appearance-settings";
import { ThemeProvider } from "@firefly/ui/components/theme-provider";
import { Toaster } from "@firefly/ui/components/sonner";
import { TooltipProvider } from "@firefly/ui/components/tooltip";

export function RootAppChrome() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CustomCSSInjector />
      <TooltipProvider>
        <RootGuard>
          <SidebarProvider>
            <SettingsDialogProvider>
              <div className="relative flex h-svh w-full overflow-hidden overscroll-none">
                <AppSidebar />
                <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <main className="flex min-h-0 flex-1 overflow-hidden">
                    <Outlet />
                  </main>
                </SidebarInset>
              </div>
              <AppSettingsDialog extensionSettings={WEB_EXTENSION_SETTINGS} />
            </SettingsDialogProvider>
          </SidebarProvider>
        </RootGuard>
      </TooltipProvider>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
