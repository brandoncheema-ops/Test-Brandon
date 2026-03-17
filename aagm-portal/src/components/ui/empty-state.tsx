import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
          className
        )}
        {...props}
      >
        {Icon && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <h3
          className={cn(
            "text-lg font-semibold tracking-tight",
            Icon && "mt-4"
          )}
        >
          {title}
        </h3>
        {description && (
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
