import { notFound } from "next/navigation";
import Link from "next/link";
import { getMonthRun, getAdjacentMonths, getPeriodMonths } from "@/app/actions/months";
import { formatCurrency, formatNumber, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { MonthActions } from "@/components/months/month-actions";
import { FileUploadZone } from "@/components/months/file-upload-zone";
import { Progress } from "@/components/ui/progress";

interface MonthPageProps {
  params: Promise<{ id: string }>;
}

const UPLOAD_CATEGORIES = [
  { key: "collections", label: "Collections Report" },
  { key: "monthly_statement", label: "Monthly Statement" },
  { key: "invoice", label: "Invoice" },
  { key: "support_doc", label: "Supporting Document" },
] as const;

export default async function MonthPage({ params }: MonthPageProps) {
  const { id } = await params;

  const [monthRun, adjacent, periodMonths] = await Promise.all([
    getMonthRun(id),
    getAdjacentMonths(id),
    getPeriodMonths(id),
  ]);

  if (!monthRun) {
    notFound();
  }

  const { financialSummary, contractVersion, collectionsRows, expenseRows, uploadFiles, auditEvents } = monthRun;
  const isFinalized = monthRun.status === "finalized";

  // Determine which upload categories are present
  const uploadedCategories = new Set(uploadFiles.map((f) => f.category));

  // Compute collections totals
  const collectionsTotal = collectionsRows.reduce((sum, r) => sum + r.netCollections, 0);
  const paymentsTotal = collectionsRows.reduce((sum, r) => sum + r.payments, 0);
  const refundsTotal = collectionsRows.reduce((sum, r) => sum + r.refunds, 0);
  const unitsTotal = collectionsRows.reduce((sum, r) => sum + r.units, 0);

  // Expenses total
  const expensesTotal = expenseRows.reduce((sum, r) => sum + r.amount, 0);

  // Period context calculations
  const periodCollectionsTotal = periodMonths.reduce(
    (sum, pm) => sum + (pm.financialSummary?.collectionsTotal ?? 0),
    0
  );
  const periodTarget = contractVersion.quarterTargetRevenue ?? 0;
  const periodProgress = periodTarget > 0 ? (periodCollectionsTotal / periodTarget) * 100 : 0;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      {/* Navigation breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Monthly Runs
        </Link>
        <ChevronRightIcon />
        <span className="text-foreground font-medium">{monthRun.monthLabel}</span>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Adjacent month navigation */}
          {adjacent?.previous && (
            <Link
              href={`/months/${adjacent.previous.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeftIcon />
            </Link>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {monthRun.monthLabel}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(monthRun.status)}`}
              >
                {monthRun.status === "in_review" && (
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 status-pulse" />
                )}
                {getStatusLabel(monthRun.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {contractVersion.name} ({contractVersion.code})
            </p>
          </div>

          {adjacent?.next && (
            <Link
              href={`/months/${adjacent.next.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRightSmallIcon />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/months/${id}/review`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ClipboardIcon />
            Review
          </Link>
          <Link
            href={`/months/${id}/reconciliation`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ScaleIcon />
            Reconciliation
          </Link>
          <Link
            href={`/months/${id}/exports`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <DownloadIcon />
            Exports
          </Link>
          <MonthActions
            monthRunId={monthRun.id}
            status={monthRun.status}
            monthLabel={monthRun.monthLabel}
          />
        </div>
      </div>

      {/* Draft indicator */}
      {financialSummary?.isDraft && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Financial summary is a draft (calculation v{financialSummary.calculationVersion}). Finalize the month to lock results.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* A. Financial Summary Cards                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Financial Summary
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FinancialCard
            label="Invoice Amount"
            value={financialSummary?.invoiceAmount ?? contractVersion.invoiceAmount}
          />
          <FinancialCard
            label="Expected Payment"
            value={financialSummary?.expectedPayment ?? null}
            delta={
              financialSummary
                ? financialSummary.reconciliationDeltaInvoiceVsExpected
                : null
            }
            deltaLabel="vs Invoice"
          />
          <FinancialCard
            label="Actual Received"
            value={financialSummary?.actualPaymentReceived ?? null}
            delta={
              financialSummary
                ? financialSummary.reconciliationDeltaExpectedVsActual
                : null
            }
            deltaLabel="vs Expected"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* B. Upload Checklist                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upload Checklist
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {UPLOAD_CATEGORIES.map((cat) => {
            const isUploaded = uploadedCategories.has(cat.key);
            const filesInCategory = uploadFiles.filter((f) => f.category === cat.key);
            return (
              <div
                key={cat.key}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  isUploaded
                    ? "border-green-200 bg-green-50/50"
                    : "border-border bg-white"
                }`}
              >
                {isUploaded ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                    <CheckIcon className="text-green-700" />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                    <EmptyCircleIcon className="text-gray-400" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{cat.label}</p>
                  {filesInCategory.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {filesInCategory.length} file{filesInCategory.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* C. Collections by Location                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Collections by Location
        </h2>
        {collectionsRows.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-white px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No collections data yet. Upload and parse a collections report to populate this table.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Payments</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Refunds</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Collections</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Units</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {collectionsRows.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.sourceLocationCanonical}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatCurrency(row.payments)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatCurrency(row.refunds)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                        {formatCurrency(row.netCollections)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatNumber(row.units)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ReviewStatusBadge status={row.reviewStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(paymentsTotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(refundsTotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(collectionsTotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatNumber(unitsTotal)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ---------------------------------------------------------------- */}
        {/* D. Period Context                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Period Context
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {contractVersion.periodMonths}-month period &middot; Target: {formatCurrency(periodTarget)}
          </p>

          <div className="mt-4 space-y-3">
            {periodMonths.map((pm) => {
              const isCurrent = pm.id === monthRun.id;
              const pmCollections = pm.financialSummary?.collectionsTotal ?? 0;
              return (
                <div key={pm.id} className="flex items-center gap-3">
                  <div className="w-24 flex-shrink-0">
                    {isCurrent ? (
                      <span className="text-sm font-semibold text-foreground">{pm.monthLabel}</span>
                    ) : (
                      <Link
                        href={`/months/${pm.id}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {pm.monthLabel}
                      </Link>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCurrent ? "bg-primary" : "bg-primary/50"
                        }`}
                        style={{
                          width: `${periodTarget > 0 ? Math.min((pmCollections / periodTarget) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-24 flex-shrink-0 text-right text-sm tabular-nums text-foreground">
                    {formatCurrency(pmCollections)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Period Total</span>
              <span className="tabular-nums font-semibold text-foreground">
                {formatCurrency(periodCollectionsTotal)}
              </span>
            </div>
            <div className="mt-2">
              <Progress
                value={periodProgress}
                max={100}
                className="h-3"
                indicatorClassName={periodProgress >= 100 ? "bg-green-600" : "bg-primary"}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.min(periodProgress, 100).toFixed(1)}% of target</span>
              {periodCollectionsTotal > periodTarget && periodTarget > 0 && (
                <span className="font-medium text-green-700">
                  Overage: {formatCurrency(periodCollectionsTotal - periodTarget)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* E. Carryforward Panel                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Carryforward
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                Carry In
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-blue-800">
                {formatCurrency(monthRun.carryforwardIn)}
              </p>
              <p className="mt-0.5 text-xs text-blue-600/70">From prior month</p>
            </div>
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                Carry Out
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-violet-800">
                {formatCurrency(monthRun.carryforwardOut)}
              </p>
              <p className="mt-0.5 text-xs text-violet-600/70">To next month</p>
            </div>
          </div>

          {/* F. Expenses Summary */}
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Expenses
            </h3>
            {expenseRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No expense data available.</p>
            ) : (
              <div className="mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="pb-2 text-center font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenseRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-foreground">{row.categoryRaw}</td>
                        <td className="py-2 text-right tabular-nums text-foreground">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="py-2 text-center">
                          <ReviewStatusBadge status={row.reviewStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="pt-2 font-semibold text-foreground">Total</td>
                      <td className="pt-2 text-right tabular-nums font-semibold text-foreground">
                        {formatCurrency(expensesTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* G. Activity Log                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Activity Log
        </h2>
        {auditEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-border bg-white shadow-sm">
            <ul className="divide-y divide-border">
              {auditEvents.slice(0, 10).map((event, idx) => (
                <li key={idx} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <ActivityDotIcon eventType={event.eventType} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{event.eventDescription}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* H. File Upload Area                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Upload Files
        </h2>
        <div className="mt-3 rounded-xl border border-border bg-white p-6 shadow-sm">
          <FileUploadZone monthRunId={monthRun.id} isFinalized={isFinalized} />
        </div>
      </section>

      {/* Existing uploaded files list */}
      {uploadFiles.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Uploaded Files
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Filename</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parse Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Size</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {uploadFiles.map((file) => (
                  <tr key={file.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {file.originalFilename}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {UPLOAD_CATEGORIES.find((c) => c.key === file.category)?.label ?? file.category}
                    </td>
                    <td className="px-4 py-3">
                      <ParseStatusBadge status={file.parseStatus} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {file.fileSizeBytes != null
                        ? `${(file.fileSizeBytes / 1024).toFixed(1)} KB`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(file.uploadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bottom spacer */}
      <div className="h-12" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper components                                                          */
/* -------------------------------------------------------------------------- */

function FinancialCard({
  label,
  value,
  delta,
  deltaLabel,
}: {
  label: string;
  value: number | null;
  delta?: number | null;
  deltaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value != null ? formatCurrency(value) : "—"}
      </p>
      {delta != null && delta !== 0 && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
              delta > 0
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {formatCurrency(delta)}
          </span>
          {deltaLabel && (
            <span className="text-xs text-muted-foreground">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    approved: "bg-green-50 text-green-700",
    excluded: "bg-red-50 text-red-600",
    flagged: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function ParseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    parsed: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function ActivityDotIcon({ eventType }: { eventType: string }) {
  const colorMap: Record<string, string> = {
    upload: "text-blue-500",
    parse_completed: "text-green-600",
    parse_failed: "text-red-500",
    calculation_draft: "text-amber-500",
    calculation_final: "text-green-600",
    finalize: "text-green-700",
    reopen: "text-orange-500",
    override: "text-violet-500",
    month_created: "text-blue-500",
    month_status_changed: "text-gray-500",
  };
  const color = colorMap[eventType] ?? "text-gray-400";
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="currentColor"
      className={color}
    >
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* SVG Icons                                                                   */
/* -------------------------------------------------------------------------- */

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightSmallIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EmptyCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
