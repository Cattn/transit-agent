import { useRef, useState, type ReactElement } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import {
  AlertDialog,
  Button,
  Column,
  FilterChip,
  FlowRow,
  Icon,
  HorizontalDivider,
  IconButton,
  ListItem,
  RadioButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Text,
  TextButton,
  TimePickerDialog,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, padding, Shapes, weight } from '@expo/ui/jetpack-compose/modifiers';
import ArrowDown from '../../../assets/icons/keyboard_arrow_down_fill.xml';
import ArrowUp from '../../../assets/icons/keyboard_arrow_up_fill.xml';
import Close from '../../../assets/icons/close_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { ChipMode, FilterFocus, FiltersChromeProps } from './FiltersScreen';
import { PlaceField, type PlaceFieldColors } from './PlaceField';

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
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={m3Text('headlineSmall')}>{item.title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth()]}>
          {item.options.map((option) => (
            <Row key={option.label} verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), clickable(() => onPick(option.value)), padding(0, 4, 0, 4)]}>
              <RadioButton selected={option.selected} onClick={() => onPick(option.value)} />
              <Text color={m.onSurface} style={m3Text('bodyLarge')}>{option.label}</Text>
            </Row>
          ))}
        </Column>
      </AlertDialog.Text>
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
  const scrolled = useRef(false);
  const [pickingTime, setPickingTime] = useState(false);
  const [pickingLimit, setPickingLimit] = useState<LimitItem['key']>();
  const editing = props.limits.find((item) => item.key === pickingLimit);
  const placeColors: PlaceFieldColors = {
    surface: m.surface,
    onSurface: m.onSurface,
    onSurfaceVariant: m.onSurfaceVariant,
    primary: m.primary,
    outline: m.outline
  };

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
          <Text modifiers={[weight(1)]} style={{ ...m3Text('titleLarge'), textAlign: 'center' }}>Trip filters</Text>
          <TextButton onClick={props.onReset}>
            <Text style={m3Text('labelLarge')}>Reset</Text>
          </TextButton>
        </Row>
      </Block>
      <ScrollView ref={scroll} onScrollBeginDrag={() => { scrolled.current = true; }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.list}>
        <View onLayout={(event) => remember('where', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}>
              <Text style={m3Text('titleMedium')}>Where & when</Text>
            </Column>
          </Block>
          <Block scheme={scheme}>
            <ListItem colors={{ containerColor: m.surfaceContainerLow }} modifiers={[fillMaxWidth(), clickable(() => props.onSearch('origin'))]}>
              <ListItem.OverlineContent>
                <Text color={m.onSurfaceVariant} style={m3Text('labelMedium')}>From</Text>
              </ListItem.OverlineContent>
              <ListItem.HeadlineContent>
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                  <Text style={m3Text('bodyLarge')}>{props.origin.label}</Text>
                  <AgentMark show={props.origin.agent} m={m} />
                </Row>
              </ListItem.HeadlineContent>
            </ListItem>
          </Block>
          {props.search?.which === 'origin' ? (
            <PlaceField near={props.search.near} showLocation locating={props.search.locating} notice={props.search.notice} colors={placeColors} onPick={props.search.onPick} onUseLocation={props.search.onUseLocation} />
          ) : null}
          <Block scheme={scheme}>
            <ListItem colors={{ containerColor: m.surfaceContainerLow }} modifiers={[fillMaxWidth(), clickable(() => props.onSearch('destination'))]}>
              <ListItem.OverlineContent>
                <Text color={m.onSurfaceVariant} style={m3Text('labelMedium')}>To</Text>
              </ListItem.OverlineContent>
              <ListItem.HeadlineContent>
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                  <Text style={m3Text('bodyLarge')}>{props.destination.label}</Text>
                  <AgentMark show={props.destination.agent} m={m} />
                </Row>
              </ListItem.HeadlineContent>
            </ListItem>
          </Block>
          {props.search?.which === 'destination' ? (
            <PlaceField near={props.search.near} showLocation={false} locating={props.search.locating} notice={props.search.notice} colors={placeColors} onPick={props.search.onPick} onUseLocation={props.search.onUseLocation} />
          ) : null}
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 4)]}>
              <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                {props.timeOptions.map((option) => (
                  <SegmentedButton key={option.value} selected={option.selected} onClick={() => props.onTimeType(option.value)}>
                    <SegmentedButton.Label>
                      <Text style={m3Text('labelLarge')}>{option.label}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>
            </Column>
          </Block>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth()]}>
              <ListItem colors={{ containerColor: m.surfaceContainerLow }} modifiers={[fillMaxWidth(), clickable(() => setPickingTime(true))]}>
                <ListItem.HeadlineContent>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                    <Text style={m3Text('bodyLarge')}>{props.time.label}</Text>
                    <AgentMark show={props.time.agent} m={m} />
                  </Row>
                </ListItem.HeadlineContent>
                <ListItem.TrailingContent>
                  <Text color={m.primary} style={m3Text('labelLarge')}>{props.time.set ? 'Change' : 'Set'}</Text>
                </ListItem.TrailingContent>
              </ListItem>
              {pickingTime ? (
                <TimePickerDialog
                  initialDate={props.time.at ?? new Date().toISOString()}
                  is24Hour={false}
                  confirmButtonLabel="Set time"
                  onDateSelected={(at) => {
                    setPickingTime(false);
                    props.onSetTime(at);
                  }}
                  onDismissRequest={() => setPickingTime(false)}
                />
              ) : null}
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('modes', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 8)]}>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                <Text style={m3Text('titleMedium')}>Modes</Text>
                <AgentMark show={props.modesAgent} m={m} />
              </Row>
              <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
                {props.modes.map((mode) => (
                  <FilterChip key={mode.mode} selected={mode.selected} onClick={() => props.onToggleMode(mode.mode)}>
                    <FilterChip.LeadingIcon>
                      <Icon source={MODE_ICONS[mode.mode]} size={18} />
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
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                <Text modifiers={[weight(1)]} style={m3Text('titleMedium')}>How strict is the arrival time?</Text>
                <AgentMark show={props.lateAgent} m={m} />
              </Row>
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
            <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 8)]}>
              <Text style={m3Text('titleMedium')}>Preferences (rank, never exclude)</Text>
              {props.preferences.map((row) => (
                <Column key={row.key} verticalArrangement={{ spacedBy: 4 }}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
                    <Text style={m3Text('bodyLarge')}>{row.start}</Text>
                    <AgentMark show={row.agent} m={m} />
                    <Row modifiers={[weight(1)]}>{null}</Row>
                    <Text style={m3Text('bodyLarge')}>{row.end}</Text>
                  </Row>
                  <PreferenceSlider value={row.value} onChange={(value) => props.onPreference(row.key, value)} />
                </Column>
              ))}
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('limits', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}>
              <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(m.surfaceContainerLowest)]}>
                <Row verticalAlignment="center" modifiers={[fillMaxWidth(), clickable(props.onToggleLimits), padding(16, 16, 16, 8)]}>
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
      <Block scheme={scheme}>
        <Column modifiers={[fillMaxWidth()]}>
          <HorizontalDivider color={m.outlineVariant} />
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
            <Column modifiers={[weight(1)]}>
              {props.counts ? <Text color={m.onSurface} style={m3Text('titleSmall')}>{props.counts.routes}</Text> : null}
              {props.counts ? <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.counts.almost}</Text> : null}
            </Column>
            <Button onClick={props.onShowRoutes}>
              <Text style={m3Text('labelLarge')}>Show routes</Text>
            </Button>
          </Row>
        </Column>
      </Block>
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
  content: { paddingBottom: 8 }
});
