import type { MoonPhaseName } from './moonPhase';

/**
 * Returns the SVG path used for the shaded portion of the lunar disk.
 * The path is deterministic, clamps invalid illumination values, and mirrors
 * waxing/waning phases so the lit side changes direction correctly.
 */
export function getMoonShadowPath(illumination: number, phase: MoonPhaseName): string {
  const illum = Math.max(0, Math.min(1, Number.isFinite(illumination) ? illumination : 0));
  if (illum >= 0.995) return '';
  if (illum <= 0.005) return 'M50 0A50 50 0 1 0 50 100A50 50 0 1 0 50 0Z';

  const waxing = phase === 'waxing_crescent' || phase === 'first_quarter' || phase === 'waxing_gibbous';
  const terminatorRadius = Math.max(0.4, 50 * Math.abs(1 - 2 * illum));

  if (waxing) {
    return illum < 0.5
      ? `M50 0 A${terminatorRadius} 50 0 0 1 50 100 A50 50 0 0 1 50 0 Z`
      : `M50 0 A${terminatorRadius} 50 0 0 0 50 100 A50 50 0 0 1 50 0 Z`;
  }

  return illum < 0.5
    ? `M50 0 A${terminatorRadius} 50 0 0 0 50 100 A50 50 0 0 0 50 0 Z`
    : `M50 0 A${terminatorRadius} 50 0 0 1 50 100 A50 50 0 0 0 50 0 Z`;
}
