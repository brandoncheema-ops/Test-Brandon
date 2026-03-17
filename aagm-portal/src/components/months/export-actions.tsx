"use client";

import { useState, useTransition } from "react";
import { generateExport } from "@/app/actions/exports";

export function ExportActions({
  monthRunId,
  type,
  disabled,
}: {
  monthRunId: string;
  type: "summary" | "invoice" | "csv";
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    downloadUrl?: string;
  } | null>(null);

  const handleExport = () => {
    startTransition(async () => {
      setResult(null);
      const res = await generateExport(monthRunId, type);
      if ("error" in res) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true, downloadUrl: res.downloadUrl });
      }
    });
  };

  const labels = {
    summary: "Generate Summary",
    invoice: "Generate Invoice",
    csv: "Export CSV",
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={disabled || isPending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
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
            Generating...
          </>
        ) : (
          <>
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {labels[type]}
          </>
        )}
      </button>

      {result?.error && (
        <p className="mt-2 text-sm text-red-600">{result.error}</p>
      )}

      {result?.downloadUrl && (
        <a
          href={result.downloadUrl}
          download
          className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Download Ready
        </a>
      )}
    </div>
  );
}
