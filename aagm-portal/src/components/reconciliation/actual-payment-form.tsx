"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateActualPayment } from "@/app/actions/months";

interface ActualPaymentFormProps {
  monthRunId: string;
  currentValue: number | null;
}

export function ActualPaymentForm({
  monthRunId,
  currentValue,
}: ActualPaymentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(
    currentValue != null ? currentValue.toFixed(2) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmed(false);

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    startTransition(async () => {
      const res = await updateActualPayment(monthRunId, parsed);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setConfirmed(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="actual-payment"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Actual Payment Received
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="actual-payment"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirmed(false);
              }}
              className="pl-7 tabular-nums"
              disabled={isPending}
            />
          </div>
        </div>
        <Button type="submit" size="default" disabled={isPending || !amount}>
          {isPending ? (
            <>
              <LoadingSpinner />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {confirmed && (
        <div className="flex items-center gap-1.5 text-sm text-green-600">
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
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Payment amount saved successfully.
        </div>
      )}
    </form>
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
