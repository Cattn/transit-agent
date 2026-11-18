import { useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

/** Width of the drag handle at the trailing edge of each row (the Compose icon sits under it). */
export const HANDLE_WIDTH = 56;

interface Props {
  /** One unique key per row, in order. A change of keys means the rows were reordered. */
  keys: readonly string[];
  draggable: boolean;
  renderRow: (index: number) => ReactNode;
  /** Shown under a row (the place search), never while dragging. */
  renderBelow: (index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
}

function hoverIndex(from: number, translation: number, pitch: number, count: number) {
  'worklet';
  if (pitch <= 0) return from;
  return Math.max(0, Math.min(count - 1, from + Math.round(translation / pitch)));
}

function Row({ index, count, pitch, active, translation, draggable, onDrop, onMeasure, children, below }: {
  index: number;
  count: number;
  pitch: SharedValue<number>;
  active: SharedValue<number>;
  translation: SharedValue<number>;
  draggable: boolean;
  onDrop: (from: number, to: number) => void;
  onMeasure: (height: number) => void;
  children: ReactNode;
  below: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const from = active.get();
    if (from < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from === index) return { transform: [{ translateY: translation.get() }], zIndex: 2, elevation: 6 };
    const to = hoverIndex(from, translation.get(), pitch.get(), count);
    const shift = from < index && to >= index ? -pitch.get() : from > index && to <= index ? pitch.get() : 0;
    return { transform: [{ translateY: withTiming(shift, { duration: 150 }) }], zIndex: 0 };
  });
  const pan = Gesture.Pan()
    .enabled(draggable)
    .minDistance(0)
    .onStart(() => {
      active.set(index);
      translation.set(0);
    })
    .onUpdate((event) => {
      translation.set(event.translationY);
    })
    .onEnd(() => {
      runOnJS(onDrop)(index, hoverIndex(index, translation.get(), pitch.get(), count));
    })
    .onFinalize((_, success) => {
      if (!success) active.set(-1);
    });
  return (
    <Animated.View style={style}>
      <View onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}>
        {children}
        {draggable ? (
          <GestureDetector gesture={pan}>
            <View accessibilityLabel="Drag to reorder" style={styles.handle} />
          </GestureDetector>
        ) : null}
      </View>
      {below}
    </Animated.View>
  );
}

/**
 * The From / stops / To rows of Trip filters. Drag a row by its handle to reorder, like Google
 * Maps: the other rows slide out of the way and the order is committed on release.
 */
export function PlaceList({ keys, draggable, renderRow, renderBelow, onMove }: Props) {
  const pitch = useSharedValue(0);
  const active = useSharedValue(-1);
  const translation = useSharedValue(0);
  const order = keys.join('|');

  useLayoutEffect(() => {
    active.set(-1);
    translation.set(0);
  }, [order, active, translation]);

  const onDrop = (from: number, to: number) => {
    if (from !== to) {
      onMove(from, to);
      return;
    }
    active.set(-1);
    translation.set(0);
  };

  return (
    <View>
      {keys.map((key, index) => (
        <Row
          key={key}
          index={index}
          count={keys.length}
          pitch={pitch}
          active={active}
          translation={translation}
          draggable={draggable}
          onDrop={onDrop}
          onMeasure={(height) => { if (index === 0) pitch.set(height); }}
          below={renderBelow(index)}
        >
          {renderRow(index)}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { position: 'absolute', top: 0, right: 0, bottom: 0, width: HANDLE_WIDTH }
});
