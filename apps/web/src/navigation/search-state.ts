export type LandingTab = "recent" | "suggested";

export function parseLandingTab(value: unknown): LandingTab | undefined {
  return value === "recent" || value === "suggested" ? value : undefined;
}
