import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Film, Tv, RefreshCw, Calendar, HardDrive, Filter } from 'lucide-react';
import { api } from '@/api/client';
import { Panel } from '@/components/layout/Panel';
import { DataTable } from '@/components/tables/DataTable';
import { formatBytes, formatDateTime, formatRelativeTime } from '@/utils/format';

export default function MediaDetail() {
  const { id } = useParams<{ id: string }>();
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [selectedEpisode, setSelectedEpisode] = useState<number | 'all'>('all');

  const { data: item, isLoading } = useQuery({
    queryKey: ['media', id],
    queryFn: () => api.media.get(Number(id)),
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ['media', id, 'history'],
    queryFn: () => api.media.history(Number(id)),
    enabled: !!id,
  });

  const typedItem = item as any;

  // Extract available seasons and episodes from upgrade path
  const { seasons, episodesBySeason } = useMemo(() => {
    if (!typedItem?.upgradePath) return { seasons: [], episodesBySeason: {} };
    
    const seasonSet = new Set<number>();
    const epsBySeason: Record<number, Set<number>> = {};
    
    for (const step of typedItem.upgradePath) {
      if (step.season != null) {
        seasonSet.add(step.season);
        if (!epsBySeason[step.season]) {
          epsBySeason[step.season] = new Set();
        }
        if (step.episode != null) {
          epsBySeason[step.season].add(step.episode);
        }
      }
    }
    
    const seasons = Array.from(seasonSet).sort((a, b) => a - b);
    const episodesBySeason: Record<number, number[]> = {};
    for (const [season, eps] of Object.entries(epsBySeason)) {
      episodesBySeason[Number(season)] = Array.from(eps).sort((a, b) => a - b);
    }
    
    return { seasons, episodesBySeason };
  }, [typedItem?.upgradePath]);

  // Filter upgrade path based on selection
  const filteredUpgradePath = useMemo(() => {
    if (!typedItem?.upgradePath) return [];
    
    return typedItem.upgradePath.filter((step: any) => {
      if (selectedSeason !== 'all' && step.season !== selectedSeason) {
        return false;
      }
      if (selectedEpisode !== 'all' && step.episode !== selectedEpisode) {
        return false;
      }
      return true;
    });
  }, [typedItem?.upgradePath, selectedSeason, selectedEpisode]);

  // Reset episode filter when season changes
  const handleSeasonChange = (season: number | 'all') => {
    setSelectedSeason(season);
    setSelectedEpisode('all');
  };

  // Get episodes for currently selected season
  const availableEpisodes = selectedSeason !== 'all' ? episodesBySeason[selectedSeason] ?? [] : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 skeleton rounded" />
        <div className="h-64 skeleton rounded" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Media item not found</p>
        <Link to="/media" className="text-accent-blue hover:underline mt-2 inline-block">
          Back to Media
        </Link>
      </div>
    );
  }

  const isSeries = typedItem?.type === 'series';
  const hasSeasons = seasons.length > 0;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/media"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Media
      </Link>

      {/* Header */}
      <div className="flex gap-6">
        {/* Poster */}
        <div className="w-48 flex-shrink-0">
          <div className="aspect-[2/3] bg-background-secondary rounded-lg overflow-hidden">
            {typedItem.posterUrl ? (
              <img
                src={typedItem.posterUrl}
                alt={typedItem.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {typedItem.type === 'movie' ? (
                  <Film className="w-16 h-16 text-text-dim" />
                ) : (
                  <Tv className="w-16 h-16 text-text-dim" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold">{typedItem.title}</h1>
            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
              typedItem.type === 'movie' ? 'bg-accent-yellow text-black' : 'bg-accent-purple text-white'
            }`}>
              {typedItem.type === 'movie' ? 'Movie' : 'Series'}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 text-text-muted">
            {typedItem.year && <span>{typedItem.year}</span>}
            {typedItem.quality && (
              <span className="px-2 py-0.5 bg-accent-blue/20 text-accent-blue rounded">
                {typedItem.quality}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <HardDrive className="w-4 h-4" />
                <span className="text-sm">Size</span>
              </div>
              <p className="text-xl font-semibold text-accent-green">
                {formatBytes(typedItem.sizeBytes)}
              </p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm">Upgrades</span>
              </div>
              <p className="text-xl font-semibold text-accent-purple">
                {typedItem.upgradeCount}
              </p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Added</span>
              </div>
              <p className="text-lg font-medium">
                {formatRelativeTime(typedItem.addedAt)}
              </p>
            </div>
            <div className="panel p-4">
              <div className="text-text-muted text-sm mb-1">Total Downloaded</div>
              <p className="text-xl font-semibold text-accent-blue">
                {formatBytes(typedItem.totalSizeDownloaded)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Path Timeline */}
      {typedItem.upgradePath && typedItem.upgradePath.length > 0 && (
        <Panel 
          title="Upgrade History" 
          subtitle={`Quality upgrade timeline${filteredUpgradePath.length !== typedItem.upgradePath.length ? ` (${filteredUpgradePath.length} of ${typedItem.upgradePath.length})` : ''}`}
        >
          {/* Season/Episode Filters for Series */}
          {isSeries && hasSeasons && (
            <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-muted">Filter:</span>
              </div>
              
              {/* Season Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-muted">Season:</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => handleSeasonChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-background-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
                >
                  <option value="all">All Seasons</option>
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Episode Filter (only show when season is selected) */}
              {selectedSeason !== 'all' && availableEpisodes.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-text-muted">Episode:</label>
                  <select
                    value={selectedEpisode}
                    onChange={(e) => setSelectedEpisode(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-background-secondary border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  >
                    <option value="all">All Episodes</option>
                    {availableEpisodes.map((ep) => (
                      <option key={ep} value={ep}>
                        Episode {ep}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Clear Filters */}
              {(selectedSeason !== 'all' || selectedEpisode !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedSeason('all');
                    setSelectedEpisode('all');
                  }}
                  className="text-sm text-accent-blue hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline items */}
            <div className="space-y-4">
              {filteredUpgradePath.length === 0 ? (
                <p className="text-text-muted text-center py-4">No upgrades match the selected filter</p>
              ) : (
                filteredUpgradePath.map((step: any, index: number) => {
                  // Format episode label for series
                  const episodeLabel = step.season != null && step.episode != null
                    ? `S${String(step.season).padStart(2, '0')}E${String(step.episode).padStart(2, '0')}`
                    : null;
                  
                  return (
                    <div key={index} className="relative flex items-start gap-4 pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                        index === filteredUpgradePath.length - 1
                          ? 'bg-accent-green'
                          : 'bg-accent-blue'
                      }`} />

                      <div className="flex-1 panel p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            {/* Episode info for series */}
                            {episodeLabel && (
                              <p className="text-xs text-accent-purple font-medium mb-1">
                                {episodeLabel}
                                {step.episodeTitle && (
                                  <span className="text-text-muted font-normal"> - {step.episodeTitle}</span>
                                )}
                              </p>
                            )}
                            <p className="font-medium">{step.quality}</p>
                            <p className="text-sm text-text-muted">
                              {step.releaseGroup && (
                                <span className="text-accent-purple">{step.releaseGroup}</span>
                              )}
                              {step.resolution && ` - ${step.resolution}`}
                              {step.source && ` - ${step.source}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-text-muted">
                              {formatDateTime(step.timestamp)}
                            </p>
                            <p className="text-sm text-accent-blue">
                              {formatBytes(step.sizeBytes)}
                            </p>
                            {step.qualityScore && (
                              <p className="text-xs text-text-dim">
                                Score: {step.qualityScore}/100
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Download History Table */}
      {history && history.length > 0 && (
        <Panel title="Download Events" noPadding>
          <DataTable
            data={history as any[]}
            columns={[
              {
                key: 'eventType',
                header: 'Event',
                render: (val) => (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    val === 'downloaded' ? 'bg-accent-green/20 text-accent-green' :
                    val === 'grabbed' ? 'bg-accent-blue/20 text-accent-blue' :
                    val === 'upgraded' ? 'bg-accent-purple/20 text-accent-purple' :
                    'bg-background-tertiary text-text-muted'
                  }`}>
                    {val}
                  </span>
                ),
              },
              { key: 'quality', header: 'Quality' },
              { key: 'releaseGroup', header: 'Group' },
              { key: 'indexer', header: 'Indexer' },
              {
                key: 'sizeBytes',
                header: 'Size',
                align: 'right',
                render: (val) => formatBytes(val),
              },
              {
                key: 'timestamp',
                header: 'Date',
                align: 'right',
                render: (val) => formatRelativeTime(val),
              },
            ]}
            keyField="id"
            maxHeight="max-h-[400px]"
          />
        </Panel>
      )}
    </div>
  );
}
