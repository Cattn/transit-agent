import { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useNetworkState } from 'expo-network';
import type { AppColors } from '../theme/colors';
import { MapLoadingContent } from './MapLoadingContent';

const FADE_MS = 250;
const LOAD_TIMEOUT_MS = 20_000;
const ERROR_RETRY_MS = 3_000;

export type MapLoadStatus = 'loading' | 'offline' | 'failed' | 'loaded';

export function useMapLoad() {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [wasOffline, setWasOffline] = useState(offline);
  const retry = useCallback(() => {
    setTimedOut(false);
    setErrored(false);
    setRound((n) => n + 1);
    setAttempt((n) => n + 1);
  }, []);
  if (offline !== wasOffline) {
    setWasOffline(offline);
    if (!offline && !loaded) retry();
  }

  useEffect(() => {
    if (loaded || offline || timedOut) return;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, offline, timedOut, round]);

  useEffect(() => {
    if (!errored || loaded || offline || timedOut) return;
    const timer = setTimeout(() => {
      setErrored(false);
      setAttempt((n) => n + 1);
    }, ERROR_RETRY_MS);
    return () => clearTimeout(timer);
  }, [errored, loaded, offline, timedOut]);

  const onLoad = useCallback(() => setLoaded(true), []);
  const onLoadError = useCallback(() => setErrored(true), []);
  const status: MapLoadStatus = loaded ? 'loaded' : offline ? 'offline' : timedOut ? 'failed' : 'loading';
  return { status, attempt, onLoad, onLoadError, retry };
}

export interface MapLoadingProps {
  status: MapLoadStatus;
  colors: AppColors;
  padding: { top: number; bottom: number };
  onRetry: () => void;
}

export function MapLoading({ status, colors, padding, onRetry }: MapLoadingProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [gone, setGone] = useState(false);
  const [shown, setShown] = useState<Exclude<MapLoadStatus, 'loaded'>>('loading');
  if (status !== 'loaded' && status !== shown) setShown(status);

  useEffect(() => {
    if (status !== 'loaded') return;
    const fade = Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true });
    fade.start(({ finished }) => {
      if (finished) setGone(true);
    });
    return () => fade.stop();
  }, [status, opacity]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={status === 'failed' ? 'box-none' : 'none'}
      style={[styles.cover, { backgroundColor: colors.map, opacity, paddingTop: padding.top, paddingBottom: padding.bottom }]}
    >
      <MapLoadingContent status={shown} colors={colors} onRetry={onRetry} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }
});
