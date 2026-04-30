import { Outlet, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { RootGuard } from "./root-guard";
import { WEB_EXTENSION_SETTINGS } from "../extensions/ui";
import { SidebarInset, SidebarProvider } from "@webaura/ui/components/sidebar";
import { AppSettingsDialog } from "@webaura/ui/components/settings-dialog";
import { ThemeProvider } from "@webaura/ui/components/theme-provider";
import { Toaster } from "@webaura/ui/components/sonner";
import { TooltipProvider } from "@webaura/ui/components/tooltip";
import { Route } from "../routes/__root";

export function RootAppChrome() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <RootGuard>
          <SidebarProvider
            onOpenChange={(open) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  sidebar: open ? "open" : undefined,
                }),
                to: ".",
              });
            }}
            open={search.sidebar === "open"}
          >
            <div className="relative flex h-svh w-full overflow-hidden overscroll-none">
              <AppSidebar />
              <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <AppHeader />
                <main className="flex min-h-0 flex-1 overflow-hidden">
                  <Outlet />
                </main>
              </SidebarInset>
            </div>
            <AppSettingsDialog extensionSettings={WEB_EXTENSION_SETTINGS} />
          </SidebarProvider>
        </RootGuard>
      </TooltipProvider>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
