import { notFound } from "next/navigation";
import { getMonthRun, getPeriodMonths } from "@/app/actions/months";
import {
  formatCurrency,
  formatNumber,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ActualPaymentForm } from "@/components/reconciliation/actual-payment-form";

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [monthRun, periodMonths] = await Promise.all([
    getMonthRun(id),
    getPeriodMonths(id),
  ]);
  if (!monthRun) notFound();

  const summary = monthRun.financialSummary;
  const contract = monthRun.contractVersion;

  /* ---------------------------------------------------------------- */
  /*  Computed values                                                  */
  /* ---------------------------------------------------------------- */

  const invoiceAmount = summary?.invoiceAmount ?? contract.invoiceAmount ?? 0;
  const expectedPayment = summary?.expectedPayment ?? 0;
  const actualReceived = summary?.actualPaymentReceived ?? null;

  const deltaInvoiceVsExpected =
    summary?.reconciliationDeltaInvoiceVsExpected ??
    invoiceAmount - expectedPayment;
  const deltaExpectedVsActual =
    summary?.reconciliationDeltaExpectedVsActual ??
    (actualReceived != null ? actualReceived - expectedPayment : null);

  const periodCollectionsTotal = summary?.periodCollectionsTotal ?? 0;
  const periodTargetRevenue = summary?.periodTargetRevenue ?? 0;
  const periodOverage = summary?.periodOverage ?? 0;

  const carryforwardIn = monthRun.carryforwardIn ?? 0;
  const carryforwardOut = monthRun.carryforwardOut ?? 0;

  /* Period month summaries */
  const periodSummaries = periodMonths.map((pm) => {
    const fs = pm.financialSummary;
    const collections = fs?.collectionsTotal ?? 0;
    const requiredRevenue = summary?.requiredNetRevenue ?? 0;
    const overage = collections - requiredRevenue;
    const subsidyExpected = fs?.expectedPayment ?? 0;
    return {
      id: pm.id,
      label: pm.monthLabel,
      isCurrent: pm.id === id,
      collections,
      requiredRevenue,
      overage,
      subsidyExpected,
    };
  });

  const periodTotals = periodSummaries.reduce(
    (acc, m) => ({
      collections: acc.collections + m.collections,
      requiredRevenue: acc.requiredRevenue + m.requiredRevenue,
      overage: acc.overage + m.overage,
      subsidyExpected: acc.subsidyExpected + m.subsidyExpected,
    }),
    { collections: 0, requiredRevenue: 0, overage: 0, subsidyExpected: 0 }
  );

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function DeltaDisplay({
    value,
    label,
  }: {
    value: number | null;
    label: string;
  }) {
    if (value == null) {
      return (
        <div className="text-sm text-muted-foreground">
          {label}: <span className="italic">N/A</span>
        </div>
      );
    }
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isZero = value === 0;
    return (
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
          isZero
            ? "bg-gray-50 text-gray-600"
            : isPositive
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
        }`}
      >
        {!isZero && (
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
            className={isNegative ? "rotate-180" : ""}
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        )}
        <span>{label}:</span>
        <span className="tabular-nums font-semibold">
          {formatCurrency(Math.abs(value))}
        </span>
        {isPositive && <span className="text-xs">(overpaid)</span>}
        {isNegative && <span className="text-xs">(shortfall)</span>}
        {isZero && <span className="text-xs">(exact match)</span>}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      {/* ── A. Header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <a
          href={`/months/${id}`}
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to {monthRun.monthLabel}
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reconciliation &mdash; {monthRun.monthLabel}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare invoice, expected subsidy, and actual payment received.
          Status:{" "}
          <span className="font-medium">
            {getStatusLabel(monthRun.status)}
          </span>
        </p>
      </div>

      {/* ── B. Three Financial Truth Cards ────────────────────────── */}
      <section className="mb-8">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Invoice Amount */}
          <div className="relative rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Invoice Amount
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(invoiceAmount)}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Per contract ({contract.code})
            </div>
            {/* Delta arrow to next card */}
            <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                  deltaInvoiceVsExpected === 0
                    ? "border-gray-300 bg-gray-50 text-gray-500"
                    : deltaInvoiceVsExpected > 0
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-red-300 bg-red-50 text-red-700"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Expected Payment */}
          <div className="relative rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Expected Payment
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(expectedPayment)}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Calculated subsidy check
            </div>
            {/* Delta arrow to next card */}
            <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                  deltaExpectedVsActual == null || deltaExpectedVsActual === 0
                    ? "border-gray-300 bg-gray-50 text-gray-500"
                    : deltaExpectedVsActual > 0
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-red-300 bg-red-50 text-red-700"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 3: Actual Received */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Actual Received
            </div>
            {actualReceived != null ? (
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(actualReceived)}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground/50">
                Not entered
              </div>
            )}
            <div className="mt-3 border-t border-border pt-3">
              <ActualPaymentForm
                monthRunId={id}
                currentValue={actualReceived}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── E. Reconciliation Deltas ──────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Reconciliation Deltas
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <DeltaDisplay
            value={deltaInvoiceVsExpected}
            label="Invoice vs Expected"
          />
          <DeltaDisplay
            value={deltaExpectedVsActual}
            label="Expected vs Actual"
          />
        </div>
      </section>

      {/* ── C. Period Summary ─────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Period Summary
        </h2>
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Collections</TableHead>
                <TableHead className="text-right">Required Revenue</TableHead>
                <TableHead className="text-right">Overage</TableHead>
                <TableHead className="text-right">Subsidy Expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodSummaries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No period data available.
                  </TableCell>
                </TableRow>
              ) : (
                periodSummaries.map((pm) => (
                  <TableRow
                    key={pm.id}
                    className={pm.isCurrent ? "bg-blue-50/50" : ""}
                  >
                    <TableCell>
                      <span
                        className={`font-medium ${
                          pm.isCurrent ? "text-blue-700" : ""
                        }`}
                      >
                        {pm.label}
                      </span>
                      {pm.isCurrent && (
                        <span className="ml-2 text-xs text-blue-500">
                          (current)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(pm.collections)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(pm.requiredRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          pm.overage > 0
                            ? "text-green-600 font-medium"
                            : pm.overage < 0
                              ? "text-red-600 font-medium"
                              : ""
                        }
                      >
                        {formatCurrency(pm.overage)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(pm.subsidyExpected)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {periodSummaries.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell>Period Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(periodTotals.collections)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(periodTotals.requiredRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        periodTotals.overage > 0
                          ? "text-green-600"
                          : periodTotals.overage < 0
                            ? "text-red-600"
                            : ""
                      }
                    >
                      {formatCurrency(periodTotals.overage)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(periodTotals.subsidyExpected)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        {/* Period Target vs Actual highlight */}
        {summary && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-white px-5 py-3">
              <span className="text-sm text-muted-foreground">
                Period Target Revenue
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(periodTargetRevenue)}
              </span>
            </div>
            <div
              className={`flex items-center justify-between rounded-lg border px-5 py-3 ${
                periodOverage > 0
                  ? "border-green-200 bg-green-50"
                  : periodOverage < 0
                    ? "border-red-200 bg-red-50"
                    : "border-border bg-white"
              }`}
            >
              <span className="text-sm text-muted-foreground">
                Period Overage
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  periodOverage > 0
                    ? "text-green-700"
                    : periodOverage < 0
                      ? "text-red-700"
                      : ""
                }`}
              >
                {formatCurrency(periodOverage)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── D. Carryforward Panel ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Carryforward
        </h2>
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            {/* Carryforward In */}
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Carryforward In
              </div>
              <div
                className={`text-xl font-bold tabular-nums ${
                  carryforwardIn > 0
                    ? "text-green-600"
                    : carryforwardIn < 0
                      ? "text-red-600"
                      : "text-foreground"
                }`}
              >
                {formatCurrency(carryforwardIn)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                From prior month
              </div>
            </div>

            {/* Visual flow arrow */}
            <div className="mx-6 flex items-center">
              <div className="h-px w-8 bg-border" />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              <div className="h-px w-8 bg-border" />
            </div>

            {/* Current Month Processing */}
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                This Month
              </div>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {monthRun.monthLabel}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Processing
              </div>
            </div>

            {/* Visual flow arrow */}
            <div className="mx-6 flex items-center">
              <div className="h-px w-8 bg-border" />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              <div className="h-px w-8 bg-border" />
            </div>

            {/* Carryforward Out */}
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Carryforward Out
              </div>
              <div
                className={`text-xl font-bold tabular-nums ${
                  carryforwardOut > 0
                    ? "text-green-600"
                    : carryforwardOut < 0
                      ? "text-red-600"
                      : "text-foreground"
                }`}
              >
                {formatCurrency(carryforwardOut)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                To next month
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── F. Override Section ────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Enter Actual Payment
        </h2>
        <div className="rounded-xl border border-border bg-white p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Enter the actual payment amount received from the payer. This will
            be compared against the expected subsidy payment to calculate any
            reconciliation delta.
          </p>
          <ActualPaymentForm monthRunId={id} currentValue={actualReceived} />
        </div>
      </section>
    </div>
  );
}
