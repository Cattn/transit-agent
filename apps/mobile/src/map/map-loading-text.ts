import type { AppColors } from '../theme/colors';

export interface MapLoadingContentProps {
  status: 'loading' | 'offline' | 'failed';
  colors: AppColors;
  onRetry: () => void;
}

export const MAP_LOADING_TEXT = {
  loading: { title: 'Loading map…', hint: undefined },
  offline: { title: 'No internet connection', hint: 'The map loads when you’re back online.' },
  failed: { title: 'Map couldn’t load', hint: 'Check your connection and try again.' }
} as const;
