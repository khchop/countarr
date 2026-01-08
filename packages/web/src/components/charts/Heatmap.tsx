import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { chartTheme } from './theme';

interface HeatmapProps {
  data: number[][]; // [day][hour] matrix
  height?: number;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export function Heatmap({ data, height = 200 }: HeatmapProps) {
  // Handle empty data
  if (!data?.length || data.every(row => !row?.length || row.every(v => v === 0))) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No activity data available
      </div>
    );
  }

  // Convert matrix to ECharts format: [x, y, value]
  const heatmapData: [number, number, number][] = [];
  let max = 0;

  data.forEach((dayData, dayIndex) => {
    (dayData || []).forEach((value, hourIndex) => {
      heatmapData.push([hourIndex, dayIndex, value]);
      if (value > max) max = value;
    });
  });

  const option: EChartsOption = {
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      position: 'top',
      formatter: (params: any) => {
        const [hour, day, value] = params.data;
        return `${days[day]} ${hours[hour]}: ${value} downloads`;
      },
    },
    grid: {
      left: 50,
      right: 20,
      top: 10,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      data: hours,
      splitArea: { show: true },
      axisLabel: {
        color: '#8e8e8e',
        interval: 3, // Show every 4th label
      },
      axisLine: { lineStyle: { color: '#2a2e33' } },
    },
    yAxis: {
      type: 'category',
      data: days,
      splitArea: { show: true },
      axisLabel: { color: '#8e8e8e' },
      axisLine: { lineStyle: { color: '#2a2e33' } },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      show: false,
      inRange: {
        color: ['#181b1f', '#1a3a5c', '#3274d9', '#5794f2'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
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
