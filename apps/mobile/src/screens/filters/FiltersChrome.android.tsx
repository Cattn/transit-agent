import { useRef, useState, type ReactElement } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import {
  Button,
  Column,
  FilterChip,
  FlowRow,
  Icon,
  IconButton,
  ListItem,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Switch,
  Text,
  TextButton,
  useMaterialColors,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { clickable, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import ArrowDown from '../../../assets/icons/keyboard_arrow_down_fill.xml';
import ArrowUp from '../../../assets/icons/keyboard_arrow_up_fill.xml';
import Close from '../../../assets/icons/close_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Edit from '../../../assets/icons/edit_fill.xml';
import Lock from '../../../assets/icons/lock_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { ChipMode, FilterFocus, FiltersChromeProps, LimitAction } from './FiltersScreen';
import { PlaceField, type PlaceFieldColors } from './PlaceField';

const MODE_ICONS: Record<ChipMode, number> = {
  walk: DirectionsWalk,
  bus: DirectionsBus,
  rail: Train,
  bike: DirectionsBike
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
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
      <Icon source={Edit} size={14} tint={m.primary} contentDescription="Set by the agent" />
      <Text color={m.primary} style={m3Text('labelMedium')}>Agent</Text>
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

function LimitRow({ title, item, m, onAction }: {
  title: string;
  item: { label: string; set: boolean; agent: boolean };
  m: MaterialColors;
  onAction: (action: LimitAction) => void;
}) {
  return (
    <ListItem modifiers={[fillMaxWidth()]}>
      <ListItem.LeadingContent>
        <Icon source={Lock} size={24} tint={m.onSurfaceVariant} contentDescription="Limit" />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text style={m3Text('bodyLarge')}>{title}</Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
          {item.set ? <TextButton onClick={() => onAction('down')}><Text style={m3Text('labelLarge')}>−</Text></TextButton> : null}
          {item.set ? <TextButton onClick={() => onAction('up')}><Text style={m3Text('labelLarge')}>+</Text></TextButton> : null}
          {item.set ? <TextButton onClick={() => onAction('clear')}><Text style={m3Text('labelLarge')}>Clear</Text></TextButton> : null}
          {item.set ? null : <TextButton onClick={() => onAction('up')}><Text style={m3Text('labelLarge')}>Set</Text></TextButton>}
          <AgentMark show={item.agent} m={m} />
        </Row>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <Text style={m3Text('labelLarge')}>{item.label}</Text>
      </ListItem.TrailingContent>
    </ListItem>
  );
}

export function FiltersChrome(props: FiltersChromeProps) {
  const insets = useSafeAreaInsets();
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const placeColors: PlaceFieldColors = {
    surface: m.surface,
    onSurface: m.onSurface,
    onSurfaceVariant: m.onSurfaceVariant,
    primary: m.primary,
    outline: m.outline
  };

  const remember = (key: FilterFocus, y: number) => {
    if (scrolled.current || props.focus !== key) return;
    scrolled.current = true;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  };

  return (
    <View style={[styles.fill, { backgroundColor: m.surface, paddingTop: insets.top }]}>
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
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.list}>
        <View onLayout={(event) => remember('where', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}>
              <Text style={m3Text('titleMedium')}>Where & when</Text>
            </Column>
          </Block>
          <Block scheme={scheme}>
            <ListItem modifiers={[fillMaxWidth(), clickable(() => props.onSearch('origin'))]}>
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
            <ListItem modifiers={[fillMaxWidth(), clickable(() => props.onSearch('destination'))]}>
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
            <ListItem modifiers={props.time.set ? [fillMaxWidth()] : [fillMaxWidth(), clickable(props.onSetTime)]}>
              <ListItem.LeadingContent>
                <Icon source={Lock} size={24} tint={m.onSurfaceVariant} contentDescription="Locked time" />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                  <Text style={m3Text('bodyLarge')}>{props.time.label}</Text>
                  <AgentMark show={props.time.agent} m={m} />
                </Row>
              </ListItem.HeadlineContent>
            </ListItem>
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
                    <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>↔</Text>
                    <Text modifiers={[weight(1)]} style={m3Text('bodyLarge')}>{row.end}</Text>
                    <AgentMark show={row.agent} m={m} />
                  </Row>
                  <PreferenceSlider value={row.value} onChange={(value) => props.onPreference(row.key, value)} />
                </Column>
              ))}
            </Column>
          </Block>
        </View>

        <View onLayout={(event) => remember('limits', event.nativeEvent.layout.y)}>
          <Block scheme={scheme}>
            <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
              <Row verticalAlignment="center" modifiers={[fillMaxWidth(), clickable(props.onToggleLimits)]}>
                <Text modifiers={[weight(1)]} style={m3Text('titleMedium')}>Advanced limits</Text>
                <Icon source={props.limitsOpen ? ArrowUp : ArrowDown} size={24} contentDescription={props.limitsOpen ? 'Collapse advanced limits' : 'Expand advanced limits'} />
              </Row>
              {props.limitsOpen ? (
                <Column>
                  <LimitRow title="Max walk" item={props.walk} m={m} onAction={props.onWalk} />
                  <LimitRow title="Max transfers" item={props.transfers} m={m} onAction={props.onTransfers} />
                  <ListItem modifiers={[fillMaxWidth()]}>
                    <ListItem.LeadingContent>
                      <Icon source={Lock} size={24} tint={m.onSurfaceVariant} contentDescription="Limit" />
                    </ListItem.LeadingContent>
                    <ListItem.HeadlineContent>
                      <Text style={m3Text('bodyLarge')}>Step-free access</Text>
                    </ListItem.HeadlineContent>
                    <ListItem.SupportingContent>
                      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
                        <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.stepFree.on ? 'On' : 'Off'}</Text>
                        <AgentMark show={props.stepFree.agent} m={m} />
                      </Row>
                    </ListItem.SupportingContent>
                    <ListItem.TrailingContent>
                      <Switch value={props.stepFree.on} onCheckedChange={props.onStepFree} />
                    </ListItem.TrailingContent>
                  </ListItem>
                </Column>
              ) : null}
            </Column>
          </Block>
        </View>
      </ScrollView>
      <Block scheme={scheme}>
        <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 12)]}>
          {props.counts ? (
            <Column>
              <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.counts.routes}</Text>
              <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{props.counts.almost}</Text>
            </Column>
          ) : null}
          <Button onClick={props.onShowRoutes} modifiers={[fillMaxWidth()]}>
            <Text style={m3Text('labelLarge')}>Show routes</Text>
          </Button>
        </Column>
      </Block>
      <View style={{ height: insets.bottom, backgroundColor: m.surface }} />
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
