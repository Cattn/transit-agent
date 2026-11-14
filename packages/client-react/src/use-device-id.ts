import { useEffect, useState } from 'react';
import { createDeviceId } from '@transit/shared';

export interface DeviceIdStorage { get(): Promise<string | null>; set(id: string): Promise<void> }
const pending = new WeakMap<DeviceIdStorage, Promise<string>>();

export function useDeviceId(storage: DeviceIdStorage): string | undefined {
  const [value, setValue] = useState<{ storage: DeviceIdStorage; id: string }>();
  useEffect(() => {
    let active = true;
    let task = pending.get(storage);
    if (!task) {
      task = (async () => {
        const existing = await storage.get();
        if (existing) return existing;
        const id = createDeviceId();
        await storage.set(id);
        return id;
      })();
      pending.set(storage, task);
    }
    void task.then((id) => { if (active) setValue({ storage, id }); }).catch((error) => {
      pending.delete(storage);
      console.warn('Unable to load device ID', error);
    });
    return () => { active = false; };
  }, [storage]);
  return value?.storage === storage ? value.id : undefined;
}
