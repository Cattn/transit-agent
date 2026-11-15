import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  AssistChip,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  ExtendedFloatingActionButton,
  FilledTonalIconButton,
  FloatingActionButton,
  Icon,
  Row,
  SegmentedButton,
  Shape,
  SingleChoiceSegmentedButtonRow,
  Surface,
  Text,
  TextButton,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, height, horizontalScroll, padding, paddingAll, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import AccountCircle from '../../../assets/icons/account_circle_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import Favorite from '../../../assets/icons/favorite_fill.xml';
import FitnessCenter from '../../../assets/icons/fitness_center_fill.xml';
import Flight from '../../../assets/icons/flight_fill.xml';
import HomeIcon from '../../../assets/icons/home_fill.xml';
import LocalCafe from '../../../assets/icons/local_cafe_fill.xml';
import MyLocation from '../../../assets/icons/my_location_fill.xml';
import Notifications from '../../../assets/icons/notifications_fill.xml';
import Park from '../../../assets/icons/park_fill.xml';
import School from '../../../assets/icons/school_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Search from '../../../assets/icons/search_fill.xml';
import Warning from '../../../assets/icons/warning_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import Settings from '../../../assets/icons/settings_fill.xml';
import ShoppingBag from '../../../assets/icons/shopping_bag_fill.xml';
import WandShine from '../../../assets/icons/wand_shine_fill.xml';
import Work from '../../../assets/icons/work_fill.xml';
import type { SavedItinerary } from '@transit/shared';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { HomeChromeProps, SavedPlaceChip } from './HomeScreen';
import { MODE_OPTIONS, type ModeGroupName } from './ModeSlider';
import { tileRole, tripCardText } from './TrackedTripCard';

const MODE_ICONS: Record<ModeGroupName, number> = { transit: DirectionsBus, fly: Flight };
const CHIP_ICONS: Record<SavedPlaceChip['icon'], number> = { home: HomeIcon, work: Work, fitness: FitnessCenter, school: School, cafe: LocalCafe, shopping: ShoppingBag, favorite: Favorite, park: Park };
const HANDLE_HEIGHT = 24;
const LIST_CAP = 212;
const COLLAPSED_MAX_SHARE = 0.55;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;
const CARD_RADIUS = 28;
const PEEK = 0;
const COLLAPSED = 1;
const EXPANDED = 2;

function tileColors(role: ReturnType<typeof tileRole>, m: MaterialColors): { bg: string; fg: string } {
  if (role === 'secondary') return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  return { bg: m.primaryContainer, fg: m.onPrimaryContainer };
}

function TripCard({ trip, now, m, scheme, onOpen }: { trip: SavedItinerary; now: Date; m: MaterialColors; scheme: 'light' | 'dark'; onOpen: () => void }) {
  const text = tripCardText(trip, now);
  const tile = tileColors(tileRole(text.state), m);
  const pill = text.live
    ? { bg: m.primaryContainer, fg: m.onPrimaryContainer, icon: Sensors }
    : { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant, icon: Schedule };
  const radius = { topStart: CARD_RADIUS, topEnd: CARD_RADIUS, bottomStart: CARD_RADIUS, bottomEnd: CARD_RADIUS };

  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      <Surface
        onClick={onOpen}
        color={m.surfaceContainerLowest}
        contentColor={m.onSurface}
        shadowElevation={2}
        shape={Shape.RoundedCorner({ cornerRadii: radius })}
        modifiers={[fillMaxWidth()]}
      >
        <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center" modifiers={[paddingAll(10)]}>
          <Column
            horizontalAlignment="center"
            verticalArrangement="center"
            modifiers={[size(68, 76), clip(Shapes.RoundedCorner(20)), background(tile.bg)]}
          >
            {'label' in text.tile ? (
              <Text color={tile.fg} style={{ ...m3Text('labelMedium'), textAlign: 'center' }}>{text.tile.label}</Text>
            ) : (
              <>
                <Text color={tile.fg} style={m3Text('labelSmall')}>{text.tile.top}</Text>
                <Text color={tile.fg} style={m3Text('headlineMedium', 700)}>{text.tile.value}</Text>
                <Text color={tile.fg} style={m3Text('labelSmall')}>{text.tile.bottom}</Text>
              </>
            )}
          </Column>
          <Column verticalArrangement={{ spacedBy: 3 }} modifiers={[weight(1)]}>
            <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('titleMedium')}>{text.title}</Text>
            <Text color={m.onSurfaceVariant} maxLines={2} overflow="ellipsis" style={m3Text('bodySmall')}>{text.message}</Text>
            <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
              <Row
                horizontalArrangement={{ spacedBy: 4 }}
                verticalAlignment="center"
                modifiers={[clip(Shapes.RoundedCorner(12)), background(pill.bg), padding(7, 2, 9, 2)]}
              >
                <Icon source={pill.icon} size={13} tint={pill.fg} />
                <Text color={pill.fg} style={m3Text('labelSmall', 700)}>{text.freshness.label}</Text>
              </Row>
              <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={m3Text('bodySmall')} modifiers={[weight(1)]}>
                {text.meta}
              </Text>
            </Row>
          </Column>
        </Row>
      </Surface>
    </Host>
  );
}

export function HomeChrome(props: HomeChromeProps) {
  const { colors, group, trips, now, chips, locating, notice, status, onTopLayout } = props;
  const scheme = colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [titleHeight, setTitleHeight] = useState(36);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [footerHeight, setFooterHeight] = useState(64 + insets.bottom);
  const [editMenu, setEditMenu] = useState(false);
  const [listHeight, setListHeight] = useState(LIST_CAP);
  const [sheetIndex, setSheetIndex] = useState(COLLAPSED);
  const [topHeight, setTopHeight] = useState(126);
  const topEdge = Math.round(insets.top + 4 + topHeight);

  useEffect(() => {
    onTopLayout?.(topEdge);
  }, [onTopLayout, topEdge]);

  const expanded = Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP));
  const natural = Math.round(HANDLE_HEIGHT + headerHeight + Math.min(listHeight, LIST_CAP) + footerHeight + 8);
  const collapsed = Math.min(natural, Math.round(containerHeight * COLLAPSED_MAX_SHARE), expanded - MIN_TRAVEL);
  const peek = Math.round(HANDLE_HEIGHT + titleHeight + insets.bottom + 4);
  const snapPoints = [peek, collapsed, expanded];
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
            <Surface
              onClick={props.onSearch}
              color={m.surfaceContainerHigh}
              contentColor={m.onSurfaceVariant}
              shadowElevation={2}
              shape={Shape.RoundedCorner({ cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 } })}
              modifiers={[weight(1), height(56)]}
            >
              <Row horizontalArrangement={{ spacedBy: 16 }} verticalAlignment="center" modifiers={[fillMaxWidth(), height(56), padding(16, 0, 16, 0)]}>
                <Icon source={Search} size={24} tint={m.onSurface} contentDescription="Search" />
                <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>Where to?</Text>
              </Row>
            </Surface>
            <FilledTonalIconButton onClick={props.onOpenSettings}>
              <Icon source={AccountCircle} size={28} contentDescription="Settings" />
            </FilledTonalIconButton>
          </Row>
          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            {MODE_OPTIONS.map((option) => (
              <SegmentedButton
                key={option.group}
                selected={option.group === group}
                onClick={() => props.onGroupChange(option.group)}
                colors={{ activeContainerColor: m.secondaryContainer, inactiveContainerColor: m.surfaceContainer }}
              >
                <SegmentedButton.Label>
                  <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
                    <Icon source={MODE_ICONS[option.group]} size={18} />
                    <Text style={m3Text('labelLarge')}>{option.label}</Text>
                  </Row>
                </SegmentedButton.Label>
              </SegmentedButton>
            ))}
          </SingleChoiceSegmentedButtonRow>
        </Column>
      </Host>

      {sheetIndex !== EXPANDED ? (
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
                <Text style={m3Text('labelLarge')}>Ask agent</Text>
              </ExtendedFloatingActionButton.Text>
            </ExtendedFloatingActionButton>
          </Column>
        </Host>
      ) : null}

      <BottomSheet
        index={COLLAPSED}
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
            <View onLayout={(event) => setTitleHeight(event.nativeEvent.layout.height)}>
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
                  <Text color={m.onSurface} style={m3Text('titleLarge')} modifiers={[weight(1)]}>Tracked trips</Text>
                  <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
                    <Icon source={Notifications} size={18} tint={m.onSurfaceVariant} />
                    <Text color={m.onSurfaceVariant} style={m3Text('labelLarge')}>{`${props.watchingCount} watching`}</Text>
                  </Row>
                </Row>
              </Host>
            </View>
            {notice ? (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Text color={m.onSurface} style={m3Text('bodyMedium')} modifiers={[padding(16, 0, 16, 8)]}>{notice}</Text>
              </Host>
            ) : null}
            {props.tripsError ? (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Row
                  horizontalArrangement={{ spacedBy: 10 }}
                  verticalAlignment="center"
                  modifiers={[fillMaxWidth(), padding(16, 0, 16, 8), clip(Shapes.RoundedCorner(12)), background(m.errorContainer), padding(12, 4, 4, 4)]}
                >
                  <Icon source={Warning} size={18} tint={m.onErrorContainer} />
                  <Text color={m.onErrorContainer} style={m3Text('bodyMedium')} modifiers={[weight(1)]}>{props.tripsError}</Text>
                  <TextButton onClick={props.onRetryTrips}>
                    <Text color={m.onErrorContainer} style={m3Text('labelLarge', 700)}>Retry</Text>
                  </TextButton>
                </Row>
              </Host>
            ) : null}
          </View>
          <BottomSheetScrollView
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: footerHeight + 8 }]}
            onContentSizeChange={(_, height) => setListHeight(height - footerHeight - 8)}
          >
            {trips.length ? trips.map((trip) => <TripCard key={trip.id} trip={trip} now={now} m={m} scheme={scheme} onOpen={() => props.onOpenTrip(trip.id)} />) : (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')} modifiers={[padding(4, 12, 4, 12)]}>
                  {props.tripsLoading ? 'Loading saved trips…' : props.tripsError ? 'Saved trips are not available right now.' : 'No tracked trips yet.'}
                </Text>
              </Host>
            )}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>

      {sheetIndex !== PEEK ? (
        <View
          style={[styles.footer, { backgroundColor: m.surfaceContainer, paddingBottom: insets.bottom + 8 }]}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
            <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}>
              <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), horizontalScroll()]}>
                {chips.map((chip) => (
                  <AssistChip key={chip.key} onClick={chip.onPress} colors={{ leadingIconContentColor: chip.color }}>
                    <AssistChip.LeadingIcon>
                      <Icon source={CHIP_ICONS[chip.icon]} size={18} tint={chip.color} />
                    </AssistChip.LeadingIcon>
                    <AssistChip.Label>
                      <Text style={m3Text('labelLarge')}>{chip.label}</Text>
                    </AssistChip.Label>
                  </AssistChip>
                ))}
                <DropdownMenu expanded={editMenu} onDismissRequest={() => setEditMenu(false)}>
                  <DropdownMenu.Trigger>
                    <AssistChip onClick={() => setEditMenu(true)}>
                      <AssistChip.LeadingIcon>
                        <Icon source={Edit} size={18} />
                      </AssistChip.LeadingIcon>
                      <AssistChip.Label>
                        <Text style={m3Text('labelLarge')}>Edit</Text>
                      </AssistChip.Label>
                    </AssistChip>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Items>
                    {chips.map((chip) => (
                      <DropdownMenuItem
                        key={chip.key}
                        onClick={() => {
                          setEditMenu(false);
                          chip.onEdit();
                        }}
                      >
                        <DropdownMenuItem.LeadingIcon>
                          <Icon source={CHIP_ICONS[chip.icon]} size={24} tint={chip.color} />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <Text style={m3Text('bodyLarge')}>{chip.label}</Text>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenu.Items>
                </DropdownMenu>
                <AssistChip onClick={props.onOpenSettings}>
                  <AssistChip.LeadingIcon>
                    <Icon source={Settings} size={18} />
                  </AssistChip.LeadingIcon>
                  <AssistChip.Label>
                    <Text style={m3Text('labelLarge')}>Settings</Text>
                  </AssistChip.Label>
                </AssistChip>
              </Row>
              {status ? <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>{status}</Text> : null}
            </Column>
          </Host>
        </View>
      ) : (
        <View pointerEvents="none" style={[styles.footer, { height: insets.bottom, backgroundColor: m.surfaceContainer }]} />
      )}
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
