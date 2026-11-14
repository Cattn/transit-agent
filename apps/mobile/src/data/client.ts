import { useMemo } from 'react';
import { createApiClient, createMockApiClient, type ApiClient } from '@transit/shared';
import { useDeviceId } from '@transit/client-react';
import { getApiUrl, secureStoreDeviceIdStorage } from '../platform';

export type ApiMode = 'server' | 'mock';

export const apiMode: ApiMode = process.env.EXPO_PUBLIC_API_MODE === 'server' ? 'server' : 'mock';

const mockClient: ApiClient | undefined = apiMode === 'mock' ? createMockApiClient({ latencyMs: 0 }) : undefined;

export function useAppClient(): ApiClient | undefined {
  const deviceId = useDeviceId(secureStoreDeviceIdStorage);
  return useMemo(() => mockClient ?? (deviceId ? createApiClient(getApiUrl(), { deviceId }) : undefined), [deviceId]);
}
