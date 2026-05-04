"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-5 px-4 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg"
        aria-hidden="true"
      >
        <svg className="h-7 w-7 text-danger-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <div>
        <h2
          className="font-display text-2xl font-normal text-text-primary"
          style={{ letterSpacing: "-0.02em" }}
        >
          Something went wrong
        </h2>
        <p className="mt-2 max-w-[40ch] text-sm text-text-muted">
          An unexpected error occurred. Please try again or refresh the page.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
