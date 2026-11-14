import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  Column,
  FilterChip,
  HorizontalDivider,
  Icon,
  IconButton,
  Row,
  Surface,
  Text,
  useMaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, height, horizontalScroll, padding, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import SwapVert from '../../../assets/icons/swap_vert_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import Warning from '../../../assets/icons/warning_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { CARD_RADIUS, corners, MODE_ICONS, RouteCard } from './RouteCard.android';
import type { ResultsChromeProps } from './ResultsScreen';

const COLLAPSED_SHARE = 0.58;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;

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
              <IconButton onClick={props.onSwap}>
                <Icon source={SwapVert} size={24} contentDescription="Swap start and destination" />
              </IconButton>
            </Row>
          </Surface>
          <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), horizontalScroll()]}>
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
            </Column>
          </Host>
          <BottomSheetScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}>
            {props.message ? (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')} modifiers={[padding(4, 12, 4, 12)]}>{props.message}</Text>
              </Host>
            ) : null}
            {props.cards.map((card) => (
              <Host key={card.id} matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <RouteCard
                  card={card}
                  canSave={props.canSave}
                  m={m}
                  onSelect={() => props.onSelect(card.id)}
                  onSave={() => props.onSave(card.id)}
                />
              </Host>
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
