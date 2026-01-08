// Extended color palette matching the frontend theme
export const colorPalette = [
  '#3274d9', // blue
  '#73bf69', // green  
  '#f2495c', // red
  '#ff9830', // yellow/orange
  '#b877d9', // purple
  '#1f978a', // teal
  '#ff780a', // orange
  '#5794f2', // light blue
  '#e74c3c', // red variant
  '#27ae60', // green variant
  '#8e44ad', // purple variant
  '#f39c12', // gold
  '#16a085', // teal variant
  '#2980b9', // blue variant
  '#c0392b', // dark red
  '#d35400', // burnt orange
];

/**
 * Get color by index (wraps around the palette)
 */
export function getColorByIndex(index: number): string {
  return colorPalette[index % colorPalette.length];
}

// Fixed colors for specific known categories
export const fixedColors: Record<string, string> = {
  // Resolutions
  '4K': '#e74c3c',
  '2160p': '#e74c3c',
  '1080p': '#3498db',
  '720p': '#2ecc71',
  '480p': '#f1c40f',
  'SD': '#9b59b6',
  
  // Sources
  'BluRay': '#3498db',
  'WEB-DL': '#2ecc71',
  'WEBDL': '#2ecc71',
  'WEBRip': '#1abc9c',
  'HDTV': '#f1c40f',
  'DVD': '#9b59b6',
  
  // Playback methods
  'DirectPlay': '#2ecc71',
  'DirectStream': '#3498db',
  'Transcode': '#e74c3c',
  
  // Watched status
  'Watched': '#2ecc71',
  'Unwatched': '#e74c3c',
  
  // Apps
  'radarr': '#f1c40f',
  'sonarr': '#3498db',
  'bazarr': '#9b59b6',
  'prowlarr': '#e67e22',
  
  // Common labels
  'Plays': '#e74c3c',
  'Unknown': '#888888',
};

/**
 * Get color for a label, using fixed colors for known categories
 * or falling back to index-based color.
 */
export function getColor(label: string, index: number = 0): string {
  const fixed = fixedColors[label];
  if (fixed) return fixed;
  return getColorByIndex(index);
}

/**
 * Generate a consistent color for a label using a hash.
 * This ensures the same label always gets the same color regardless of order.
 */
export function getColorForLabel(label: string): string {
  // First check fixed colors
  const fixed = fixedColors[label];
  if (fixed) return fixed;
  
  // Simple but effective string hash
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    // Mix in character code with position weighting
    hash = (hash * 31 + label.charCodeAt(i) * (i + 1)) | 0;
  }
  // Add length to the hash for better distribution of short strings
  hash = (hash * 17 + label.length * 7) | 0;
  
  // Use absolute value and mod to get index
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}
