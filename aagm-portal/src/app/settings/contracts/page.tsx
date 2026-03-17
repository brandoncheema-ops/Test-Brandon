import { getContractVersions, getLocationAliases } from "@/app/actions/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreateContractDialog } from "@/components/contracts/create-contract-dialog";
import { CreateAliasDialog } from "@/components/contracts/create-alias-dialog";

export default async function ContractSettingsPage() {
  const [contracts, aliases] = await Promise.all([
    getContractVersions(),
    getLocationAliases(),
  ]);

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contract Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage contract versions, effective dates, and location aliases
          </p>
        </div>
        <CreateContractDialog />
      </div>

      {/* Contract Versions */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Contract Versions</h2>
        <div className="space-y-4">
          {contracts.map((contract) => {
            let locations: string[] = [];
            try {
              locations = JSON.parse(contract.includedLocations);
            } catch {
              // empty
            }

            return (
              <div
                key={contract.id}
                className="rounded-xl border border-border bg-white p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{contract.name}</h3>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {contract.code}
                      </span>
                      {contract.isActive && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Effective: {formatDate(contract.effectiveStartDate)}
                      {contract.effectiveEndDate
                        ? ` — ${formatDate(contract.effectiveEndDate)}`
                        : " — No end date"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">
                      {contract._count.monthRuns} month
                      {contract._count.monthRuns !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Invoice Amount
                    </span>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {formatCurrency(contract.invoiceAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Required Monthly Revenue
                    </span>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {contract.requiredMonthlyRevenue
                        ? formatCurrency(contract.requiredMonthlyRevenue)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Period Target Revenue
                    </span>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {contract.quarterTargetRevenue
                        ? formatCurrency(contract.quarterTargetRevenue)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Period Length
                    </span>
                    <p className="mt-1 text-lg font-semibold">
                      {contract.periodMonths} month
                      {contract.periodMonths !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Annual figures */}
                {(contract.annualFmvExpense ||
                  contract.annualRequiredRevenue ||
                  contract.maxAnnualSubsidy) && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    {contract.annualFmvExpense && (
                      <div className="rounded-lg bg-blue-50/50 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                          Annual FMV Expense
                        </span>
                        <p className="mt-1 font-semibold tabular-nums text-blue-900">
                          {formatCurrency(contract.annualFmvExpense)}
                        </p>
                      </div>
                    )}
                    {contract.annualRequiredRevenue && (
                      <div className="rounded-lg bg-blue-50/50 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                          Annual Required Revenue
                        </span>
                        <p className="mt-1 font-semibold tabular-nums text-blue-900">
                          {formatCurrency(contract.annualRequiredRevenue)}
                        </p>
                      </div>
                    )}
                    {contract.maxAnnualSubsidy && (
                      <div className="rounded-lg bg-blue-50/50 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                          Max Annual Subsidy
                        </span>
                        <p className="mt-1 font-semibold tabular-nums text-blue-900">
                          {formatCurrency(contract.maxAnnualSubsidy)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Locations */}
                <div className="mt-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Included Locations
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {locations.map((loc) => (
                      <span
                        key={loc}
                        className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>

                {contract.notes && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {contract.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Location Aliases */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Location Aliases</h2>
          <CreateAliasDialog />
        </div>
        <div className="rounded-xl border border-border bg-white">
          <table className="data-table w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">Source Value</th>
                <th className="px-4 py-3 text-left">Canonical Location</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((alias) => (
                <tr
                  key={alias.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-sm font-mono">
                    {alias.sourceValue}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {alias.canonicalValue}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        alias.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {alias.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {aliases.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No location aliases configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
