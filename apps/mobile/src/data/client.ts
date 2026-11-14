import { useEffect } from 'react';
import { createApiClient, createMockApiClient, type ApiClient } from '@transit/shared';
import { useDeviceId } from '@transit/client-react';
import { getApiUrl, secureStoreDeviceIdStorage } from '../platform';

export type ApiMode = 'server' | 'mock';

export const apiMode: ApiMode = process.env.EXPO_PUBLIC_API_MODE === 'server' ? 'server' : 'mock';

let deviceId: string | undefined;

export const client: ApiClient = apiMode === 'server'
  ? createApiClient(getApiUrl(), { deviceId: () => deviceId })
  : createMockApiClient({ latencyMs: 0 });

export function useClientDeviceId(): string | undefined {
  const id = useDeviceId(secureStoreDeviceIdStorage);
  useEffect(() => {
    deviceId = id;
  }, [id]);
  return id;
}
