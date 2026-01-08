import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, PieChart, Heatmap, BarChart, StackedBarTimeSeries, BarTimeSeries } from '@/components/charts';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { useOverviewStats, useDownloadStats, useQualityStats, useReleaseGroupStats, useRecordStats } from '@/hooks/useStats';
import { formatBytes, formatDate } from '@/utils/format';

export default function Dashboard() {
  const { data: overview, isLoading: loadingOverview, isFetching: fetchingOverview, isPlaceholderData: placeholderOverview, error: overviewError, refetch: refetchOverview } = useOverviewStats();
  const { data: downloads, isLoading: loadingDownloads, isFetching: fetchingDownloads, isPlaceholderData: placeholderDownloads, error: downloadsError, refetch: refetchDownloads } = useDownloadStats();
  const { data: quality, isLoading: loadingQuality, isFetching: fetchingQuality, isPlaceholderData: placeholderQuality, error: qualityError, refetch: refetchQuality } = useQualityStats();
  const { data: releaseGroups, isLoading: loadingGroups, isFetching: fetchingGroups, isPlaceholderData: placeholderGroups, error: groupsError, refetch: refetchGroups } = useReleaseGroupStats();
  const { data: records, isLoading: loadingRecords, isFetching: fetchingRecords, isPlaceholderData: placeholderRecords, error: recordsError, refetch: refetchRecords } = useRecordStats();

  return (
    <div className="space-y-6">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <QuerySection
          isLoading={loadingOverview}
          isFetching={fetchingOverview}
          isPlaceholderData={placeholderOverview}
          data={overview}
          error={overviewError}
          onRetry={refetchOverview}
          skeleton={
            <>
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
            </>
          }
        >
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
            title="Movies"
            value={overview?.movies ?? 0}
            unit="number"
            color="yellow"
          />
          <StatPanel
            title="Series"
            value={overview?.series ?? 0}
            unit="number"
            color="purple"
          />
          <StatPanel
            title="Quality Score"
            value={overview?.avgQualityScore.value ?? 0}
            unit="score"
            color="blue"
          />
          <StatPanel
            title="Upgrades"
            value={overview?.totalUpgrades.value ?? 0}
            unit="number"
            color="green"
          />
        </QuerySection>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingDownloads}
          isFetching={fetchingDownloads}
          isPlaceholderData={placeholderDownloads}
          data={downloads}
          error={downloadsError}
          onRetry={refetchDownloads}
          skeleton={
            <>
              <PanelSkeleton />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Downloads Over Time" subtitle="Stacked by source">
            <StackedBarTimeSeries
              data={downloads?.byDay ?? []}
              height={280}
            />
          </Panel>
          <Panel title="Download Size Over Time" subtitle="GB per day">
            <BarTimeSeries
              data={downloads?.sizeByDay ?? []}
              height={280}
              yAxisLabel="GB"
              valueFormatter={(v) => `${v.toFixed(1)} GB`}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuerySection
          isLoading={loadingDownloads || loadingQuality}
          isFetching={fetchingDownloads || fetchingQuality}
          isPlaceholderData={placeholderDownloads || placeholderQuality}
          data={downloads && quality ? { downloads, quality } : undefined}
          error={downloadsError || qualityError}
          onRetry={() => {
            if (downloadsError) refetchDownloads();
            if (qualityError) refetchQuality();
          }}
          skeleton={
            <>
              <PanelSkeleton />
              <PanelSkeleton />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Resolution Distribution">
            <PieChart
              data={quality?.resolutionDistribution ?? []}
              height={220}
            />
          </Panel>
          <Panel title="Source Distribution">
            <PieChart
              data={quality?.sourceDistribution ?? []}
              height={220}
            />
          </Panel>
          <Panel title="Downloads by App">
            <PieChart
              data={downloads?.byApp ?? []}
              height={220}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Heatmap & Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QuerySection
          isLoading={loadingDownloads}
          isFetching={fetchingDownloads}
          isPlaceholderData={placeholderDownloads}
          data={downloads}
          error={downloadsError}
          onRetry={refetchDownloads}
          skeleton={
            <>
              <PanelSkeleton className="lg:col-span-2" />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Download Activity Heatmap" subtitle="By hour and day" className="lg:col-span-2">
            <Heatmap
              data={downloads?.heatmap ?? []}
              height={200}
            />
          </Panel>
          <Panel title="Downloads by Day">
            <BarChart
              data={downloads?.byDayOfWeek ?? []}
              height={200}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingGroups}
          isFetching={fetchingGroups}
          isPlaceholderData={placeholderGroups}
          data={releaseGroups}
          error={groupsError}
          onRetry={refetchGroups}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Top Release Groups" subtitle="By download count" noPadding>
            <DataTable
              data={(releaseGroups?.groups ?? []).slice(0, 10).map((g, i) => ({
                rank: i + 1,
                releaseGroup: g.releaseGroup,
                downloads: g.totalDownloads,
                totalSize: g.totalSizeBytes,
              }))}
              columns={[
                { key: 'rank', header: '#', width: '40px' },
                { key: 'releaseGroup', header: 'Release Group' },
                { key: 'downloads', header: 'Downloads', align: 'right', sortable: true },
                {
                  key: 'totalSize',
                  header: 'Total Size',
                  align: 'right',
                  render: (val) => formatBytes(val),
                  sortable: true,
                },
              ]}
              keyField="rank"
              maxHeight="max-h-[300px]"
            />
          </Panel>
        </QuerySection>

        <QuerySection
          isLoading={loadingRecords}
          isFetching={fetchingRecords}
          isPlaceholderData={placeholderRecords}
          data={records}
          error={recordsError}
          onRetry={refetchRecords}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Records & Extremes" noPadding>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-muted">Biggest File</span>
                <div className="text-right">
                  <p className="font-medium">{records?.biggestFile?.title ?? 'N/A'}</p>
                  <p className="text-sm text-accent-blue">{formatBytes(records?.biggestFile?.sizeBytes ?? 0)}</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-muted">Most Upgraded</span>
                <div className="text-right">
                  <p className="font-medium">{records?.mostUpgradedItem?.title ?? 'N/A'}</p>
                  <p className="text-sm text-accent-purple">{records?.mostUpgradedItem?.upgradeCount ?? 0} upgrades</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-muted">Busiest Day</span>
                <div className="text-right">
                  <p className="font-medium">{records?.busiestDay?.date ? formatDate(records.busiestDay.date) : 'N/A'}</p>
                  <p className="text-sm text-accent-green">{records?.busiestDay?.downloads ?? 0} downloads</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-text-muted">Longest Upgrade Wait</span>
                <div className="text-right">
                  <p className="font-medium">{records?.longestUpgradeWait?.title ?? 'N/A'}</p>
                  <p className="text-sm text-accent-yellow">{records?.longestUpgradeWait?.days ?? 0} days</p>
                </div>
              </div>
            </div>
          </Panel>
        </QuerySection>
      </div>
    </div>
  );
}
