import { Panel, PanelSkeleton } from '@/components/layout/Panel';
import { StatPanel, StatPanelSkeleton, TimeSeries, PieChart, Sankey } from '@/components/charts';
import { DataTable } from '@/components/tables/DataTable';
import { useOverviewStats, useQualityStats, useUpgradeStats, useReleaseGroupStats } from '@/hooks/useStats';
import { formatBytes } from '@/utils/format';

export default function Quality() {
  const { data: overview, isLoading: loadingOverview } = useOverviewStats();
  const { data: quality, isLoading: loadingQuality } = useQualityStats();
  const { data: upgrades, isLoading: loadingUpgrades } = useUpgradeStats();
  const { data: releaseGroups, isLoading: loadingGroups } = useReleaseGroupStats();

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingOverview || loadingUpgrades ? (
          <>
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
          </>
        ) : (
          <>
            <StatPanel
              title="Average Quality Score"
              value={overview?.avgQualityScore.value ?? 0}
              unit="score"
              color="blue"
            />
            <StatPanel
              title="Total Upgrades"
              value={overview?.totalUpgrades.value ?? 0}
              unit="number"
              color="purple"
            />
            <StatPanel
              title="Avg Time Between Upgrades"
              value={`${upgrades?.avgTimeBetweenUpgrades ?? 0}h`}
              unit="none"
              color="yellow"
            />
            <StatPanel
              title="Release Group Loyalty"
              value={releaseGroups?.loyalty.loyaltyPercent ?? 0}
              unit="percent"
              color="green"
              subtitle="Top 5 groups usage"
            />
          </>
        )}
      </div>

      {/* Quality Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingQuality ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Resolution Distribution">
              <PieChart
                data={quality?.resolutionDistribution ?? []}
                height={280}
              />
            </Panel>
            <Panel title="Source Distribution">
              <PieChart
                data={quality?.sourceDistribution ?? []}
                height={280}
              />
            </Panel>
            <Panel title="Codec Distribution">
              <PieChart
                data={quality?.codecDistribution ?? []}
                height={280}
              />
            </Panel>
          </>
        )}
      </div>

      {/* Quality Trend */}
      <div className="grid grid-cols-1 gap-4">
        {loadingQuality ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Quality Score Trend" subtitle="Average quality score over time">
            <TimeSeries
              data={quality?.qualityTrend ?? []}
              height={300}
              yAxisLabel="Score"
            />
          </Panel>
        )}
      </div>

      {/* Stacked Quality Over Time */}
      <div className="grid grid-cols-1 gap-4">
        {loadingQuality ? (
          <PanelSkeleton />
        ) : (
          <Panel title="Resolution Over Time" subtitle="Quality distribution trend">
            <TimeSeries
              data={quality?.qualityOverTime ?? []}
              height={300}
              stacked
            />
          </Panel>
        )}
      </div>

      {/* Upgrade Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loadingUpgrades ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Quality Upgrade Flow" subtitle="Sankey diagram of quality transitions">
              <Sankey
                nodes={upgrades?.upgradeFlows.nodes ?? []}
                links={upgrades?.upgradeFlows.links ?? []}
                height={350}
              />
            </Panel>
            <Panel title="Upgrades Over Time">
              <TimeSeries
                data={upgrades?.upgradesPerDay ?? []}
                height={350}
              />
            </Panel>
          </>
        )}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loadingUpgrades || loadingGroups ? (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        ) : (
          <>
            <Panel title="Most Upgraded Items" noPadding>
              <DataTable
                data={upgrades?.mostUpgraded ?? []}
                columns={[
                  { key: 'rank', header: '#', width: '40px' },
                  { key: 'title', header: 'Title' },
                  { key: 'type', header: 'Type', width: '80px' },
                  { key: 'upgradeCount', header: 'Upgrades', align: 'right', sortable: true },
                ]}
                keyField="rank"
                maxHeight="max-h-[300px]"
              />
            </Panel>
            <Panel title="Top Release Groups by Size" noPadding>
              <DataTable
                data={[...(releaseGroups?.groups ?? [])].sort((a, b) => b.totalSizeBytes - a.totalSizeBytes).slice(0, 10).map((g, i) => ({
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
          </>
        )}
      </div>
    </div>
  );
}
