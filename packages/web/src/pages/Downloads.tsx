import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, TimeSeries, PieChart, Heatmap, BarChart } from '@/components/charts';
import { useOverviewStats, useDownloadStats } from '@/hooks/useStats';

export default function Downloads() {
  const { data: overview, isLoading: loadingOverview } = useOverviewStats();
  const { data: downloads, isLoading: loadingDownloads } = useDownloadStats();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingOverview ? (
          <>
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
          </>
        ) : (
          <>
            <StatPanel
              title="Total Downloads"
              value={overview?.totalDownloads.value ?? 0}
              unit="number"
              color="blue"
            />
            <StatPanel
              title="Total Size"
              value={overview?.totalSizeBytes.value ?? 0}
              unit="bytes"
              color="green"
            />
            <StatPanel
              title="Movies Downloaded"
              value={overview?.movies ?? 0}
              unit="number"
              color="yellow"
            />
            <StatPanel
              title="Episodes Downloaded"
              value={overview?.episodes ?? 0}
              unit="number"
              color="purple"
            />
          </>
        )}
      </div>

      {/* Time Series */}
      <div className="grid grid-cols-1 gap-4">
        {loadingDownloads ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Downloads Over Time" subtitle="Daily download activity by source">
            <TimeSeries
              data={downloads?.byDay ?? []}
              height={350}
              stacked
              showLegend
            />
          </Panel>
        )}
      </div>

      {/* Size Time Series */}
      <div className="grid grid-cols-1 gap-4">
        {loadingDownloads ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Download Volume" subtitle="GB downloaded per day">
            <TimeSeries
              data={downloads?.sizeByDay ?? []}
              height={300}
              yAxisLabel="GB"
            />
          </Panel>
        )}
      </div>

      {/* Heatmap */}
      <div className="grid grid-cols-1 gap-4">
        {loadingDownloads ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Activity Heatmap" subtitle="Download activity by hour and day of week">
            <Heatmap
              data={downloads?.heatmap ?? []}
              height={250}
            />
          </Panel>
        )}
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingDownloads ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Downloads by Day of Week">
              <BarChart
                data={downloads?.byDayOfWeek ?? []}
                height={250}
              />
            </Panel>
            <Panel title="Downloads by Source App">
              <PieChart
                data={downloads?.byApp ?? []}
                height={250}
              />
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
