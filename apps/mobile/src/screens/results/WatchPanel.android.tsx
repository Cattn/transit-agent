import { useState } from 'react';
import { Host } from '@expo/ui';
import { Button, Column, HorizontalDivider, Icon, ListItem, LoadingIndicator, ModalBottomSheet, OutlinedButton, Row, Surface, Switch, Text, type MaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, size, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import Location from '../../../assets/icons/my_location_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { corners } from './RouteCard.android';
import type { SavedTripActions } from './ResultsScreen';

export function WatchPanel({ trip, m, scheme }: { trip: SavedTripActions; m: MaterialColors; scheme: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const rowColors = { containerColor: m.surfaceContainerLow, contentColor: m.onSurface, supportingContentColor: m.onSurfaceVariant };
  const label = trip.rerouting ? 'Finding another route…' : trip.change ? 'Route updated' : trip.boardingLabel ? 'Confirm boarding' : 'Trip status';
  return (
    <Host matchContents colorScheme={scheme} seedColor={materialSeedColor}>
      <Surface onClick={() => setOpen(true)} color={m.secondaryContainer} contentColor={m.onSecondaryContainer} shadowElevation={2} shape={corners(28)}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[padding(18, 12, 18, 12)]}>
          {trip.rerouting ? <LoadingIndicator modifiers={[size(20, 20)]} /> : <Icon source={trip.boardingLabel || trip.change ? DirectionsBus : Schedule} size={20} />}
          <Text style={m3Text('labelLarge')}>{label}</Text>
        </Row>
      </Surface>
      {open ? (
        <ModalBottomSheet onDismissRequest={() => setOpen(false)} containerColor={m.surfaceContainerLow} contentColor={m.onSurface}>
          <Column verticalArrangement={{ spacedBy: 20 }} modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
              <Text style={m3Text('headlineSmall')}>{trip.rerouting ? 'Finding another route…' : trip.change ? 'Route updated' : trip.boardingLabel ?? 'Trip status'}</Text>
              {trip.rerouting ? (
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
                  <LoadingIndicator modifiers={[size(32, 32)]} />
                  <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>Checking routes that meet your requirements.</Text>
                </Row>
              ) : trip.status ? <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>{trip.boardingLabel ? trip.status.replace(/ Are you on board\?$/, '') : trip.status}</Text> : null}
            </Column>
            {trip.change ? (
              <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
                <Text color={m.primary} style={m3Text('labelLarge')}>Route updated</Text>
                <Text style={m3Text('bodyMedium')}>{trip.change}</Text>
                <OutlinedButton
                  enabled={!dismissing}
                  onClick={() => {
                    setDismissing(true);
                    void trip.onDismissChange?.().then((done) => { if (done) setOpen(false); }).finally(() => setDismissing(false));
                  }}
                  modifiers={[fillMaxWidth(), height(48)]}
                >
                  <Text style={m3Text('labelLarge')}>{dismissing ? 'Dismissing…' : 'Dismiss update'}</Text>
                </OutlinedButton>
              </Column>
            ) : null}
            {trip.boardingLabel ? (
              <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
                <Button enabled={!trip.rerouting} onClick={() => { trip.onBoard?.(); setOpen(false); }} modifiers={[fillMaxWidth(), height(48)]}>
                  <Text style={m3Text('labelLarge')}>Yes, I'm on board</Text>
                </Button>
                <OutlinedButton enabled={!trip.rerouting} onClick={trip.onMissed} modifiers={[fillMaxWidth(), height(48)]}>
                  <Text style={m3Text('labelLarge')}>No, find next route</Text>
                </OutlinedButton>
              </Column>
            ) : null}
            {trip.watch && trip.onToggleLocation ? (
              <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
                <HorizontalDivider color={m.outlineVariant} />
                <Text color={m.onSurfaceVariant} style={m3Text('labelLarge')}>Optional</Text>
                <ListItem colors={rowColors}>
                  <ListItem.LeadingContent><Icon source={Location} size={24} /></ListItem.LeadingContent>
                  <ListItem.HeadlineContent><Text>Share trip location</Text></ListItem.HeadlineContent>
                  <ListItem.SupportingContent><Text>Only while Home is open. Helps confirm boarding and find your next route.</Text></ListItem.SupportingContent>
                  <ListItem.TrailingContent><Switch value={trip.sharingLocation ?? false} onCheckedChange={trip.onToggleLocation} /></ListItem.TrailingContent>
                </ListItem>
              </Column>
            ) : null}
            {trip.error ? (
              <Column verticalArrangement={{ spacedBy: 8 }}>
                <Text color={m.error} style={m3Text('bodyMedium')}>{trip.error}</Text>
                <OutlinedButton onClick={trip.onRetry} modifiers={[fillMaxWidth(), height(48)]}><Text style={m3Text('labelLarge')}>Retry</Text></OutlinedButton>
              </Column>
            ) : null}
          </Column>
        </ModalBottomSheet>
      ) : null}
    </Host>
  );
}
