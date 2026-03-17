"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ className, content, side = "top", children, delayDuration, ...props }, ref) => {
    const sideClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    const delayClass = delayDuration === 0 ? "delay-0" : "delay-300";

    return (
      <div
        ref={ref}
        className={cn("group/tooltip relative inline-flex", className)}
        {...props}
      >
        {children}
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md group-hover/tooltip:inline-block",
            "animate-in fade-in-0 zoom-in-95",
            delayClass,
            sideClasses[side]
          )}
        >
          {content}
        </span>
      </div>
    );
  }
);
Tooltip.displayName = "Tooltip";

export { Tooltip };
