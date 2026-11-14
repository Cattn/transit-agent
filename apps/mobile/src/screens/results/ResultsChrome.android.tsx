import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  AssistChip,
  Column,
  FilterChip,
  HorizontalDivider,
  Icon,
  IconButton,
  Row,
  Shape,
  Surface,
  Text,
  TextButton,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { alpha, background, clip, fillMaxWidth, horizontalScroll, padding, paddingAll, Shapes, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { Tone } from '@transit/shared';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import BookmarkAdd from '../../../assets/icons/bookmark_add_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import ChevronRight from '../../../assets/icons/chevron_right_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBoat from '../../../assets/icons/directions_boat_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import Flight from '../../../assets/icons/flight_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import RadioButtonUnchecked from '../../../assets/icons/radio_button_unchecked_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import SwapVert from '../../../assets/icons/swap_vert_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import WandShine from '../../../assets/icons/wand_shine_fill.xml';
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
const CARD_RADIUS = 20;

function corners(radius: number) {
  return Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
}

function toneColors(tone: Tone, m: MaterialColors): { bg: string; fg: string } {
  const role = toneRole(tone);
  if (role === 'primary') return { bg: m.primaryContainer, fg: m.onPrimaryContainer };
  if (role === 'secondary') return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  return { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant };
}

function LegChips({ chips, m }: { chips: LegChip[]; m: MaterialColors }) {
  return (
    <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
      {chips.map((chip, index) => (
        <Row key={chip.id} horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
          {index > 0 ? <Icon source={ChevronRight} size={16} tint={m.onSurfaceVariant} /> : null}
          {chip.transit ? (
            <Row
              horizontalArrangement={{ spacedBy: 4 }}
              verticalAlignment="center"
              modifiers={[clip(Shapes.RoundedCorner(8)), background(m.primaryContainer), padding(6, 3, 8, 3)]}
            >
              <Icon source={MODE_ICONS[chip.mode]} size={16} tint={m.onPrimaryContainer} />
              <Text color={m.onPrimaryContainer} style={m3Text('labelLarge')}>{chip.label}</Text>
            </Row>
          ) : (
            <Row horizontalArrangement={{ spacedBy: 1 }} verticalAlignment="center">
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
  const freshColor = text.live ? m.primary : m.onSurfaceVariant;

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      <Surface
        color={m.surfaceContainerLowest}
        contentColor={m.onSurface}
        shape={corners(CARD_RADIUS)}
        border={{ width: selected ? 2 : 1, color: selected ? m.primary : m.outlineVariant }}
        onClick={onSelect}
        modifiers={[fillMaxWidth()]}
      >
        <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[paddingAll(16)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Text color={m.onSurface} style={m3Text('titleMedium', 700)} modifiers={[weight(1)]}>{text.times}</Text>
            <Text color={m.onSurface} style={m3Text('titleMedium', 700)}>{text.duration}</Text>
          </Row>
          <LegChips chips={text.chips} m={m} />
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[weight(1)]}>
              <Icon source={text.live ? Sensors : Schedule} size={14} tint={freshColor} />
              <Text color={freshColor} maxLines={1} style={m3Text('labelMedium', 700)}>{text.freshness.label}</Text>
              <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={m3Text('bodySmall')}>{text.updated}</Text>
            </Row>
            <Text color={m.onSurface} style={m3Text('titleSmall', 700)}>{text.cost}</Text>
            <Text color={risk.fg} style={m3Text('labelMedium')} modifiers={[clip(Shapes.RoundedCorner(8)), background(risk.bg), padding(8, 3, 8, 3)]}>
              {text.risk.label}
            </Text>
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
                <TextButton enabled={canSave && !saved} onClick={onSave}>
                  <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
                    <Icon source={saved ? Check : BookmarkAdd} size={18} />
                    <Text style={m3Text('labelLarge')}>{saved ? 'Saved' : 'Save'}</Text>
                  </Row>
                </TextButton>
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
          <Surface color={m.surfaceContainerLowest} contentColor={m.onSurface} shadowElevation={3} shape={corners(16)} modifiers={[fillMaxWidth()]}>
            <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(4, 6, 4, 6)]}>
              <IconButton onClick={props.onBack}>
                <Icon source={ArrowBack} size={24} contentDescription="Back" />
              </IconButton>
              <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[weight(1), padding(0, 4, 0, 4)]}>
                <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center">
                  <Icon source={RadioButtonUnchecked} size={16} tint={m.primary} />
                  <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyLarge')}>{props.origin}</Text>
                </Row>
                <HorizontalDivider color={m.outlineVariant} modifiers={[padding(26, 0, 0, 0)]} />
                <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center">
                  <Icon source={LocationOn} size={16} tint={m.error} />
                  <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyLarge')}>{props.destination}</Text>
                </Row>
              </Column>
              <IconButton onClick={props.onSwap}>
                <Icon source={SwapVert} size={24} contentDescription="Swap start and destination" />
              </IconButton>
            </Row>
          </Surface>
          <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), horizontalScroll()]}>
            {props.chips.map((chip) => chip.kind === 'agent' ? (
              <AssistChip key={chip.key} onClick={props.onOpenFilters} colors={{ containerColor: m.surfaceContainerLowest }}>
                <AssistChip.LeadingIcon>
                  <Icon source={WandShine} size={18} />
                </AssistChip.LeadingIcon>
                <AssistChip.Label>
                  <Text style={m3Text('labelLarge')}>{chip.label}</Text>
                </AssistChip.Label>
                <AssistChip.TrailingIcon>
                  <Icon source={Edit} size={16} />
                </AssistChip.TrailingIcon>
              </AssistChip>
            ) : (
              <FilterChip key={chip.key} selected onClick={props.onOpenFilters}>
                <FilterChip.LeadingIcon>
                  <Icon source={Check} size={18} />
                </FilterChip.LeadingIcon>
                <FilterChip.Label>
                  <Text style={m3Text('labelLarge')}>{chip.label}</Text>
                </FilterChip.Label>
              </FilterChip>
            ))}
            <AssistChip onClick={props.onOpenFilters} colors={{ containerColor: m.surfaceContainerLowest }}>
              <AssistChip.LeadingIcon>
                <Icon source={Tune} size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text style={m3Text('labelLarge')}>Filters</Text>
              </AssistChip.Label>
            </AssistChip>
          </Row>
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
        <BottomSheetView style={styles.sheetContent}>
          <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
            <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(16, 4, 16, 10)]}>
              <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text color={m.onSurface} style={m3Text('headlineSmall')}>{props.title}</Text>
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
                <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
                  <Text color={m.onSurface} style={m3Text('titleSmall')}>Almost works</Text>
                  {props.nearMisses.map((miss) => (
                    <Column
                      key={miss.id}
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[fillMaxWidth(), alpha(0.7), clip(Shapes.RoundedCorner(16)), background(m.surfaceContainerHighest), paddingAll(14)]}
                    >
                      <Text color={m.onSurface} style={m3Text('bodyMedium', 500)}>{miss.title}</Text>
                      {miss.reason ? <Text color={m.error} style={m3Text('bodySmall')}>{miss.reason}</Text> : null}
                    </Column>
                  ))}
                </Column>
              </Host>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheetView>
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
