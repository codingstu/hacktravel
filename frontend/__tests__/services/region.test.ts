import {
  DEFAULT_CONTINENT,
  filterPresetRoutes,
  inferContinentFromCoordinates,
  inferContinentFromTimezone,
  resolveHotDestinations,
} from '@/services/region';
import {
  FEATURED_SUB_REGIONS_FALLBACK,
  HOT_DESTINATIONS,
  PRESET_ROUTES,
  REGION_METADATA_FALLBACK,
} from '@/services/presets';

describe('region helpers', () => {
  it('uses Asia as default continent', () => {
    expect(DEFAULT_CONTINENT).toBe('Asia');
  });

  it('infers continent from timezone with South America fallback branch', () => {
    expect(inferContinentFromTimezone('Europe/London')).toBe('Europe');
    expect(inferContinentFromTimezone('Africa/Cairo')).toBe('Africa');
    expect(inferContinentFromTimezone('Australia/Sydney')).toBe('Oceania');
    expect(inferContinentFromTimezone('America/Sao_Paulo')).toBe('SouthAmerica');
    expect(inferContinentFromTimezone('America/New_York')).toBe('NorthAmerica');
    expect(inferContinentFromTimezone(undefined)).toBe('Asia');
  });

  it('infers continent from coordinates', () => {
    expect(inferContinentFromCoordinates(-22.9, -43.2)).toBe('SouthAmerica');
    expect(inferContinentFromCoordinates(40.7, -74)).toBe('NorthAmerica');
    expect(inferContinentFromCoordinates(51.5, -0.1)).toBe('Europe');
    expect(inferContinentFromCoordinates(-1.2, 36.8)).toBe('Africa');
    expect(inferContinentFromCoordinates(-33.8, 151.2)).toBe('Oceania');
    expect(inferContinentFromCoordinates(35.7, 139.7)).toBe('Asia');
  });

  it('filters preset routes by continent only', () => {
    const asianRoutes = filterPresetRoutes(PRESET_ROUTES, 'Asia');
    expect(asianRoutes.length).toBeGreaterThan(0);
    expect(asianRoutes.every(route => route.continent === 'Asia')).toBe(true);
  });

  it('filters preset routes by continent and sub region', () => {
    const ukRoutes = filterPresetRoutes(PRESET_ROUTES, 'Europe', 'UK');
    expect(ukRoutes.length).toBeGreaterThan(0);
    expect(ukRoutes.every(route => route.continent === 'Europe')).toBe(true);
    expect(ukRoutes.every(route => route.sub_region === 'UK')).toBe(true);
  });

  it('resolves hot destinations with sub region priority', () => {
    const activeRegion = REGION_METADATA_FALLBACK.find(item => item.key === 'Europe') ?? null;
    const destinations = resolveHotDestinations(
      activeRegion,
      FEATURED_SUB_REGIONS_FALLBACK,
      'UK',
      HOT_DESTINATIONS,
    );
    expect(destinations).toEqual(['伦敦', '爱丁堡', '曼彻斯特', '利物浦']);
  });

  it('falls back to region destinations and then global destinations', () => {
    const activeRegion = REGION_METADATA_FALLBACK.find(item => item.key === 'Africa') ?? null;
    expect(
      resolveHotDestinations(activeRegion, FEATURED_SUB_REGIONS_FALLBACK, '', HOT_DESTINATIONS),
    ).toEqual(['开罗', '马拉喀什', '开普敦', '内罗毕', '桑给巴尔']);

    expect(
      resolveHotDestinations(null, FEATURED_SUB_REGIONS_FALLBACK, '', HOT_DESTINATIONS),
    ).toEqual(HOT_DESTINATIONS);
  });
});
