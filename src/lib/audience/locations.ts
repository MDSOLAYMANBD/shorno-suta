// Location hierarchy spec. Today only District is enabled, but the
// LocationPicker iterates this list so Upazila/Area can be turned on
// later just by flipping `enabled` and providing a data source.

export type LocationLevel = 'division' | 'district' | 'upazila' | 'area';

export interface LocationLevelDef {
  level: LocationLevel;
  label: string;
  bn: string;
  enabled: boolean;
}

export const LOCATION_LEVELS: LocationLevelDef[] = [
  { level: 'division', label: 'Division', bn: 'বিভাগ',  enabled: false },
  { level: 'district', label: 'District', bn: 'জেলা',   enabled: true  },
  { level: 'upazila',  label: 'Upazila',  bn: 'উপজেলা', enabled: false },
  { level: 'area',     label: 'Area',     bn: 'এরিয়া',  enabled: false },
];

export const ACTIVE_LOCATION_LEVELS = LOCATION_LEVELS.filter((l) => l.enabled);
