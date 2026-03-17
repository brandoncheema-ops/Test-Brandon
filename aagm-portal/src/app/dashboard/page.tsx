import Link from "next/link";
import { getMonthRuns } from "@/app/actions/months";
import { formatCurrency } from "@/lib/utils";
import { MonthStatusBadge } from "@/components/dashboard/month-status-badge";
import { CreateMonthDialog } from "@/components/dashboard/create-month-dialog";

export default async function DashboardPage() {
  const monthRuns = await getMonthRuns();

  const totalMonths = monthRuns.length;
  const finalizedCount = monthRuns.filter((m) => m.status === "finalized").length;
  const pendingCount = monthRuns.filter(
    (m) => m.status === "pending" || m.status === "needs_upload"
  ).length;

  const currentYear = new Date().getFullYear();
  const collectionsYTD = monthRuns
    .filter(
      (m) =>
        m.financialSummary &&
        m.periodKey.startsWith(String(currentYear))
    )
    .reduce((sum, m) => sum + (m.financialSummary?.collectionsTotal ?? 0), 0);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Monthly Runs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage monthly subsidy calculations and income guarantee
            payments.
          </p>
        </div>
        <CreateMonthDialog />
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Months" value={String(totalMonths)} />
        <SummaryCard
          label="Finalized"
          value={String(finalizedCount)}
          accent="text-green-700"
        />
        <SummaryCard
          label="Pending"
          value={String(pendingCount)}
          accent="text-amber-700"
        />
        <SummaryCard
          label="Collections YTD"
          value={formatCurrency(collectionsYTD)}
          mono
        />
      </div>

      {/* Month Runs Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {monthRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No month runs yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Get started by creating your first monthly run. The system will
              automatically assign the active contract version and calculate
              carryforward amounts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left">Month</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Contract</th>
                  <th className="px-4 py-3 text-right">Collections</th>
                  <th className="px-4 py-3 text-right">Invoice</th>
                  <th className="px-4 py-3 text-right">Expected Payment</th>
                  <th className="px-4 py-3 text-right">Actual Received</th>
                  <th className="px-4 py-3 text-center">Carryforward</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/months/${run.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {run.monthLabel}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <MonthStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {run.contractVersion?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(run.financialSummary?.collectionsTotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(
                        run.financialSummary?.invoiceAmount ??
                          run.contractVersion?.invoiceAmount
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatCurrency(run.financialSummary?.expectedPayment)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {run.financialSummary?.actualPaymentReceived != null
                        ? formatCurrency(
                            run.financialSummary.actualPaymentReceived
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {run.carryforwardIn !== 0 && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            In {formatCurrency(run.carryforwardIn)}
                          </span>
                        )}
                        {run.carryforwardOut !== 0 && (
                          <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                            Out {formatCurrency(run.carryforwardOut)}
                          </span>
                        )}
                        {run.carryforwardIn === 0 &&
                          run.carryforwardOut === 0 &&
                          "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/months/${run.id}`}
                        className="inline-flex items-center rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        aria-label={`View ${run.monthLabel}`}
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
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent ?? "text-foreground"
        } ${mono ? "tabular-nums" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
