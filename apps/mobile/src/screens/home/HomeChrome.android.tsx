import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  AssistChip,
  Column,
  DockedSearchBar,
  ElevatedCard,
  ExtendedFloatingActionButton,
  FilledTonalIconButton,
  FloatingActionButton,
  Icon,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, horizontalScroll, padding, paddingAll, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import AccountCircle from '@expo/material-symbols/account_circle.xml';
import DirectionsBus from '@expo/material-symbols/directions_bus.xml';
import DirectionsCar from '@expo/material-symbols/directions_car.xml';
import FitnessCenter from '@expo/material-symbols/fitness_center.xml';
import Flight from '@expo/material-symbols/flight.xml';
import HomeIcon from '@expo/material-symbols/home.xml';
import MyLocation from '@expo/material-symbols/my_location.xml';
import Notifications from '@expo/material-symbols/notifications.xml';
import Schedule from '@expo/material-symbols/schedule.xml';
import Search from '@expo/material-symbols/search.xml';
import Sensors from '@expo/material-symbols/sensors.xml';
import Settings from '@expo/material-symbols/settings.xml';
import WandShine from '@expo/material-symbols/wand_shine.xml';
import Work from '@expo/material-symbols/work.xml';
import type { SavedItinerary } from '@transit/shared';
import { materialSeedColor } from '../../theme/colors';
import type { HomeChromeProps, SavedPlaceChip } from './HomeScreen';
import { MODE_OPTIONS, type ModeGroupName } from './ModeSlider';
import { tileRole, tripCardText } from './TrackedTripCard';

const MODE_ICONS: Record<ModeGroupName, number> = { transit: DirectionsBus, drive: DirectionsCar, fly: Flight };
const CHIP_ICONS: Record<SavedPlaceChip['key'], number> = { home: HomeIcon, office: Work, gym: FitnessCenter };
const HANDLE_HEIGHT = 24;
const LIST_CAP = 236;
const COLLAPSED_MAX_SHARE = 0.55;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;

function tileColors(role: ReturnType<typeof tileRole>, m: MaterialColors): { bg: string; fg: string } {
  if (role === 'secondary') return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  return { bg: m.primaryContainer, fg: m.onPrimaryContainer };
}

function TripCard({ trip, now, m, scheme }: { trip: SavedItinerary; now: Date; m: MaterialColors; scheme: 'light' | 'dark' }) {
  const text = tripCardText(trip, now);
  const tile = tileColors(tileRole(text.state), m);
  const pill = text.live
    ? { bg: m.primaryContainer, fg: m.onPrimaryContainer, icon: Sensors }
    : { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant, icon: Schedule };

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      <ElevatedCard colors={{ containerColor: m.surfaceContainerLowest }} elevation={2} modifiers={[fillMaxWidth()]}>
        <Row horizontalArrangement={{ spacedBy: 14 }} verticalAlignment="center" modifiers={[paddingAll(12)]}>
          <Column
            horizontalAlignment="center"
            verticalArrangement="center"
            modifiers={[size(80, 88), clip(Shapes.RoundedCorner(20)), background(tile.bg)]}
          >
            {'label' in text.tile ? (
              <Text color={tile.fg} style={{ typography: 'labelLarge', textAlign: 'center' }}>{text.tile.label}</Text>
            ) : (
              <>
                <Text color={tile.fg} style={{ typography: 'labelMedium' }}>{text.tile.top}</Text>
                <Text color={tile.fg} style={{ typography: 'headlineLarge', fontWeight: '700' }}>{text.tile.value}</Text>
                <Text color={tile.fg} style={{ typography: 'labelMedium' }}>{text.tile.bottom}</Text>
              </>
            )}
          </Column>
          <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
            <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={{ typography: 'titleMedium' }}>{text.title}</Text>
            <Text color={m.onSurfaceVariant} maxLines={2} overflow="ellipsis" style={{ typography: 'bodyMedium' }}>{text.message}</Text>
            <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
              <Row
                horizontalArrangement={{ spacedBy: 4 }}
                verticalAlignment="center"
                modifiers={[clip(Shapes.RoundedCorner(12)), background(pill.bg), padding(8, 3, 10, 3)]}
              >
                <Icon source={pill.icon} size={14} tint={pill.fg} />
                <Text color={pill.fg} style={{ typography: 'labelMedium', fontWeight: '700' }}>{text.freshness.label}</Text>
              </Row>
              <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={{ typography: 'bodySmall' }} modifiers={[weight(1)]}>
                {text.meta}
              </Text>
            </Row>
          </Column>
        </Row>
      </ElevatedCard>
    </Host>
  );
}

export function HomeChrome(props: HomeChromeProps) {
  const { colors, group, trips, now, chips, locating, notice, status } = props;
  const scheme = colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [footerHeight, setFooterHeight] = useState(72 + insets.bottom);
  const [listHeight, setListHeight] = useState(LIST_CAP);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [topHeight, setTopHeight] = useState(126);

  const expanded = Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP));
  const natural = Math.round(HANDLE_HEIGHT + headerHeight + Math.min(listHeight, LIST_CAP) + footerHeight + 8);
  const collapsed = Math.min(natural, Math.round(containerHeight * COLLAPSED_MAX_SHARE), expanded - MIN_TRAVEL);
  const snapPoints = [collapsed, expanded];
  const visible = snapPoints[sheetIndex] ?? collapsed;

  const settle = (index: number) => {
    if (index < 0) return;
    setSheetIndex(index);
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
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <DockedSearchBar onQueryChange={() => undefined} modifiers={[weight(1)]}>
              <DockedSearchBar.LeadingIcon>
                <Icon source={Search} size={24} contentDescription="Search" />
              </DockedSearchBar.LeadingIcon>
              <DockedSearchBar.Placeholder>
                <Text>Where to?</Text>
              </DockedSearchBar.Placeholder>
            </DockedSearchBar>
            <FilledTonalIconButton onClick={props.onOpenSettings}>
              <Icon source={AccountCircle} size={28} contentDescription="Settings" />
            </FilledTonalIconButton>
          </Row>
          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            {MODE_OPTIONS.map((option) => (
              <SegmentedButton key={option.group} selected={option.group === group} onClick={() => props.onGroupChange(option.group)}>
                <SegmentedButton.Label>
                  <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
                    <Icon source={MODE_ICONS[option.group]} size={18} />
                    <Text>{option.label}</Text>
                  </Row>
                </SegmentedButton.Label>
              </SegmentedButton>
            ))}
          </SingleChoiceSegmentedButtonRow>
        </Column>
      </Host>

      {sheetIndex === 0 ? (
        <Host
          matchContents
          colorScheme={scheme}
          seedColor={materialSeedColor}
          style={[styles.actions, { bottom: visible + 16 }]}
        >
          <Column horizontalAlignment="end" verticalArrangement={{ spacedBy: 12 }}>
            <FloatingActionButton onClick={locating ? undefined : props.onLocate}>
              <FloatingActionButton.Icon>
                <Icon source={MyLocation} size={24} contentDescription={locating ? 'Finding your location' : 'Use my location'} />
              </FloatingActionButton.Icon>
            </FloatingActionButton>
            <ExtendedFloatingActionButton onClick={props.onAskAgent}>
              <ExtendedFloatingActionButton.Icon>
                <Icon source={WandShine} size={24} />
              </ExtendedFloatingActionButton.Icon>
              <ExtendedFloatingActionButton.Text>
                <Text>Ask agent</Text>
              </ExtendedFloatingActionButton.Text>
            </ExtendedFloatingActionButton>
          </Column>
        </Host>
      ) : null}

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        onChange={settle}
        onAnimate={(_from, to) => settle(to)}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: m.surfaceContainer }]}
        handleIndicatorStyle={[styles.handle, { backgroundColor: m.onSurfaceVariant }]}
      >
        <BottomSheetView style={styles.sheetContent}>
          <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
              <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
                <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                  <Text color={m.onSurface} style={{ typography: 'titleLarge' }} modifiers={[weight(1)]}>Tracked trips</Text>
                  <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
                    <Icon source={Notifications} size={18} tint={m.onSurfaceVariant} />
                    <Text color={m.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{`${props.watchingCount} watching`}</Text>
                  </Row>
                </Row>
                {notice ? <Text color={m.onSurface} style={{ typography: 'bodyMedium' }}>{notice}</Text> : null}
              </Column>
            </Host>
          </View>
          <BottomSheetScrollView
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: footerHeight + 8 }]}
            onContentSizeChange={(_, height) => setListHeight(height - footerHeight - 8)}
          >
            {trips.length ? trips.map((trip) => <TripCard key={trip.id} trip={trip} now={now} m={m} scheme={scheme} />) : (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Text color={m.onSurfaceVariant} style={{ typography: 'bodyLarge' }} modifiers={[padding(4, 12, 4, 12)]}>No tracked trips yet.</Text>
              </Host>
            )}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>

      <View
        style={[styles.footer, { backgroundColor: m.surfaceContainer, paddingBottom: insets.bottom + 8 }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
          <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}>
            <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), horizontalScroll()]}>
              {chips.map((chip) => (
                <AssistChip key={chip.key} onClick={chip.onPress}>
                  <AssistChip.LeadingIcon>
                    <Icon source={CHIP_ICONS[chip.key]} size={18} />
                  </AssistChip.LeadingIcon>
                  <AssistChip.Label>
                    <Text>{chip.label}</Text>
                  </AssistChip.Label>
                </AssistChip>
              ))}
              <AssistChip onClick={props.onOpenSettings}>
                <AssistChip.LeadingIcon>
                  <Icon source={Settings} size={18} />
                </AssistChip.LeadingIcon>
                <AssistChip.Label>
                  <Text>Settings</Text>
                </AssistChip.Label>
              </AssistChip>
            </Row>
            <Text color={m.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{status}</Text>
          </Column>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16 },
  actions: { position: 'absolute', right: 16 },
  fullWidth: { width: '100%' },
  sheetBackground: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 32, height: 4, opacity: 0.4 },
  sheetContent: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  list: { flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingVertical: 4 }
});
