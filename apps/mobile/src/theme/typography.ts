import { Platform } from 'react-native';
import type { TextProps } from '@expo/ui/jetpack-compose';

type TextStyle = NonNullable<TextProps['style']>;
type TypographyStyle = NonNullable<TextStyle['typography']>;

export type RobotoWeight = 400 | 500 | 700;

const FAMILY: Record<RobotoWeight, string> = { 400: 'Roboto_400Regular', 500: 'Roboto_500Medium', 700: 'Roboto_700Bold' };

const MEDIUM_ROLES: readonly TypographyStyle[] = ['titleMedium', 'titleSmall', 'labelLarge', 'labelMedium', 'labelSmall'];

export function roboto(weight: RobotoWeight): string {
  return FAMILY[weight];
}

export function m3Text(typography: TypographyStyle, weight?: RobotoWeight): TextStyle {
  return { typography, fontFamily: FAMILY[weight ?? (MEDIUM_ROLES.includes(typography) ? 500 : 400)] };
}

export function androidFont(weight: RobotoWeight): { fontFamily: string } | undefined {
  return Platform.OS === 'android' ? { fontFamily: FAMILY[weight] } : undefined;
}
