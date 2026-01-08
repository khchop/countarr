import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { BarChart } from '@/components/charts';
import { 
  useAllTimeRecords, 
  useDownloadMilestones, 
  useGoldenHour, 
  useDownloadPatterns, 
  useDownloadStreaks,
  useQuirkyStats,
  useLibraryInsights
} from '@/hooks/useStats';
import { formatBytes, formatNumber, formatDate, formatDuration } from '@/utils/format';
import { 
  Trophy, Clock, Calendar, Zap, Film, Tv, Star, 
  TrendingUp, Moon, Sun, Award, Target, Flame, Heart, 
  Play, BarChart3, CheckCircle, HardDrive, History
} from 'lucide-react';

export default function Records() {
  const { data: allTime, isLoading: loadingAllTime } = useAllTimeRecords();
  const { data: milestones, isLoading: loadingMilestones } = useDownloadMilestones();
  const { data: goldenHour, isLoading: loadingGoldenHour } = useGoldenHour();
  const { data: patterns, isLoading: loadingPatterns } = useDownloadPatterns();
  const { data: streaks, isLoading: loadingStreaks } = useDownloadStreaks();
  const { data: quirky, isLoading: loadingQuirky } = useQuirkyStats();
  const { data: insights, isLoading: loadingInsights } = useLibraryInsights();

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
  };

  return (
    <div className="space-y-6">
      {/* Quirky Stats Hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingQuirky ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="panel p-4 animate-pulse">
                <div className="h-4 bg-background-tertiary rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-background-tertiary rounded w-3/4"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <Film size={16} />
                Total Watch Time
              </div>
              <div className="text-2xl font-bold text-accent-purple">
                {quirky?.totalWatchTimeYears.toFixed(1)} years
              </div>
              <div className="text-xs text-text-dim">if watched non-stop</div>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <TrendingUp size={16} />
                Avg Downloads/Week
              </div>
              <div className="text-2xl font-bold text-accent-blue">
                {quirky?.avgDownloadsPerWeek.toFixed(1)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <Calendar size={16} />
                Favorite Day
              </div>
              <div className="text-2xl font-bold text-accent-green">
                {quirky?.favoriteDayOfWeek ?? 'N/A'}
              </div>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-text-muted text-sm mb-1">
                <Star size={16} />
                Most Active Month
              </div>
              <div className="text-2xl font-bold text-accent-yellow">
                {quirky?.mostActiveMonth?.month ?? 'N/A'} {quirky?.mostActiveMonth?.year ?? ''}
              </div>
              <div className="text-xs text-text-dim">
                {formatNumber(quirky?.mostActiveMonth?.count ?? 0)} downloads
              </div>
            </div>
          </>
        )}
      </div>

      {/* Night Owl vs Early Bird */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingQuirky ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Are You a Night Owl or Early Bird?">
            <div className="flex items-center justify-around p-6">
              <div className="text-center">
                <Moon size={48} className="mx-auto text-accent-purple mb-2" />
                <div className="text-3xl font-bold text-accent-purple">
                  {quirky?.nightOwlPercentage ?? 0}%
                </div>
                <div className="text-sm text-text-muted">Night Owl</div>
                <div className="text-xs text-text-dim">12AM - 6AM</div>
              </div>
              <div className="h-24 w-px bg-border"></div>
              <div className="text-center">
                <Sun size={48} className="mx-auto text-accent-yellow mb-2" />
                <div className="text-3xl font-bold text-accent-yellow">
                  {quirky?.earlyBirdPercentage ?? 0}%
                </div>
                <div className="text-sm text-text-muted">Early Bird</div>
                <div className="text-xs text-text-dim">6AM - 12PM</div>
              </div>
            </div>
          </Panel>
        )}

        {/* Golden Hour */}
        {loadingGoldenHour ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Golden Hour">
            <div className="flex items-center justify-center p-6">
              <div className="text-center">
                <Clock size={48} className="mx-auto text-accent-yellow mb-2" />
                <div className="text-4xl font-bold text-accent-yellow">
                  {formatHour(goldenHour?.hour ?? 0)}
                </div>
                <div className="text-sm text-text-muted mt-2">Most Active Download Hour</div>
                <div className="text-xs text-text-dim">
                  {formatNumber(goldenHour?.downloads ?? 0)} downloads ({goldenHour?.percentage ?? 0}%)
                </div>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* All-Time Records */}
      <Panel title="All-Time Records" subtitle="Your personal bests">
        {loadingAllTime ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-background-secondary rounded-lg p-4">
                <div className="h-4 bg-background-tertiary rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-background-tertiary rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-red text-sm mb-2">
                <Trophy size={16} />
                Biggest Download
              </div>
              <div className="font-bold text-lg truncate">{allTime?.biggestDownload?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{formatBytes(allTime?.biggestDownload?.sizeBytes ?? 0)}</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-green text-sm mb-2">
                <Target size={16} />
                Smallest Download
              </div>
              <div className="font-bold text-lg truncate">{allTime?.smallestDownload?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{formatBytes(allTime?.smallestDownload?.sizeBytes ?? 0)}</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-blue text-sm mb-2">
                <Zap size={16} />
                Busiest Day
              </div>
              <div className="font-bold text-lg">{formatDate(allTime?.busiestDay?.date)}</div>
              <div className="text-text-muted text-sm">{formatNumber(allTime?.busiestDay?.downloads ?? 0)} downloads</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-purple text-sm mb-2">
                <Award size={16} />
                Most Upgraded
              </div>
              <div className="font-bold text-lg truncate">{allTime?.mostUpgraded?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{allTime?.mostUpgraded?.count ?? 0} upgrades</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-cyan text-sm mb-2">
                <Film size={16} />
                Oldest Content
              </div>
              <div className="font-bold text-lg truncate">{allTime?.oldestContent?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{allTime?.oldestContent?.year ?? 'N/A'}</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-yellow text-sm mb-2">
                <Tv size={16} />
                Newest Content
              </div>
              <div className="font-bold text-lg truncate">{allTime?.newestContent?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{allTime?.newestContent?.year ?? 'N/A'}</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-red text-sm mb-2">
                <Clock size={16} />
                Longest Runtime
              </div>
              <div className="font-bold text-lg truncate">{allTime?.longestRuntime?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{formatDuration((allTime?.longestRuntime?.minutes ?? 0) * 60)}</div>
            </div>
            <div className="bg-background-secondary rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent-green text-sm mb-2">
                <Star size={16} />
                First Download
              </div>
              <div className="font-bold text-lg truncate">{allTime?.firstDownload?.title ?? 'N/A'}</div>
              <div className="text-text-muted text-sm">{formatDate(allTime?.firstDownload?.date)}</div>
            </div>
          </div>
        )}
      </Panel>

      {/* Download Streaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingStreaks ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Longest Streak">
              <div className="flex items-center justify-center p-6">
                <div className="text-center">
                  <Flame size={48} className="mx-auto text-accent-red mb-2" />
                  <div className="text-4xl font-bold text-accent-red">
                    {streaks?.longestStreak.days ?? 0} days
                  </div>
                  <div className="text-sm text-text-muted mt-2">
                    {formatDate(streaks?.longestStreak.startDate)} - {formatDate(streaks?.longestStreak.endDate)}
                  </div>
                </div>
              </div>
            </Panel>
            <Panel title="Current Streak">
              <div className="flex items-center justify-center p-6">
                <div className="text-center">
                  <Flame size={48} className={`mx-auto mb-2 ${streaks?.currentStreak ? 'text-accent-green' : 'text-text-dim'}`} />
                  <div className={`text-4xl font-bold ${streaks?.currentStreak ? 'text-accent-green' : 'text-text-dim'}`}>
                    {streaks?.currentStreak?.days ?? 0} days
                  </div>
                  <div className="text-sm text-text-muted mt-2">
                    {streaks?.currentStreak 
                      ? `Started ${formatDate(streaks.currentStreak.startDate)}`
                      : 'No active streak'}
                  </div>
                </div>
              </div>
            </Panel>
          </>
        )}
      </div>

      {/* Download Milestones */}
      <Panel title="Download Milestones" subtitle="Your journey through the numbers">
        {loadingMilestones ? (
          <div className="p-4 animate-pulse">
            <div className="flex gap-4 overflow-x-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-32 h-24 bg-background-secondary rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {milestones?.map((m) => (
                <div key={m.milestone} className="flex-shrink-0 bg-background-secondary rounded-lg p-4 min-w-[160px]">
                  <div className="text-2xl font-bold text-accent-blue">#{formatNumber(m.milestone)}</div>
                  <div className="text-sm font-medium truncate mt-1">{m.title}</div>
                  <div className="text-xs text-text-muted">{formatDate(m.date)}</div>
                  <div className={`text-xs mt-1 ${m.type === 'movie' ? 'text-accent-yellow' : 'text-accent-cyan'}`}>
                    {m.type === 'movie' ? 'Movie' : 'TV Show'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* Download Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingPatterns ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Downloads by Hour">
              <BarChart
                data={patterns?.byHour.map(h => ({ label: formatHour(h.hour), value: h.count })) ?? []}
                height={250}
              />
            </Panel>
            <Panel title="Downloads by Day">
              <BarChart
                data={patterns?.byDayOfWeek.map(d => ({ label: d.dayName, value: d.count })) ?? []}
                height={250}
              />
            </Panel>
          </>
        )}
      </div>

      {/* Weekend vs Weekday */}
      {!loadingPatterns && patterns && (
        <Panel title="Weekend vs Weekday">
          <div className="flex items-center justify-around p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-blue">
                {patterns.weekendVsWeekday.weekday.percentage}%
              </div>
              <div className="text-sm text-text-muted">Weekday</div>
              <div className="text-xs text-text-dim">
                ~{formatNumber(patterns.weekendVsWeekday.weekday.avgPerDay)} avg/day
              </div>
            </div>
            <div className="h-16 w-px bg-border"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-green">
                {patterns.weekendVsWeekday.weekend.percentage}%
              </div>
              <div className="text-sm text-text-muted">Weekend</div>
              <div className="text-xs text-text-dim">
                ~{formatNumber(patterns.weekendVsWeekday.weekend.avgPerDay)} avg/day
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Library Insights */}
      <Panel title="Library Insights" subtitle="Fun facts about your collection">
        {loadingInsights ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-background-secondary rounded-lg p-4">
                <div className="h-4 bg-background-tertiary rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-background-tertiary rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {/* Release Group Loyalty */}
            {insights?.releaseGroupLoyalty && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-purple text-sm mb-2">
                  <Heart size={16} />
                  Release Group Loyalty
                </div>
                <div className="font-bold text-lg">{insights.releaseGroupLoyalty.group}</div>
                <div className="text-text-muted text-sm">
                  {insights.releaseGroupLoyalty.percentage.toFixed(0)}% of your downloads
                </div>
                <div className="text-xs text-text-dim">
                  {formatNumber(insights.releaseGroupLoyalty.count)} items
                </div>
              </div>
            )}

            {/* Most Binged Show */}
            {insights?.mostBingedShow && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-red text-sm mb-2">
                  <Play size={16} />
                  Most Binged Show
                </div>
                <div className="font-bold text-lg truncate">{insights.mostBingedShow.title}</div>
                <div className="text-text-muted text-sm">
                  {insights.mostBingedShow.episodesInOneDay} episodes in one day
                </div>
                <div className="text-xs text-text-dim">
                  {formatDate(insights.mostBingedShow.date)}
                </div>
              </div>
            )}

            {/* Average Upgrade Time */}
            {insights?.avgUpgradeTime && insights.avgUpgradeTime.sampleSize > 0 && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-blue text-sm mb-2">
                  <History size={16} />
                  Upgrade Dedication
                </div>
                <div className="font-bold text-lg">
                  {insights.avgUpgradeTime.days.toFixed(0)} days avg
                </div>
                <div className="text-text-muted text-sm">between upgrades</div>
                <div className="text-xs text-text-dim">
                  Based on {formatNumber(insights.avgUpgradeTime.sampleSize)} upgrades
                </div>
              </div>
            )}

            {/* Genre Variety */}
            {insights?.genreVariety && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-green text-sm mb-2">
                  <BarChart3 size={16} />
                  Genre Variety
                </div>
                <div className="font-bold text-lg">
                  {insights.genreVariety.uniqueGenres} genres
                </div>
                <div className="text-text-muted text-sm">
                  Top: {insights.genreVariety.topGenre}
                </div>
                <div className="text-xs text-text-dim">
                  {insights.genreVariety.topGenrePercentage.toFixed(0)}% of your library
                </div>
              </div>
            )}

            {/* Quality Breakdown */}
            {insights?.qualityBreakdown && insights.qualityBreakdown.length > 0 && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-cyan text-sm mb-2">
                  <Film size={16} />
                  Quality Mix
                </div>
                <div className="space-y-1">
                  {insights.qualityBreakdown.slice(0, 3).map((q) => (
                    <div key={q.resolution} className="flex justify-between text-sm">
                      <span className={
                        q.resolution === '2160p' ? 'text-accent-purple' :
                        q.resolution === '1080p' ? 'text-accent-blue' :
                        q.resolution === '720p' ? 'text-accent-green' :
                        'text-text-muted'
                      }>
                        {q.resolution}
                      </span>
                      <span>{q.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Series Completion Rate */}
            {insights?.seriesCompletionRate && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-yellow text-sm mb-2">
                  <CheckCircle size={16} />
                  Series Completion
                </div>
                <div className="font-bold text-lg">
                  {insights.seriesCompletionRate.percentage.toFixed(0)}% complete
                </div>
                <div className="text-text-muted text-sm">
                  {formatNumber(insights.seriesCompletionRate.completed)} of {formatNumber(insights.seriesCompletionRate.completed + insights.seriesCompletionRate.inProgress)} series
                </div>
              </div>
            )}

            {/* Average Movie Size */}
            {insights?.avgMovieSize && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-red text-sm mb-2">
                  <HardDrive size={16} />
                  Avg Movie Size
                </div>
                <div className="font-bold text-lg">
                  {formatBytes(insights.avgMovieSize.bytes)}
                </div>
                <div className="text-text-muted text-sm">
                  {insights.avgMovieSize.comparedToTypical}
                </div>
              </div>
            )}

            {/* Oldest Watched */}
            {insights?.oldestWatched && (
              <div className="bg-background-secondary rounded-lg p-4">
                <div className="flex items-center gap-2 text-accent-purple text-sm mb-2">
                  <Calendar size={16} />
                  Oldest You've Watched
                </div>
                <div className="font-bold text-lg truncate">{insights.oldestWatched.title}</div>
                <div className="text-text-muted text-sm">
                  Released {insights.oldestWatched.year}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
