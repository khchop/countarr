import { useState, useMemo } from 'react';
import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, BarChart, TimeSeries } from '@/components/charts';
import { DataTable } from '@/components/tables/DataTable';
import { useReleaseGroupsList, useReleaseGroupDetails, useReleaseGroupPulse, useReleaseGroupRanking } from '@/hooks/useStats';
import { formatBytes, formatNumber, formatDate } from '@/utils/format';
import { Search, BarChart3, List } from 'lucide-react';

type SortOption = 'downloads' | 'size' | 'quality' | 'recent';
type ViewMode = 'list' | 'detail';

export default function ReleaseGroups() {
  const [sortBy, setSortBy] = useState<SortOption>('downloads');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [granularity, setGranularity] = useState<'month' | 'year'>('month');

  const { data: listData, isLoading: loadingList } = useReleaseGroupsList(50, 0, sortBy);
  const { data: details, isLoading: loadingDetails } = useReleaseGroupDetails(selectedGroup ?? '');
  const { data: pulse, isLoading: loadingPulse } = useReleaseGroupPulse(selectedGroup ?? '', granularity);
  const { data: ranking, isLoading: loadingRanking } = useReleaseGroupRanking(selectedGroup ?? '', granularity);

  // Memoize filtered groups to avoid recalculation on every render
  const filteredGroups = useMemo(() => 
    listData?.groups.filter(g => 
      g.releaseGroup.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [],
    [listData?.groups, searchQuery]
  );

  // Memoize chart data transformations
  const pulseChartData = useMemo(() => 
    pulse?.map(p => ({ label: p.period, value: p.count })) ?? [],
    [pulse]
  );

  const rankingChartData = useMemo(() => [{
    label: 'Rank',
    data: ranking?.map(r => ({ timestamp: r.period, value: r.rank })) ?? [],
    color: '#3498db',
  }], [ranking]);

  const handleGroupClick = (group: string) => {
    setSelectedGroup(group);
    setViewMode('detail');
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingList ? (
          <>
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
          </>
        ) : (
          <>
            <StatPanel
              title="Total Groups"
              value={listData?.total ?? 0}
              unit="number"
              color="blue"
            />
            <StatPanel
              title="Top 5 Share"
              value={listData?.loyalty.loyaltyPercent ?? 0}
              unit="percent"
              color="green"
            />
            <StatPanel
              title="Total Downloads"
              value={listData?.loyalty.totalDownloads ?? 0}
              unit="number"
              color="yellow"
            />
            <StatPanel
              title="Top Group"
              value={listData?.loyalty.topGroups[0] ?? 'N/A'}
              unit="none"
              color="purple"
            />
          </>
        )}
      </div>

      {/* View Toggle & Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-background-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'list' 
                ? 'bg-accent-blue text-white' 
                : 'text-text-muted hover:text-text'
            }`}
          >
            <List size={16} />
            List View
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'detail' 
                ? 'bg-accent-blue text-white' 
                : 'text-text-muted hover:text-text'
            }`}
            disabled={!selectedGroup}
          >
            <BarChart3 size={16} />
            Detail View
          </button>
        </div>

        {viewMode === 'list' && (
          <>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg text-sm focus:outline-none focus:border-accent-blue"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm focus:outline-none focus:border-accent-blue"
            >
              <option value="downloads">Sort by Downloads</option>
              <option value="size">Sort by Size</option>
              <option value="quality">Sort by Quality</option>
              <option value="recent">Sort by Recent</option>
            </select>
          </>
        )}

        {viewMode === 'detail' && selectedGroup && (
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Granularity:</span>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'month' | 'year')}
              className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm focus:outline-none focus:border-accent-blue"
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'list' ? (
        /* List View */
        <div className="grid grid-cols-1 gap-4">
          {loadingList ? (
            <PanelSkeleton />
          ) : (
            <Panel title="Release Groups" subtitle={`${filteredGroups.length} groups found`}>
              <DataTable
                columns={[
                  { key: 'releaseGroup', header: 'Release Group', render: (v) => (
                    <button 
                      onClick={() => handleGroupClick(v as string)}
                      className="text-accent-blue hover:underline text-left"
                    >
                      {v as string}
                    </button>
                  )},
                  { key: 'totalDownloads', header: 'Downloads', align: 'right', render: (v) => formatNumber(v as number) },
                  { key: 'totalSizeBytes', header: 'Total Size', align: 'right', render: (v) => formatBytes(v as number) },
                  { key: 'avgQualityScore', header: 'Avg Quality', align: 'right', render: (v) => v ? `${v}` : 'N/A' },
                  { key: 'movieCount', header: 'Movies', align: 'right' },
                  { key: 'tvCount', header: 'TV', align: 'right' },
                  { key: 'upgradeCount', header: 'Upgrades', align: 'right' },
                  { key: 'lastSeen', header: 'Last Seen', align: 'right', render: (v) => formatDate(v as string) },
                ]}
                data={filteredGroups}
                maxHeight="max-h-[600px]"
              />
            </Panel>
          )}
        </div>
      ) : (
        /* Detail View */
        selectedGroup && (
          <div className="space-y-6">
            {/* Group Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-accent-blue">{selectedGroup}</h2>
                <p className="text-text-muted">Release Group Analysis</p>
              </div>
              <button
                onClick={() => setViewMode('list')}
                className="px-4 py-2 bg-background-secondary border border-border rounded-lg text-sm hover:border-accent-blue transition-colors"
              >
                Back to List
              </button>
            </div>

            {/* Group Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {loadingDetails ? (
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
                    value={details?.totalDownloads ?? 0}
                    unit="number"
                    color="blue"
                  />
                  <StatPanel
                    title="Total Size"
                    value={details?.totalSizeBytes ?? 0}
                    unit="bytes"
                    color="green"
                  />
                  <StatPanel
                    title="Movies"
                    value={details?.movieCount ?? 0}
                    unit="number"
                    color="yellow"
                  />
                  <StatPanel
                    title="TV Episodes"
                    value={details?.tvCount ?? 0}
                    unit="number"
                    color="purple"
                  />
                </>
              )}
            </div>

            {/* Pulse Chart (Grabs Over Time) */}
            <div className="grid grid-cols-1 gap-4">
              {loadingPulse ? (
                <PanelSkeleton />
              ) : (
                <Panel 
                  title="Download Pulse" 
                  subtitle={`Grabs per ${granularity}`}
                >
                  <BarChart
                    data={pulseChartData}
                    height={300}
                  />
                </Panel>
              )}
            </div>

            {/* Ranking Over Time */}
            <div className="grid grid-cols-1 gap-4">
              {loadingRanking ? (
                <PanelSkeleton />
              ) : (
                <Panel 
                  title="Ranking Over Time" 
                  subtitle="Position among all release groups"
                >
                  <TimeSeries
                    data={rankingChartData}
                    height={250}
                    yAxisLabel="Rank"
                  />
                  <div className="text-center text-text-muted text-sm mt-2">
                    Lower is better (Rank 1 = Top Group)
                  </div>
                </Panel>
              )}
            </div>

            {/* Quality Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loadingDetails ? (
                <>
                  <PanelSkeleton />
                  <PanelSkeleton />
                  <PanelSkeleton />
                </>
              ) : (
                <>
                  <Panel title="Resolution Breakdown">
                    <BarChart
                      data={details?.resolutionBreakdown ?? []}
                      height={200}
                      horizontal
                      invertY
                    />
                  </Panel>
                  <Panel title="Source Breakdown">
                    <BarChart
                      data={details?.sourceBreakdown ?? []}
                      height={200}
                      horizontal
                      invertY
                    />
                  </Panel>
                  <Panel title="Codec Breakdown">
                    <BarChart
                      data={details?.codecBreakdown ?? []}
                      height={200}
                      horizontal
                      invertY
                    />
                  </Panel>
                </>
              )}
            </div>

            {/* Recent Downloads & Top Indexers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingDetails ? (
                <>
                  <PanelSkeleton />
                  <PanelSkeleton />
                </>
              ) : (
                <>
                  <Panel title="Recent Downloads">
                    <DataTable
                      columns={[
                        { key: 'title', header: 'Title' },
                        { key: 'resolution', header: 'Quality' },
                        { key: 'sizeBytes', header: 'Size', align: 'right', render: (v) => formatBytes(v as number) },
                        { key: 'date', header: 'Date', align: 'right', render: (v) => formatDate(v as string) },
                      ]}
                      data={details?.recentDownloads ?? []}
                      maxHeight="max-h-[300px]"
                    />
                  </Panel>
                  <Panel title="Top Indexers">
                    <DataTable
                      columns={[
                        { key: 'indexer', header: 'Indexer' },
                        { key: 'count', header: 'Grabs', align: 'right', render: (v) => formatNumber(v as number) },
                      ]}
                      data={details?.topIndexers ?? []}
                      maxHeight="max-h-[300px]"
                    />
                  </Panel>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
