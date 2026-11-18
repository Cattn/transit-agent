import { useMemo } from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { createApiClient, createMockApiClient, type ApiClient } from '@transit/shared';
import { useDeviceId } from '@transit/client-react';
import { getApiUrl, onServerUrl, secureStoreDeviceIdStorage, useServerUrl } from '../platform';

export type ApiMode = 'server' | 'mock';

export const buildMode: ApiMode = process.env.EXPO_PUBLIC_API_MODE === 'server' ? 'server' : 'mock';

export let apiMode: ApiMode = buildMode;

onServerUrl((url) => {
  apiMode = url ? 'server' : buildMode;
});

let mockClient: ApiClient | undefined;

function getMockClient(): ApiClient {
  if (mockClient) return mockClient;
  mockClient = createMockApiClient({ latencyMs: 0 });
  void mockClient.putProfile({
    home: { name: '25 Joy St', coordinates: [-71.0652, 42.3592], kind: 'address' },
    work: { name: '200 Clarendon St', coordinates: [-71.0752, 42.3496], kind: 'address' }
  });
  return mockClient;
}

export function useAppClient(): ApiClient | undefined {
  const deviceId = useDeviceId(secureStoreDeviceIdStorage);
  const serverUrl = useServerUrl();
  return useMemo(() => {
    if (serverUrl === undefined) return undefined;
    if (!serverUrl && buildMode === 'mock') return getMockClient();
    return deviceId ? createApiClient(getApiUrl(serverUrl), { deviceId, streamFetch: expoFetch as unknown as typeof fetch }) : undefined;
  }, [deviceId, serverUrl]);
}
