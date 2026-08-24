import { Driver } from '../types';

// ----------------------------------------------------------------------
// CONSTANTS: NEON PALETTE (Tremor/Tailwind Match)
// ----------------------------------------------------------------------

// Requested Balanced Palette: Blue-500, Emerald-500, Violet-500, Rose-500, Cyan-500, Amber-500
export const NEON_PALETTE = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F43F5E', // Rose
    '#06B6D4', // Cyan
    '#F59E0B'  // Amber
];

export const FALLBACK_COLOR = { primary: "#858595", secondary: "#E0E0E0" };

/**
 * Generates an array of hex colors corresponding to the input drivers.
 * Uses a cyclic Neon palette to ensure high contrast on dark backgrounds.
 */
export const generateChartColors = (drivers: Driver[]): string[] => {
    return drivers.map((_, index) => {
        return NEON_PALETTE[index % NEON_PALETTE.length];
    });
};