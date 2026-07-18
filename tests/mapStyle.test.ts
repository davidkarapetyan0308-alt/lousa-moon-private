import { LOUSA_DARK_MAP_STYLE, LOUSA_LIGHT_MAP_STYLE } from '../src/theme/mapStyle';

describe('LOUSA map styles', () => {
  it('provides branded light and dark styles', () => {
    expect(LOUSA_LIGHT_MAP_STYLE.length).toBeGreaterThan(10);
    expect(LOUSA_DARK_MAP_STYLE.length).toBeGreaterThan(10);
  });

  it('does not hide all labels or roads', () => {
    const all = [...LOUSA_LIGHT_MAP_STYLE, ...LOUSA_DARK_MAP_STYLE];
    const hidesGlobalLabels = all.some(
      (item) => !item.featureType && item.elementType === 'labels' && item.stylers.some((style) => style.visibility === 'off'),
    );
    const hidesAllRoads = all.some(
      (item) => item.featureType === 'road' && !item.elementType && item.stylers.some((style) => style.visibility === 'off'),
    );
    expect(hidesGlobalLabels).toBe(false);
    expect(hidesAllRoads).toBe(false);
  });
});
