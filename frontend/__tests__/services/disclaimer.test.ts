/**
 * Tests for disclaimer mapping service
 */
import { getDisclaimer } from '../../services/disclaimer';
import type { Continent } from '../../services/types';

const CONTINENTS: Continent[] = [
  'Asia',
  'Europe',
  'NorthAmerica',
  'SouthAmerica',
  'Africa',
  'Oceania',
];

describe('getDisclaimer', () => {
  it.each(CONTINENTS)('returns non-empty string for %s / zh', (continent) => {
    const result = getDisclaimer(continent, 'zh');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it.each(CONTINENTS)('returns non-empty string for %s / en', (continent) => {
    const result = getDisclaimer(continent, 'en');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it('Asia + zh mentions 携程 or Trip.com', () => {
    const result = getDisclaimer('Asia', 'zh');
    expect(result).toMatch(/携程|Trip\.com/);
  });

  it('Europe + en mentions Booking.com or Skyscanner', () => {
    const result = getDisclaimer('Europe', 'en');
    expect(result).toMatch(/Booking\.com|Skyscanner/);
  });

  it('NorthAmerica + en mentions Google Flights or Expedia', () => {
    const result = getDisclaimer('NorthAmerica', 'en');
    expect(result).toMatch(/Google Flights|Expedia/);
  });

  it('contains at least 2 platform names', () => {
    // Simple heuristic: look for common separators between platform names
    const result = getDisclaimer('Asia', 'zh');
    const separatorCount = (result.match(/[、,，]/g) || []).length;
    expect(separatorCount).toBeGreaterThanOrEqual(2);
  });

  it('returns fallback for undefined continent', () => {
    const result = getDisclaimer(undefined, 'en');
    expect(result).toBeTruthy();
    expect(result).toContain('AI-generated');
  });

  it('prefers serverDisclaimer over local mapping', () => {
    const serverMsg = 'Custom server disclaimer text';
    const result = getDisclaimer('Asia', 'zh', serverMsg);
    expect(result).toBe(serverMsg);
  });

  it('falls back to local mapping when serverDisclaimer is empty', () => {
    const result = getDisclaimer('Asia', 'zh', '');
    expect(result).toContain('携程');
  });
});
