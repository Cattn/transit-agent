import { useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import {
  AlertDialog,
  Column,
  DatePickerDialog,
  FilledTonalButton,
  FilterChip,
  FlowRow,
  Icon,
  IconButton,
  ListItem,
  OutlinedTextField,
  RadioButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Surface,
  Text,
  TextButton,
  TimePickerDialog,
  useMaterialColors,
  useNativeState,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, padding, Shapes, weight } from '@expo/ui/jetpack-compose/modifiers';
import Add from '../../../assets/icons/add_fill.xml';
import ArrowDown from '../../../assets/icons/keyboard_arrow_down_fill.xml';
import ArrowUp from '../../../assets/icons/keyboard_arrow_up_fill.xml';
import CalendarToday from '../../../assets/icons/calendar_today_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import Close from '../../../assets/icons/close_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import DragIndicator from '../../../assets/icons/drag_indicator_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import MyLocation from '../../../assets/icons/my_location_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import TripOrigin from '../../../assets/icons/trip_origin_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { corners } from '../results/RouteCard.android';
import type { ChipMode, FilterFocus, FiltersChromeProps, PlaceRowItem } from './FiltersScreen';
import { parseCustomLimit } from './limits';
import { PlaceField, type PlaceFieldColors } from './PlaceField';
import { PlaceList } from './PlaceList';
import { pickerDay } from './when';

const MODE_ICONS: Record<ChipMode, number> = {
  walk: DirectionsWalk,
  bus: DirectionsBus,
  rail: Train,
  bike: DirectionsBike,
  car: DirectionsCar
};

function Block({ scheme, children }: { scheme: 'light' | 'dark'; children: ReactElement }) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      {children}
    </Host>
  );
}

function AgentMark({ show, m }: { show: boolean; m: MaterialColors }) {
  if (!show) return null;
  return (
    <Row modifiers={[clip(Shapes.RoundedCorner(8)), background(m.tertiaryContainer), padding(8, 2, 8, 2)]}>
      <Text color={m.onTertiaryContainer} style={m3Text('labelMedium')}>✦ Agent</Text>
    </Row>
  );
}

function SectionLabel({ text, agent, m }: { text: string; agent: boolean; m: MaterialColors }) {
  return (
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      <Text color={m.onSurfaceVariant} style={m3Text('titleSmall')}>{text}</Text>
      <AgentMark show={agent} m={m} />
    </Row>
  );
}

function PlaceRow({ label, value, agent, icon, tint, m, onClick, onRemove, draggable }: { label: string; value: string; agent: boolean; icon: number; tint: string; m: MaterialColors; onClick: () => void; onRemove?: () => void; draggable: boolean }) {
  return (
    <Surface
      color={m.surfaceContainerLow}
      contentColor={m.onSurface}
      shape={corners(16)}
      border={{ width: 1, color: m.outline }}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), clickable(onClick)]}
    >
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
        <Icon source={icon} size={24} tint={tint} />
        <Column modifiers={[weight(1)]}>
          <Text color={m.onSurfaceVariant} style={m3Text('labelMedium')}>{label}</Text>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
            <Text color={m.onSurface} maxLines={1} style={m3Text('bodyLarge')}>{value}</Text>
            <AgentMark show={agent} m={m} />
          </Row>
        </Column>
        {onRemove ? (
          <IconButton onClick={onRemove}>
            <Icon source={Close} size={24} tint={m.onSurfaceVariant} contentDescription={`Remove ${value}`} />
          </IconButton>
        ) : null}
        {draggable ? <Icon source={DragIndicator} size={24} tint={m.onSurfaceVariant} /> : null}
      </Row>
    </Surface>
  );
}

const REVEAL_OFFSET = 96;

function Revealed({ scroll, scrollY, scrolled, children }: { scroll: RefObject<ScrollViewInstance | null>; scrollY: RefObject<number>; scrolled: RefObject<boolean>; children: ReactNode }) {
  const self = useRef<ViewInstance>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = scroll.current;
      self.current?.measureInWindow((_x, y) => {
        list?.measureInWindow((_lx, top) => {
          const delta = y - top - REVEAL_OFFSET;
          if (delta <= 0) return;
          scrolled.current = true;
          list.scrollTo({ y: scrollY.current + delta, animated: true });
        });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [scroll, scrollY, scrolled]);
  return <View ref={self} style={styles.searchGap}>{children}</View>;
}

function placeIcon(place: PlaceRowItem): number {
  if (place.role === 'origin') return MyLocation;
  if (place.role === 'destination') return LocationOn;
  return TripOrigin;
}

function PreferenceSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const live = useRef(value);
  const moved = useRef(false);
  const [drag, setDrag] = useState<number | undefined>(undefined);
  const [pending, setPending] = useState<number | undefined>(undefined);
  if (pending !== undefined && Object.is(value, pending)) {
    setPending(undefined);
    if (drag !== undefined) setDrag(undefined);
  }
  return (
    <Slider
      value={drag ?? value}
      modifiers={[fillMaxWidth()]}
      onValueChange={(next) => {
        moved.current = true;
        live.current = next;
        setDrag(next);
      }}
      onValueChangeFinished={() => {
        if (!moved.current) return;
        moved.current = false;
        const next = Math.min(1, Math.max(0, Math.round(live.current * 100) / 100));
        setPending(next);
        onChange(next);
      }}
    />
  );
}

type LimitItem = FiltersChromeProps['limits'][number];

function LimitRow({ title, value, agent, m, onClick }: { title: string; value: string; agent: boolean; m: MaterialColors; onClick: () => void }) {
  return (
    <ListItem colors={{ containerColor: m.surfaceContainerLowest }} modifiers={[fillMaxWidth(), clickable(onClick)]}>
      <ListItem.HeadlineContent>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Text style={m3Text('bodyLarge')}>{title}</Text>
          <AgentMark show={agent} m={m} />
        </Row>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        <Text color={m.primary} style={m3Text('labelLarge')}>{value}</Text>
      </ListItem.TrailingContent>
    </ListItem>
  );
}

function LimitDialog({ item, m, onPick, onDismiss }: { item: LimitItem; m: MaterialColors; onPick: (value: number | null) => void; onDismiss: () => void }) {
  const [custom, setCustom] = useState(false);
  const initial = item.custom.current === undefined ? '' : String(item.custom.current);
  const field = useNativeState(initial);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string>();
  const submit = (value: string) => {
    const parsed = parseCustomLimit(value, item.custom);
    if ('error' in parsed) setError(parsed.error);
    else onPick(parsed.value);
  };
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={m3Text('headlineSmall')}>{item.title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth()]}>
          {custom ? null : item.options.map((option) => (
            <Row key={option.label} verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), clickable(() => onPick(option.value)), padding(0, 4, 0, 4)]}>
              <RadioButton selected={option.selected} onClick={() => onPick(option.value)} />
              <Text color={m.onSurface} style={m3Text('bodyLarge')}>{option.label}</Text>
            </Row>
          ))}
          {custom ? null : (
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), clickable(() => setCustom(true)), padding(0, 4, 0, 4)]}>
              <RadioButton selected={false} onClick={() => setCustom(true)} />
              <Text color={m.onSurface} style={m3Text('bodyLarge')}>Custom</Text>
            </Row>
          )}
          {custom ? (
            <OutlinedTextField
              autoFocus
              value={field}
              singleLine
              isError={error !== undefined}
              onValueChange={(value) => {
                setText(value);
                setError(undefined);
              }}
              keyboardOptions={{ keyboardType: 'number', imeAction: 'done' }}
              keyboardActions={{ onDone: submit }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Suffix>
                <Text style={m3Text('bodyLarge')}>{item.custom.suffix}</Text>
              </OutlinedTextField.Suffix>
              {error ? (
                <OutlinedTextField.SupportingText>
                  <Text style={m3Text('bodySmall')}>{error}</Text>
                </OutlinedTextField.SupportingText>
              ) : null}
            </OutlinedTextField>
          ) : null}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton enabled={custom} onClick={() => submit(text)}>
          <Text style={m3Text('labelLarge')}>Set</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text style={m3Text('labelLarge')}>Cancel</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  );
}

export function FiltersChrome(props: FiltersChromeProps) {
  const insets = useSafeAreaInsets();
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const scrolled = useRef(false);
  const [picking, setPicking] = useState<{ kind: 'date' | 'time'; at: string; opened: Date }>();
  const [pickingLimit, setPickingLimit] = useState<LimitItem['key']>();
  const editing = props.limits.find((item) => item.key === pickingLimit);
  const placeColors: PlaceFieldColors = {
    surface: m.surface,
    onSurface: m.onSurface,
    onSurfaceVariant: m.onSurfaceVariant,
    primary: m.primary,
    outline: m.outline
  };

  const searchField = (showLocation: boolean) => props.search ? (
    <Revealed scroll={scroll} scrollY={scrollY} scrolled={scrolled}>
      <PlaceField near={props.search.near} showLocation={showLocation} locating={props.search.locating} notice={props.search.notice} colors={placeColors} onPick={props.search.onPick} onUseLocation={props.search.onUseLocation} />
    </Revealed>
  ) : null;

  const remember = (key: FilterFocus, y: number) => {
    if (scrolled.current || props.focus !== key) return;
    requestAnimationFrame(() => {
      if (!scrolled.current) scroll.current?.scrollTo({ y, animated: false });
    });
  };

  return (
    <View style={[styles.fill, { backgroundColor: m.surfaceContainerLow, paddingTop: insets.top }]}>
      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: m.onSurfaceVariant }]} />
      </View>
      <Block scheme={scheme}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(4, 0, 8, 0)]}>
          <IconButton onClick={props.onClose}>
            <Icon source={Close} size={24} contentDescription="Close" />
          </IconButton>
          <Text modifiers={[weight(1), padding(8, 0, 0, 0)]} style={m3Text('titleLarge')}>Trip filters</Text>
          <TextButton onClick={props.onReset}>
            <Text style={m3Text('labelLarge')}>Reset</Text>
          </TextButton>
        </Row>
      </Block>
      <ScrollView ref={scroll} onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} onScrollBeginDrag={() => { scrolled.current = true; }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.list}>
        <View onLayout={(event) => remember('where', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 6)]}>
              <SectionLabel text="Where & when" agent={false} m={m} />
            </Column>
          </Block>
          <PlaceList
            keys={props.places.map((place, index) => `${index}:${place.label}`)}
            draggable={props.places.length > 2 && props.search === undefined}
            onMove={props.onMovePlace}
            renderRow={(index) => {
              const place = props.places[index]!;
              return (
                <Block scheme={scheme}>
                  <Column modifiers={[fillMaxWidth(), padding(16, 6, 16, 6)]}>
                    <PlaceRow
                      label={place.title}
                      value={place.label}
                      agent={place.agent}
                      icon={placeIcon(place)}
                      tint={place.role === 'origin' ? m.primary : place.role === 'destination' ? m.error : m.onSurfaceVariant}
                      m={m}
                      onClick={() => props.onSearch(place.target)}
                      onRemove={typeof place.target === 'number' ? () => props.onRemoveStop(place.target as number) : undefined}
                      draggable={props.places.length > 2 && props.search === undefined}
                    />
                  </Column>
                </Block>
              );
            }}
            renderBelow={(index) => props.search?.which === props.places[index]!.target ? searchField(props.places[index]!.role === 'origin') : null}
          />
          {props.canAddStop ? (
            <Block scheme={scheme}>
              <Row modifiers={[fillMaxWidth(), padding(8, 0, 16, 0)]}>
                <TextButton onClick={() => props.onSearch('add')}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                    <Icon source={Add} size={18} />
                    <Text style={m3Text('labelLarge')}>Add stop</Text>
                  </Row>
                </TextButton>
              </Row>
            </Block>
          ) : null}
          {props.search?.which === 'add' ? searchField(false) : null}
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 4)]}>
              <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                {props.timeOptions.map((option) => (
                  <SegmentedButton key={option.value} selected={option.selected} onClick={() => props.onTimeType(option.value)}>
                    <SegmentedButton.Label>
                      <Text maxLines={1} style={m3Text('labelLarge')}>{option.label}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
                <FilledTonalButton modifiers={[weight(1)]} onClick={() => setPicking({ kind: 'date', at: props.time.at, opened: new Date() })}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                    <Icon source={CalendarToday} size={18} />
                    <Text maxLines={1} style={m3Text('labelLarge')}>{props.time.day}</Text>
                  </Row>
                </FilledTonalButton>
                <FilledTonalButton modifiers={[weight(1)]} onClick={() => setPicking({ kind: 'time', at: props.time.at, opened: new Date() })}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                    <Icon source={Schedule} size={18} />
                    <Text maxLines={1} style={m3Text('labelLarge')}>{props.time.agent ? `✦ ${props.time.clock}` : props.time.clock}</Text>
                  </Row>
                </FilledTonalButton>
              </Row>
              {picking?.kind === 'date' ? (
                <DatePickerDialog
                  initialDate={pickerDay(new Date(picking.at))}
                  selectableDates={{ start: picking.opened }}
                  confirmButtonLabel="Set date"
                  onDateSelected={(day) => {
                    setPicking(undefined);
                    props.onSetDate(day);
                  }}
                  onDismissRequest={() => setPicking(undefined)}
                />
              ) : null}
              {picking?.kind === 'time' ? (
                <TimePickerDialog
                  initialDate={picking.at}
                  is24Hour={false}
                  confirmButtonLabel="Set time"
                  onDateSelected={(at) => {
                    setPicking(undefined);
                    props.onSetTime(at);
                  }}
                  onDismissRequest={() => setPicking(undefined)}
                />
              ) : null}
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('modes', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 8)]}>
              <SectionLabel text="Modes" agent={props.modesAgent} m={m} />
              <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 0 }}>
                {props.modes.map((mode) => (
                  <FilterChip key={mode.mode} selected={mode.selected} onClick={() => props.onToggleMode(mode.mode)}>
                    <FilterChip.LeadingIcon>
                      <Icon source={mode.selected ? Check : MODE_ICONS[mode.mode]} size={18} />
                    </FilterChip.LeadingIcon>
                    <FilterChip.Label>
                      <Text style={m3Text('labelLarge')}>{mode.label}</Text>
                    </FilterChip.Label>
                  </FilterChip>
                ))}
              </FlowRow>
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('strict', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 8)]}>
              <SectionLabel text="How strict is the arrival time?" agent={props.lateAgent} m={m} />
              <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                {props.lateOptions.map((option) => (
                  <SegmentedButton key={option.value} selected={option.selected} onClick={() => props.onLateTolerance(option.value)}>
                    <SegmentedButton.Label>
                      <Text style={m3Text('labelLarge')}>{option.label}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('prefs', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 8)]}>
              <SectionLabel text="Preferences (rank, never exclude)" agent={false} m={m} />
              {props.preferences.map((row) => (
                <Column key={row.key} verticalArrangement={{ spacedBy: 0 }}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
                    <Text color={m.onSurface} style={m3Text('bodyLarge')}>{row.start}</Text>
                    <AgentMark show={row.agent} m={m} />
                    <Row modifiers={[weight(1)]}>{null}</Row>
                    <Text color={m.onSurface} style={m3Text('bodyLarge')}>{row.end}</Text>
                  </Row>
                  <PreferenceSlider value={row.value} onChange={(value) => props.onPreference(row.key, value)} />
                </Column>
              ))}
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('limits', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}>
              <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(m.surfaceContainerLowest)]}>
                <Row verticalAlignment="center" modifiers={[fillMaxWidth(), clickable(props.onToggleLimits), padding(16, 10, 16, 12)]}>
                  <Text modifiers={[weight(1)]} style={m3Text('titleSmall')}>Advanced limits</Text>
                  <Icon source={props.limitsOpen ? ArrowUp : ArrowDown} size={24} tint={m.onSurfaceVariant} contentDescription={props.limitsOpen ? 'Collapse advanced limits' : 'Expand advanced limits'} />
                </Row>
                {props.limitsOpen ? (
                  <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}>
                    {props.limits.map((item) => (
                      <LimitRow key={item.key} title={item.title} value={item.label} agent={item.agent} m={m} onClick={() => setPickingLimit(item.key)} />
                    ))}
                    <LimitRow title="Step-free access" value={props.stepFree.on ? 'On' : 'Off'} agent={props.stepFree.agent} m={m} onClick={() => props.onStepFree(!props.stepFree.on)} />
                  </Column>
                ) : null}
              </Column>
              {editing ? (
                <LimitDialog
                  item={editing}
                  m={m}
                  onPick={(value) => {
                    setPickingLimit(undefined);
                    props.onLimit(editing.key, value);
                  }}
                  onDismiss={() => setPickingLimit(undefined)}
                />
              ) : null}
            </Column>
          </Block>
        </View>
      </ScrollView>
      <View style={{ height: insets.bottom, backgroundColor: m.surfaceContainerLow }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 24, elevation: 24 },
  fullWidth: { width: '100%' },
  handleRow: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 32, height: 4, borderRadius: 2, opacity: 0.4 },
  list: { flex: 1 },
  content: { paddingBottom: 8 },
  searchGap: { paddingTop: 8 }
});
