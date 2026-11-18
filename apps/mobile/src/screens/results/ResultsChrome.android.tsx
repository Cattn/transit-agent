import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Host } from '@expo/ui';
import {
  AlertDialog,
  Column,
  FilterChip,
  HorizontalDivider,
  Icon,
  IconButton,
  Row,
  Surface,
  Switch,
  Text,
  TextButton,
  useMaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, height, horizontalScroll, padding, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import Delete from '../../../assets/icons/delete_fill.xml';
import DragIndicator from '../../../assets/icons/drag_indicator_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Notifications from '../../../assets/icons/notifications_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import SwapVert from '../../../assets/icons/swap_vert_fill.xml';
import TripOrigin from '../../../assets/icons/trip_origin_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import Warning from '../../../assets/icons/warning_fill.xml';
import { PlaceList } from '../filters/PlaceList';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { CARD_RADIUS, corners, MODE_ICONS, RouteCard } from './RouteCard.android';
import type { ResultsChromeProps } from './ResultsScreen';
import { WatchPanel } from './WatchPanel.android';

// The sheet's header is its drag handle: content panning is off so the route list never moves the sheet (#81).
const SheetHeaderContext = createContext<{ header: ReactNode; indicator: string; onHeight: (height: number) => void }>({ header: null, indicator: 'transparent', onHeight: () => undefined });

function SheetHeader() {
  const { header, indicator, onHeight } = useContext(SheetHeaderContext);
  return (
    <View onLayout={(event) => onHeight(event.nativeEvent.layout.height)}>
      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: indicator }]} />
      </View>
      {header}
    </View>
  );
}

const COLLAPSED_SHARE = 0.58;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;
const COLLAPSED = 1;
const HEADER_ESTIMATE = 96;

export function ResultsChrome(props: ResultsChromeProps) {
  const scheme = props.colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [topHeight, setTopHeight] = useState(180);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(COLLAPSED);
  const [headerHeight, setHeaderHeight] = useState(HEADER_ESTIMATE);
  const sheet = useRef<BottomSheet>(null);

  const expanded = Math.max(3, Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP)));
  const travel = Math.max(1, Math.min(MIN_TRAVEL, Math.floor(expanded / 3)));
  const collapsed = Math.max(2, Math.min(Math.round(containerHeight * COLLAPSED_SHARE), expanded - travel));
  const peek = Math.max(1, Math.min(Math.round(headerHeight + insets.bottom), collapsed - travel));
  const snapPoints = [peek, collapsed, expanded];

  const settle = (index: number) => {
    if (index < 0) return;
    setSheetIndex(index);
    props.onSheetLayout(snapPoints[index] ?? collapsed);
  };


  const header = (
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
        {props.savedTrip && sheetIndex === 2 ? (
          <TextButton onClick={() => sheet.current?.snapToIndex(COLLAPSED)}><Text style={m3Text('labelLarge')}>Trip updates</Text></TextButton>
        ) : null}
        {props.savedTrip?.error && sheetIndex === 2 ? (
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
  );

  const places = [
    { label: props.origin, role: 'origin' as const },
    ...props.stops.map((label) => ({ label, role: 'stop' as const })),
    { label: props.destination, role: 'destination' as const }
  ];
  const marker = (role: (typeof places)[number]['role']) => role === 'origin' ? (
    <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(10, 10), clip(Shapes.Circle), background(m.primary)]}>
      <Row modifiers={[size(6, 6), clip(Shapes.Circle), background(m.surfaceContainerLowest)]}>{null}</Row>
    </Row>
  ) : role === 'stop' ? <Icon source={TripOrigin} size={14} tint={m.onSurfaceVariant} /> : <Icon source={LocationOn} size={18} tint={m.error} />;
  const reorder = props.onMovePlace;
  const stopsCard = props.stops.length > 0 ? (
    <View style={[styles.stopsCard, { backgroundColor: m.surfaceContainerLowest }]}>
      <Host matchContents colorScheme={scheme} seedColor={materialSeedColor}>
        <IconButton onClick={props.onBack}>
          <Icon source={ArrowBack} size={24} contentDescription="Back" />
        </IconButton>
      </Host>
      <View style={styles.stopsList}>
        <PlaceList
          keys={places.map((place, index) => `${index}:${place.label}`)}
          draggable={reorder !== undefined}
          onMove={(from, to) => reorder?.(from, to)}
          renderBelow={() => null}
          renderRow={(index) => {
            const place = places[index]!;
            return (
              <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                <Column modifiers={[fillMaxWidth(), background(m.surfaceContainerLowest)]}>
                  <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), height(40), padding(0, 0, 16, 0)]}>
                    <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[size(20, 20)]}>{marker(place.role)}</Row>
                    <Text color={place.role === 'stop' ? m.onSurfaceVariant : m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyLarge')} modifiers={[weight(1)]}>{place.label}</Text>
                    {reorder ? <Icon source={DragIndicator} size={24} tint={m.onSurfaceVariant} contentDescription={`Drag ${place.label} to reorder`} /> : null}
                  </Row>
                  {index < places.length - 1 ? <HorizontalDivider color={m.outlineVariant} /> : null}
                </Column>
              </Host>
            );
          }}
        />
      </View>
    </View>
  ) : null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 4 }]} onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}>
      {stopsCard}
      <Host
        matchContents={{ vertical: true }}
        colorScheme={scheme}
        seedColor={materialSeedColor}
        style={styles.fullWidth}
      >
        <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
          {stopsCard ? null : <Surface color={m.surfaceContainerLowest} contentColor={m.onSurface} shadowElevation={3} shape={corners(24)} modifiers={[fillMaxWidth()]}>
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
          </Surface>}
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
      </View>

      <SheetHeaderContext.Provider value={{ header, indicator: m.onSurfaceVariant, onHeight: setHeaderHeight }}>
        <BottomSheet
          ref={sheet}
          index={COLLAPSED}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          enableContentPanningGesture={false}
          onChange={settle}
          onAnimate={(_from, to) => settle(to)}
          backgroundStyle={[styles.sheetBackground, { backgroundColor: m.surfaceContainerLow }]}
          handleComponent={SheetHeader}
        >
          <View style={styles.sheetContent}>
            <BottomSheetScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 + (sheetIndex === COLLAPSED ? expanded - collapsed : 0) }]}>
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
              {props.returns ? (
                <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
                  <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(0, 6, 0, 0)]}>
                    <Text color={m.onSurfaceVariant} style={m3Text('titleSmall')}>Return</Text>
                    {props.returns.message ? <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.returns.message}</Text> : null}
                    {props.returns.warning ? <Text color={m.tertiary} style={m3Text('bodyMedium')}>{props.returns.warning}</Text> : null}
                  </Column>
                </Host>
              ) : null}
              {props.returns?.cards.map((card) => (
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
          </View>
        </BottomSheet>
      </SheetHeaderContext.Provider>
      {props.savedTrip && sheetIndex !== 2 ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 24, right: 24, bottom: (snapPoints[sheetIndex] ?? collapsed) + 16, alignItems: 'center' }}>
          <WatchPanel key={props.title} trip={props.savedTrip} m={m} scheme={scheme} />
        </View>
      ) : null}
      <View pointerEvents="none" style={[styles.navStrip, { height: insets.bottom, backgroundColor: m.surfaceContainerLow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12 },
  fullWidth: { width: '100%' },
  stopsCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 24, overflow: 'hidden', elevation: 3, paddingTop: 6, paddingBottom: 6, paddingStart: 4, marginBottom: 10 },
  stopsList: { flex: 1, paddingStart: 4 },
  sheetBackground: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handleRow: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 32, height: 4, borderRadius: 2, opacity: 0.4 },
  sheetContent: { flex: 1 },
  list: { flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingTop: 2 },
  navStrip: { position: 'absolute', left: 0, right: 0, bottom: 0 }
});
