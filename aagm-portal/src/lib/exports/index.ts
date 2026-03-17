// Export utilities - barrel file
// PDF generation will be added in a future phase
// Current MVP uses CSV exports via server actions

export const EXPORT_TYPES = {
  summary_pdf: "Month Summary Report",
  invoice_pdf: "Invoice",
  month_report_pdf: "Month Report",
  csv_export: "Data Export (CSV)",
} as const;

export type ExportType = keyof typeof EXPORT_TYPES;

export function getExportTypeLabel(type: string): string {
  return EXPORT_TYPES[type as ExportType] || type;
}
