"use client";

import * as React from "react";

type TooltipProviderProps = React.PropsWithChildren<{
  delayDuration?: number;
}>;

type TooltipProps = React.PropsWithChildren;

type TooltipTriggerProps = React.PropsWithChildren<{
  asChild?: boolean;
}>;

type TooltipContentProps = React.PropsWithChildren<
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "center" | "end" | "start";
    side?: "bottom" | "left" | "right" | "top";
    sideOffset?: number;
  }
>;

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

function TooltipTrigger({ children }: TooltipTriggerProps) {
  return <>{children}</>;
}

function TooltipContent(_props: TooltipContentProps) {
  return null;
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
