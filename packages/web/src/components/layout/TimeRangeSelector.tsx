import { create } from 'zustand';
import type { TimeRange } from '@/api/client';

interface TimeRangeState {
  range: TimeRange;
  setRange: (range: TimeRange) => void;
}

export const useTimeRange = create<TimeRangeState>((set) => ({
  range: '30d',
  setRange: (range) => set({ range }),
}));

const ranges: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
];

export function TimeRangeSelector() {
  const { range, setRange } = useTimeRange();

  return (
    <div className="flex items-center bg-background rounded-lg border border-border p-1">
      {ranges.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setRange(value)}
          className={`time-range-btn ${range === value ? 'active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
