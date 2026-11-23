import { useState } from 'react';
import {
  Box,
  Button,
  Column,
  FlowRow,
  HorizontalDivider,
  Icon,
  Row,
  Shape,
  Surface,
  Text,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import {
  animateContentSize,
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
  Shapes,
  size,
  weight,
  width
} from '@expo/ui/jetpack-compose/modifiers';
import type { Badge, Tone } from '@transit/shared';
import BookmarkAdd from '../../../assets/icons/bookmark_add_fill.xml';
import Check from '../../../assets/icons/check_fill.xml';
import ChevronRight from '../../../assets/icons/chevron_right_fill.xml';
import DirectionsBike from '../../../assets/icons/directions_bike_fill.xml';
import DirectionsBoat from '../../../assets/icons/directions_boat_fill.xml';
import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import DirectionsCar from '../../../assets/icons/directions_car_fill.xml';
import DirectionsWalk from '../../../assets/icons/directions_walk_fill.xml';
import Flight from '../../../assets/icons/flight_fill.xml';
import KeyboardArrowDown from '../../../assets/icons/keyboard_arrow_down_fill.xml';
import KeyboardArrowUp from '../../../assets/icons/keyboard_arrow_up_fill.xml';
import LocationOn from '../../../assets/icons/location_on_fill.xml';
import Schedule from '../../../assets/icons/schedule_fill.xml';
import Sensors from '../../../assets/icons/sensors_fill.xml';
import Train from '../../../assets/icons/train_fill.xml';
import Warning from '../../../assets/icons/warning_fill.xml';
import { m3Text } from '../../theme/typography';
import { toneRole, type LegChip, type LegDetail } from './ItineraryCard';
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

export const CARD_RADIUS = 24;
const PILL_RADIUS = 999;
const LEG_CARD_INSET = 12;
const TIME_COL = 62;
const OUTER_TIME_COL = TIME_COL + LEG_CARD_INSET;
const RAIL_COL = 20;

export function corners(radius: number) {
  return Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
}

function toneColors(tone: Tone, m: MaterialColors): { bg: string; fg: string } {
  const role = toneRole(tone);
  if (role === 'error') return { bg: m.errorContainer, fg: m.onErrorContainer };
  if (role === 'tertiary') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer };
  return { bg: m.secondaryContainer, fg: m.onSecondaryContainer };
}

function transitModeColors(mode: LegChip['mode'], m: MaterialColors): { bg: string; fg: string; track: string } {
  if (mode === 'rail') return { bg: m.primaryContainer, fg: m.onPrimaryContainer, track: m.primary };
  if (mode === 'ferry' || mode === 'flight') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer, track: m.tertiary };
  return { bg: m.secondaryContainer, fg: m.onSecondaryContainer, track: m.secondary };
}

function freshnessPillStyle(badge: Badge, live: boolean, m: MaterialColors): { bg: string; fg: string; icon: number } {
  if (live) {
    if (badge.tone === 'warn') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer, icon: Sensors };
    return { bg: m.primaryContainer, fg: m.onPrimaryContainer, icon: Sensors };
  }
  if (badge.tone === 'warn') return { bg: m.tertiaryContainer, fg: m.onTertiaryContainer, icon: Schedule };
  return { bg: m.surfaceContainerHighest, fg: m.onSurfaceVariant, icon: Schedule };
}

function LegChips({ chips, m, wrap }: { chips: LegChip[]; m: MaterialColors; wrap: boolean }) {
  const items = chips.map((chip, index) => {
    const modeTone = transitModeColors(chip.mode, m);
    return (
      <Row key={chip.id} horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
        {index > 0 ? <Icon source={ChevronRight} size={16} tint={m.outline} /> : null}
        {chip.transit ? (
          <Surface color={modeTone.bg} contentColor={modeTone.fg} shape={corners(10)}>
            <Row horizontalArrangement={{ spacedBy: 5 }} verticalAlignment="center" modifiers={[padding(8, 4, 10, 4)]}>
              <Icon source={MODE_ICONS[chip.mode]} size={16} tint={modeTone.fg} />
              <Text color={modeTone.fg} maxLines={1} softWrap={false} style={m3Text('labelLarge', 700)}>{chip.label}</Text>
            </Row>
          </Surface>
        ) : (
          <Surface color={m.surfaceContainerHigh} contentColor={m.onSurfaceVariant} shape={corners(10)}>
            <Row horizontalArrangement={{ spacedBy: 3 }} verticalAlignment="center" modifiers={[padding(6, 4, 8, 4)]}>
              <Icon source={MODE_ICONS[chip.mode]} size={15} tint={m.onSurfaceVariant} />
              <Text color={m.onSurfaceVariant} maxLines={1} softWrap={false} style={m3Text('labelMedium', 500)}>
                {chip.label === '0' ? '<1m' : `${chip.label}m`}
              </Text>
            </Row>
          </Surface>
        )}
      </Row>
    );
  });
  return wrap
    ? <FlowRow horizontalArrangement={{ spacedBy: 6 }} verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>{items}</FlowRow>
    : <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center" modifiers={[fillMaxWidth(), horizontalScroll()]}>{items}</Row>;
}

function DottedConnector({ count, color }: { count: number; color: string }) {
  return (
    <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 4 }} modifiers={[width(RAIL_COL)]}>
      {Array.from({ length: count }, (_, idx) => (
        <Box key={idx} modifiers={[size(4, 4), clip(Shapes.Circle), background(color)]}>{null}</Box>
      ))}
    </Column>
  );
}

function TransferRow({ minutes, m }: { minutes: number; m: MaterialColors }) {
  const tight = minutes <= 5;
  const bg = tight ? m.tertiaryContainer : m.surfaceContainerHigh;
  const fg = tight ? m.onTertiaryContainer : m.onSurfaceVariant;
  return (
    <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
      <Box modifiers={[width(OUTER_TIME_COL)]}>{null}</Box>
      <DottedConnector count={2} color={tight ? m.tertiary : m.outline} />
      <Surface color={bg} contentColor={fg} shape={corners(PILL_RADIUS)}>
        <Row horizontalArrangement={{ spacedBy: 5 }} verticalAlignment="center" modifiers={[padding(10, 4, 12, 4)]}>
          <Icon source={Schedule} size={14} tint={fg} />
          <Text color={fg} maxLines={1} softWrap={false} style={m3Text('labelMedium', 500)}>{`${minutes} min transfer`}</Text>
        </Row>
      </Surface>
    </Row>
  );
}

function ActiveLegRow({ leg, m }: { leg: LegDetail; m: MaterialColors }) {
  return (
    <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
      <Box contentAlignment="centerStart" modifiers={[width(OUTER_TIME_COL)]}>
        <Text color={m.onSurfaceVariant} maxLines={1} softWrap={false} style={m3Text('bodySmall')}>{leg.duration}</Text>
      </Box>
      <DottedConnector count={3} color={m.outline} />
      <Surface color={m.surfaceContainerHigh} contentColor={m.onSurface} shape={corners(16)} modifiers={[weight(1)]}>
        <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(10, 9, 12, 9)]}>
          <Box contentAlignment="center" modifiers={[size(30, 30), clip(Shapes.Circle), background(m.surfaceContainerHighest)]}>
            <Icon source={MODE_ICONS[leg.mode]} size={17} tint={m.onSurfaceVariant} />
          </Box>
          <Column verticalArrangement={{ spacedBy: 1 }} modifiers={[weight(1)]}>
            <Text color={m.onSurface} maxLines={1} overflow="ellipsis" style={m3Text('bodyMedium', 500)}>
              {leg.distance ? `${leg.label} · ${leg.distance}` : leg.label}
            </Text>
            <Text color={m.onSurfaceVariant} maxLines={1} style={m3Text('bodySmall')}>{leg.freshness.label}</Text>
          </Column>
        </Row>
      </Surface>
    </Row>
  );
}

function TransitLegCard({
  leg,
  m,
  stopsOpen,
  onToggleStops
}: {
  leg: LegDetail;
  m: MaterialColors;
  stopsOpen: boolean;
  onToggleStops: () => void;
}) {
  const accent = transitModeColors(leg.mode, m);
  const pill = freshnessPillStyle(leg.freshness, leg.live, m);
  const hasExpandableStops = (leg.intermediateStopNames?.length ?? 0) > 0;

  return (
    <Surface
      color={m.surfaceContainerHigh}
      contentColor={m.onSurface}
      shape={corners(20)}
      modifiers={[fillMaxWidth(), animateContentSize()]}
    >
      <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth(), padding(LEG_CARD_INSET, 12, LEG_CARD_INSET, 12)]}>
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Box contentAlignment="centerStart" modifiers={[width(TIME_COL)]}>
            <Text color={m.onSurface} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)}>{leg.departTime}</Text>
          </Box>
          <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
            <Box modifiers={[size(10, 10), clip(Shapes.Circle), background(accent.track)]}>{null}</Box>
          </Box>
          <Text color={m.onSurface} maxLines={2} overflow="ellipsis" style={m3Text('titleSmall', 700)} modifiers={[weight(1)]}>
            {leg.fromName ?? 'Board'}
          </Text>
        </Row>

        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Box contentAlignment="centerStart" modifiers={[width(TIME_COL)]}>
            <Text color={m.onSurfaceVariant} maxLines={1} softWrap={false} style={m3Text('bodySmall')}>{leg.duration}</Text>
          </Box>
          <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
            <Box modifiers={[size(4, 34), clip(Shapes.RoundedCorner(2)), background(accent.track)]}>{null}</Box>
          </Box>
          <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 6 }} modifiers={[weight(1)]}>
            <Surface color={accent.bg} contentColor={accent.fg} shape={corners(10)} modifiers={[height(28)]}>
              <Row horizontalArrangement={{ spacedBy: 5 }} verticalAlignment="center" modifiers={[padding(8, 0, 10, 0)]}>
                <Icon source={MODE_ICONS[leg.mode]} size={16} tint={accent.fg} />
                <Text color={accent.fg} maxLines={1} softWrap={false} style={m3Text('labelLarge', 700)}>{leg.label}</Text>
              </Row>
            </Surface>
            {leg.direction ? (
              <Box contentAlignment="centerStart" modifiers={[padding(0, 4, 0, 4)]}>
                <Text color={m.onSurfaceVariant} maxLines={2} overflow="ellipsis" style={m3Text('bodyMedium', 500)}>
                  {leg.direction}
                </Text>
              </Box>
            ) : null}
            {!leg.stopCountShort ? (
              <Surface color={pill.bg} contentColor={pill.fg} shape={corners(PILL_RADIUS)} modifiers={[height(28)]}>
                <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[padding(10, 0, 10, 0)]}>
                  {leg.live ? <Icon source={Sensors} size={13} tint={pill.fg} /> : null}
                  <Text color={pill.fg} maxLines={1} softWrap={false} style={m3Text('labelMedium', 500)}>
                    {leg.freshness.label}
                  </Text>
                </Row>
              </Surface>
            ) : null}
          </FlowRow>
        </Row>

        {leg.stopCountShort ? (
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <Box modifiers={[width(TIME_COL)]}>{null}</Box>
            <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
              <Box modifiers={[size(4, 28), clip(Shapes.RoundedCorner(2)), background(accent.track)]}>{null}</Box>
            </Box>
            <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 6 }} modifiers={[weight(1)]}>
              {hasExpandableStops ? (
                <Surface
                  color={m.surfaceContainerHighest}
                  contentColor={m.onSurface}
                  shape={corners(12)}
                  onClick={onToggleStops}
                  modifiers={[height(28)]}
                >
                  <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[padding(10, 0, 8, 0)]}>
                    <Text color={m.onSurface} maxLines={1} softWrap={false} style={m3Text('labelMedium', 500)}>
                      {leg.stopCountShort}
                    </Text>
                    <Icon
                      source={stopsOpen ? KeyboardArrowUp : KeyboardArrowDown}
                      size={16}
                      tint={m.onSurfaceVariant}
                    />
                  </Row>
                </Surface>
              ) : (
                <Box contentAlignment="centerStart" modifiers={[height(28)]}>
                  <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>{leg.stopCountShort}</Text>
                </Box>
              )}
              <Surface color={pill.bg} contentColor={pill.fg} shape={corners(PILL_RADIUS)} modifiers={[height(28)]}>
                <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center" modifiers={[padding(10, 0, 10, 0)]}>
                  {leg.live ? <Icon source={Sensors} size={13} tint={pill.fg} /> : null}
                  <Text color={pill.fg} maxLines={1} softWrap={false} style={m3Text('labelMedium', 500)}>
                    {leg.freshness.label}
                  </Text>
                </Row>
              </Surface>
            </FlowRow>
          </Row>
        ) : null}

        {stopsOpen && leg.intermediateStopNames?.length ? (
          <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
            {leg.intermediateStopNames.map((stopName, idx) => (
              <Row key={`${leg.id}-stop-${idx}`} horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                <Box modifiers={[width(TIME_COL)]}>{null}</Box>
                <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
                  <Box contentAlignment="center" modifiers={[size(8, 8), clip(Shapes.Circle), background(accent.track)]}>
                    <Box modifiers={[size(4, 4), clip(Shapes.Circle), background(m.surfaceContainerHigh)]}>{null}</Box>
                  </Box>
                </Box>
                <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={m3Text('bodySmall')} modifiers={[weight(1)]}>
                  {stopName}
                </Text>
              </Row>
            ))}
          </Column>
        ) : null}

        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Box contentAlignment="centerStart" modifiers={[width(TIME_COL)]}>
            <Text color={m.onSurface} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)}>{leg.arriveTime}</Text>
          </Box>
          <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
            <Box contentAlignment="center" modifiers={[size(10, 10), clip(Shapes.Circle), background(accent.track)]}>
              <Box modifiers={[size(4, 4), clip(Shapes.Circle), background(m.surfaceContainerHigh)]}>{null}</Box>
            </Box>
          </Box>
          <Text color={m.onSurface} maxLines={2} overflow="ellipsis" style={m3Text('titleSmall', 500)} modifiers={[weight(1)]}>
            {leg.toName ?? 'Get off'}
          </Text>
        </Row>
      </Column>
    </Surface>
  );
}

export function RouteCard({ card, canSave, m, standalone = false, onSelect, onSave }: {
  card: ResultCard;
  canSave: boolean;
  m: MaterialColors;
  standalone?: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  const { text, saved } = card;
  const expanded = standalone || card.selected;
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
  const risk = toneColors(text.risk.tone, m);
  const pill = freshnessPillStyle(text.freshness, text.live, m);
  const toggleStops = (legId: string) => setExpandedStops((prev) => ({ ...prev, [legId]: !prev[legId] }));

  const hasTransit = text.details.some((leg) => leg.transit);
  const transferLabel = hasTransit
    ? (text.transfers === 0 ? 'Direct' : text.transfers === 1 ? '1 transfer' : `${text.transfers} transfers`)
    : text.details[0]?.distance;
  const originCutout = standalone ? m.surfaceContainerLow : m.surfaceContainer;

  const headerContent = (
    <Column
      verticalArrangement={{ spacedBy: 12 }}
      modifiers={
        standalone
          ? [fillMaxWidth(), padding(0, 4, 0, 14)]
          : [fillMaxWidth(), clickable(onSelect), padding(16, 16, 16, expanded ? 14 : 16)]
      }
    >
      <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
          <Text color={m.onSurface} style={m3Text(standalone ? 'titleLarge' : 'titleMedium', 700)}>{text.times}</Text>
          {card.wait ? (
            <Text color={card.wait.long ? m.tertiary : m.onSurfaceVariant} style={m3Text('labelMedium', 500)}>
              {card.wait.label}
            </Text>
          ) : transferLabel ? (
            <Text color={m.onSurfaceVariant} style={m3Text('bodySmall')}>
              {transferLabel}
            </Text>
          ) : null}
        </Column>
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
          <Text color={expanded ? m.primary : m.onSurface} style={m3Text(standalone ? 'headlineMedium' : 'headlineSmall', 700)}>
            {text.duration}
          </Text>
          {!standalone ? (
            <Box
              contentAlignment="center"
              modifiers={[
                size(28, 28),
                clip(Shapes.Circle),
                background(expanded ? m.primaryContainer : m.surfaceContainerHigh)
              ]}
            >
              <Icon
                source={expanded ? KeyboardArrowUp : KeyboardArrowDown}
                size={18}
                tint={expanded ? m.onPrimaryContainer : m.onSurfaceVariant}
                contentDescription={expanded ? 'Collapse route details' : 'Expand route details'}
              />
            </Box>
          ) : null}
        </Row>
      </Row>

      <LegChips chips={text.chips} m={m} wrap={expanded} />

      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[weight(1)]}>
          <Surface color={pill.bg} contentColor={pill.fg} shape={corners(PILL_RADIUS)}>
            <Row horizontalArrangement={{ spacedBy: 5 }} verticalAlignment="center" modifiers={[padding(9, 4, 11, 4)]}>
              <Icon source={pill.icon} size={14} tint={pill.fg} />
              <Text color={pill.fg} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)}>
                {text.freshness.label}
              </Text>
            </Row>
          </Surface>
          {text.detail ? (
            <Text color={m.onSurfaceVariant} maxLines={1} overflow="ellipsis" style={m3Text('bodySmall')} modifiers={[weight(1)]}>
              {text.detail}
            </Text>
          ) : null}
        </Row>
        <Text color={m.onSurface} style={m3Text('titleSmall', 700)}>{text.cost}</Text>
        <Surface color={risk.bg} contentColor={risk.fg} shape={corners(PILL_RADIUS)}>
          <Text color={risk.fg} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)} modifiers={[padding(10, 4, 10, 4)]}>
            {text.risk.label}
          </Text>
        </Surface>
      </Row>
    </Column>
  );

  const detailsContent = expanded ? (
    <Column
      verticalArrangement={{ spacedBy: 14 }}
      modifiers={standalone ? [fillMaxWidth(), padding(0, 0, 0, 8)] : [fillMaxWidth(), padding(16, 0, 16, 16)]}
    >
      <HorizontalDivider color={m.outlineVariant} />

      {text.riskReasons.length > 0 ? (
        <Surface color={risk.bg} contentColor={risk.fg} shape={corners(16)} modifiers={[fillMaxWidth()]}>
          <Row horizontalArrangement={{ spacedBy: 10 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(12, 10, 14, 10)]}>
            <Icon source={Warning} size={18} tint={risk.fg} />
            <Text color={risk.fg} style={m3Text('bodySmall', 500)} modifiers={[weight(1)]}>
              {text.riskReasons.join(' · ')}
            </Text>
          </Row>
        </Surface>
      ) : null}

      <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
          <Box contentAlignment="centerStart" modifiers={[width(OUTER_TIME_COL)]}>
            <Text color={m.onSurface} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)}>{text.departTime}</Text>
          </Box>
          <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
            <Box contentAlignment="center" modifiers={[size(12, 12), clip(Shapes.Circle), background(m.primary)]}>
              <Box modifiers={[size(6, 6), clip(Shapes.Circle), background(originCutout)]}>{null}</Box>
            </Box>
          </Box>
          <Text color={m.onSurface} maxLines={2} overflow="ellipsis" style={m3Text('titleSmall', 700)} modifiers={[weight(1)]}>
            {text.originName ?? 'Start'}
          </Text>
        </Row>

        {text.details.map((leg) => (
          <Column key={leg.id} verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth()]}>
            {leg.transferBufferMinutes ? <TransferRow minutes={leg.transferBufferMinutes} m={m} /> : null}
            {leg.transit ? (
              <TransitLegCard
                leg={leg}
                m={m}
                stopsOpen={Boolean(expandedStops[leg.id])}
                onToggleStops={() => toggleStops(leg.id)}
              />
            ) : (
              <ActiveLegRow leg={leg} m={m} />
            )}
          </Column>
        ))}

        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
          <Box contentAlignment="centerStart" modifiers={[width(OUTER_TIME_COL)]}>
            <Text color={m.onSurface} maxLines={1} softWrap={false} style={m3Text('labelMedium', 700)}>{text.arriveTime}</Text>
          </Box>
          <Box contentAlignment="center" modifiers={[width(RAIL_COL)]}>
            <Icon source={LocationOn} size={18} tint={m.error} />
          </Box>
          <Text color={m.onSurface} maxLines={2} overflow="ellipsis" style={m3Text('titleSmall', 700)} modifiers={[weight(1)]}>
            {text.destinationName ?? 'Destination'}
          </Text>
        </Row>
      </Column>

      <HorizontalDivider color={m.outlineVariant} />

      <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 1 }} modifiers={[weight(1)]}>
          <Text color={m.onSurface} style={m3Text('labelMedium', 700)}>
            {text.cost === 'Free' ? 'Free trip' : text.cost.startsWith('~') ? `Est. fare · ${text.cost}` : `Fare · ${text.cost}`}
          </Text>
          {text.costBreakdown ? (
            <Text color={m.onSurfaceVariant} maxLines={2} overflow="ellipsis" style={m3Text('bodySmall')}>
              {text.costBreakdown}
            </Text>
          ) : null}
        </Column>
        {saved ? (
          <Surface color={m.secondaryContainer} contentColor={m.onSecondaryContainer} shape={corners(PILL_RADIUS)}>
            <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center" modifiers={[padding(14, 10, 16, 10)]}>
              <Icon source={Check} size={18} tint={m.onSecondaryContainer} />
              <Text color={m.onSecondaryContainer} style={m3Text('labelLarge', 700)}>Saved</Text>
            </Row>
          </Surface>
        ) : (
          <Button enabled={canSave} onClick={onSave} shape={corners(PILL_RADIUS)}>
            <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
              <Icon source={BookmarkAdd} size={18} />
              <Text style={m3Text('labelLarge', 700)}>Save</Text>
            </Row>
          </Button>
        )}
      </Row>
    </Column>
  ) : null;

  if (standalone) {
    return (
      <Column modifiers={[fillMaxWidth(), animateContentSize()]}>
        {headerContent}
        {detailsContent}
      </Column>
    );
  }

  return (
    <Surface
      color={m.surfaceContainer}
      contentColor={m.onSurface}
      shadowElevation={expanded ? 2 : 0}
      shape={corners(CARD_RADIUS)}
      border={expanded ? undefined : { width: 1, color: m.outlineVariant }}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(CARD_RADIUS)), animateContentSize()]}
    >
      <Column modifiers={[fillMaxWidth()]}>
        {headerContent}
        {detailsContent}
      </Column>
    </Surface>
  );
}
