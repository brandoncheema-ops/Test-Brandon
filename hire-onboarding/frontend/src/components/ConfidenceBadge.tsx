import { ConfidenceLevel } from '../types';

const COLORS: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.HIGH]: 'bg-green-100 text-green-800',
  [ConfidenceLevel.MEDIUM]: 'bg-yellow-100 text-yellow-800',
  [ConfidenceLevel.LOW]: 'bg-red-100 text-red-800',
};

interface Props {
  confidence: ConfidenceLevel;
}

export default function ConfidenceBadge({ confidence }: Props) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${COLORS[confidence]}`}
    >
      {confidence}
    </span>
  );
}
