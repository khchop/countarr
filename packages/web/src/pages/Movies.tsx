import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, StackedBarTimeSeries, PieChart, BarChart } from '@/components/charts';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { useMovieStats, useMovieDecades, useMovieRuntime, useMovieStudios } from '@/hooks/useStats';
import { formatBytes, formatNumber, formatDuration } from '@/utils/format';

export default function Movies() {
  const { data: stats, isLoading: loadingStats, isFetching: fetchingStats, isPlaceholderData: placeholderStats, error: statsError, refetch: refetchStats } = useMovieStats();
  const { data: decades, isLoading: loadingDecades, isFetching: fetchingDecades, isPlaceholderData: placeholderDecades, error: decadesError, refetch: refetchDecades } = useMovieDecades();
  const { data: runtime, isLoading: loadingRuntime, isFetching: fetchingRuntime, isPlaceholderData: placeholderRuntime, error: runtimeError, refetch: refetchRuntime } = useMovieRuntime();
  const { data: studios, isLoading: loadingStudios, isFetching: fetchingStudios, isPlaceholderData: placeholderStudios, error: studiosError, refetch: refetchStudios } = useMovieStudios(15);

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuerySection
          isLoading={loadingStats}
          isFetching={fetchingStats}
          isPlaceholderData={placeholderStats}
          data={stats}
          error={statsError}
          onRetry={refetchStats}
          skeleton={
            <>
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
              <StatPanelSkeleton />
            </>
          }
        >
          <StatPanel
            title="Total Movies"
            value={stats?.overview.totalMovies ?? 0}
            unit="number"
            color="yellow"
          />
          <StatPanel
            title="Library Size"
            value={stats?.overview.totalSizeBytes ?? 0}
            unit="bytes"
            color="blue"
          />
          <StatPanel
            title="Downloaded"
            value={stats?.overview.downloadedCount ?? 0}
            unit="number"
            color="green"
            subtitle="this period"
          />
          <StatPanel
            title="Upgraded"
            value={stats?.overview.upgradedCount ?? 0}
            unit="number"
            color="purple"
            subtitle="this period"
          />
          <StatPanel
            title="Avg Quality"
            value={stats?.overview.avgQualityScore ?? 0}
            unit="number"
            color="blue"
            subtitle="score"
          />
        </QuerySection>
      </div>

      {/* Downloads Over Time */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingStats}
          isFetching={fetchingStats}
          isPlaceholderData={placeholderStats}
          data={stats}
          error={statsError}
          onRetry={refetchStats}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Movie Downloads Over Time" subtitle="Daily download activity">
            <StackedBarTimeSeries
              data={stats?.downloadsByDay ?? []}
              height={300}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Quality & Genre Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuerySection
          isLoading={loadingStats}
          isFetching={fetchingStats}
          isPlaceholderData={placeholderStats}
          data={stats}
          error={statsError}
          onRetry={refetchStats}
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
              data={stats?.quality.resolution ?? []}
              height={250}
            />
          </Panel>
          <Panel title="Source Distribution">
            <PieChart
              data={stats?.quality.source ?? []}
              height={250}
            />
          </Panel>
          <Panel title="Genre Distribution">
            <PieChart
              data={stats?.genreDistribution.slice(0, 10) ?? []}
              height={250}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Decades & Runtime */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingDecades}
          isFetching={fetchingDecades}
          isPlaceholderData={placeholderDecades}
          data={decades}
          error={decadesError}
          onRetry={refetchDecades}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Movies by Decade" subtitle="Release year distribution">
            <BarChart
              data={decades?.map(d => ({ label: d.decade, value: d.count })) ?? []}
              height={280}
              horizontal
            />
          </Panel>
        </QuerySection>

        <QuerySection
          isLoading={loadingRuntime}
          isFetching={fetchingRuntime}
          isPlaceholderData={placeholderRuntime}
          data={runtime}
          error={runtimeError}
          onRetry={refetchRuntime}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Runtime Statistics">
            <div className="grid grid-cols-2 gap-4 p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-green">
                  {formatDuration((runtime?.shortestMinutes ?? 0) * 60)}
                </div>
                <div className="text-sm text-text-muted">Shortest</div>
                <div className="text-xs text-text-dim truncate mt-1">
                  {runtime?.shortestTitle ?? 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-red">
                  {formatDuration((runtime?.longestMinutes ?? 0) * 60)}
                </div>
                <div className="text-sm text-text-muted">Longest</div>
                <div className="text-xs text-text-dim truncate mt-1">
                  {runtime?.longestTitle ?? 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-blue">
                  {formatDuration((runtime?.averageMinutes ?? 0) * 60)}
                </div>
                <div className="text-sm text-text-muted">Average</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-purple">
                  {formatDuration((runtime?.totalMinutes ?? 0) * 60)}
                </div>
                <div className="text-sm text-text-muted">Total Library</div>
              </div>
            </div>
          </Panel>
        </QuerySection>
      </div>

      {/* Release Groups & Studios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingStats}
          isFetching={fetchingStats}
          isPlaceholderData={placeholderStats}
          data={stats}
          error={statsError}
          onRetry={refetchStats}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Top Release Groups" subtitle="By download count" noPadding>
            <DataTable
              columns={[
                { key: 'rank', header: '#', width: '50px' },
                { key: 'releaseGroup', header: 'Release Group' },
                { key: 'count', header: 'Downloads', align: 'right', render: (v) => formatNumber(v as number) },
                { key: 'totalSize', header: 'Size', align: 'right', render: (v) => formatBytes(v as number) },
              ]}
              data={stats?.releaseGroups ?? []}
              maxHeight="max-h-[300px]"
            />
          </Panel>
        </QuerySection>

        <QuerySection
          isLoading={loadingStudios}
          isFetching={fetchingStudios}
          isPlaceholderData={placeholderStudios}
          data={studios}
          error={studiosError}
          onRetry={refetchStudios}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Top Studios" subtitle="By movie count" noPadding>
            <DataTable
              columns={[
                { key: 'rank', header: '#', width: '50px' },
                { key: 'studio', header: 'Studio' },
                { key: 'count', header: 'Movies', align: 'right', render: (v) => formatNumber(v as number) },
              ]}
              data={studios ?? []}
              maxHeight="max-h-[300px]"
            />
          </Panel>
        </QuerySection>
      </div>
    </div>
  );
}
