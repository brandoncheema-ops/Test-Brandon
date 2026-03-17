import { notFound } from "next/navigation";
import { getMonthRun } from "@/app/actions/months";
import {
  formatCurrency,
  formatNumber,
  formatDate,
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
import { Badge } from "@/components/ui/badge";
import {
  ConfirmAllButton,
  RowActions,
  ReviewStatusBadge,
} from "@/components/uploads/review-actions";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const monthRun = await getMonthRun(id);
  if (!monthRun) notFound();

  const { collectionsRows, expenseRows, uploadFiles } = monthRun;

  /* ---------------------------------------------------------------- */
  /*  Computed values                                                  */
  /* ---------------------------------------------------------------- */

  const collectionsTotal = collectionsRows.reduce(
    (acc, r) => ({
      payments: acc.payments + (r.payments ?? 0),
      refunds: acc.refunds + (r.refunds ?? 0),
      netCollections: acc.netCollections + (r.netCollections ?? 0),
      units: acc.units + (r.units ?? 0),
    }),
    { payments: 0, refunds: 0, netCollections: 0, units: 0 }
  );

  const expensesTotal = expenseRows.reduce(
    (acc, r) => acc + (r.amount ?? 0),
    0
  );

  const pendingCount =
    collectionsRows.filter((r) => r.reviewStatus === "pending").length +
    expenseRows.filter((r) => r.reviewStatus === "pending").length;

  /* Location mapping: raw -> canonical */
  const locationMappings = collectionsRows.reduce<
    Record<string, string | null>
  >((map, r) => {
    if (r.sourceLocationRaw && !(r.sourceLocationRaw in map)) {
      map[r.sourceLocationRaw] = r.sourceLocationCanonical;
    }
    return map;
  }, {});

  const unmappedLocations = Object.entries(locationMappings)
    .filter(([, canonical]) => !canonical)
    .map(([raw]) => raw);

  const zeroValueCollections = collectionsRows.filter(
    (r) => (r.netCollections ?? 0) === 0
  );
  const zeroValueExpenses = expenseRows.filter((r) => (r.amount ?? 0) === 0);

  /* Expected file categories */
  const expectedCategories = [
    "collections",
    "expenses",
    "adjustments",
  ];
  const uploadedCategories = new Set(
    uploadFiles.map((f) => f.category?.toLowerCase())
  );
  const missingCategories = expectedCategories.filter(
    (c) => !uploadedCategories.has(c)
  );

  const hasWarnings =
    unmappedLocations.length > 0 ||
    zeroValueCollections.length > 0 ||
    zeroValueExpenses.length > 0 ||
    missingCategories.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Parse status helpers                                             */
  /* ---------------------------------------------------------------- */

  function parseStatusBadge(status: string | null) {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return <Badge variant="info">Processing</Badge>;
      default:
        return <Badge variant="secondary">{status ?? "Pending"}</Badge>;
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Upload Review &mdash; {monthRun.monthLabel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review parsed data before running calculations. Status:{" "}
              <span className="font-medium">
                {getStatusLabel(monthRun.status)}
              </span>
            </p>
          </div>
          {/* G. Confirm / flag actions */}
          <ConfirmAllButton monthRunId={id} pendingCount={pendingCount} />
        </div>
      </div>

      {/* ── F. Validation Summary ─────────────────────────────────── */}
      {hasWarnings && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-amber-800">
              Validation Warnings
            </h2>
          </div>
          <ul className="space-y-1.5 text-sm text-amber-700">
            {unmappedLocations.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>
                  <strong>{unmappedLocations.length}</strong> unmapped location
                  {unmappedLocations.length !== 1 ? "s" : ""}:{" "}
                  {unmappedLocations.join(", ")}
                </span>
              </li>
            )}
            {zeroValueCollections.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>
                  <strong>{zeroValueCollections.length}</strong> collection row
                  {zeroValueCollections.length !== 1 ? "s" : ""} with zero net
                  value
                </span>
              </li>
            )}
            {zeroValueExpenses.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>
                  <strong>{zeroValueExpenses.length}</strong> expense row
                  {zeroValueExpenses.length !== 1 ? "s" : ""} with zero amount
                </span>
              </li>
            )}
            {missingCategories.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>
                  Missing file categories:{" "}
                  <strong>{missingCategories.join(", ")}</strong>
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── B. Upload Files ───────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Upload Files
        </h2>
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Filename</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Parse Status</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadFiles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No files uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                uploadFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      {file.originalFilename}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {file.category ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>{parseStatusBadge(file.parseStatus)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(file.uploadedAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {file.parseNotes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── C. Collections Review ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Collections Review
        </h2>
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
                <TableHead className="text-right">Net Collections</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectionsRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No collection rows parsed.
                  </TableCell>
                </TableRow>
              ) : (
                collectionsRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.reviewStatus === "excluded" ? "opacity-50" : ""
                    }
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {row.sourceLocationCanonical || (
                            <span className="italic text-amber-600">
                              Unmapped
                            </span>
                          )}
                        </span>
                        {row.sourceLocationRaw !==
                          row.sourceLocationCanonical && (
                          <span className="block text-xs text-muted-foreground">
                            raw: {row.sourceLocationRaw}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.payments)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.refunds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.netCollections)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.units)}
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={row.reviewStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        type="collections"
                        rowId={row.id}
                        currentStatus={row.reviewStatus}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {collectionsRows.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(collectionsTotal.payments)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(collectionsTotal.refunds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(collectionsTotal.netCollections)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(collectionsTotal.units)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>

      {/* ── D. Location Mapping ───────────────────────────────────── */}
      {Object.keys(locationMappings).length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Location Mapping
          </h2>
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Raw Location</span>
                <span>Canonical Location</span>
              </div>
              {Object.entries(locationMappings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([raw, canonical]) => (
                  <div
                    key={raw}
                    className={`grid grid-cols-2 gap-4 rounded-md px-2 py-1.5 text-sm ${
                      !canonical
                        ? "bg-amber-50 border border-amber-200"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <span className="font-mono text-muted-foreground">
                      {raw}
                    </span>
                    <span
                      className={
                        canonical
                          ? "font-medium"
                          : "italic text-amber-600 font-medium"
                      }
                    >
                      {canonical || "UNMAPPED"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ── E. Expenses Review ────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Expenses Review
        </h2>
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No expense rows parsed.
                  </TableCell>
                </TableRow>
              ) : (
                expenseRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.reviewStatus === "excluded" ? "opacity-50" : ""
                    }
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {row.categoryCanonical || row.categoryRaw}
                        </span>
                        {row.categoryRaw !== row.categoryCanonical &&
                          row.categoryCanonical && (
                            <span className="block text-xs text-muted-foreground">
                              raw: {row.categoryRaw}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={row.reviewStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        type="expenses"
                        rowId={row.id}
                        currentStatus={row.reviewStatus}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {expenseRows.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(expensesTotal)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>
    </div>
  );
}
