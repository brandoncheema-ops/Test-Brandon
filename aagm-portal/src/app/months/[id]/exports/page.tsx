import { notFound } from "next/navigation";
import { getMonthRun } from "@/app/actions/months";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import { ExportActions } from "@/components/months/export-actions";

export default async function ExportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const monthRun = await getMonthRun(id);
  if (!monthRun) notFound();

  const summary = monthRun.financialSummary;

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <a
          href={`/months/${id}`}
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {monthRun.monthLabel}
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">
          Exports — {monthRun.monthLabel}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and download reports for this month. Status:{" "}
          <span className="font-medium">{getStatusLabel(monthRun.status)}</span>
        </p>
      </div>

      {/* Export Options */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Month Summary */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Month Summary Report</h3>
              <p className="text-sm text-muted-foreground">
                Complete summary with collections, expenses, and calculations
              </p>
            </div>
          </div>
          {summary ? (
            <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Collections</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(summary.collectionsTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Payment</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(summary.expectedPayment)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Expenses</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(summary.totalExpenses)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-sm text-amber-700">
              No financial summary available yet. Run a calculation first.
            </div>
          )}
          <ExportActions monthRunId={id} type="summary" disabled={!summary} />
        </div>

        {/* Invoice */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Invoice</h3>
              <p className="text-sm text-muted-foreground">
                Monthly invoice per contract terms
              </p>
            </div>
          </div>
          <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Amount</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(monthRun.contractVersion.invoiceAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract</span>
              <span className="font-medium">{monthRun.contractVersion.code}</span>
            </div>
          </div>
          <ExportActions monthRunId={id} type="invoice" disabled={false} />
        </div>

        {/* CSV Export */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Data Export (CSV)</h3>
              <p className="text-sm text-muted-foreground">
                Raw collections and expense data in CSV format
              </p>
            </div>
          </div>
          <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collection Rows</span>
              <span className="font-medium">{monthRun.collectionsRows.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expense Rows</span>
              <span className="font-medium">{monthRun.expenseRows.length}</span>
            </div>
          </div>
          <ExportActions
            monthRunId={id}
            type="csv"
            disabled={
              monthRun.collectionsRows.length === 0 &&
              monthRun.expenseRows.length === 0
            }
          />
        </div>

        {/* Export History */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Export History</h3>
              <p className="text-sm text-muted-foreground">
                Previously generated artifacts
              </p>
            </div>
          </div>
          {monthRun.exportArtifacts.length > 0 ? (
            <div className="space-y-2">
              {monthRun.exportArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{artifact.filename}</span>
                    <span className="ml-2 text-muted-foreground">
                      {artifact.artifactType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(artifact.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No exports generated yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
