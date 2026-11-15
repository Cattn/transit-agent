import { useMemo } from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { createApiClient, createMockApiClient, type ApiClient } from '@transit/shared';
import { useDeviceId } from '@transit/client-react';
import { getApiUrl, secureStoreDeviceIdStorage } from '../platform';

export type ApiMode = 'server' | 'mock';

export const apiMode: ApiMode = process.env.EXPO_PUBLIC_API_MODE === 'server' ? 'server' : 'mock';

const mockClient: ApiClient | undefined = apiMode === 'mock' ? createMockApiClient({ latencyMs: 0 }) : undefined;

void mockClient?.putProfile({
  home: { name: 'Home · 25 Joy St', coordinates: [-71.0652, 42.3592], kind: 'address' },
  work: { name: 'Office · 200 Clarendon St', coordinates: [-71.0752, 42.3496], kind: 'address' }
});

export function useAppClient(): ApiClient | undefined {
  const deviceId = useDeviceId(secureStoreDeviceIdStorage);
  return useMemo(() => mockClient ?? (deviceId ? createApiClient(getApiUrl(), { deviceId, streamFetch: expoFetch as unknown as typeof fetch }) : undefined), [deviceId]);
}
