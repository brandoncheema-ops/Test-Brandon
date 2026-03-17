"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirmAllRows, updateRowStatus } from "@/app/actions/review";

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function reviewBadgeVariant(status: string) {
  switch (status) {
    case "confirmed":
      return "success" as const;
    case "flagged":
      return "warning" as const;
    case "excluded":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function reviewBadgeLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "flagged":
      return "Flagged";
    case "excluded":
      return "Excluded";
    default:
      return status;
  }
}

/* ------------------------------------------------------------------ */
/*  Bulk Confirm All                                                   */
/* ------------------------------------------------------------------ */

interface ConfirmAllButtonProps {
  monthRunId: string;
  pendingCount: number;
}

export function ConfirmAllButton({
  monthRunId,
  pendingCount,
}: ConfirmAllButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    totalConfirmed?: number;
    error?: string;
  } | null>(null);

  function handleConfirmAll() {
    setResult(null);
    startTransition(async () => {
      const res = await confirmAllRows(monthRunId);
      if ("error" in res) {
        setResult({ error: res.error as string });
      } else {
        setResult({ success: true, totalConfirmed: res.totalConfirmed });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        onClick={handleConfirmAll}
        disabled={isPending || pendingCount === 0}
      >
        {isPending ? (
          <>
            <LoadingSpinner />
            Confirming...
          </>
        ) : (
          <>
            <CheckAllIcon />
            Confirm All ({pendingCount} pending)
          </>
        )}
      </Button>
      {result?.success && (
        <span className="text-xs text-green-600">
          {result.totalConfirmed} rows confirmed
        </span>
      )}
      {result?.error && (
        <span className="text-xs text-destructive">{result.error}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual Row Actions                                             */
/* ------------------------------------------------------------------ */

interface RowActionsProps {
  type: "collections" | "expenses";
  rowId: string;
  currentStatus: string;
}

export function RowActions({ type, rowId, currentStatus }: RowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStatusChange(newStatus: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateRowStatus(type, rowId, newStatus);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <ReviewStatusBadge status={currentStatus} />
      {currentStatus !== "confirmed" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={() => handleStatusChange("confirmed")}
          disabled={isPending}
          title="Confirm"
        >
          {isPending ? <LoadingSpinner /> : <CheckIcon />}
        </Button>
      )}
      {currentStatus !== "flagged" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          onClick={() => handleStatusChange("flagged")}
          disabled={isPending}
          title="Flag"
        >
          {isPending ? <LoadingSpinner /> : <FlagIcon />}
        </Button>
      )}
      {currentStatus !== "excluded" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => handleStatusChange("excluded")}
          disabled={isPending}
          title="Exclude"
        >
          {isPending ? <LoadingSpinner /> : <ExcludeIcon />}
        </Button>
      )}
      {currentStatus !== "pending" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          onClick={() => handleStatusChange("pending")}
          disabled={isPending}
          title="Reset to Pending"
        >
          {isPending ? <LoadingSpinner /> : <ResetIcon />}
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

export function ReviewStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={reviewBadgeVariant(status)} className="text-[11px]">
      {reviewBadgeLabel(status)}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function LoadingSpinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckAllIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function ExcludeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
