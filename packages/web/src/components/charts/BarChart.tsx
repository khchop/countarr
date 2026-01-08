import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { chartTheme, extendedColorPalette } from './theme';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  horizontal?: boolean;
  /** For horizontal charts: if true, reverses data so first item appears at top (use for ranked data) */
  invertY?: boolean;
}

export function BarChart({
  data,
  height = 250,
  horizontal = false,
  invertY = false,
}: BarChartProps) {
  // Handle empty data
  if (!data?.length || data.every(d => d.value === 0)) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  // For horizontal bar charts with invertY, reverse the data so first item appears at top
  // ECharts renders Y-axis categories from bottom to top by default
  // Use invertY=true for ranked data (e.g., "Top Networks" where highest should be at top)
  // Use invertY=false for sequential data (e.g., decades where chronological order matters)
  const chartData = (horizontal && invertY) ? [...data].reverse() : data;

  const categoryAxis = {
    type: 'category' as const,
    data: chartData.map(d => d.label),
    axisLabel: {
      color: '#8e8e8e',
      rotate: horizontal ? 0 : 45,
    },
    axisLine: {
      lineStyle: { color: '#2a2e33' },
    },
  };

  const valueAxis = {
    type: 'value' as const,
    axisLabel: { color: '#8e8e8e' },
    splitLine: {
      lineStyle: { color: '#1f2229' },
    },
  };

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: horizontal ? 100 : 40,
      right: 20,
      top: 20,
      bottom: horizontal ? 30 : 60,
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [
      {
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
        data: chartData.map((d, index) => ({
          value: d.value,
          itemStyle: {
            color: d.color || extendedColorPalette[index % extendedColorPalette.length],
          },
        })),
      },
    ],
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
