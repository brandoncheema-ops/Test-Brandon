"use client";

import { useState, useRef, useTransition } from "react";
import { createLocationAlias } from "@/app/actions/contracts";

export function CreateAliasDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      setError(null);
      const result = await createLocationAlias({
        sourceValue: formData.get("sourceValue") as string,
        canonicalValue: formData.get("canonicalValue") as string,
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
        className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Alias
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-white p-0 shadow-lg backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Add Location Alias</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Source Value (as appears in files)
              </label>
              <input
                name="sourceValue"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder='e.g. "West Kendall Baptist"'
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Canonical Location
              </label>
              <select
                name="canonicalValue"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="SMH">SMH</option>
                <option value="SMH-Cardiac">SMH-Cardiac</option>
                <option value="WKH">WKH</option>
                <option value="Doral">Doral</option>
                <option value="Doctors Hospital">Doctors Hospital</option>
                <option value="BHHD">BHHD</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <input
                name="notes"
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
              {isPending ? "Adding..." : "Add Alias"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
