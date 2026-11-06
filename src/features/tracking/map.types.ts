import type { LocationFix, LocationQuality } from '../../types/tracking';

export interface TrackingMapProps {
  fix?: LocationFix;
  quality: LocationQuality;
  follow: boolean;
  reduceMotion: boolean;
  bottomInset: number;
  onPan(): void;
}
