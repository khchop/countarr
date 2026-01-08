import { useMemo, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { chartTheme, extendedColorPalette } from './theme';

interface PieData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieData[];
  height?: number;
  showLegend?: boolean;
  donut?: boolean;
}

export const PieChart = memo(function PieChart({
  data,
  height = 250,
  showLegend = true,
  donut = true,
}: PieChartProps) {
  const hasData = data?.length > 0 && data.some(d => d.value > 0);

  const option: EChartsOption = useMemo(() => ({
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: showLegend ? {
      ...chartTheme.legend,
      orient: 'vertical',
      right: 10,
      top: 'center',
      type: 'scroll',
    } : undefined,
    series: [
      {
        type: 'pie',
        radius: donut ? ['50%', '70%'] : '70%',
        center: showLegend ? ['35%', '50%'] : ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#181b1f',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#d8d9da',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
        data: data?.map((d, index) => ({
          name: d.label,
          value: d.value,
          itemStyle: {
            color: d.color || extendedColorPalette[index % extendedColorPalette.length],
          },
        })) ?? [],
      },
    ],
  }), [data, showLegend, donut]);

  // Handle empty data
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
