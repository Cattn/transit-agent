export interface AppColors {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  errorContainer: string;
  onErrorContainer: string;
  outline: string;
  live: string;
  map: string;
  scrim: string;
}

export const light: AppColors = {
  scheme: 'light',
  background: '#FEF7FF',
  surface: '#FFFFFF',
  surfaceVariant: '#F3EDF7',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  outline: '#79747E',
  live: '#146C2E',
  map: '#E7EAE2',
  scrim: 'rgba(0, 0, 0, 0.32)'
};

export const dark: AppColors = {
  scheme: 'dark',
  background: '#141218',
  surface: '#211F26',
  surfaceVariant: '#2B2930',
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CAC4D0',
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  outline: '#938F99',
  live: '#7DDA8F',
  map: '#1E2320',
  scrim: 'rgba(0, 0, 0, 0.5)'
};
