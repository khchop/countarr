/**
 * Shared time aggregation utilities for chart components.
 * Used by StackedBarTimeSeries and BarTimeSeries.
 */

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesData {
  label: string;
  data: TimeSeriesDataPoint[];
  color?: string;
}

export type Granularity = 'day' | 'week' | 'month';

/**
 * Determine the best granularity based on the date range.
 * - > 90 days: monthly
 * - > 30 days: weekly
 * - Otherwise: daily
 */
export function determineGranularity(dates: string[]): Granularity {
  if (dates.length <= 1) return 'day';
  
  const sortedDates = [...dates].sort();
  const firstDate = new Date(sortedDates[0]);
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 90) return 'month';
  if (daysDiff > 30) return 'week';
  return 'day';
}

/**
 * Get week key in YYYY-Www format.
 */
export function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get month key in YYYY-MM format.
 */
export function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate time series data by the specified granularity.
 */
export function aggregateData(
  data: TimeSeriesData[],
  granularity: Granularity
): { aggregatedData: TimeSeriesData[]; periods: string[] } {
  if (granularity === 'day') {
    const allDates = new Set<string>();
    data.forEach(series => {
      series.data.forEach(d => allDates.add(d.timestamp));
    });
    return { aggregatedData: data, periods: Array.from(allDates).sort() };
  }

  const getKey = granularity === 'week' ? getWeekKey : getMonthKey;
  const allPeriods = new Set<string>();

  const aggregatedData = data.map(series => {
    const periodMap = new Map<string, number>();
    
    series.data.forEach(d => {
      const periodKey = getKey(d.timestamp);
      allPeriods.add(periodKey);
      periodMap.set(periodKey, (periodMap.get(periodKey) ?? 0) + d.value);
    });

    return {
      ...series,
      data: Array.from(periodMap.entries()).map(([timestamp, value]) => ({
        timestamp,
        value,
      })),
    };
  });

  return { aggregatedData, periods: Array.from(allPeriods).sort() };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a period label for chart display.
 */
export function formatPeriodLabel(period: string, granularity: Granularity): string {
  if (granularity === 'day') {
    const date = new Date(period);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  if (granularity === 'week') {
    const match = period.match(/(\d{4})-W(\d{2})/);
    if (match) {
      return `W${parseInt(match[2])}`;
    }
    return period;
  }
  if (granularity === 'month') {
    const match = period.match(/(\d{4})-(\d{2})/);
    if (match) {
      const monthIndex = parseInt(match[2]) - 1;
      return MONTH_NAMES[monthIndex];
    }
    return period;
  }
  return period;
}

/**
 * Collect all dates from time series data for granularity detection.
 */
export function collectAllDates(data: TimeSeriesData[]): string[] {
  const allDates: string[] = [];
  data.forEach(series => {
    series.data.forEach(d => allDates.push(d.timestamp));
  });
  return allDates;
}

/**
 * Create data maps for efficient period lookup.
 */
export function createSeriesDataMaps(aggregatedData: TimeSeriesData[]): Map<string, number>[] {
  return aggregatedData.map(series => {
    const map = new Map<string, number>();
    series.data.forEach(d => map.set(d.timestamp, d.value));
    return map;
  });
}

/**
 * Check if time series data has any actual data points.
 */
export function hasTimeSeriesData(data: TimeSeriesData[] | undefined | null): boolean {
  return Boolean(data?.length && data.some(s => s.data?.length > 0));
}
