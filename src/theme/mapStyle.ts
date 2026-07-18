export type LousaMapStyleElement = {
  elementType?: string;
  featureType?: string;
  stylers: Record<string, string | number | boolean>[];
};

/**
 * LOUSA map styling intentionally keeps roads, labels and landmarks readable.
 * Google attribution is rendered by the native SDK and must remain visible.
 */
export const LOUSA_LIGHT_MAP_STYLE: LousaMapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#F7F0F2' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5F5362' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFDFE' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#D8CBD1' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#F3E9ED' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#F8F3F1' }] },
  { featureType: 'poi', elementType: 'geometry.fill', stylers: [{ color: '#F1E7EB' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -70 }, { lightness: 18 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#725D69' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#E8EFE7' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#667462' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFDFE' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E7DCE1' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ saturation: -80 }, { lightness: 12 }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FBE9F0' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#EEC9D7' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D99AAF' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', elementType: 'geometry.fill', stylers: [{ color: '#EDE4F3' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ saturation: -70 }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#DCE5EB' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6A7882' }] },
];

export const LOUSA_DARK_MAP_STYLE: LousaMapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#211B29' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#D7CAD3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17131D' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#5A485C' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#2A2332' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#211C27' }] },
  { featureType: 'poi', elementType: 'geometry.fill', stylers: [{ color: '#302737' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -75 }, { lightness: -5 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#C7B8C3' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#25332C' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#93AA99' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#342B3D' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1B171F' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ saturation: -85 }, { lightness: -12 }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#4A3443' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#74445A' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#9A5A75' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', elementType: 'geometry.fill', stylers: [{ color: '#3B3146' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#202D38' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9AADB9' }] },
];
