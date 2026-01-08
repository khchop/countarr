import { describe, it, expect } from 'vitest';
import {
  determineGranularity,
  getWeekKey,
  getMonthKey,
  aggregateData,
  formatPeriodLabel,
  collectAllDates,
  createSeriesDataMaps,
  hasTimeSeriesData,
  type TimeSeriesData,
} from './timeAggregation';

describe('determineGranularity', () => {
  it('returns day for empty or single date array', () => {
    expect(determineGranularity([])).toBe('day');
    expect(determineGranularity(['2024-01-01'])).toBe('day');
  });

  it('returns day for ranges under 30 days', () => {
    const dates = ['2024-01-01', '2024-01-15', '2024-01-20'];
    expect(determineGranularity(dates)).toBe('day');
  });

  it('returns week for ranges between 30-90 days', () => {
    const dates = ['2024-01-01', '2024-02-15'];
    expect(determineGranularity(dates)).toBe('week');
  });

  it('returns month for ranges over 90 days', () => {
    const dates = ['2024-01-01', '2024-06-01'];
    expect(determineGranularity(dates)).toBe('month');
  });

  it('handles unsorted date arrays', () => {
    const dates = ['2024-06-01', '2024-01-01', '2024-03-15'];
    expect(determineGranularity(dates)).toBe('month');
  });
});

describe('getWeekKey', () => {
  it('returns week key in YYYY-Www format', () => {
    // Note: Week calculation varies by implementation
    const key = getWeekKey('2024-01-15');
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('pads week numbers with leading zeros', () => {
    const key = getWeekKey('2024-01-01');
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('getMonthKey', () => {
  it('returns month key in YYYY-MM format', () => {
    expect(getMonthKey('2024-01-15')).toBe('2024-01');
    expect(getMonthKey('2024-12-31')).toBe('2024-12');
  });

  it('pads single digit months with leading zeros', () => {
    expect(getMonthKey('2024-03-01')).toBe('2024-03');
    expect(getMonthKey('2024-09-15')).toBe('2024-09');
  });
});

describe('aggregateData', () => {
  const testData: TimeSeriesData[] = [
    {
      label: 'Series A',
      data: [
        { timestamp: '2024-01-01', value: 10 },
        { timestamp: '2024-01-02', value: 20 },
        { timestamp: '2024-01-15', value: 30 },
      ],
      color: '#ff0000',
    },
  ];

  it('returns original data for day granularity', () => {
    const result = aggregateData(testData, 'day');
    expect(result.aggregatedData).toEqual(testData);
    expect(result.periods).toHaveLength(3);
    expect(result.periods).toContain('2024-01-01');
  });

  it('aggregates data by week', () => {
    const result = aggregateData(testData, 'week');
    expect(result.aggregatedData[0].label).toBe('Series A');
    expect(result.aggregatedData[0].color).toBe('#ff0000');
    // Values in same week should be aggregated
    expect(result.periods.length).toBeLessThanOrEqual(3);
  });

  it('aggregates data by month', () => {
    const result = aggregateData(testData, 'month');
    expect(result.aggregatedData[0].label).toBe('Series A');
    // All January data should aggregate to one period
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]).toBe('2024-01');
    // Total value should be 10 + 20 + 30 = 60
    expect(result.aggregatedData[0].data[0].value).toBe(60);
  });
});

describe('formatPeriodLabel', () => {
  it('formats day labels as M/D', () => {
    expect(formatPeriodLabel('2024-01-15', 'day')).toBe('1/15');
    expect(formatPeriodLabel('2024-12-31', 'day')).toBe('12/31');
  });

  it('formats week labels as Wxx', () => {
    expect(formatPeriodLabel('2024-W05', 'week')).toBe('W5');
    expect(formatPeriodLabel('2024-W52', 'week')).toBe('W52');
  });

  it('formats month labels as month name', () => {
    expect(formatPeriodLabel('2024-01', 'month')).toBe('Jan');
    expect(formatPeriodLabel('2024-12', 'month')).toBe('Dec');
    expect(formatPeriodLabel('2024-06', 'month')).toBe('Jun');
  });

  it('returns original period for invalid format', () => {
    expect(formatPeriodLabel('invalid', 'week')).toBe('invalid');
    expect(formatPeriodLabel('invalid', 'month')).toBe('invalid');
  });
});

describe('collectAllDates', () => {
  it('collects dates from multiple series', () => {
    const data: TimeSeriesData[] = [
      {
        label: 'A',
        data: [{ timestamp: '2024-01-01', value: 1 }, { timestamp: '2024-01-02', value: 2 }],
      },
      {
        label: 'B',
        data: [{ timestamp: '2024-01-02', value: 3 }, { timestamp: '2024-01-03', value: 4 }],
      },
    ];
    const dates = collectAllDates(data);
    expect(dates).toHaveLength(4);
    expect(dates).toContain('2024-01-01');
    expect(dates).toContain('2024-01-02');
    expect(dates).toContain('2024-01-03');
  });

  it('returns empty array for empty data', () => {
    expect(collectAllDates([])).toEqual([]);
  });
});

describe('createSeriesDataMaps', () => {
  it('creates maps for each series', () => {
    const data: TimeSeriesData[] = [
      {
        label: 'A',
        data: [{ timestamp: '2024-01-01', value: 10 }, { timestamp: '2024-01-02', value: 20 }],
      },
      {
        label: 'B',
        data: [{ timestamp: '2024-01-01', value: 5 }],
      },
    ];
    const maps = createSeriesDataMaps(data);
    expect(maps).toHaveLength(2);
    expect(maps[0].get('2024-01-01')).toBe(10);
    expect(maps[0].get('2024-01-02')).toBe(20);
    expect(maps[1].get('2024-01-01')).toBe(5);
  });
});

describe('hasTimeSeriesData', () => {
  it('returns false for null/undefined', () => {
    expect(hasTimeSeriesData(null)).toBe(false);
    expect(hasTimeSeriesData(undefined)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasTimeSeriesData([])).toBe(false);
  });

  it('returns false for series with no data points', () => {
    expect(hasTimeSeriesData([{ label: 'A', data: [] }])).toBe(false);
  });

  it('returns true for series with data points', () => {
    expect(hasTimeSeriesData([
      { label: 'A', data: [{ timestamp: '2024-01-01', value: 10 }] },
    ])).toBe(true);
  });
});
