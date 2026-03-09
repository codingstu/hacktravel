import type { CommunityRoute, Continent, FeaturedSubRegion, RegionMeta } from './types';

export const DEFAULT_CONTINENT: Continent = 'Asia';

export function inferContinentFromTimezone(timezone?: string): Continent {
  if (!timezone) return DEFAULT_CONTINENT;
  if (timezone.startsWith('Europe/') || timezone === 'UTC') return 'Europe';
  if (timezone.startsWith('Africa/')) return 'Africa';
  if (timezone.startsWith('Pacific/')) return 'Oceania';
  if (timezone.startsWith('Australia/')) return 'Oceania';
  if (timezone.startsWith('America/')) {
    const southAmericaZones = [
      'America/Sao_Paulo',
      'America/Argentina',
      'America/Bogota',
      'America/Lima',
      'America/Santiago',
      'America/Montevideo',
      'America/Asuncion',
      'America/La_Paz',
      'America/Caracas',
    ];
    return southAmericaZones.some(zone => timezone.startsWith(zone))
      ? 'SouthAmerica'
      : 'NorthAmerica';
  }
  return DEFAULT_CONTINENT;
}

export function inferContinentFromCoordinates(latitude: number, longitude: number): Continent {
  if (latitude < 15 && longitude >= -90 && longitude <= -30) return 'SouthAmerica';
  if (latitude >= 15 && longitude >= -170 && longitude <= -30) return 'NorthAmerica';
  if (latitude >= 35 && longitude >= -25 && longitude <= 60) return 'Europe';
  if (latitude >= -35 && latitude <= 37 && longitude >= -20 && longitude <= 55) return 'Africa';
  if (longitude >= 110 && latitude <= 0) return 'Oceania';
  return DEFAULT_CONTINENT;
}

export function filterPresetRoutes(
  routes: CommunityRoute[],
  selectedContinent: Continent,
  selectedSubRegion = '',
): CommunityRoute[] {
  return routes.filter(route => {
    if (route.continent !== selectedContinent) return false;
    if (selectedSubRegion && route.sub_region !== selectedSubRegion) return false;
    return true;
  });
}

export function resolveHotDestinations(
  activeRegion: RegionMeta | null,
  featuredSubRegions: FeaturedSubRegion[],
  selectedSubRegion = '',
  fallbackDestinations: string[] = [],
): string[] {
  if (selectedSubRegion) {
    const subRegionMeta = featuredSubRegions.find(item => item.key === selectedSubRegion);
    if (subRegionMeta?.hot_destinations?.length) {
      return subRegionMeta.hot_destinations;
    }
  }
  if (activeRegion?.hot_destinations?.length) {
    return activeRegion.hot_destinations;
  }
  return fallbackDestinations;
}
