import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text } from 'react-native';
import type { Itinerary } from '@transit/shared';

const BUTTON_SIZE = 44;
const CLOSE_SIZE = 28;
const RING_GAP = 8;
const DISC_MARGIN = 12;

export interface RoutePickerProps {
  candidates: Itinerary[];
  colors: ReadonlyMap<string, string>;
  center: [number, number];
  area: { width: number; height: number };
  onPick: (itineraryId: string) => void;
  onClose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? (min + max) / 2 : Math.min(Math.max(value, min), max);
}

export function RoutePicker({ candidates, colors, center, area, onPick, onClose }: RoutePickerProps) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const radius = Math.max(48, (candidates.length * (BUTTON_SIZE + RING_GAP)) / (2 * Math.PI));
  const diameter = radius * 2 + BUTTON_SIZE + DISC_MARGIN;
  const x = clamp(center[0], diameter / 2, area.width - diameter / 2);
  const y = clamp(center[1], diameter / 2, area.height - diameter / 2);

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <Pressable
        accessible={false}
        style={[
          styles.disc,
          { left: x - diameter / 2, top: y - diameter / 2, width: diameter, height: diameter, borderRadius: diameter / 2 }
        ]}
      />
      {candidates.map((itinerary, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / candidates.length;
        return (
          <Pressable
            key={itinerary.id}
            accessibilityRole="button"
            accessibilityLabel={`${itinerary.durationMinutes} minutes: ${itinerary.summary}`}
            onPress={() => onPick(itinerary.id)}
            style={[
              styles.choice,
              {
                left: x + Math.cos(angle) * radius - BUTTON_SIZE / 2,
                top: y + Math.sin(angle) * radius - BUTTON_SIZE / 2,
                backgroundColor: colors.get(itinerary.id)
              }
            ]}
          >
            <Text style={styles.choiceText}>{itinerary.durationMinutes}m</Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close route picker"
        onPress={onClose}
        style={[styles.close, { left: x - CLOSE_SIZE / 2, top: y - CLOSE_SIZE / 2 }]}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  choice: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 8
  },
  choiceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowRadius: 2
  },
  close: {
    position: 'absolute',
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8
  },
  closeText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18
  }
});
