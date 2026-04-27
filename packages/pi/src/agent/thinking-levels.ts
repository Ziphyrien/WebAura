import { supportsXhigh, type Model } from "@mariozechner/pi-ai";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"] as const;
const THINKING_LEVELS_WITH_XHIGH = [...THINKING_LEVELS, "xhigh"] as const;

export function getAvailableThinkingLevels(model: Model<any> | null | undefined): ThinkingLevel[] {
  if (model?.reasoning !== true) {
    return ["off"];
  }

  return [...(supportsXhigh(model) ? THINKING_LEVELS_WITH_XHIGH : THINKING_LEVELS)];
}

export function clampThinkingLevel(
  level: ThinkingLevel,
  model: Model<any> | null | undefined,
): ThinkingLevel {
  const availableLevels = getAvailableThinkingLevels(model);

  if (availableLevels.includes(level)) {
    return level;
  }

  const ordered = THINKING_LEVELS_WITH_XHIGH;
  const requestedIndex = ordered.indexOf(level);

  if (requestedIndex === -1) {
    return availableLevels[0] ?? "off";
  }

  for (let i = requestedIndex; i < ordered.length; i++) {
    const candidate = ordered[i];
    if (candidate && availableLevels.includes(candidate)) {
      return candidate;
    }
  }

  for (let i = requestedIndex - 1; i >= 0; i--) {
    const candidate = ordered[i];
    if (candidate && availableLevels.includes(candidate)) {
      return candidate;
    }
  }

  return availableLevels[0] ?? "off";
}

export function formatThinkingLevelLabel(level: ThinkingLevel): string {
  if (level === "xhigh") {
    return "XHigh";
  }

  return `${level.slice(0, 1).toUpperCase()}${level.slice(1)}`;
}
