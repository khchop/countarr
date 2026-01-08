import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, PieChart } from '@/components/charts';
import { StackedBarTimeSeries } from '@/components/charts/StackedBarTimeSeries';
import { DataTable } from '@/components/tables/DataTable';
import { QuerySection } from '@/components/QuerySection';
import { useSubtitleStats, useSubtitleProviderPerformance, useSubtitleRecent } from '@/hooks/useStats';
import { formatNumber, formatDate } from '@/utils/format';
import { Languages, CheckCircle, XCircle } from 'lucide-react';

export default function Subtitles() {
  const { data: stats, isLoading: loadingStats, isFetching: fetchingStats, isPlaceholderData: placeholderStats, error: statsError, refetch: refetchStats } = useSubtitleStats();
  const { data: providerPerf, isLoading: loadingPerf, isFetching: fetchingPerf, isPlaceholderData: placeholderPerf, error: perfError, refetch: refetchPerf } = useSubtitleProviderPerformance();
  const { data: recent, isLoading: loadingRecent, isFetching: fetchingRecent, isPlaceholderData: placeholderRecent, error: recentError, refetch: refetchRecent } = useSubtitleRecent(20);

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-text-muted';
    if (score >= 80) return 'text-accent-green';
    if (score >= 60) return 'text-accent-yellow';
    return 'text-accent-red';
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
              <StatPanelSkeleton />
            </>
          }
        >
          <StatPanel
            title="Total Downloads"
            value={stats?.overview.totalDownloads ?? 0}
            unit="number"
            color="purple"
          />
          <StatPanel
            title="Languages"
            value={stats?.overview.uniqueLanguages ?? 0}
            unit="number"
            color="blue"
          />
          <StatPanel
            title="Providers"
            value={stats?.overview.uniqueProviders ?? 0}
            unit="number"
            color="green"
          />
          <StatPanel
            title="Avg Score"
            value={stats?.overview.avgScore ?? 0}
            unit="number"
            color="yellow"
          />
          <StatPanel
            title="Movie Subs"
            value={stats?.overview.movieSubtitles ?? 0}
            unit="number"
            color="cyan"
          />
          <StatPanel
            title="TV Subs"
            value={stats?.overview.tvSubtitles ?? 0}
            unit="number"
            color="red"
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
          <Panel title="Subtitle Downloads Over Time" subtitle="Daily download activity">
            <StackedBarTimeSeries
              data={stats?.byDay ?? []}
              height={300}
              showLegend
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Language & Provider Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </>
          }
        >
          <Panel title="Language Distribution">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PieChart
                data={stats?.languages.slice(0, 8).map(l => ({ label: l.language, value: l.count })) ?? []}
                height={250}
              />
              <div className="space-y-2 p-4">
                {stats?.languages.slice(0, 6).map((lang, index) => (
                  <div key={lang.language} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-4">{index + 1}</span>
                      <Languages size={14} className="text-accent-blue" />
                      <span>{lang.language}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-text-muted">{lang.percentage}%</span>
                      <span className={getScoreColor(lang.avgScore)}>
                        {lang.avgScore ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Score Distribution">
            <PieChart
              data={stats?.scoreDistribution ?? []}
              height={300}
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Provider Stats */}
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
          <Panel title="Provider Statistics" subtitle="Downloads and quality by provider">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
              {stats?.providers.map((provider) => (
                <div key={provider.provider} className="bg-background-secondary rounded-lg p-4">
                  <div className="font-medium truncate">{provider.provider}</div>
                  <div className="text-2xl font-bold text-accent-purple mt-2">
                    {formatNumber(provider.count)}
                  </div>
                  <div className="text-sm text-text-muted">{provider.percentage}% of total</div>
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-text-muted">Avg Score:</span>
                    <span className={getScoreColor(provider.avgScore)}>
                      {provider.avgScore ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Success Rate:</span>
                    <span className={provider.successRate >= 80 ? 'text-accent-green' : provider.successRate >= 60 ? 'text-accent-yellow' : 'text-accent-red'}>
                      {provider.successRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </QuerySection>
      </div>

      {/* Provider Performance Table */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingPerf}
          isFetching={fetchingPerf}
          isPlaceholderData={placeholderPerf}
          data={providerPerf}
          error={perfError}
          onRetry={refetchPerf}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Provider Performance Comparison" subtitle="Detailed breakdown">
            <DataTable
              columns={[
                { key: 'rank', header: '#', width: '50px' },
                { key: 'provider', header: 'Provider' },
                { key: 'total', header: 'Total', align: 'right', render: (v) => formatNumber(v as number) },
                { key: 'avgScore', header: 'Avg Score', align: 'right', render: (v) => (
                  <span className={getScoreColor(v as number | null)}>{v ?? 'N/A'}</span>
                )},
                { key: 'excellent', header: 'Excellent', align: 'right', render: (v) => (
                  <span className="text-accent-green">{formatNumber(v as number)}</span>
                )},
                { key: 'good', header: 'Good', align: 'right', render: (v) => (
                  <span className="text-accent-blue">{formatNumber(v as number)}</span>
                )},
                { key: 'fair', header: 'Fair', align: 'right', render: (v) => (
                  <span className="text-accent-yellow">{formatNumber(v as number)}</span>
                )},
                { key: 'poor', header: 'Poor', align: 'right', render: (v) => (
                  <span className="text-accent-red">{formatNumber(v as number)}</span>
                )},
                { key: 'excellentRate', header: 'Success %', align: 'right', render: (v) => (
                  <div className="flex items-center justify-end gap-1">
                    {(v as number) >= 70 ? (
                      <CheckCircle size={14} className="text-accent-green" />
                    ) : (
                      <XCircle size={14} className="text-accent-red" />
                    )}
                    <span>{v as number}%</span>
                  </div>
                )},
              ]}
              data={providerPerf ?? []}
              maxHeight="max-h-[400px]"
            />
          </Panel>
        </QuerySection>
      </div>

      {/* Recent Downloads */}
      <div className="grid grid-cols-1 gap-4">
        <QuerySection
          isLoading={loadingRecent}
          isFetching={fetchingRecent}
          isPlaceholderData={placeholderRecent}
          data={recent}
          error={recentError}
          onRetry={refetchRecent}
          skeleton={<PanelSkeleton />}
        >
          <Panel title="Recent Subtitle Downloads">
            <DataTable
              columns={[
                { key: 'title', header: 'Title' },
                { key: 'type', header: 'Type', render: (v) => (
                  <span className={v === 'movie' ? 'text-accent-yellow' : 'text-accent-cyan'}>
                    {v === 'movie' ? 'Movie' : 'TV'}
                  </span>
                )},
                { key: 'language', header: 'Language' },
                { key: 'provider', header: 'Provider' },
                { key: 'score', header: 'Score', align: 'right', render: (v) => (
                  <span className={getScoreColor(v as number | null)}>{v ?? 'N/A'}</span>
                )},
                { key: 'timestamp', header: 'Date', align: 'right', render: (v) => formatDate(v as string) },
              ]}
              data={recent ?? []}
              maxHeight="max-h-[400px]"
            />
          </Panel>
        </QuerySection>
      </div>

    </div>
  );
}
