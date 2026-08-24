// utils/teamColors.ts

// 1. NEW "TV GRAPHICS" PALETTE (Dark Mode Safe)
// High saturation, high brightness colors that pop on black backgrounds.
const TEAM_COLORS: Record<string, string> = {
  "Red Bull": "#3671C6",    // Vibrant Blue (TV Style) instead of Navy
  "Mercedes": "#27F4D2",    // Neon Cyan
  "Ferrari": "#E80020",     // Racing Red
  "McLaren": "#FF8000",     // Papaya Neon
  "Aston Martin": "#229971",// Emerald Green (Lighter)
  "Alpine": "#0093CC",      // French Blue
  "Williams": "#64C4FF",    // Electric Light Blue
  "RB": "#1634CB",          // Electric Blue (VCARB)
  "Sauber": "#52E252",      // Neon Green (Kick/Audi style)
  "Haas": "#B6BABD",        // Light Grey/White
  "Fallback": "#FFFFFF"     // Pure White
};

/**
 * Normalizes API team names to match our Palette Keys.
 */
const normalizeTeamName = (rawName: string): string => {
  if (!rawName) return 'Fallback';
  const name = rawName.toLowerCase();
  
  if (name.includes('red bull')) return 'Red Bull';
  if (name.includes('ferrari')) return 'Ferrari';
  if (name.includes('mercedes')) return 'Mercedes';
  if (name.includes('mclaren')) return 'McLaren';
  if (name.includes('aston martin')) return 'Aston Martin';
  if (name.includes('alpine')) return 'Alpine';
  if (name.includes('williams')) return 'Williams';
  if (name.includes('haas')) return 'Haas';
  // Handle various naming conventions for VCARB / Alpha Tauri
  if (name.includes('rb') || name.includes('alpha') || name.includes('toro rosso') || name.includes('vcarb')) return 'RB';
  // Handle Sauber / Stake / Audi / Alfa Romeo
  if (name.includes('sauber') || name.includes('stake') || name.includes('audi') || name.includes('alfa')) return 'Sauber';
  
  return 'Fallback';
};

/**
 * Lightens a color strictly for visualization separation (Teammate differentiation).
 * Uses a bitwise tinting method that mixes with white while preserving the hue.
 * 
 * @param hex The base hex color (e.g. "#FF0000")
 * @param percent Strength of the lightening (0.0 to 1.0). 
 *                0.2 = 20% lighter.
 */
const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    // Mix with White (255) based on percent
    // This creates a "Tint" which is safer than just increasing luminosity for neon colors
    const newR = Math.round(r + (255 - r) * percent);
    const newG = Math.round(g + (255 - g) * percent);
    const newB = Math.round(b + (255 - b) * percent);

    // Clamp to 255 just in case
    const finalR = Math.min(255, newR);
    const finalG = Math.min(255, newG);
    const finalB = Math.min(255, newB);

    return "#" + ((1 << 24) + (finalR << 16) + (finalG << 8) + finalB).toString(16).slice(1);
};

/**
 * Generates chart colors for a list of items (Drivers).
 * 
 * STRICT LOGIC:
 * 1. Resets counts every time it runs.
 * 2. The FIRST driver of a team encountered gets the BASE color.
 * 3. Subsequent drivers of the SAME team get progressively lighter colors.
 * 
 * @param items Array of objects containing `team_name`.
 */
export const generateSeriesColors = (items: { team_name: string }[]): string[] => {
  // Local counter map reset on every call
  const teamCounts: Record<string, number> = {};

  return items.map((item) => {
    const teamKey = normalizeTeamName(item.team_name || '');
    const baseColor = TEAM_COLORS[teamKey] || TEAM_COLORS['Fallback'];
    
    // Get current count for this team (0 for the first one)
    const currentCount = teamCounts[teamKey] || 0;
    
    // Increment for the next iteration
    teamCounts[teamKey] = currentCount + 1;

    // Logic:
    // Index 0 (Primary Driver) -> Base Color
    // Index 1 (Teammate)       -> 25% Lighter
    // Index 2 (Reserve/Other)  -> 45% Lighter
    if (currentCount === 0) {
        return baseColor;
    } else {
        // Use a steeper step (0.25) to ensure the secondary line is clearly distinct
        const lightenFactor = Math.min(0.8, currentCount * 0.25);
        return lightenColor(baseColor, lightenFactor);
    }
  });
};

// Export alias for backward compatibility with other components
export const getTeamColors = generateSeriesColors;
