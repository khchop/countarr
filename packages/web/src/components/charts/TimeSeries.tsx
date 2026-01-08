import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { chartTheme, extendedColorPalette } from './theme';

interface TimeSeriesData {
  label: string;
  data: Array<{ timestamp: string; value: number }>;
  color?: string;
}

interface TimeSeriesProps {
  data: TimeSeriesData[];
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
  area?: boolean;
  stacked?: boolean;
  smooth?: boolean;
}

export function TimeSeries({
  data,
  height = 250,
  showLegend = true,
  yAxisLabel,
  area = true,
  stacked = false,
  smooth = true,
}: TimeSeriesProps) {
  // Handle empty data
  const hasData = data?.length > 0 && data.some(s => s.data?.length > 0);
  if (!hasData) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  // For stacked charts, we need to ensure all series have values for all dates
  // to avoid gaps/holes in the visualization
  let processedData = data;
  if (stacked) {
    // Collect all unique timestamps
    const allTimestamps = new Set<string>();
    data.forEach(series => {
      series.data.forEach(d => allTimestamps.add(d.timestamp));
    });
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Fill in missing timestamps with 0 values for each series
    processedData = data.map(series => {
      const dataMap = new Map(series.data.map(d => [d.timestamp, d.value]));
      return {
        ...series,
        data: sortedTimestamps.map(ts => ({
          timestamp: ts,
          value: dataMap.get(ts) ?? 0,
        })),
      };
    });
  }

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: '#3274d9',
          opacity: 0.5,
        },
      },
    },
    legend: showLegend && processedData.length > 1 ? {
      ...chartTheme.legend,
      bottom: 0,
      type: 'scroll',
      data: processedData.map(d => d.label),
    } : undefined,
    grid: {
      left: 50,
      right: 20,
      top: 20,
      // More space for legends with many items (2 rows typical)
      bottom: showLegend && processedData.length > 1 
        ? (processedData.length > 4 ? 70 : 50) 
        : 30,
    },
    xAxis: {
      ...chartTheme.xAxis,
      type: 'time' as const,
    },
    yAxis: {
      ...chartTheme.yAxis,
      type: 'value',
      name: yAxisLabel,
      nameTextStyle: {
        color: '#8e8e8e',
      },
      splitNumber: 4,
      minInterval: 1, // For count data, use integers
    },
    series: processedData.map((series, index) => {
      const color = series.color || extendedColorPalette[index % extendedColorPalette.length];
      return {
        name: series.label,
        type: 'line',
        smooth: stacked ? false : smooth, // Don't smooth stacked charts
        symbol: 'none',
        sampling: 'lttb',
        stack: stacked ? 'total' : undefined,
        areaStyle: area ? {
          opacity: stacked ? 0.85 : 0.3,
        } : undefined,
        lineStyle: {
          width: stacked ? 0 : 2, // Hide line for stacked (area only)
          color,
        },
        itemStyle: {
          color,
        },
        data: series.data.map(d => [d.timestamp, d.value]),
      };
    }),
  };

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: 'canvas' }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
}
