import type { EChartsOption } from 'echarts';

// Grafana-inspired dark theme for ECharts
export const chartTheme: EChartsOption = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#d8d9da',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  title: {
    textStyle: {
      color: '#d8d9da',
    },
    subtextStyle: {
      color: '#8e8e8e',
    },
  },
  legend: {
    textStyle: {
      color: '#d8d9da',
    },
  },
  tooltip: {
    backgroundColor: '#1f2229',
    borderColor: '#2a2e33',
    textStyle: {
      color: '#d8d9da',
    },
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#2a2e33',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#2a2e33',
      },
    },
    axisLabel: {
      color: '#8e8e8e',
    },
    splitLine: {
      lineStyle: {
        color: '#1f2229',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#2a2e33',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#2a2e33',
      },
    },
    axisLabel: {
      color: '#8e8e8e',
    },
    splitLine: {
      lineStyle: {
        color: '#1f2229',
      },
    },
  },
  grid: {
    borderColor: '#2a2e33',
  },
};

export const colors = {
  blue: '#3274d9',
  green: '#73bf69',
  yellow: '#ff9830',
  red: '#f2495c',
  purple: '#b877d9',
  cyan: '#5794f2',
  orange: '#ff780a',
  teal: '#1f978a',
};

export const colorPalette = [
  colors.blue,
  colors.green,
  colors.yellow,
  colors.red,
  colors.purple,
  colors.cyan,
  colors.orange,
  colors.teal,
];

// Extended palette with more distinct colors for better differentiation
export const extendedColorPalette = [
  '#3274d9', // blue
  '#73bf69', // green  
  '#f2495c', // red
  '#ff9830', // yellow/orange
  '#b877d9', // purple
  '#1f978a', // teal
  '#ff780a', // orange
  '#5794f2', // light blue
  '#e74c3c', // red variant
  '#27ae60', // green variant
  '#8e44ad', // purple variant
  '#f39c12', // gold
  '#16a085', // teal variant
  '#2980b9', // blue variant
  '#c0392b', // dark red
  '#d35400', // burnt orange
];
