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

interface BarTimeSeriesProps {
  data: TimeSeriesData[];
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
  /** Format function for tooltip values */
  valueFormatter?: (value: number) => string;
}

/**
 * Simple bar chart for time series data (non-stacked).
 * Good for single-series data like "Download Size per day".
 * Auto-adjusts granularity based on date range.
 * Memoized to prevent unnecessary re-renders and animation replays.
 */
export const BarTimeSeries = memo(function BarTimeSeries({
  data,
  height = 250,
  showLegend = false,
  yAxisLabel,
  valueFormatter,
}: BarTimeSeriesProps) {
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
        valueFormatter: valueFormatter ? (value) => valueFormatter(Number(value)) : undefined,
      },
      legend: showLegend && aggregatedData.length > 1 ? {
        ...chartTheme.legend,
        bottom: 0,
        data: aggregatedData.map(d => d.label),
      } : undefined,
      grid: {
        left: 60,
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
        axisLabel: {
          color: '#8e8e8e',
          formatter: valueFormatter,
        },
      },
      series: aggregatedData.map((series, index) => {
        const color = series.color || extendedColorPalette[index % extendedColorPalette.length];
        const dataMap = seriesDataMaps[index];
        
        return {
          name: series.label,
          type: 'bar',
          barWidth: '60%',
          itemStyle: {
            color,
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            focus: 'series',
          },
          data: periods.map(period => dataMap.get(period) ?? 0),
        };
      }),
    };
  }, [data, hasData, showLegend, yAxisLabel, valueFormatter]);

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
