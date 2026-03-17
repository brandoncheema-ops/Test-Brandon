"use client";

import { useState, useRef, useTransition } from "react";
import { createContractVersion } from "@/app/actions/contracts";

export function CreateContractDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      setError(null);
      const result = await createContractVersion({
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        effectiveStartDate: formData.get("effectiveStartDate") as string,
        effectiveEndDate: (formData.get("effectiveEndDate") as string) || null,
        invoiceAmount: parseFloat(formData.get("invoiceAmount") as string),
        requiredMonthlyRevenue: formData.get("requiredMonthlyRevenue")
          ? parseFloat(formData.get("requiredMonthlyRevenue") as string)
          : undefined,
        quarterTargetRevenue: formData.get("quarterTargetRevenue")
          ? parseFloat(formData.get("quarterTargetRevenue") as string)
          : undefined,
        annualFmvExpense: formData.get("annualFmvExpense")
          ? parseFloat(formData.get("annualFmvExpense") as string)
          : undefined,
        annualRequiredRevenue: formData.get("annualRequiredRevenue")
          ? parseFloat(formData.get("annualRequiredRevenue") as string)
          : undefined,
        maxAnnualSubsidy: formData.get("maxAnnualSubsidy")
          ? parseFloat(formData.get("maxAnnualSubsidy") as string)
          : undefined,
        includedLocations: (formData.get("includedLocations") as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        periodMonths: parseInt(formData.get("periodMonths") as string) || 3,
        notes: (formData.get("notes") as string) || undefined,
      });

      if ("error" in result) {
        setError(result.error as string);
      } else {
        dialogRef.current?.close();
      }
    });
  };

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Contract Version
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl border border-border bg-white p-0 shadow-lg backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="mb-6 text-lg font-semibold">
            New Contract Version
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Main Contract 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Code</label>
                <input
                  name="code"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MAIN-2026"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Effective Start
                </label>
                <input
                  name="effectiveStartDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Effective End
                </label>
                <input
                  name="effectiveEndDate"
                  type="date"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Invoice Amount ($)
              </label>
              <input
                name="invoiceAmount"
                type="number"
                step="0.01"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Required Monthly Revenue ($)
                </label>
                <input
                  name="requiredMonthlyRevenue"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Period Target Revenue ($)
                </label>
                <input
                  name="quarterTargetRevenue"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Annual FMV ($)
                </label>
                <input
                  name="annualFmvExpense"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Annual Required Rev ($)
                </label>
                <input
                  name="annualRequiredRevenue"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Max Annual Subsidy ($)
                </label>
                <input
                  name="maxAnnualSubsidy"
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Included Locations (comma-separated)
              </label>
              <input
                name="includedLocations"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="SMH, SMH-Cardiac, WKH, Doral, Doctors Hospital, BHHD"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Period Length (months)
              </label>
              <input
                name="periodMonths"
                type="number"
                defaultValue={3}
                min={1}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Contract"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
