import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import type { SettingsSection } from "@firefly/ui/lib/search-state";
import { BadgeCheck, Sparkles, Palette, Receipt, Globe, Database, HelpCircle } from "lucide-react";
import { CostsPanel } from "@firefly/ui/components/costs-panel";
import { DataSettings } from "@firefly/ui/components/data-settings";
import {
  ExtensionsSettings,
  type ExtensionSettingsEntry,
} from "@firefly/ui/components/extensions-settings";
import { ProviderSettings } from "@firefly/ui/components/provider-settings";
import { ProxySettings } from "@firefly/ui/components/proxy-settings";
import { AppearanceSettings } from "@firefly/ui/components/appearance-settings";
import { Dialog, DialogContent, DialogTitle } from "@firefly/ui/components/dialog";
import { Tabs, TabsList, TabsTrigger } from "@firefly/ui/components/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@firefly/ui/components/sidebar";
import { useSelectedSessionSummary } from "@firefly/pi/hooks/use-selected-session-summary";
import { useSettingsDialog } from "@firefly/ui/components/settings-state";

type SettingsSectionItem = {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  id: SettingsSection;
  label: string;
};

const SETTINGS_SECTIONS: Array<SettingsSectionItem> = [
  {
    description: "LLM API keys and OAuth credentials stored in this browser",
    icon: BadgeCheck,
    id: "providers",
    label: "Providers",
  },
  {
    description: "Enable optional AI-callable browser tools",
    icon: Sparkles,
    id: "extensions",
    label: "Extensions",
  },
  {
    description: "Customize colors, themes, layout density, and styles",
    icon: Palette,
    id: "appearance",
    label: "Appearance",
  },
  {
    description: "Session and daily usage totals",
    icon: Receipt,
    id: "costs",
    label: "Costs",
  },
  {
    description: "Optional proxy routing for provider requests",
    icon: Globe,
    id: "proxy",
    label: "Proxy",
  },
  {
    description: "Export chat or wipe all local app data",
    icon: Database,
    id: "data",
    label: "Data",
  },
  {
    description: "How Firefly runs browser-native AI modules locally",
    icon: HelpCircle,
    id: "about",
    label: "About",
  },
];

export function AppSettingsDialog(props: {
  dataPanel?: React.ReactNode;
  extensionSettings?: readonly ExtensionSettingsEntry[];
  pricingLabel?: string;
  pricingPanel?: React.ReactNode;
}) {
  const settingsDialog = useSettingsDialog();
  const currentMatch = useRouterState({
    select: (state) => state.matches[state.matches.length - 1],
  });
  const sessionId =
    currentMatch.routeId === "/chat/$sessionId" ? currentMatch.params.sessionId : undefined;
  const session = useSelectedSessionSummary(sessionId);
  const section = SETTINGS_SECTIONS.some((item) => item.id === settingsDialog.section)
    ? settingsDialog.section
    : "providers";
  const activeSection =
    SETTINGS_SECTIONS.find((item) => item.id === section) ?? SETTINGS_SECTIONS[0];

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          settingsDialog.closeSettings();
        }
      }}
      open={settingsDialog.open}
    >
      <DialogContent className="flex max-h-[90dvh] min-h-0 w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100%-2rem,36rem)] md:h-[620px] md:max-h-[620px] md:min-h-[620px] md:max-w-5xl">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <SidebarProvider className="flex min-h-0 min-w-0 flex-1 flex-row items-stretch overflow-hidden md:h-full md:min-h-0">
          <Sidebar
            className="hidden border-r border-foreground/10 md:flex md:h-full md:min-h-0 md:self-stretch"
            collapsible="none"
          >
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SETTINGS_SECTIONS.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={section === item.id}>
                          <button onClick={() => settingsDialog.setSection(item.id)} type="button">
                            <item.icon />
                            <span>{item.label}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0">
            <header className="shrink-0 border-b border-foreground/10 px-5 pt-4 md:hidden">
              <Tabs className="gap-0" value={section}>
                <div className="w-full min-w-0 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                  <TabsList
                    className="inline-flex h-auto w-max flex-nowrap justify-start gap-4 bg-transparent p-0 px-1 data-[variant=line]:gap-4"
                    variant="line"
                  >
                    {SETTINGS_SECTIONS.map((item) => (
                      <TabsTrigger
                        asChild
                        className="flex-none gap-1.5 px-1.5 pb-2"
                        key={item.id}
                        value={item.id}
                      >
                        <button onClick={() => settingsDialog.setSection(item.id)} type="button">
                          <item.icon className="size-4 shrink-0" />
                          {item.label}
                        </button>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 max-w-2xl">
                <div className="text-sm font-medium">{activeSection.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {activeSection.description}
                </div>
              </div>
              <div className="max-w-3xl">
                {section === "providers" ? (
                  <ProviderSettings
                    onNavigateToProxy={() => {
                      settingsDialog.setSection("proxy");
                    }}
                  />
                ) : null}
                {section === "extensions" ? (
                  <ExtensionsSettings extensions={props.extensionSettings} />
                ) : null}
                {section === "appearance" ? <AppearanceSettings /> : null}
                {section === "proxy" ? <ProxySettings /> : null}
                {section === "costs" ? <CostsPanel session={session} /> : null}
                {section === "data" ? (props.dataPanel ?? <DataSettings />) : null}
                {section === "about" ? <AboutPanel /> : null}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

function AboutPanel() {
  return (
    <div className="space-y-5">
      <div className="space-y-5 text-sm leading-relaxed">
        <p className="text-foreground">
          Firefly is a local-first AI workspace that runs in your browser. The default experience is
          plain AI chat; optional extensions can register AI-callable tools while keeping your own
          credentials in your own browser.
        </p>

        <div>
          <div className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Privacy
          </div>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Local by default.</span> Chats,
              sessions, settings, extension credentials, provider keys, and usage data stay in this
              browser.
            </p>
            <p>
              <span className="font-medium text-foreground">Network:</span> Model requests go
              directly to the providers you configure, unless you explicitly enable your own proxy
              in settings. Optional extensions may call their own services when you enable them.
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Models and modules
          </div>
          <div className="overflow-x-auto rounded-none border border-border/80 text-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30">
                  <th className="px-3 py-2 font-medium text-foreground">Setting</th>
                  <th className="px-3 py-2 font-medium text-foreground">What it is for</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium text-foreground">Providers</td>
                  <td className="px-3 py-2">
                    API keys and OAuth credentials for the models you use.
                  </td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium text-foreground">Extensions</td>
                  <td className="px-3 py-2">
                    Optional AI-callable tools. Disabled extensions are not exposed to the model.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            How it works
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Assistant</span> - Start a normal AI
              chat and optionally add attachments for context.
            </li>
            <li>
              <span className="font-medium text-foreground">Stack</span> - pi-mono with
              browser-native state and direct provider access.
            </li>
            <li>
              <span className="font-medium text-foreground">Local first</span> - The agent runs in a
              per-tab dedicated worker; durable state stays on the main thread.
            </li>
            <li>
              <span className="font-medium text-foreground">Resilient</span> - Lease ownership,
              recovery, and interrupted-turn repair stay inside the browser runtime.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
