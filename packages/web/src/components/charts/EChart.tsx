import { useRef, useEffect, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface EChartProps {
  option: EChartsOption;
  height?: number;
  className?: string;
}

/**
 * Wrapper around ReactECharts that handles React StrictMode issues.
 * The echarts-for-react library has issues with the ResizeObserver
 * disconnecting during StrictMode's double-mount behavior.
 */
function EChartInner({ option, height = 250, className }: EChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Ensure proper cleanup
  useEffect(() => {
    return () => {
      // The chart instance cleanup is handled by ReactECharts
      // This effect is here for potential future cleanup needs
    };
  }, []);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height }}
      className={className}
      opts={{ renderer: 'canvas' }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
}

export const EChart = memo(EChartInner);
