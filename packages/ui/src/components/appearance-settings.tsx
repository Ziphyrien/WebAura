"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@firefly/db";
import { Button } from "@firefly/ui/components/button";
import { Label } from "@firefly/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@firefly/ui/components/select";
import { Textarea } from "@firefly/ui/components/textarea";
import { Monitor, Moon, Sun } from "lucide-react";

const CUSTOM_CSS_KEY = "custom_css_override";

// Injects the custom CSS into the head reactively at runtime
export function CustomCSSInjector() {
  const customCss = useLiveQuery(async () => {
    const row = await db.settings.get(CUSTOM_CSS_KEY);
    return typeof row?.value === "string" ? row.value : "";
  }, []);

  return (
    <style id="firefly-custom-css-injector" type="text/css">
      {customCss ?? ""}
    </style>
  );
}

export function AppearanceSettings() {
  const { setTheme, theme = "system" } = useTheme();

  // Custom CSS State
  const [localCss, setLocalCss] = React.useState("");
  const dbCss = useLiveQuery(async () => {
    const row = await db.settings.get(CUSTOM_CSS_KEY);
    return typeof row?.value === "string" ? row.value : "";
  }, []);

  // Sync DB to local input once loaded
  React.useEffect(() => {
    if (dbCss !== undefined) {
      setLocalCss(dbCss);
    }
  }, [dbCss]);

  const handleSaveCss = React.useCallback(async () => {
    await db.settings.put({
      key: CUSTOM_CSS_KEY,
      value: localCss,
      updatedAt: String(Date.now()),
    });
  }, [localCss]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Theme Choice - Select form to avoid floating single button clutter */}
      <div className="space-y-2">
        <Label htmlFor="theme-select" className="text-sm font-medium">
          Color Theme
        </Label>
        <div className="flex max-w-sm gap-2">
          <Select value={theme} onValueChange={(val) => setTheme(val)}>
            <SelectTrigger id="theme-select" className="w-full">
              <div className="flex items-center gap-2">
                {theme === "light" ? (
                  <Sun className="size-4 text-muted-foreground" />
                ) : theme === "dark" ? (
                  <Moon className="size-4 text-muted-foreground" />
                ) : (
                  <Monitor className="size-4 text-muted-foreground" />
                )}
                <SelectValue placeholder="Select Theme" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light Mode</SelectItem>
              <SelectItem value="dark">Dark Mode</SelectItem>
              <SelectItem value="system">System Preference</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Switch between light, dark, or sync automatically with your operating system preferences.
        </p>
      </div>

      {/* Custom CSS Editor */}
      <div className="space-y-2 pt-4 border-t border-border/40">
        <Label htmlFor="custom-css-editor" className="text-sm font-medium">
          Custom CSS
        </Label>
        <div className="space-y-3">
          <Textarea
            id="custom-css-editor"
            className="font-mono text-xs h-40 leading-relaxed resize-none w-full"
            placeholder="/* Add your custom styles here, e.g. */&#10;:root {&#10;  --primary: oklch(0.6 0.15 150);&#10;  --radius: 0.5rem;&#10;}"
            value={localCss}
            onChange={(e) => setLocalCss(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={localCss === dbCss} onClick={handleSaveCss}>
              Apply Styles
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Write custom CSS to instantly customize Firefly&apos;s interface style. Changes apply
          reactively in real-time.
        </p>
      </div>
    </div>
  );
}
