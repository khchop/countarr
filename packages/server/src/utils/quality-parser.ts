import type { Resolution, QualitySource, VideoCodec, AudioCodec, ParsedQuality } from '@countarr/shared';

// Resolution patterns
const resolutionPatterns: [RegExp, Resolution][] = [
  [/\b2160p\b/i, '2160p'],
  [/\b4k\b/i, '2160p'],
  [/\buhd\b/i, '2160p'],
  [/\b1080p\b/i, '1080p'],
  [/\b1080i\b/i, '1080p'],
  [/\b720p\b/i, '720p'],
  [/\b576p\b/i, '576p'],
  [/\b480p\b/i, '480p'],
  [/\bsdtv\b/i, '480p'],
];

// Source patterns (order matters - more specific first)
const sourcePatterns: [RegExp, QualitySource][] = [
  [/\bremux\b/i, 'remux'],
  [/\bblu-?ray\b/i, 'bluray'],
  [/\bbdrip\b/i, 'bluray'],
  [/\bweb-?dl\b/i, 'webdl'],
  [/\bwebdl\b/i, 'webdl'],
  [/\bamazon\b/i, 'webdl'],
  [/\bamzn\b/i, 'webdl'],
  [/\bnetflix\b/i, 'webdl'],
  [/\bnf\b/i, 'webdl'],
  [/\bdsnp\b/i, 'webdl'],
  [/\bdisney\+?\b/i, 'webdl'],
  [/\bhmax\b/i, 'webdl'],
  [/\bweb-?rip\b/i, 'webrip'],
  [/\bwebrip\b/i, 'webrip'],
  [/\bhdtv\b/i, 'hdtv'],
  [/\bpdtv\b/i, 'hdtv'],
  [/\bdsr\b/i, 'hdtv'],
  [/\bdvdrip\b/i, 'dvd'],
  [/\bdvd-?r\b/i, 'dvd'],
  [/\bdvd\b/i, 'dvd'],
  [/\bcam\b/i, 'cam'],
  [/\bhdcam\b/i, 'cam'],
  [/\bts\b/i, 'telesync'],
  [/\btelesync\b/i, 'telesync'],
  [/\btc\b/i, 'telecine'],
  [/\btelecine\b/i, 'telecine'],
  [/\bworkprint\b/i, 'workprint'],
  [/\bwp\b/i, 'workprint'],
];

// Video codec patterns
const videoCodecPatterns: [RegExp, VideoCodec][] = [
  [/\bav1\b/i, 'av1'],
  [/\bx265\b/i, 'x265'],
  [/\bh\.?265\b/i, 'h265'],
  [/\bhevc\b/i, 'hevc'],
  [/\bx264\b/i, 'x264'],
  [/\bh\.?264\b/i, 'h264'],
  [/\bavc\b/i, 'h264'],
  [/\bvp9\b/i, 'vp9'],
  [/\bxvid\b/i, 'xvid'],
  [/\bdivx\b/i, 'divx'],
  [/\bmpeg-?2\b/i, 'mpeg2'],
];

// Audio codec patterns
const audioCodecPatterns: [RegExp, AudioCodec][] = [
  [/\batmos\b/i, 'atmos'],
  [/\btruehd\b/i, 'truehd'],
  [/\bdts-?hd\b/i, 'dtshd'],
  [/\bdts-?ma\b/i, 'dtshd'],
  [/\bdts\b/i, 'dts'],
  [/\beac3\b/i, 'eac3'],
  [/\bdd\+\b/i, 'eac3'],
  [/\bddp\b/i, 'eac3'],
  [/\bac3\b/i, 'ac3'],
  [/\bdd5\.?1\b/i, 'ac3'],
  [/\bdolby digital\b/i, 'ac3'],
  [/\bflac\b/i, 'flac'],
  [/\baac\b/i, 'aac'],
  [/\bopus\b/i, 'opus'],
  [/\bmp3\b/i, 'mp3'],
];

// Release group pattern - typically at the end after a dash
const releaseGroupPattern = /-([a-zA-Z0-9]+)(?:\[[\w.]+\])?$/;

// Quality score weights
const resolutionScores: Record<Resolution, number> = {
  '2160p': 100,
  '1080p': 75,
  '720p': 50,
  '576p': 30,
  '480p': 20,
  'unknown': 0,
};

const sourceScores: Record<QualitySource, number> = {
  'remux': 100,
  'bluray': 90,
  'webdl': 80,
  'webrip': 70,
  'hdtv': 50,
  'dvd': 30,
  'telecine': 20,
  'telesync': 15,
  'cam': 5,
  'workprint': 5,
  'unknown': 0,
};

const codecScores: Record<VideoCodec, number> = {
  'av1': 100,
  'x265': 90,
  'h265': 90,
  'hevc': 90,
  'x264': 70,
  'h264': 70,
  'vp9': 75,
  'xvid': 30,
  'divx': 30,
  'mpeg2': 20,
  'unknown': 0,
};

function findMatch<T>(text: string, patterns: [RegExp, T][]): T | null {
  for (const [pattern, value] of patterns) {
    if (pattern.test(text)) {
      return value;
    }
  }
  return null;
}

export function parseQuality(releaseTitle: string): ParsedQuality {
  const title = releaseTitle || '';
  
  const resolution = findMatch(title, resolutionPatterns) ?? 'unknown';
  const source = findMatch(title, sourcePatterns) ?? 'unknown';
  const videoCodec = findMatch(title, videoCodecPatterns) ?? 'unknown';
  const audioCodec = findMatch(title, audioCodecPatterns) ?? 'unknown';
  
  const is3d = /\b3d\b/i.test(title);
  const isHdr = /\bhdr10?\+?\b/i.test(title) || /\bdolby.?vision\b/i.test(title) || /\bdv\b/i.test(title);
  const isDolbyVision = /\bdolby.?vision\b/i.test(title) || /\b(?:dv|dovi)\b/i.test(title);
  const isAtmos = /\batmos\b/i.test(title);
  
  // Calculate quality score (weighted average)
  const resScore = resolutionScores[resolution];
  const srcScore = sourceScores[source];
  const codecScore = codecScores[videoCodec];
  
  // Weight: resolution 40%, source 35%, codec 25%
  let qualityScore = Math.round(resScore * 0.4 + srcScore * 0.35 + codecScore * 0.25);
  
  // Bonuses
  if (isHdr) qualityScore = Math.min(100, qualityScore + 5);
  if (isDolbyVision) qualityScore = Math.min(100, qualityScore + 3);
  if (isAtmos) qualityScore = Math.min(100, qualityScore + 2);
  
  return {
    resolution,
    source,
    videoCodec,
    audioCodec,
    is3d,
    isHdr,
    isDolbyVision,
    isAtmos,
    qualityScore,
  };
}

export function parseReleaseGroup(releaseTitle: string): string | null {
  const title = releaseTitle || '';
  
  // Remove common file extensions first
  const cleaned = title.replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '');
  
  const match = cleaned.match(releaseGroupPattern);
  if (match && match[1]) {
    const group = match[1];
    // Filter out common false positives
    const falsePositives = ['720p', '1080p', '2160p', 'x264', 'x265', 'HEVC', 'HDR', 'REMUX', 'BluRay', 'WEB', 'AMZN', 'NF'];
    if (!falsePositives.some(fp => fp.toLowerCase() === group.toLowerCase())) {
      return group;
    }
  }
  
  return null;
}

export function formatQuality(parsed: ParsedQuality): string {
  const parts: string[] = [];
  
  if (parsed.resolution !== 'unknown') {
    parts.push(parsed.resolution);
  }
  
  if (parsed.source !== 'unknown') {
    const sourceNames: Record<QualitySource, string> = {
      'remux': 'Remux',
      'bluray': 'BluRay',
      'webdl': 'WEB-DL',
      'webrip': 'WEBRip',
      'hdtv': 'HDTV',
      'dvd': 'DVD',
      'cam': 'CAM',
      'telesync': 'TS',
      'telecine': 'TC',
      'workprint': 'WP',
      'unknown': '',
    };
    parts.push(sourceNames[parsed.source]);
  }
  
  if (parsed.isHdr) parts.push('HDR');
  if (parsed.isDolbyVision) parts.push('DV');
  
  return parts.join(' ') || 'Unknown';
}
