import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Host } from '@expo/ui';
import { Column, Icon, ListItem, LoadingIndicator, OutlinedTextField, Row, Text, useMaterialColors, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth, padding, size } from '@expo/ui/jetpack-compose/modifiers';
import { usePlaceSearch } from '@transit/client-react';
import type { Place } from '@transit/shared';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import MyLocation from '../../../assets/icons/my_location_fill.xml';
import Search from '../../../assets/icons/search_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { PlaceFieldProps } from './PlaceField';

function placeName(place: Place): string {
  return place.name ?? `${place.coordinates[1].toFixed(4)}, ${place.coordinates[0].toFixed(4)}`;
}

export function PlaceField({ near, showLocation, locating, notice, onPick, onUseLocation }: PlaceFieldProps) {
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const field = useRef<TextFieldRef>(null);
  const [query, setQuery] = useState('');
  const { results, loading } = usePlaceSearch(query, { near });
  const trimmed = query.trim();
  const hint = trimmed.length > 0 && trimmed.length < 3
    ? 'Type at least 3 letters'
    : !loading && trimmed.length >= 3 && results.length === 0 ? 'No places found' : undefined;
  const [after, setAfter] = useState<{ run: () => void }>();
  const blurThen = (run: () => void) => setAfter({ run });

  useEffect(() => {
    if (!after) return;
    void (field.current?.blur() ?? Promise.resolve()).catch(() => undefined).then(after.run);
  }, [after]);

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
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
          {hint ? (
            <OutlinedTextField.SupportingText>
              <Text style={m3Text('bodySmall')}>{hint}</Text>
            </OutlinedTextField.SupportingText>
          ) : null}
        </OutlinedTextField>
        {showLocation ? (
          <ListItem modifiers={locating ? [fillMaxWidth()] : [fillMaxWidth(), clickable(() => blurThen(onUseLocation))]}>
            <ListItem.LeadingContent>
              <Icon source={MyLocation} size={24} tint={m.primary} />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text color={m.primary} style={m3Text('bodyLarge')}>{locating ? 'Finding your location…' : 'Use my location'}</Text>
            </ListItem.HeadlineContent>
          </ListItem>
        ) : null}
        {notice ? (
          <Text color={m.error} style={m3Text('bodyMedium')} modifiers={[padding(16, 4, 16, 4)]}>{notice}</Text>
        ) : null}
        {loading ? (
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[padding(16, 8, 16, 8)]}>
            <LoadingIndicator modifiers={[size(24, 24)]} />
            <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Searching…</Text>
          </Row>
        ) : null}
        {results.map((place, index) => (
          <ListItem key={`${index}-${place.coordinates.join(',')}`} modifiers={[fillMaxWidth(), clickable(() => blurThen(() => onPick(place)))]}>
            <ListItem.LeadingContent>
              <Icon source={LocationOn} size={24} tint={m.onSurfaceVariant} />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text style={m3Text('bodyLarge')}>{placeName(place)}</Text>
            </ListItem.HeadlineContent>
          </ListItem>
        ))}
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' }
});
