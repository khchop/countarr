import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, StackedBarTimeSeries, PieChart } from '@/components/charts';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { usePlaybackStats } from '@/hooks/useStats';
import { formatBytes, formatDuration, formatRelativeTime } from '@/utils/format';

export default function Playback() {
  const { data: playback, isLoading: loadingPlayback, isFetching: fetchingPlayback, isPlaceholderData: placeholderPlayback, error: playbackError, refetch: refetchPlayback } = usePlaybackStats();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuerySection
          isLoading={loadingPlayback}
          isFetching={fetchingPlayback}
          isPlaceholderData={placeholderPlayback}
          data={playback}
          error={playbackError}
          onRetry={refetchPlayback}
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
            title="Total Plays"
            value={playback?.userStats?.reduce((sum, u) => sum + (u.playCount || 0), 0) ?? 0}
            unit="number"
            color="blue"
          />
          <StatPanel
            title="Unique Items Watched"
            value={playback?.watchedVsUnwatched?.find((d) => d.label === 'Watched')?.value ?? 0}
            unit="number"
            color="green"
          />
          <StatPanel
            title="Active Users"
            value={playback?.userStats?.length ?? 0}
            unit="number"
            color="purple"
          />
          <StatPanel
            title="Unwatched Items"
            value={playback?.watchedVsUnwatched?.find((d) => d.label === 'Unwatched')?.value ?? 0}
            unit="number"
            color="yellow"
          />
        </QuerySection>
      </div>

      {/* Plays Over Time by User */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingPlayback}
          isFetching={fetchingPlayback}
          isPlaceholderData={placeholderPlayback}
          data={playback}
          error={playbackError}
          onRetry={refetchPlayback}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Plays by User" subtitle="Number of items played per day">
            <StackedBarTimeSeries
              data={playback?.watchTimePerDay ?? []}
              height={350}
              yAxisLabel="Plays"
            />
          </Panel>
        </QuerySection>
      </div>

      {/* User Stats & Watched/Unwatched */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingPlayback}
          isFetching={fetchingPlayback}
          isPlaceholderData={placeholderPlayback}
          data={playback}
          error={playbackError}
          onRetry={refetchPlayback}
          skeleton={
            <>
              <PanelSkeleton />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Playback by User" noPadding>
            <DataTable
              data={playback?.userStats ?? []}
              columns={[
                { key: 'rank', header: '#', width: '40px' },
                { key: 'userName', header: 'User' },
                { key: 'playCount', header: 'Plays', align: 'right', sortable: true },
                { key: 'uniqueItems', header: 'Unique Items', align: 'right', sortable: true },
              ]}
              keyField="rank"
              maxHeight="max-h-[300px]"
            />
          </Panel>
          <Panel title="Watched vs Unwatched">
            <PieChart
              data={playback?.watchedVsUnwatched ?? []}
              height={300}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Most Watched & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuerySection
          isLoading={loadingPlayback}
          isFetching={fetchingPlayback}
          isPlaceholderData={placeholderPlayback}
          data={playback}
          error={playbackError}
          onRetry={refetchPlayback}
          skeleton={
            <>
              <PanelSkeleton />
              <PanelSkeleton />
            </>
          }
        >
          <Panel title="Most Played Content" noPadding>
            <DataTable
              data={playback?.mostWatched ?? []}
              columns={[
                { key: 'rank', header: '#', width: '40px' },
                { key: 'title', header: 'Title' },
                { key: 'type', header: 'Type', width: '80px' },
                { key: 'playCount', header: 'Plays', align: 'right', sortable: true },
              ]}
              keyField="rank"
              maxHeight="max-h-[400px]"
            />
          </Panel>
          <Panel title="Recent Playback Activity" noPadding>
            <DataTable
              data={playback?.recentPlayback ?? []}
              columns={[
                { key: 'title', header: 'Title' },
                { key: 'userName', header: 'User', width: '100px' },
                {
                  key: 'durationSeconds',
                  header: 'Duration',
                  align: 'right',
                  width: '100px',
                  render: (val) => formatDuration(val),
                },
                {
                  key: 'startedAt',
                  header: 'When',
                  align: 'right',
                  width: '100px',
                  render: (val) => formatRelativeTime(val),
                },
              ]}
              keyField="id"
              maxHeight="max-h-[400px]"
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Never Watched */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingPlayback}
          isFetching={fetchingPlayback}
          isPlaceholderData={placeholderPlayback}
          data={playback}
          error={playbackError}
          onRetry={refetchPlayback}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Downloaded but Never Watched" subtitle="The shame list" noPadding>
            <DataTable
              data={playback?.neverWatched ?? []}
              columns={[
                { key: 'rank', header: '#', width: '40px' },
                { key: 'title', header: 'Title' },
                { key: 'type', header: 'Type', width: '80px' },
                {
                  key: 'sizeBytes',
                  header: 'Size',
                  align: 'right',
                  render: (val) => formatBytes(val),
                },
                {
                  key: 'addedAt',
                  header: 'Added',
                  align: 'right',
                  render: (val) => formatRelativeTime(val),
                },
              ]}
              keyField="rank"
              maxHeight="max-h-[400px]"
            />
          </Panel>
        </QuerySection>
      </div>
    </div>
  );
}
