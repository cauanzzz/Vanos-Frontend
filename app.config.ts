import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  return {
    ...config,
    name: config.name ?? 'Vanos',
    slug: config.slug ?? 'vanos-mobile',
    plugins: [...(config.plugins ?? []), ...(androidKey ? [['react-native-maps', { androidGoogleMapsApiKey: androidKey }] as [string, { androidGoogleMapsApiKey: string }]] : [])],
    extra: { ...config.extra, mapsAndroidConfigured: Boolean(androidKey) },
  };
};
