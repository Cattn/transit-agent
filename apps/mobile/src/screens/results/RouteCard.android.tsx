import { Button, Column, FlowRow, HorizontalDivider, Icon, Row, Shape, Surface, Text, type MaterialColors } from '@expo/ui/jetpack-compose';
import { clickable, clip, fillMaxWidth, horizontalScroll, padding, Shapes, weight } from '@expo/ui/jetpack-compose/modifiers';
import type { Tone } from '@transit/shared';
import BookmarkAdd from '../../../assets/icons/bookmark_add_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBoat from '../../../assets/icons/directions_boat_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Flight from '../../../assets/icons/flight_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import { m3Text } from '../../theme/typography';
import { toneRole, type LegChip } from './ItineraryCard';
import type { ResultCard } from './ResultsScreen';

export const MODE_ICONS: Record<LegChip['mode'], number> = {
  walk: DirectionsWalk,
  bike: DirectionsBike,
  bikeshare: DirectionsBike,
  bus: DirectionsBus,
  rail: Train,
  ferry: DirectionsBoat,
  car: DirectionsCar,
  flight: Flight
};
export const CARD_RADIUS = 16;

export function corners(radius: number) {
  return Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
}

function toneColors(tone: Tone, m: MaterialColors): { bg: string; fg: string } {
  const role = toneRole(tone);
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
}

function LegChips({ chips, m, wrap }: { chips: LegChip[]; m: MaterialColors; wrap: boolean }) {
  const items = chips.map((chip, index) => (
    <Row key={chip.id} horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
      {index > 0 ? <Text color={m.outline} style={m3Text('labelLarge')}>›</Text> : null}
      {chip.transit ? (
        <Surface color={m.primaryContainer} contentColor={m.onPrimaryContainer} shape={corners(8)}>
          <Row horizontalArrangement={{ spacedBy: 2 }} verticalAlignment="center" modifiers={[padding(6, 3, 8, 3)]}>
            <Icon source={MODE_ICONS[chip.mode]} size={18} tint={m.onPrimaryContainer} />
            <Text color={m.onPrimaryContainer} maxLines={1} softWrap={false} style={m3Text('labelLarge', 700)}>{chip.label}</Text>
          </Row>
        </Surface>
      ) : (
        <Row horizontalArrangement={{ spacedBy: 2 }} verticalAlignment="center">
          <Icon source={MODE_ICONS[chip.mode]} size={18} tint={m.onSurfaceVariant} />
          <Text color={m.onSurfaceVariant} maxLines={1} softWrap={false} style={m3Text('labelMedium')}>{chip.label}</Text>
        </Row>
      )}
    </Row>
  ));
  return wrap
    ? <FlowRow horizontalArrangement={{ spacedBy: 6 }} verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>{items}</FlowRow>
    : <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center" modifiers={[fillMaxWidth(), horizontalScroll()]}>{items}</Row>;
}

export function RouteCard({ card, canSave, m, onSelect, onSave }: {
  card: ResultCard;
  canSave: boolean;
  m: MaterialColors;
  onSelect: () => void;
  onSave: () => void;
}) {
  const { text, selected, saved } = card;
  const risk = toneColors(text.risk.tone, m);
  const pill = text.live
    ? { bg: m.primaryContainer, fg: m.onPrimaryContainer, icon: Sensors }
    : { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant, icon: Schedule };

  return (
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
        {card.wait ? <Text color={card.wait.long ? m.tertiary : m.onSurfaceVariant} style={m3Text('labelLarge')}>{card.wait.label}</Text> : null}
        <LegChips chips={text.chips} m={m} wrap={selected} />
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
                <Text color={m.onSurface} style={m3Text('bodyMedium', 500)}>{leg.direction ? `${leg.label} ${leg.direction}` : leg.label}</Text>
                <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>{`${leg.times} · ${leg.freshness.label}`}</Text>
                {leg.stopCount ? <Text color={m.onSurface} style={m3Text('bodySmall', 500)}>{leg.stopCount}</Text> : null}
                {leg.stops ? <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>{leg.stops}</Text> : null}
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
  );
}
