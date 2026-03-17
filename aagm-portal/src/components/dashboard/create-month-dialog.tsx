"use client";

import { useRef, useState, useTransition } from "react";
import { createMonthRun } from "@/app/actions/months";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function CreateMonthDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createMonthRun(month, year);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        closeDialog();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
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
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Create Month
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-white p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDialog();
        }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Create New Month Run
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a month and year to create a new monthly run. The system
              will automatically assign the active contract and calculate any
              carryforward amounts.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="create-month-select"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Month
              </label>
              <select
                id="create-month-select"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                disabled={isPending}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="create-year-input"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Year
              </label>
              <input
                id="create-year-input"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2040}
                disabled={isPending}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isPending}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && (
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
              )}
              {isPending ? "Creating..." : "Create Month"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
