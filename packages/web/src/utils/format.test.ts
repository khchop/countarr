import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatDate,
  formatDateTime,
} from './format';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns N/A for negative or NaN values', () => {
    expect(formatBytes(-1)).toBe('N/A');
    expect(formatBytes(NaN)).toBe('N/A');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
  });

  it('formats terabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('respects decimal places parameter', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
    expect(formatBytes(1536, 3)).toBe('1.5 KB');
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns 0s for negative values', () => {
    expect(formatDuration(-1)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m');
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
  });

  it('formats days and hours', () => {
    expect(formatDuration(86400)).toBe('1d 0h');
    expect(formatDuration(86400 + 3600)).toBe('1d 1h');
    expect(formatDuration(86400 * 2 + 3600 * 5)).toBe('2d 5h');
  });
});

describe('formatNumber', () => {
  it('formats small numbers with locale string', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });
});

describe('formatDate', () => {
  it('returns N/A for null/undefined', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns Invalid date for invalid strings', () => {
    expect(formatDate('not a date')).toBe('Invalid date');
  });

  it('formats valid date strings', () => {
    // Format depends on locale, so just check it contains the year
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
  });
});

describe('formatDateTime', () => {
  it('returns N/A for null/undefined', () => {
    expect(formatDateTime(null)).toBe('N/A');
    expect(formatDateTime(undefined)).toBe('N/A');
  });

  it('returns Invalid date for invalid strings', () => {
    expect(formatDateTime('not a date')).toBe('Invalid date');
  });

  it('formats valid datetime strings', () => {
    const result = formatDateTime('2024-01-15T14:30:00');
    expect(result).toContain('2024');
  });
});
