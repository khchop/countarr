import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, PieChart } from '@/components/charts';
import { StackedBarTimeSeries } from '@/components/charts/StackedBarTimeSeries';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { useIndexerStats } from '@/hooks/useStats';
import { formatBytes, formatNumber } from '@/utils/format';

export default function Indexers() {
  const { data: stats, isLoading, isFetching, isPlaceholderData, error, refetch } = useIndexerStats();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuerySection
          isLoading={isLoading}
          isFetching={isFetching}
          isPlaceholderData={isPlaceholderData}
          data={stats}
          error={error}
          onRetry={refetch}
          skeleton={
            <>
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
            </>
          }
        >
          <StatPanel
            title="Total Grabs"
            value={stats?.overview.totalGrabs ?? 0}
            unit="number"
            color="blue"
          />
          <StatPanel
            title="Indexers Used"
            value={stats?.overview.uniqueIndexers ?? 0}
            unit="number"
            color="green"
          />
          <div className="panel p-4">
            <div className="text-sm text-text-muted mb-1">Top Indexer</div>
            <div className="text-xl font-bold text-accent-yellow truncate">
              {stats?.overview.topIndexer ?? 'N/A'}
            </div>
            <div className="text-sm text-text-dim">
              {formatNumber(stats?.overview.topIndexerCount ?? 0)} grabs
            </div>
          </div>
          <StatPanel
            title="Total Downloaded"
            value={stats?.overview.totalSizeBytes ?? 0}
            unit="bytes"
            color="purple"
          />
        </QuerySection>
      </div>

      {/* Grabs Over Time */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={isLoading}
          isFetching={isFetching}
          isPlaceholderData={isPlaceholderData}
          data={stats}
          error={error}
          onRetry={refetch}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Grabs Over Time" subtitle="Downloads by indexer">
            <StackedBarTimeSeries
              data={stats?.grabsOverTime ?? []}
              height={300}
              showLegend
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Distribution & Top Indexers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuerySection
          isLoading={isLoading}
          isFetching={isFetching}
          isPlaceholderData={isPlaceholderData}
          data={stats}
          error={error}
          onRetry={refetch}
          skeleton={
            <>
              <PanelSkeleton />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Indexer Distribution">
            <PieChart
              data={stats?.grabsByIndexer ?? []}
              height={300}
            />
          </Panel>
          <Panel title="Top Indexers" subtitle="By download count" noPadding>
            <DataTable
              columns={[
                { key: 'rank', header: '#', width: '50px' },
                { key: 'indexer', header: 'Indexer', render: (v) => (v as string).replace(/ \(Prowlarr\)$/, '') },
                { key: 'downloads', header: 'Downloads', align: 'right', render: (v) => formatNumber(v as number) },
                { key: 'totalSize', header: 'Size', align: 'right', render: (v) => formatBytes(v as number) },
              ]}
              data={stats?.topIndexers ?? []}
              maxHeight="max-h-[300px]"
            />
          </Panel>
        </QuerySection>
      </div>
    </div>
  );
}
