export function newPlaceId(): string {
  return `place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
