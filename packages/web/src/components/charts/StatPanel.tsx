import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatBytes, formatDuration, formatNumber } from '@/utils/format';

interface StatPanelProps {
  title: string;
  value: number | string;
  unit?: 'bytes' | 'duration' | 'number' | 'percent' | 'score' | 'none' | 'text';
  trend?: number; // Percentage change
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan';
  className?: string;
}

const colorClasses = {
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  yellow: 'text-accent-yellow',
  red: 'text-accent-red',
  purple: 'text-accent-purple',
  cyan: 'text-accent-cyan',
};

export function StatPanel({
  title,
  value,
  unit = 'number',
  trend,
  subtitle,
  color = 'blue',
  className = '',
}: StatPanelProps) {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    switch (unit) {
      case 'bytes':
        return formatBytes(val);
      case 'duration':
        return formatDuration(val);
      case 'number':
        return formatNumber(val);
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'score':
        return `${Math.round(val)}/100`;
      case 'none':
      case 'text':
        return String(val);
      default:
        return String(val);
    }
  };

  const TrendIcon = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <div className={`panel p-4 ${className}`.trim()}>
      <p className="text-sm text-text-muted mb-1">{title}</p>
      <div className="flex items-end justify-between">
        <p className={`text-3xl font-semibold stat-value ${colorClasses[color]}`}>
          {formatValue(value)}
        </p>
        {trend !== undefined && TrendIcon && (
          <div
            className={`flex items-center text-sm ${
              trend > 0
                ? 'text-accent-green'
                : trend < 0
                ? 'text-accent-red'
                : 'text-text-muted'
            }`}
          >
            <TrendIcon className="w-4 h-4 mr-1" />
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-text-muted mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export function StatPanelSkeleton() {
  return (
    <div className="panel p-4">
      <div className="h-4 w-24 skeleton rounded mb-2" />
      <div className="h-9 w-32 skeleton rounded" />
    </div>
  );
}
