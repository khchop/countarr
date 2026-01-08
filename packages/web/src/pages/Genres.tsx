import { useState, useMemo, useCallback } from 'react';
import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, PieChart, BarChart } from '@/components/charts';
import { StackedBarTimeSeries } from '@/components/charts/StackedBarTimeSeries';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { useGenreStats, useGenreDecades, useAllGenres, useGenreDetails } from '@/hooks/useStats';
import { formatNumber } from '@/utils/format';
import { TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';

type FilterType = 'all' | 'movie' | 'series';

export default function Genres() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats, isFetching: fetchingStats, isPlaceholderData: placeholderStats, error: statsError, refetch: refetchStats } = useGenreStats(filterType === 'all' ? undefined : filterType);
  const { data: decades, isLoading: loadingDecades, isFetching: fetchingDecades, isPlaceholderData: placeholderDecades, error: decadesError, refetch: refetchDecades } = useGenreDecades();
  // useAllGenres available for future genre selector functionality
  useAllGenres();
  const { data: genreDetails, isLoading: loadingDetails, isFetching: fetchingDetails, isPlaceholderData: placeholderDetails, error: detailsError, refetch: refetchDetails } = useGenreDetails(selectedGenre ?? '', filterType === 'all' ? undefined : filterType);

  // Memoize matrix data to avoid recalculation on every render
  const matrixData = useMemo(() => {
    if (!decades) return { allDecades: [], genres: [] };
    const allDecades = Array.from(new Set(decades.map(d => d.decade))).sort();
    const genres = Array.from(new Set(decades.map(d => d.genre))).slice(0, 15);
    const genreDataMap = new Map<string, Map<string, number>>();
    
    for (const d of decades) {
      if (!genreDataMap.has(d.genre)) {
        genreDataMap.set(d.genre, new Map());
      }
      genreDataMap.get(d.genre)!.set(d.decade, d.count);
    }
    
    return { allDecades, genres, genreDataMap };
  }, [decades]);

  // Memoize top genres slice
  const topGenres = useMemo(() => 
    stats?.distribution.slice(0, 8) ?? [],
    [stats?.distribution]
  );

  // Memoize decade breakdown chart data
  const decadeBreakdownData = useMemo(() => 
    genreDetails?.decadeBreakdown.map(d => ({ label: d.decade, value: d.count })) ?? [],
    [genreDetails?.decadeBreakdown]
  );

  // Memoize release groups table data
  const releaseGroupsData = useMemo(() => 
    (genreDetails?.topReleaseGroups ?? []).map((r, i) => ({ ...r, rank: i + 1 })),
    [genreDetails?.topReleaseGroups]
  );

  const getTrendIcon = useCallback((change: number | null) => {
    if (change === null) return <Minus size={16} className="text-text-muted" />;
    if (change > 0) return <TrendingUp size={16} className="text-accent-green" />;
    if (change < 0) return <TrendingDown size={16} className="text-accent-red" />;
    return <Minus size={16} className="text-text-muted" />;
  }, []);

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <Filter size={20} className="text-text-muted" />
        <div className="flex bg-background-secondary rounded-lg p-1">
          {(['all', 'movie', 'series'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filterType === type 
                  ? 'bg-accent-blue text-white' 
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </>
          }
        >
          <StatPanel
            title="Total Genres"
            value={stats?.distribution.length ?? 0}
            unit="number"
            color="blue"
          />
          <StatPanel
            title="Diversity Score"
            value={Math.round((stats?.diversity.score ?? 0) * 100) / 100}
            unit="number"
            color="green"
            subtitle="Shannon entropy"
          />
          <div className="panel p-4">
            <div className="text-sm text-text-muted mb-1">Top Genre</div>
            <div className="text-xl font-bold text-accent-yellow flex items-center gap-2">
              {stats?.topGenre.genre ?? 'N/A'}
              {getTrendIcon(stats?.topGenre.change ?? null)}
            </div>
            <div className="text-sm text-text-dim">
              {formatNumber(stats?.topGenre.count ?? 0)} items
              {stats?.topGenre?.change !== null && stats?.topGenre?.change !== undefined && (
                <span className={stats.topGenre.change > 0 ? 'text-accent-green' : 'text-accent-red'}>
                  {' '}({stats.topGenre.change > 0 ? '+' : ''}{stats.topGenre.change}%)
                </span>
              )}
            </div>
          </div>
          <StatPanel
            title="Unique Genres"
            value={stats?.diversity.uniqueGenres ?? 0}
            unit="number"
            color="purple"
          />
        </QuerySection>
      </div>

      {/* Genres Over Time */}
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
          <Panel title="Genres Over Time" subtitle="Top genres by period">
            <StackedBarTimeSeries
              data={stats?.overTime ?? []}
              height={300}
              showLegend
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Top Genres Pie Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuerySection
          isLoading={loadingStats}
          isFetching={fetchingStats}
          isPlaceholderData={placeholderStats}
          data={stats}
          error={statsError}
          onRetry={refetchStats}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Top Genres">
            <PieChart
              data={topGenres}
              height={250}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Selected Genre Details */}
      {selectedGenre && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-accent-blue">{selectedGenre} Details</h3>
            <button
              onClick={() => setSelectedGenre(null)}
              className="text-text-muted hover:text-text text-sm"
            >
              Clear selection
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuerySection
              isLoading={loadingDetails}
              isFetching={fetchingDetails}
              isPlaceholderData={placeholderDetails}
              data={genreDetails}
              error={detailsError}
              onRetry={refetchDetails}
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
                title="Total Items"
                value={genreDetails?.totalItems ?? 0}
                unit="number"
                color="blue"
              />
              <StatPanel
                title="Total Size"
                value={genreDetails?.totalSizeBytes ?? 0}
                unit="bytes"
                color="green"
              />
              <StatPanel
                title="Movies"
                value={genreDetails?.movieCount ?? 0}
                unit="number"
                color="yellow"
              />
              <StatPanel
                title="TV Shows"
                value={genreDetails?.tvCount ?? 0}
                unit="number"
                color="purple"
              />
            </QuerySection>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuerySection
              isLoading={loadingDetails}
              isFetching={fetchingDetails}
              isPlaceholderData={placeholderDetails}
              data={genreDetails}
              error={detailsError}
              onRetry={refetchDetails}
              skeleton={
                <>
                  <PanelSkeleton />
                  <PanelSkeleton />
                </>
              }
            >
              <Panel title="Top Release Groups" subtitle={`For ${selectedGenre}`} noPadding>
                <DataTable
                  columns={[
                    { key: 'releaseGroup', header: 'Release Group' },
                    { key: 'count', header: 'Count', align: 'right', render: (v) => formatNumber(v as number) },
                  ]}
                  data={releaseGroupsData}
                  maxHeight="max-h-[300px]"
                />
              </Panel>
              <Panel title="Decade Breakdown" subtitle={`${selectedGenre} by era`}>
                <BarChart
                  data={decadeBreakdownData}
                  height={250}
                  horizontal
                />
              </Panel>
            </QuerySection>
          </div>
        </div>
      )}

      {/* Genre × Decade Matrix */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingDecades}
          isFetching={fetchingDecades}
          isPlaceholderData={placeholderDecades}
          data={decades}
          error={decadesError}
          onRetry={refetchDecades}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Genre × Decade Matrix" subtitle="Distribution across eras">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-text-muted">Genre</th>
                    {matrixData.allDecades.map(decade => (
                      <th key={decade} className="text-right p-3 font-medium text-text-muted">{decade}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.genres.map(genre => {
                    const genreDecadeMap = matrixData.genreDataMap?.get(genre);
                    const maxCount = genreDecadeMap ? Math.max(...genreDecadeMap.values(), 1) : 1;
                    return (
                      <tr key={genre} className="border-b border-border hover:bg-background-secondary">
                        <td className="p-3 font-medium">{genre}</td>
                        {matrixData.allDecades.map(decade => {
                          const count = genreDecadeMap?.get(decade) ?? 0;
                          const intensity = count / maxCount;
                          return (
                            <td 
                              key={decade} 
                              className="text-right p-3"
                              style={{ 
                                backgroundColor: count > 0 ? `rgba(52, 152, 219, ${intensity * 0.5})` : 'transparent' 
                              }}
                            >
                              {count > 0 ? formatNumber(count) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </QuerySection>
      </div>
    </div>
  );
}
