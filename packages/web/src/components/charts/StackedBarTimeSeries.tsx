import { useMemo, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { chartTheme, extendedColorPalette } from './theme';
import {
  determineGranularity,
  aggregateData,
  formatPeriodLabel,
  collectAllDates,
  createSeriesDataMaps,
  hasTimeSeriesData,
  type TimeSeriesData,
} from '@/utils/timeAggregation';

interface StackedBarTimeSeriesProps {
  data: TimeSeriesData[];
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
}

// Generate a consistent color for a label using a simple hash
// This ensures the same label always gets the same color regardless of order
function getColorForLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    // Mix in character code with position weighting
    hash = (hash * 31 + label.charCodeAt(i) * (i + 1)) | 0;
  }
  // Add length to the hash for better distribution of short strings
  hash = (hash * 17 + label.length * 7) | 0;
  
  // Use absolute value and mod to get index
  const index = Math.abs(hash) % extendedColorPalette.length;
  return extendedColorPalette[index];
}

/**
 * Stacked bar chart for time series data.
 * Better for discrete counts (like plays per day) than area charts.
 * Auto-adjusts granularity based on date range.
 * Memoized to prevent unnecessary re-renders and animation replays.
 */
export const StackedBarTimeSeries = memo(function StackedBarTimeSeries({
  data,
  height = 250,
  showLegend = true,
  yAxisLabel,
}: StackedBarTimeSeriesProps) {
  // Check if we have data
  const hasData = hasTimeSeriesData(data);

  // Memoize all computations - always run hooks in same order
  const option: EChartsOption | null = useMemo(() => {
    if (!hasData) return null;
    
    const allDates = collectAllDates(data);
    const granularity = determineGranularity(allDates);
    const { aggregatedData, periods } = aggregateData(data, granularity);
    const seriesDataMaps = createSeriesDataMaps(aggregatedData);

    return {
      ...chartTheme,
      tooltip: {
        ...chartTheme.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: showLegend && aggregatedData.length > 1 ? {
        ...chartTheme.legend,
        bottom: 0,
        data: aggregatedData.map(d => d.label),
      } : undefined,
      grid: {
        left: 50,
        right: 20,
        top: 20,
        bottom: showLegend && aggregatedData.length > 1 ? 50 : 30,
      },
      xAxis: {
        ...chartTheme.xAxis,
        type: 'category' as const,
        data: periods,
        axisLabel: {
          color: '#8e8e8e',
          formatter: (value: string) => formatPeriodLabel(value, granularity),
          rotate: periods.length > 20 ? 45 : 0,
        },
      },
      yAxis: {
        ...chartTheme.yAxis,
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: {
          color: '#8e8e8e',
        },
        splitNumber: 4,
        minInterval: 1,
      },
      series: aggregatedData.map((series, index) => {
        const color = series.color || getColorForLabel(series.label);
        const dataMap = seriesDataMaps[index];
        
        return {
          name: series.label,
          type: 'bar',
          stack: 'total',
          barWidth: '60%',
          itemStyle: {
            color,
          },
          emphasis: {
            focus: 'series',
          },
          data: periods.map(period => dataMap.get(period) ?? 0),
        };
      }),
    };
  }, [data, hasData, showLegend, yAxisLabel]);

  // Handle empty data - after all hooks
  if (!option) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: 'canvas' }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
});
