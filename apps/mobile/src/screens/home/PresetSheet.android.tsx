import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { Button, Column, FlowRow, Icon, ListItem, LoadingIndicator, ModalBottomSheet, OutlinedButton, OutlinedTextField, Row, Text, TextButton, useMaterialColors, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, imePadding, padding, Shapes, size, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { usePlaceSearch } from '@transit/client-react';
import type { Place, PresetIcon } from '@transit/shared';
import Check from '../../../assets/icons/check_fill.xml';
import Favorite from '../../../assets/icons/favorite_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import FitnessCenter from '../../../assets/icons/fitness_center_fill.xml';
import HomeIcon from '../../../assets/icons/home_fill.xml';
import LocalCafe from '../../../assets/icons/local_cafe_fill.xml';
import Park from '../../../assets/icons/park_fill.xml';
import Search from '../../../assets/icons/search_fill.xml';
import School from '../../../assets/icons/school_fill.xml';
import ShoppingBag from '../../../assets/icons/shopping_bag_fill.xml';
import Work from '../../../assets/icons/work_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { PresetSheetProps } from './PresetSheet';

export const PRESET_ICON_SOURCES: Record<PresetIcon, number> = { home: HomeIcon, work: Work, fitness: FitnessCenter, school: School, cafe: LocalCafe, shopping: ShoppingBag, favorite: Favorite, park: Park };

function placeName(place: Place | undefined): string {
  if (!place) return 'Not set';
  return place.name ?? `${place.coordinates[1].toFixed(4)}, ${place.coordinates[0].toFixed(4)}`;
}

export function PresetSheet({ colors, label, value, palette, icons, placeEditable, near, saving, error, onSave, onOpenSettings, onClose }: PresetSheetProps) {
  const scheme = colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const [color, setColor] = useState(value.color);
  const [icon, setIcon] = useState(value.icon);
  const [place, setPlace] = useState(value.place);
  const [picking, setPicking] = useState(false);
  const field = useRef<TextFieldRef>(null);
  const [query, setQuery] = useState('');
  const { results, loading } = usePlaceSearch(picking ? query : '', { near });
  const trimmed = query.trim();
  const hint = trimmed.length > 0 && trimmed.length < 3
    ? 'Type at least 3 letters'
    : !loading && trimmed.length >= 3 && results.length === 0 ? 'No places found' : undefined;
  const [picked, setPicked] = useState<{ place: Place }>();

  useEffect(() => {
    if (!picked) return;
    void (field.current?.blur() ?? Promise.resolve()).catch(() => undefined).then(() => {
      setPlace(picked.place);
      setPicking(false);
      setQuery('');
    });
  }, [picked]);

  return (
    <Host matchContents colorScheme={scheme} seedColor={materialSeedColor} style={styles.host}>
      <ModalBottomSheet onDismissRequest={onClose} skipPartiallyExpanded containerColor={m.surfaceContainerLow}>
        <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), imePadding(), verticalScroll(), padding(24, 0, 24, 24)]}>
          <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center">
            <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[size(40, 40), clip(Shapes.Circle), background(m.surfaceContainerHighest)]}>
              <Icon source={PRESET_ICON_SOURCES[icon]} size={22} tint={color} />
            </Column>
            <Text color={m.onSurface} style={m3Text('titleLarge')}>{label}</Text>
          </Row>

          <Text color={m.onSurfaceVariant} style={m3Text('labelLarge')}>Colour</Text>
          <FlowRow horizontalArrangement={{ spacedBy: 12 }} verticalArrangement={{ spacedBy: 12 }}>
            {palette.map((swatch) => (
              <Column
                key={swatch}
                horizontalAlignment="center"
                verticalArrangement="center"
                modifiers={[size(40, 40), clip(Shapes.Circle), background(swatch), clickable(() => setColor(swatch))]}
              >
                {swatch === color ? <Icon source={Check} size={22} tint="#ffffff" /> : null}
              </Column>
            ))}
          </FlowRow>

          <Text color={m.onSurfaceVariant} style={m3Text('labelLarge')}>Icon</Text>
          <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
            {icons.map((choice) => (
              <Column
                key={choice}
                horizontalAlignment="center"
                verticalArrangement="center"
                modifiers={[size(48, 48), clip(Shapes.Circle), background(choice === icon ? m.secondaryContainer : m.surfaceContainerLow), clickable(() => setIcon(choice))]}
              >
                <Icon source={PRESET_ICON_SOURCES[choice]} size={24} tint={color} />
              </Column>
            ))}
          </FlowRow>

          <Text color={m.onSurfaceVariant} style={m3Text('labelLarge')}>Place</Text>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Text color={m.onSurface} style={m3Text('bodyLarge')} modifiers={[weight(1)]}>{placeName(place)}</Text>
            {placeEditable ? (
              <TextButton onClick={() => setPicking(!picking)}>
                <Text style={m3Text('labelLarge')}>{picking ? 'Done' : place ? 'Change' : 'Set place'}</Text>
              </TextButton>
            ) : (
              <TextButton onClick={onOpenSettings}>
                <Text style={m3Text('labelLarge')}>Change in Settings</Text>
              </TextButton>
            )}
          </Row>
          {placeEditable && picking ? (
            <Column modifiers={[fillMaxWidth()]}>
              <OutlinedTextField
                ref={field}
                autoFocus
                singleLine
                onValueChange={setQuery}
                keyboardOptions={{ capitalization: 'words', autoCorrectEnabled: false, imeAction: 'search' }}
                modifiers={[fillMaxWidth()]}
              >
                <OutlinedTextField.LeadingIcon>
                  <Icon source={Search} size={24} />
                </OutlinedTextField.LeadingIcon>
                <OutlinedTextField.Placeholder>
                  <Text style={m3Text('bodyLarge')}>Search places</Text>
                </OutlinedTextField.Placeholder>
              </OutlinedTextField>
              {hint ? <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')} modifiers={[padding(16, 8, 16, 0)]}>{hint}</Text> : null}
              {loading ? (
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[padding(16, 8, 16, 8)]}>
                  <LoadingIndicator modifiers={[size(24, 24)]} />
                  <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Searching…</Text>
                </Row>
              ) : null}
              {results.slice(0, 5).map((result, index) => (
                <ListItem key={`${index}-${result.coordinates.join(',')}`} modifiers={[fillMaxWidth(), clickable(() => setPicked({ place: result }))]}>
                  <ListItem.LeadingContent>
                    <Icon source={LocationOn} size={24} tint={m.onSurfaceVariant} />
                  </ListItem.LeadingContent>
                  <ListItem.HeadlineContent>
                    <Text style={m3Text('bodyLarge')}>{placeName(result)}</Text>
                  </ListItem.HeadlineContent>
                </ListItem>
              ))}
            </Column>
          ) : null}

          {error ? <Text color={m.error} style={m3Text('bodyMedium')}>{error}</Text> : null}
          <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
            <OutlinedButton onClick={onClose} modifiers={[weight(1)]}>
              <Text style={m3Text('labelLarge')}>Cancel</Text>
            </OutlinedButton>
            <Button enabled={!saving} onClick={() => onSave({ color, icon, place })} modifiers={[weight(1)]}>
              <Text style={m3Text('labelLarge')}>{saving ? 'Saving…' : 'Save'}</Text>
            </Button>
          </Row>
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute' }
});
