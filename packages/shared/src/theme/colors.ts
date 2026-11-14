import type { TravelMode } from '../domain/modes.js';
import type { Tone } from '../format/format.js';

export type ColorScheme = 'light' | 'dark';
export interface ToneColors { fg: string; bg: string }

export const toneColors: Record<ColorScheme, Record<Tone, ToneColors>> = {
  light: {
    neutral: { fg: '#374151', bg: '#E5E7EB' },
    info: { fg: '#5B21B6', bg: '#EDE9FE' },
    ok: { fg: '#075985', bg: '#BAE6FD' },
    warn: { fg: '#78350F', bg: '#FDE68A' },
    danger: { fg: '#7F1D1D', bg: '#FCA5A5' }
  },
  dark: {
    neutral: { fg: '#E5E7EB', bg: '#4B5563' },
    info: { fg: '#DDD6FE', bg: '#4C1D95' },
    ok: { fg: '#BAE6FD', bg: '#0C4A6E' },
    warn: { fg: '#451A03', bg: '#FBBF24' },
    danger: { fg: '#FECACA', bg: '#991B1B' }
  }
};

export const modeColors: Record<ColorScheme, Record<TravelMode, string>> = {
  light: {
    walk: '#4B5563',
    bike: '#15803D',
    bikeshare: '#0F766E',
    bus: '#1D4ED8',
    rail: '#7C3AED',
    ferry: '#0369A1',
    car: '#B45309',
    flight: '#BE185D'
  },
  dark: {
    walk: '#9CA3AF',
    bike: '#4ADE80',
    bikeshare: '#2DD4BF',
    bus: '#60A5FA',
    rail: '#A78BFA',
    ferry: '#38BDF8',
    car: '#FBBF24',
    flight: '#F472B6'
  }
};
