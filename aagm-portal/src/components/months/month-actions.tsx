"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { updateMonthStatus, reopenMonth } from "@/app/actions/months";
import { runMonthCalculation } from "@/app/actions/calculations";

interface MonthActionsProps {
  monthRunId: string;
  status: string;
  monthLabel: string;
}

export function MonthActions({
  monthRunId,
  status,
  monthLabel,
}: MonthActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [calcPending, startCalcTransition] = useTransition();
  const [reopenPending, startReopenTransition] = useTransition();
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRunCalculation() {
    setError(null);
    startCalcTransition(async () => {
      const result = await runMonthCalculation(monthRunId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleFinalize() {
    setError(null);
    startTransition(async () => {
      const result = await updateMonthStatus(monthRunId, "finalized");
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setFinalizeOpen(false);
        router.refresh();
      }
    });
  }

  function handleReopen() {
    setError(null);
    startReopenTransition(async () => {
      const result = await reopenMonth(monthRunId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleMarkReadyToFinalize() {
    setError(null);
    startTransition(async () => {
      const result = await updateMonthStatus(monthRunId, "ready_to_finalize");
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-destructive mr-2">{error}</span>
      )}

      {(status === "in_review" || status === "needs_upload") && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunCalculation}
          disabled={calcPending}
        >
          {calcPending ? (
            <>
              <LoadingSpinner />
              Calculating...
            </>
          ) : (
            <>
              <CalculatorIcon />
              Run Calculation
            </>
          )}
        </Button>
      )}

      {status === "in_review" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkReadyToFinalize}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <LoadingSpinner />
              Updating...
            </>
          ) : (
            <>
              <CheckCircleIcon />
              Mark Ready
            </>
          )}
        </Button>
      )}

      {(status === "in_review" || status === "ready_to_finalize") && (
        <>
          <Button
            size="sm"
            onClick={() => setFinalizeOpen(true)}
            disabled={isPending}
          >
            <LockIcon />
            Finalize
          </Button>

          <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
            <DialogContent>
              <DialogClose />
              <DialogHeader>
                <DialogTitle>Finalize {monthLabel}?</DialogTitle>
                <DialogDescription>
                  This will lock the month and mark all calculations as final.
                  The financial summary will no longer be marked as a draft. You
                  can reopen it later if needed, but all changes will be logged.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFinalizeOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalize}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <LoadingSpinner />
                      Finalizing...
                    </>
                  ) : (
                    "Confirm Finalize"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {status === "finalized" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleReopen}
          disabled={reopenPending}
        >
          {reopenPending ? (
            <>
              <LoadingSpinner />
              Reopening...
            </>
          ) : (
            <>
              <UnlockIcon />
              Reopen
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
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

function CalculatorIcon() {
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
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  );
}

function CheckCircleIcon() {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function LockIcon() {
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
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
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
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
