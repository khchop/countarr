import ReactECharts from 'echarts-for-react';
import { chartTheme, extendedColorPalette } from './theme';

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

interface SankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
}

export function Sankey({ nodes, links, height = 300 }: SankeyProps) {
  // Handle empty data
  if (!nodes?.length || !links?.length) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No upgrade flow data available
      </div>
    );
  }

  // Filter out invalid links and convert to names
  const validLinks = links.filter(link => {
    const sourceNode = nodes[link.source];
    const targetNode = nodes[link.target];
    // Must have valid source and target, different nodes, and positive value
    return (
      sourceNode && 
      targetNode && 
      link.source !== link.target && 
      sourceNode.name !== targetNode.name &&
      link.value > 0
    );
  });

  // If no valid links after filtering, show empty state
  if (validLinks.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
      >
        No upgrade flow data available
      </div>
    );
  }

  // Convert source/target from indices to names
  const formattedLinks = validLinks.map(link => ({
    source: nodes[link.source].name,
    target: nodes[link.target].name,
    value: link.value,
  }));

  const option = {
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      trigger: 'item' as const,
      triggerOn: 'mousemove' as const,
      formatter: (params: any) => {
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}: ${params.data.value}`;
        }
        return params.name;
      },
    },
    series: [
      {
        type: 'sankey' as const,
        emphasis: {
          focus: 'adjacency' as const,
        },
        nodeAlign: 'left' as const,
        nodeGap: 15,
        nodeWidth: 20,
        layoutIterations: 32,
        data: nodes.map((node, index) => ({
          name: node.name,
          itemStyle: {
            color: extendedColorPalette[index % extendedColorPalette.length],
          },
        })),
        links: formattedLinks,
        label: {
          color: '#d8d9da',
          position: 'right' as const,
        },
        lineStyle: {
          color: 'gradient' as const,
          curveness: 0.5,
          opacity: 0.3,
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
