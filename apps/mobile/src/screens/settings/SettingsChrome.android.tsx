import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import {
  AlertDialog,
  Button,
  Column,
  FilterChip,
  FlowRow,
  Icon,
  IconButton,
  ListItem,
  LoadingIndicator,
  OutlinedTextField,
  RadioButton,
  Row,
  Slider,
  Switch,
  Text,
  TextButton,
  useMaterialColors,
  useNativeState,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { alpha, background, clickable, clip, fillMaxWidth, padding, paddingAll, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import Accessible from '../../../assets/icons/accessible_fill.xml';
import Add from '../../../assets/icons/add_fill.xml';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import AutoAwesome from '../../../assets/icons/auto_awesome_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import ChevronRight from '../../../assets/icons/chevron_right_fill.xml';
import Contrast from '../../../assets/icons/contrast_fill.xml';
import Delete from '../../../assets/icons/delete_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Dns from '../../../assets/icons/dns_fill.xml';
import Info from '../../../assets/icons/info_fill.xml';
import Language from '../../../assets/icons/language_fill.xml';
import Smartphone from '../../../assets/icons/smartphone.xml';
import Notifications from '../../../assets/icons/notifications_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import { normalizeServerUrl } from '../../platform';
import { useAppColors } from '../../theme/appearance';
import { PRESET_ICON_SOURCES } from '../home/PresetSheet.android';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import { PlaceField, type PlaceFieldColors } from '../filters/PlaceField';
import type { Choice, LimitKey, SettingsChromeProps } from './SettingsScreen';

const COMING_SOON = 'Coming soon';

function Block({ scheme, children }: { scheme: 'light' | 'dark'; children: ReactElement }) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      {children}
    </Host>
  );
}

function GroupLabel({ m, children }: { m: MaterialColors; children: string }) {
  return (
    <Row modifiers={[fillMaxWidth(), padding(16, 0, 0, 0)]}>
      <Text color={m.primary} style={m3Text('titleSmall')}>{children}</Text>
    </Row>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return (
    <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}>
      {children}
    </Column>
  );
}

interface SettingRowProps {
  m: MaterialColors;
  icon?: number;
  iconTint?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function SettingRow({ m, icon, iconTint, title, subtitle, trailing, chevron, disabled, onClick }: SettingRowProps) {
  const modifiers = [fillMaxWidth(), clip(Shapes.RoundedCorner(4))];
  if (onClick && !disabled) modifiers.push(clickable(onClick));
  if (disabled) modifiers.push(alpha(0.38));
  return (
    <ListItem colors={{ containerColor: m.surfaceContainerLow }} modifiers={modifiers}>
      {icon !== undefined ? (
        <ListItem.LeadingContent>
          <Icon source={icon} size={24} tint={iconTint ?? m.onSurfaceVariant} />
        </ListItem.LeadingContent>
      ) : null}
      <ListItem.HeadlineContent>
        <Text color={m.onSurface} style={m3Text('bodyLarge')}>{title}</Text>
      </ListItem.HeadlineContent>
      {subtitle ? (
        <ListItem.SupportingContent>
          <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{subtitle}</Text>
        </ListItem.SupportingContent>
      ) : null}
      {trailing || chevron ? (
        <ListItem.TrailingContent>
          {trailing ?? <Icon source={ChevronRight} size={20} tint={m.onSurfaceVariant} />}
        </ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
}

function Value({ m, children }: { m: MaterialColors; children: string }) {
  return <Text color={m.primary} style={m3Text('labelLarge')}>{children}</Text>;
}

function ChoiceDialog<T>({ title, options, m, onPick, onDismiss }: { title: string; options: Choice<T>[]; m: MaterialColors; onPick: (value: T) => void; onDismiss: () => void }) {
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={m3Text('headlineSmall')}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth()]}>
          {options.map((option) => (
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

function MpgDialog({ current, m, onSave, onDismiss }: { current?: number; m: MaterialColors; onSave: (value: number | undefined) => void; onDismiss: () => void }) {
  const value = useNativeState(current === undefined ? '' : String(current));
  const [text, setText] = useState(current === undefined ? '' : String(current));
  const parsed = Number(text.trim());
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed > 0 && parsed < 1000;
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={m3Text('headlineSmall')}>Car fuel economy</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Used for drive costs if using car</Text>
          <OutlinedTextField
            value={value}
            autoFocus
            singleLine
            onValueChange={setText}
            keyboardOptions={{ keyboardType: 'decimal', imeAction: 'done' }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedTextField.Suffix>
              <Text style={m3Text('bodyLarge')}>mpg</Text>
            </OutlinedTextField.Suffix>
          </OutlinedTextField>
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton enabled={valid} onClick={() => onSave(Math.round(parsed * 10) / 10)}>
          <Text style={m3Text('labelLarge')}>Save</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <Row>
          {current !== undefined ? (
            <TextButton onClick={() => onSave(undefined)}>
              <Text style={m3Text('labelLarge')}>Clear</Text>
            </TextButton>
          ) : null}
          <TextButton onClick={onDismiss}>
            <Text style={m3Text('labelLarge')}>Cancel</Text>
          </TextButton>
        </Row>
      </AlertDialog.DismissButton>
    </AlertDialog>
  );
}

interface ServerDialogProps {
  saved: string | null;
  servers: { url: string; label: string }[];
  defaultLabel: string;
  m: MaterialColors;
  onCheck: (url: string) => Promise<boolean>;
  onSelect: (url: string | null) => void;
  onRemove: (url: string) => void;
  onDismiss: () => void;
}

function ServerDialog({ saved, servers, defaultLabel, m, onCheck, onSelect, onRemove, onDismiss }: ServerDialogProps) {
  const value = useNativeState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [unreachable, setUnreachable] = useState<string>();
  const [checking, setChecking] = useState(false);
  const attempt = useRef(0);

  useEffect(() => () => { attempt.current += 1; }, []);

  const edit = (next: string) => {
    attempt.current += 1;
    setText(next);
    setError(undefined);
    setUnreachable(undefined);
    setChecking(false);
  };

  const submit = (force: boolean) => {
    const url = normalizeServerUrl(text);
    if (!url) {
      setError('Enter an address like 192.168.1.20:3001 or https://name.example.com');
      return;
    }
    if (force || servers.some((server) => server.url === url)) {
      onSelect(url);
      return;
    }
    const id = ++attempt.current;
    setChecking(true);
    setError(undefined);
    setUnreachable(undefined);
    void onCheck(url).then((ok) => {
      if (id !== attempt.current) return;
      setChecking(false);
      if (ok) {
        onSelect(url);
        return;
      }
      setUnreachable(url);
      setError("Couldn't reach that server");
    });
  };

  const option = (key: string, label: string, url: string | null, remove?: () => void) => (
    <Row key={key} verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), clickable(() => onSelect(url)), padding(0, 4, 0, 4)]}>
      <RadioButton selected={url === saved} onClick={() => onSelect(url)} />
      <Text color={m.onSurface} style={m3Text('bodyLarge')} modifiers={[weight(1)]}>{label}</Text>
      {remove ? (
        <IconButton onClick={remove}>
          <Icon source={Delete} size={24} tint={m.onSurfaceVariant} contentDescription={`Remove ${label}`} />
        </IconButton>
      ) : null}
    </Row>
  );

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={m3Text('headlineSmall')}>Server</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <Column modifiers={[fillMaxWidth()]}>
            {option('default', defaultLabel, null)}
            {servers.map((server) => option(server.url, server.label, server.url, () => onRemove(server.url)))}
          </Column>
          <OutlinedTextField
            value={value}
            autoFocus={servers.length === 0}
            singleLine
            isError={error !== undefined}
            onValueChange={edit}
            keyboardOptions={{ keyboardType: 'uri', capitalization: 'none', autoCorrectEnabled: false, imeAction: 'done' }}
            keyboardActions={{ onDone: () => { if (!checking && text.trim()) submit(false); } }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedTextField.Label>
              <Text style={m3Text('bodyLarge')}>Add a server</Text>
            </OutlinedTextField.Label>
            <OutlinedTextField.Placeholder>
              <Text style={m3Text('bodyLarge')}>192.168.1.20:3001</Text>
            </OutlinedTextField.Placeholder>
            {error ? (
              <OutlinedTextField.SupportingText>
                <Text style={m3Text('bodySmall')}>{error}</Text>
              </OutlinedTextField.SupportingText>
            ) : null}
          </OutlinedTextField>
          <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Open /connect on this phone to add one automatically.</Text>
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <Row>
          {unreachable ? (
            <TextButton onClick={() => submit(true)}>
              <Text style={m3Text('labelLarge')}>Add anyway</Text>
            </TextButton>
          ) : null}
          <TextButton enabled={!checking && text.trim() !== ''} onClick={() => submit(false)}>
            <Text style={m3Text('labelLarge')}>{checking ? 'Checking…' : 'Add'}</Text>
          </TextButton>
        </Row>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text style={m3Text('labelLarge')}>Close</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  );
}

function ComfortSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const latest = useRef(value);
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
        latest.current = next;
        setDrag(next);
      }}
      onValueChangeFinished={() => {
        if (!moved.current) return;
        moved.current = false;
        const next = Math.min(1, Math.max(0, Math.round(latest.current * 100) / 100));
        setPending(next);
        onChange(next);
      }}
    />
  );
}

type Dialog = { kind: 'limit'; key: LimitKey } | { kind: 'late' } | { kind: 'zone' } | { kind: 'theme' } | { kind: 'mpg' } | { kind: 'server' };

const MODE_ICONS = { walk: DirectionsWalk, bus: DirectionsBus, rail: Train, bike: DirectionsBike, car: DirectionsCar } as const;
const LIMIT_ICONS: Record<LimitKey, number> = { maxWalkMinutes: DirectionsWalk, maxTransfers: DirectionsBus };

export function SettingsChrome(props: SettingsChromeProps) {
  const insets = useSafeAreaInsets();
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const [dialog, setDialog] = useState<Dialog>();
  const close = () => setDialog(undefined);
  const placeColors: PlaceFieldColors = { surface: m.surface, onSurface: m.onSurface, onSurfaceVariant: m.onSurfaceVariant, primary: m.primary, outline: m.outline };
  const limit = dialog?.kind === 'limit' ? props.limits.find((item) => item.key === dialog.key) : undefined;

  const serverRow = <SettingRow m={m} icon={Dns} title="Server" subtitle={props.server.label} chevron disabled={props.server.loading} onClick={() => setDialog({ kind: 'server' })} />;
  const serverDialog = dialog?.kind === 'server' ? (
    <ServerDialog
      saved={props.server.saved}
      servers={props.server.servers}
      defaultLabel={props.server.defaultLabel}
      m={m}
      onCheck={props.onCheckServer}
      onDismiss={close}
      onSelect={(url) => { close(); props.onSaveServer(url); }}
      onRemove={props.onRemoveServer}
    />
  ) : null;

  const header = (
    <Block scheme={scheme}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(4, 8, 16, 8)]}>
        <IconButton onClick={props.onBack}>
          <Icon source={ArrowBack} size={24} contentDescription="Back" />
        </IconButton>
        <Text color={m.onSurface} style={m3Text('headlineMedium')}>Settings</Text>
      </Row>
    </Block>
  );

  if (!props.ready) {
    return (
      <View style={[styles.container, { backgroundColor: m.surface, paddingTop: insets.top }]}>
        {header}
        <Block scheme={scheme}>
          <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), paddingAll(24)]}>
            {props.loadError ? (
              <>
                <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>{props.loadError}</Text>
                <Button onClick={props.onRetryLoad}>
                  <Text style={m3Text('labelLarge')}>Retry</Text>
                </Button>
              </>
            ) : (
              <LoadingIndicator modifiers={[size(40, 40)]} />
            )}
            <Rows>{serverRow}</Rows>
            {serverDialog}
          </Column>
        </Block>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: m.surface, paddingTop: insets.top }]}>
      {header}
      {props.saveError ? (
        <Block scheme={scheme}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
            <Row modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(m.errorContainer), paddingAll(16)]}>
              <Text color={m.onErrorContainer} style={m3Text('bodyMedium')}>{props.saveError}</Text>
            </Row>
          </Row>
        </Block>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Block scheme={scheme}>
          <Column verticalArrangement={{ spacedBy: 20 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 0)]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(28)), background(m.primaryContainer), paddingAll(16)]}>
              <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[size(48, 48), clip(Shapes.Circle), background(m.primary)]}>
                <Icon source={Smartphone} size={24} tint={m.onPrimary} />
              </Column>
              <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                <Text color={m.onPrimaryContainer} style={m3Text('titleMedium')}>This device&apos;s profile</Text>
                <Text color={m.onPrimaryContainer} style={m3Text('bodyMedium')}>One profile per device — no account needed. Your defaults fill every new trip.</Text>
              </Column>
            </Row>
            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>Favorite Places</GroupLabel>
            </Column>
          </Column>
        </Block>

        <View style={styles.group}>
          <View style={styles.rows}>
            {props.places.map((place) => (
              <View key={place.key}>
                <Block scheme={scheme}>
                  <SettingRow m={m} icon={PRESET_ICON_SOURCES[place.icon]} iconTint={place.color} title={place.title} subtitle={place.value} chevron onClick={() => props.onEditPlace(place.key)} />
                </Block>
                {props.editingPlace === place.key ? (
                  <View style={{ backgroundColor: m.surfaceContainerLow }}>
                    <PlaceField
                      near={props.placeSearch.near}
                      showLocation
                      locating={props.placeSearch.locating}
                      notice={props.placeSearch.notice}
                      colors={placeColors}
                      onPick={props.placeSearch.onPick}
                      onUseLocation={props.placeSearch.onUseLocation}
                    />
                  </View>
                ) : null}
              </View>
            ))}
            {props.customPlaces.map((place) => (
              <Block key={place.key} scheme={scheme}>
                <SettingRow m={m} icon={PRESET_ICON_SOURCES[place.icon]} iconTint={place.color} title={place.title} subtitle={place.value} chevron onClick={() => props.onEditCustomPlace(place.key)} />
              </Block>
            ))}
            <Block scheme={scheme}>
              <SettingRow
                m={m}
                icon={Add}
                title="Add a place"
                subtitle={props.onAddPlace ? undefined : `Up to ${props.placeLimit} places`}
                disabled={!props.onAddPlace}
                onClick={props.onAddPlace}
              />
            </Block>
          </View>
        </View>

        <Block scheme={scheme}>
          <Column verticalArrangement={{ spacedBy: 20 }} modifiers={[fillMaxWidth(), padding(16, 20, 16, 0)]}>
            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>Trip defaults</GroupLabel>
              <Rows>
                <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(4)), background(m.surfaceContainerLow), padding(16, 14, 16, 14)]}>
                  <Text color={m.onSurface} style={m3Text('bodyLarge')}>Modes a new trip includes</Text>
                  <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: -8 }}>
                    {props.modes.map((mode) => {
                      return (
                        <FilterChip key={mode.mode} selected={mode.selected} onClick={() => props.onToggleMode(mode.mode)}>
                          <FilterChip.LeadingIcon>
                            <Icon source={mode.selected ? Check : MODE_ICONS[mode.mode]} size={18} />
                          </FilterChip.LeadingIcon>
                          <FilterChip.Label>
                            <Text style={m3Text('labelLarge')}>{mode.label}</Text>
                          </FilterChip.Label>
                        </FilterChip>
                      );
                    })}
                  </FlowRow>
                </Column>
                <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(4)), background(m.surfaceContainerLow), padding(16, 12, 16, 8)]}>
                  <Row modifiers={[fillMaxWidth()]}>
                    <Text color={m.onSurface} style={m3Text('bodyMedium')}>Cheaper</Text>
                    <Row modifiers={[weight(1)]}>{null}</Row>
                    <Text color={m.onSurface} style={m3Text('bodyMedium')}>Comfier</Text>
                  </Row>
                  <ComfortSlider value={props.comfort} onChange={props.onComfort} />
                </Column>
                {props.limits.map((item) => (
                  <SettingRow key={item.key} m={m} icon={LIMIT_ICONS[item.key]} title={item.title} subtitle="Hard limit" trailing={<Value m={m}>{item.label}</Value>} onClick={() => setDialog({ kind: 'limit', key: item.key })} />
                ))}
                <SettingRow m={m} icon={Schedule} title="Arrival strictness" subtitle={props.late.label} chevron onClick={() => setDialog({ kind: 'late' })} />
                <SettingRow
                  m={m}
                  icon={Accessible}
                  title="Step-free routes only"
                  trailing={<Switch value={props.stepFree} onCheckedChange={props.onStepFree} />}
                  onClick={() => props.onStepFree(!props.stepFree)}
                />
              </Rows>
            </Column>

            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>Vehicles</GroupLabel>
              <Rows>
                <SettingRow m={m} icon={DirectionsCar} title="Car fuel economy" subtitle="Used for drive costs if using car" trailing={<Value m={m}>{props.carMpgLabel}</Value>} onClick={() => setDialog({ kind: 'mpg' })} />
              </Rows>
            </Column>

            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>Trip monitoring</GroupLabel>
              <Rows>
                <SettingRow m={m} icon={Notifications} title="Watch saved trips" subtitle="Manage watching for each saved trip on Home" chevron onClick={props.onBack} />
                <SettingRow m={m} icon={Schedule} title="Buffer before “leave now”" subtitle={COMING_SOON} chevron disabled />
                <SettingRow m={m} icon={AutoAwesome} title="Missed-trip recovery" subtitle="Watched trips can switch to a valid next route after a confirmed miss" />
              </Rows>
            </Column>

            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>Display & region</GroupLabel>
              <Rows>
                <SettingRow m={m} icon={Language} title="Time zone" subtitle={props.timeZone.label} chevron onClick={() => setDialog({ kind: 'zone' })} />
                <SettingRow m={m} icon={Contrast} title="Theme" subtitle={props.theme.label} chevron onClick={() => setDialog({ kind: 'theme' })} />
              </Rows>
            </Column>

            <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
              <GroupLabel m={m}>About</GroupLabel>
              <Rows>
                {serverRow}
                <SettingRow m={m} icon={Smartphone} title="Device ID" subtitle={props.deviceId} />
                <SettingRow m={m} icon={Info} title="Version" subtitle={props.version} />
              </Rows>
            </Column>

            {limit ? (
              <ChoiceDialog title={limit.title} options={limit.options} m={m} onDismiss={close} onPick={(value) => { close(); props.onLimit(limit.key, value); }} />
            ) : null}
            {dialog?.kind === 'late' ? (
              <ChoiceDialog title="Arrival strictness" options={props.late.options} m={m} onDismiss={close} onPick={(value) => { close(); props.onLateTolerance(value); }} />
            ) : null}
            {dialog?.kind === 'zone' ? (
              <ChoiceDialog title="Time zone" options={props.timeZone.options} m={m} onDismiss={close} onPick={(value) => { close(); props.onTimeZone(value); }} />
            ) : null}
            {dialog?.kind === 'theme' ? (
              <ChoiceDialog title="Theme" options={props.theme.options} m={m} onDismiss={close} onPick={(value) => { close(); props.onTheme(value); }} />
            ) : null}
            {serverDialog}
            {dialog?.kind === 'mpg' ? (
              <MpgDialog current={props.carMpg} m={m} onDismiss={close} onSave={(value) => { close(); props.onCarMpg(value); }} />
            ) : null}
          </Column>
        </Block>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullWidth: { width: '100%' },
  content: { paddingBottom: 32 },
  group: { paddingHorizontal: 16, paddingTop: 8 },
  rows: { borderRadius: 24, overflow: 'hidden', gap: 2 }
});
