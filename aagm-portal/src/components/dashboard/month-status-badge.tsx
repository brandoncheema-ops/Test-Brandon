import { getStatusColor, getStatusLabel } from "@/lib/utils";

interface MonthStatusBadgeProps {
  status: string;
  className?: string;
}

export function MonthStatusBadge({ status, className = "" }: MonthStatusBadgeProps) {
  const colorClasses = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses} ${className}`}
    >
      {status === "in_review" && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 status-pulse" />
      )}
      {label}
    </span>
  );
}
