import { Button } from "@webaura/ui/components/button";
import { Separator } from "@webaura/ui/components/separator";
import { SidebarTrigger } from "@webaura/ui/components/sidebar";
import { ThemeToggle } from "@webaura/ui/components/theme-toggle";
import { useSettingsDialog } from "@webaura/ui/components/settings-state";
import { Settings } from "lucide-react";

export function AppHeader() {
  const settingsDialog = useSettingsDialog();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-2 px-3 md:hidden">
        <Button
          aria-label="Open settings"
          className="h-8 shadow-none"
          onClick={() => settingsDialog.openSettings("providers")}
          size="icon-sm"
          variant="ghost"
        >
          <Settings className="text-foreground" />
        </Button>
      </div>
      <div className="hidden items-center gap-2 px-3 md:flex">
        <Separator className="!h-6 !self-center" orientation="vertical" />
        <ThemeToggle />
        <Separator className="!h-6 !self-center" orientation="vertical" />
        <Button
          aria-label="Open settings"
          className="h-8 shadow-none"
          onClick={() => settingsDialog.openSettings("providers")}
          size="icon-sm"
          variant="ghost"
        >
          <Settings className="text-foreground" />
        </Button>
      </div>
    </header>
  );
}
