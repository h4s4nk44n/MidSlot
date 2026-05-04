import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, heading, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3
        className="mb-2 font-display text-xl font-normal text-text-primary"
        style={{ letterSpacing: "-0.015em" }}
      >
        {heading}
      </h3>
      {body && <p className="mb-6 max-w-[40ch] text-sm text-text-muted">{body}</p>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
