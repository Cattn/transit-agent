import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  AlertDialog,
  Button,
  Column,
  FilterChip,
  HorizontalDivider,
  Icon,
  IconButton,
  Row,
  Shape,
  Surface,
  Switch,
  Text,
  TextButton,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, height, horizontalScroll, padding, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { Tone } from '@transit/shared';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import BookmarkAdd from '../../../assets/icons/bookmark_add_fill.xml';
import Delete from '../../../assets/icons/delete_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBoat from '../../../assets/icons/directions_boat_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import Flight from '../../../assets/icons/flight_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Notifications from '../../../assets/icons/notifications_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import SwapVert from '../../../assets/icons/swap_vert_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import Warning from '../../../assets/icons/warning_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { toneRole, type LegChip } from './ItineraryCard';
import type { ResultCard, ResultsChromeProps } from './ResultsScreen';

const MODE_ICONS: Record<LegChip['mode'], number> = {
  walk: DirectionsWalk,
  bike: DirectionsBike,
  bikeshare: DirectionsBike,
  bus: DirectionsBus,
  rail: Train,
  ferry: DirectionsBoat,
  car: DirectionsCar,
  flight: Flight
};
const COLLAPSED_SHARE = 0.58;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;
const CARD_RADIUS = 16;

function corners(radius: number) {
  return Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
}

function toneColors(tone: Tone, m: MaterialColors): { bg: string; fg: string } {
  const role = toneRole(tone);
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
}

function LegChips({ chips, m }: { chips: LegChip[]; m: MaterialColors }) {
  return (
    <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
      {chips.map((chip, index) => (
        <Row key={chip.id} horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
          {index > 0 ? <Text color={m.outline} style={m3Text('labelLarge')}>›</Text> : null}
          {chip.transit ? (
            <Surface color={m.primaryContainer} contentColor={m.onPrimaryContainer} shape={corners(8)}>
              <Row horizontalArrangement={{ spacedBy: 2 }} verticalAlignment="center" modifiers={[padding(6, 3, 8, 3)]}>
                <Icon source={MODE_ICONS[chip.mode]} size={18} tint={m.onPrimaryContainer} />
                <Text color={m.onPrimaryContainer} style={m3Text('labelLarge', 700)}>{chip.label}</Text>
              </Row>
            </Surface>
          ) : (
            <Row horizontalArrangement={{ spacedBy: 2 }} verticalAlignment="center">
              <Icon source={MODE_ICONS[chip.mode]} size={18} tint={m.onSurfaceVariant} />
              <Text color={m.onSurfaceVariant} style={m3Text('labelMedium')}>{chip.label}</Text>
            </Row>
          )}
        </Row>
      ))}
    </Row>
  );
}

function RouteCard({ card, canSave, m, scheme, onSelect, onSave }: {
  card: ResultCard;
  canSave: boolean;
  m: MaterialColors;
  scheme: 'light' | 'dark';
  onSelect: () => void;
  onSave: () => void;
}) {
  const { text, selected, saved } = card;
  const risk = toneColors(text.risk.tone, m);
  const pill = text.live
    ? { bg: m.primaryContainer, fg: m.onPrimaryContainer, icon: Sensors }
    : { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant, icon: Schedule };

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      <Surface
        color={m.surfaceContainerLowest}
        contentColor={m.onSurface}
        shape={corners(CARD_RADIUS)}
        border={{ width: selected ? 2 : 1, color: selected ? m.primary : m.outlineVariant }}
        modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(CARD_RADIUS)), clickable(onSelect)]}
      >
        <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[padding(16, 14, 16, 14)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Text color={m.onSurface} style={m3Text('titleMedium')} modifiers={[weight(1)]}>{text.times}</Text>
            <Text color={m.onSurface} style={m3Text('titleMedium', 700)}>{text.duration}</Text>
          </Row>
          <LegChips chips={text.chips} m={m} />
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[weight(1)]}>
              <Surface color={pill.bg} contentColor={pill.fg} shape={corners(12)}>
                <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[padding(7, 2, 9, 2)]}>
                  <Icon source={pill.icon} size={14} tint={pill.fg} />
                  <Text color={pill.fg} maxLines={1} style={m3Text('labelMedium')}>{text.freshness.label}</Text>
                </Row>
              </Surface>
              {text.detail ? <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={m3Text('labelSmall')}>{text.detail}</Text> : null}
            </Row>
            <Text color={m.onSurface} style={m3Text('labelLarge')}>{text.cost}</Text>
            <Surface color={risk.bg} contentColor={risk.fg} shape={corners(8)}>
              <Text color={risk.fg} style={m3Text('labelMedium')} modifiers={[padding(8, 2, 8, 2)]}>{text.risk.label}</Text>
            </Surface>
          </Row>
          {selected ? (
            <Column verticalArrangement={{ spacedBy: 8 }}>
              <HorizontalDivider color={m.outlineVariant} />
              {text.details.map((leg) => (
                <Column key={leg.id} verticalArrangement={{ spacedBy: 1 }}>
                  <Text color={m.onSurface} style={m3Text('bodyMedium', 500)}>{leg.label}</Text>
                  <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>{`${leg.times} · ${leg.freshness.label}`}</Text>
                </Column>
              ))}
              <Row horizontalArrangement="end" modifiers={[fillMaxWidth()]}>
                <Button enabled={canSave && !saved} onClick={onSave}>
                  <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
                    <Icon source={saved ? Check : BookmarkAdd} size={18} />
                    <Text style={m3Text('labelLarge')}>{saved ? 'Saved' : 'Save'}</Text>
                  </Row>
                </Button>
              </Row>
            </Column>
          ) : null}
        </Column>
      </Surface>
    </Host>
  );
}

export function ResultsChrome(props: ResultsChromeProps) {
  const scheme = props.colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [topHeight, setTopHeight] = useState(180);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const expanded = Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP));
  const collapsed = Math.min(Math.round(containerHeight * COLLAPSED_SHARE), expanded - MIN_TRAVEL);
  const snapPoints = [collapsed, expanded];

  const settle = (index: number) => {
    if (index < 0) return;
    props.onSheetLayout(snapPoints[index] ?? collapsed);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}>
      <Host
        matchContents={{ vertical: true }}
        colorScheme={scheme}
        seedColor={materialSeedColor}
        style={[styles.top, { top: insets.top + 4 }]}
        onLayoutContent={(event) => setTopHeight(event.nativeEvent.height)}
      >
        <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
          <Surface color={m.surfaceContainerLowest} contentColor={m.onSurface} shadowElevation={3} shape={corners(24)} modifiers={[fillMaxWidth()]}>
            <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(4, 6, 12, 10)]}>
              <IconButton onClick={props.onBack}>
                <Icon source={ArrowBack} size={24} contentDescription="Back" />
              </IconButton>
              <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[weight(1)]}>
                <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[height(24)]}>
                  <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(20, 20)]}>
                    <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(10, 10), clip(Shapes.Circle), background(m.primary)]}>
                      <Row modifiers={[size(6, 6), clip(Shapes.Circle), background(m.surfaceContainerLowest)]}>{null}</Row>
                    </Row>
                  </Row>
                  <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyLarge')}>{props.origin}</Text>
                </Row>
                <HorizontalDivider color={m.outlineVariant} />
                <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[height(24)]}>
                  <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(20, 20)]}>
                    <Icon source={LocationOn} size={18} tint={m.error} />
                  </Row>
                  <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyLarge')}>{props.destination}</Text>
                </Row>
              </Column>
              {props.onSwap ? (
                <IconButton onClick={props.onSwap}>
                  <Icon source={SwapVert} size={24} contentDescription="Swap start and destination" />
                </IconButton>
              ) : null}
            </Row>
          </Surface>
          {props.onOpenFilters ? <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), horizontalScroll()]}>
            {props.chips.map((chip) => (
              <FilterChip key={chip.key} selected onClick={props.onOpenFilters}>
                <FilterChip.LeadingIcon>
                  <Icon source={Check} size={18} />
                </FilterChip.LeadingIcon>
                <FilterChip.Label>
                  <Text style={m3Text('labelLarge')}>{chip.label}</Text>
                </FilterChip.Label>
                {chip.kind === 'agent' ? (
                  <FilterChip.TrailingIcon>
                    <Icon source={Edit} size={18} />
                  </FilterChip.TrailingIcon>
                ) : null}
              </FilterChip>
            ))}
            <FilterChip
              selected={false}
              onClick={props.onOpenFilters}
              colors={{ containerColor: m.surfaceContainerLow, labelColor: m.onSurfaceVariant, iconColor: m.onSurfaceVariant }}
              border={{ width: 0, color: m.surfaceContainerLow }}
            >
              <FilterChip.LeadingIcon>
                <Icon source={Tune} size={18} />
              </FilterChip.LeadingIcon>
              <FilterChip.Label>
                <Text style={m3Text('labelLarge')}>Filters</Text>
              </FilterChip.Label>
            </FilterChip>
          </Row> : null}
        </Column>
      </Host>

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        onChange={settle}
        onAnimate={(_from, to) => settle(to)}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: m.surfaceContainerLow }]}
        handleIndicatorStyle={[styles.handle, { backgroundColor: m.onSurfaceVariant }]}
      >
        <View style={styles.sheetContent}>
          <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
            <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(16, 4, 16, 10)]}>
              <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text color={m.onSurface} style={m3Text('titleLarge')}>{props.title}</Text>
                  {props.subtitle ? <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.subtitle}</Text> : null}
                </Column>
                {props.updated ? (
                  <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
                    <Icon source={props.live ? Sensors : Schedule} size={16} tint={props.live ? m.primary : m.onSurfaceVariant} />
                    <Text color={m.onSurfaceVariant} style={m3Text('labelMedium')}>{props.updated}</Text>
                  </Row>
                ) : null}
              </Row>
              {props.warning ? (
                <Row
                  horizontalArrangement={{ spacedBy: 10 }}
                  verticalAlignment="center"
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(m.surfaceContainerHighest), padding(12, 10, 12, 10)]}
                >
                  <Icon source={Warning} size={18} tint={m.onSurfaceVariant} />
                  <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')} modifiers={[weight(1)]}>{props.warning}</Text>
                </Row>
              ) : null}
              {props.saveError ? (
                <Row
                  horizontalArrangement={{ spacedBy: 10 }}
                  verticalAlignment="center"
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(m.errorContainer), padding(12, 4, 4, 4)]}
                >
                  <Icon source={Warning} size={18} tint={m.onErrorContainer} />
                  <Text color={m.onErrorContainer} style={m3Text('bodySmall')} modifiers={[weight(1)]}>{props.saveError}</Text>
                  <TextButton onClick={props.onRetrySave}>
                    <Text color={m.onErrorContainer} style={m3Text('labelLarge', 700)}>Retry</Text>
                  </TextButton>
                </Row>
              ) : null}
              {props.savedTrip ? (
                <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                  <Icon source={Notifications} size={20} tint={m.onSurfaceVariant} />
                  <Text color={m.onSurface} style={m3Text('bodyLarge')} modifiers={[weight(1)]}>Watch this trip</Text>
                  <Switch value={props.savedTrip.watch} onCheckedChange={props.savedTrip.onToggleWatch} />
                  <IconButton onClick={() => setConfirmDelete(true)}>
                    <Icon source={Delete} size={24} tint={m.error} contentDescription="Delete saved trip" />
                  </IconButton>
                </Row>
              ) : null}
              {props.savedTrip?.error ? (
                <Row
                  horizontalArrangement={{ spacedBy: 10 }}
                  verticalAlignment="center"
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), background(m.errorContainer), padding(12, 4, 4, 4)]}
                >
                  <Icon source={Warning} size={18} tint={m.onErrorContainer} />
                  <Text color={m.onErrorContainer} style={m3Text('bodySmall')} modifiers={[weight(1)]}>{props.savedTrip.error}</Text>
                  <TextButton onClick={props.savedTrip.onRetry}>
                    <Text color={m.onErrorContainer} style={m3Text('labelLarge', 700)}>Retry</Text>
                  </TextButton>
                </Row>
              ) : null}
              {confirmDelete && props.savedTrip ? (
                <AlertDialog onDismissRequest={() => setConfirmDelete(false)}>
                  <AlertDialog.Title>
                    <Text style={m3Text('headlineSmall')}>Delete this trip?</Text>
                  </AlertDialog.Title>
                  <AlertDialog.Text>
                    <Text style={m3Text('bodyMedium')}>It will be removed from your saved trips and will no longer be watched.</Text>
                  </AlertDialog.Text>
                  <AlertDialog.ConfirmButton>
                    <TextButton onClick={() => { setConfirmDelete(false); props.savedTrip?.onDelete(); }}>
                      <Text color={m.error} style={m3Text('labelLarge')}>Delete</Text>
                    </TextButton>
                  </AlertDialog.ConfirmButton>
                  <AlertDialog.DismissButton>
                    <TextButton onClick={() => setConfirmDelete(false)}>
                      <Text style={m3Text('labelLarge')}>Cancel</Text>
                    </TextButton>
                  </AlertDialog.DismissButton>
                </AlertDialog>
              ) : null}
            </Column>
          </Host>
          <BottomSheetScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}>
            {props.message ? (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')} modifiers={[padding(4, 12, 4, 12)]}>{props.message}</Text>
              </Host>
            ) : null}
            {props.cards.map((card) => (
              <RouteCard
                key={card.id}
                card={card}
                canSave={props.canSave}
                m={m}
                scheme={scheme}
                onSelect={() => props.onSelect(card.id)}
                onSave={() => props.onSave(card.id)}
              />
            ))}
            {props.nearMisses.length ? (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 6, 0, 0)]}>
                  <Text color={m.onSurfaceVariant} style={m3Text('titleSmall')}>Almost works</Text>
                  {props.nearMisses.map((miss) => (
                    <Surface
                      key={miss.id}
                      color={m.surfaceContainerLowest}
                      contentColor={m.onSurface}
                      shape={corners(CARD_RADIUS)}
                      border={{ width: 1, color: m.outlineVariant }}
                      modifiers={[fillMaxWidth()]}
                    >
                      <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center" modifiers={[padding(16, 12, 16, 12)]}>
                        <Icon source={MODE_ICONS[miss.mode]} size={24} tint={m.onSurfaceVariant} />
                        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                          <Text color={m.onSurface} style={m3Text('titleSmall')}>{miss.title}</Text>
                          {miss.reason ? <Text color={m.error} style={m3Text('bodySmall')}>{miss.reason}</Text> : null}
                        </Column>
                        <Text color={m.onSurface} style={m3Text('labelLarge')}>{miss.cost}</Text>
                      </Row>
                    </Surface>
                  ))}
                </Column>
              </Host>
            ) : null}
          </BottomSheetScrollView>
        </View>
      </BottomSheet>
      <View pointerEvents="none" style={[styles.navStrip, { height: insets.bottom, backgroundColor: m.surfaceContainerLow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12 },
  fullWidth: { width: '100%' },
  sheetBackground: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 32, height: 4, opacity: 0.4 },
  sheetContent: { flex: 1 },
  list: { flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingTop: 2 },
  navStrip: { position: 'absolute', left: 0, right: 0, bottom: 0 }
});
