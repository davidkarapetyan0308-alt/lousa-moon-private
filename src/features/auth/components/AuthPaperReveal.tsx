import { Asset } from 'expo-asset';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hideNativeSplashOnce, launchDevLog } from '../../../bootstrap/launchCoordinator';
import { markAuthIntroComplete, requireAuthIntroCompletion } from '../../../bootstrap/startupGate';
import { traceStartup } from '../../../bootstrap/startupTrace';
import {
  AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS,
  AUTH_PAPER_MOON_EMERGENCY_FINISH_MS,
  AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS,
  AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS,
  getAuthPaperCloudTravel,
  getStartupPaperMoonTimeline,
  getThreadHeightForMoonOffset,
} from './authPaperRevealTimeline';

const PAPER_MOON_THEATRE = require('../../../../assets/images/auth/paper-intro/theatre/paper-moon-theatre.png');
const CLOUD_BACK_LEFT = require('../../../../assets/images/auth/paper-intro/theatre/cloud-thin.png');
const CLOUD_BACK_RIGHT = require('../../../../assets/images/auth/paper-intro/theatre/cloud-top-right.png');
const CLOUD_CENTRE = require('../../../../assets/images/auth/paper-intro/theatre/cloud-large-left.png');
const CLOUD_FRONT_LEFT = require('../../../../assets/images/auth/paper-intro/theatre/cloud-bottom-left.png');
const CLOUD_FRONT_RIGHT = require('../../../../assets/images/auth/paper-intro/theatre/cloud-bottom-right.png');

const AUTH_INTRO_ASSETS = [
  PAPER_MOON_THEATRE,
  CLOUD_BACK_LEFT,
  CLOUD_BACK_RIGHT,
  CLOUD_CENTRE,
  CLOUD_FRONT_LEFT,
  CLOUD_FRONT_RIGHT,
];
const EXPECTED_DECODED_ASSETS = 6;
const REDUCE_MOTION_QUERY_TIMEOUT_MS = 350;
const PAPER_ASSET_KEYS: AssetKey[] = [
  'moon',
  'cloud-back-left',
  'cloud-back-right',
  'cloud-centre',
  'cloud-front-left',
  'cloud-front-right',
];

const MOTION_EASING = Easing.bezier(0.42, 0, 0.25, 1);
const REVEAL_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);

type AuthPaperRevealGateProps = {
  active: boolean;
  /** The persistent root Stack has rendered at least one native frame. */
  startWhenReady?: boolean;
  children: ReactNode;
};

type AssetKey =
  | 'moon'
  | 'cloud-back-left'
  | 'cloud-back-right'
  | 'cloud-centre'
  | 'cloud-front-left'
  | 'cloud-front-right';

/**
 * The actual login screen stays mounted below this scene from the first frame.
 * Native splash is released only when every bundled paper layer has loaded and
 * the scene has completed layout, preventing a blank or late-cloud handoff.
 */
export function AuthPaperRevealGate({ active, startWhenReady = true, children }: AuthPaperRevealGateProps) {
  const { width, height } = useWindowDimensions();
  const activeAtMountRef = useRef(active);
  const shouldAnimate = activeAtMountRef.current;

  const scene = useMemo(() => {
    const sceneWidth = Math.min(Math.max(width, 320), 620);
    const compact = height < 720;
    // The moon starts low on its rope, then clears the centre for the logo and
    // account panel as the paper-cloud curtain opens.
    const moonWidth = Math.min(sceneWidth * (compact ? 0.29 : 0.31), 154);
    const moonHeight = moonWidth * (1536 / 1024);
    const moonStartTop = compact ? height * 0.33 : height * 0.37;
    const moonEndTop = -moonHeight * 0.86;
    const knotOffset = moonHeight * 0.035;
    const threadTop = -8;
    return {
      sceneWidth,
      compact,
      moonWidth,
      moonHeight,
      moonStartTop,
      moonEndTop,
      moonTravel: moonEndTop - moonStartTop,
      threadTop,
      threadStartHeight: moonStartTop + knotOffset - threadTop + 3,
      cloudBackTop: compact ? height * 0.22 : height * 0.24,
      cloudCentreTop: compact ? height * 0.35 : height * 0.38,
      cloudFrontTop: compact ? height * 0.53 : height * 0.57,
      brandTop: compact ? height * 0.43 : height * 0.46,
    };
  }, [height, width]);

  const [assetFilesReady, setAssetFilesReady] = useState(!shouldAnimate);
  const [decodedAssetCount, setDecodedAssetCount] = useState(shouldAnimate ? 0 : EXPECTED_DECODED_ASSETS);
  const [layoutReady, setLayoutReady] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(shouldAnimate);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [failedAssets, setFailedAssets] = useState<ReadonlySet<AssetKey>>(() => new Set());
  const [assetRetryEpoch, setAssetRetryEpoch] = useState<Record<AssetKey, number>>({
    moon: 0,
    'cloud-back-left': 0,
    'cloud-back-right': 0,
    'cloud-centre': 0,
    'cloud-front-left': 0,
    'cloud-front-right': 0,
  });

  const decodedAssetsRef = useRef(new Set<AssetKey>());
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const completedRef = useRef(!shouldAnimate);
  const timelineFinishedRef = useRef(false);
  const timelineFinishReasonRef = useRef<'animation' | 'fallback'>('animation');
  const destinationReadyRef = useRef(startWhenReady);
  const emergencyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decodeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutReadyRef = useRef(false);
  const assetRetryCountRef = useRef<Record<AssetKey, number>>({
    moon: 0,
    'cloud-back-left': 0,
    'cloud-back-right': 0,
    'cloud-centre': 0,
    'cloud-front-left': 0,
    'cloud-front-right': 0,
  });

  const contentOpacity = useSharedValue(shouldAnimate ? 0 : 1);
  const contentTranslateY = useSharedValue(shouldAnimate ? 46 : 0);
  const contentScale = useSharedValue(shouldAnimate ? 0.985 : 1);
  const overlayOpacity = useSharedValue(shouldAnimate ? 1 : 0);
  const veilOpacity = useSharedValue(shouldAnimate ? 1 : 0);

  const moonTranslateY = useSharedValue(0);
  const moonRotate = useSharedValue(-0.8);
  const moonScale = useSharedValue(1);
  const threadOpacity = useSharedValue(1);
  const brandOpacity = useSharedValue(shouldAnimate ? 0 : 1);
  const brandTranslateY = useSharedValue(shouldAnimate ? 22 : 0);
  const centreCloudY = useSharedValue(0);
  const centreCloudOpacity = useSharedValue(1);
  const leftBackX = useSharedValue(0);
  const leftBackY = useSharedValue(0);
  const leftBackRotate = useSharedValue(0);
  const rightBackX = useSharedValue(0);
  const rightBackY = useSharedValue(0);
  const rightBackRotate = useSharedValue(0);
  const leftFrontX = useSharedValue(0);
  const leftFrontY = useSharedValue(0);
  const leftFrontRotate = useSharedValue(0);
  const rightFrontX = useSharedValue(0);
  const rightFrontY = useSharedValue(0);
  const rightFrontRotate = useSharedValue(0);

  const finishOnce = useCallback((reason: 'animation' | 'fallback') => {
    if (!mountedRef.current || completedRef.current) return;
    completedRef.current = true;
    if (emergencyTimerRef.current) {
      clearTimeout(emergencyTimerRef.current);
      emergencyTimerRef.current = null;
    }
    contentOpacity.value = 1;
    contentTranslateY.value = 0;
    contentScale.value = 1;
    overlayOpacity.value = 0;
    veilOpacity.value = 0;
    centreCloudOpacity.value = 0;
    threadOpacity.value = 0;
    brandOpacity.value = 0;
    setOverlayVisible(false);
    markAuthIntroComplete();
    traceStartup('STARTUP_ANIMATION_COMPLETED', `reason=${reason}`);
    traceStartup('INTRO_COMPLETED', `reason=${reason}`);
    launchDevLog('intro_complete', `reason=${reason}`);
  }, [brandOpacity, centreCloudOpacity, contentOpacity, contentScale, contentTranslateY, overlayOpacity, threadOpacity, veilOpacity]);

  const finishAfterTimeline = useCallback((reason: 'animation' | 'fallback') => {
    timelineFinishedRef.current = true;
    timelineFinishReasonRef.current = reason;
    if (destinationReadyRef.current) {
      finishOnce(reason);
      return;
    }
    traceStartup('STARTUP_FALLBACK', 'timeline_finished_waiting_for_root_frame');
  }, [finishOnce]);

  useEffect(() => {
    destinationReadyRef.current = startWhenReady;
    if (startWhenReady && timelineFinishedRef.current && !completedRef.current) {
      finishOnce(timelineFinishReasonRef.current);
    }
  }, [finishOnce, startWhenReady]);

  const markAssetLoaded = useCallback((key: AssetKey) => {
    if (decodedAssetsRef.current.has(key)) return;
    decodedAssetsRef.current.add(key);
    const count = decodedAssetsRef.current.size;
    setDecodedAssetCount(count);
    if (count === EXPECTED_DECODED_ASSETS) { launchDevLog('paper_images_decoded'); traceStartup('INTRO_IMAGES_DECODED'); }
  }, []);

  const activateFallback = useCallback((keys: AssetKey[], reason: string) => {
    if (completedRef.current) return;
    setFallbackMode(true);
    setFailedAssets((current) => {
      const next = new Set(current);
      keys.forEach((key) => next.add(key));
      return next;
    });
    keys.forEach(markAssetLoaded);
    setAssetFilesReady(true);
    launchDevLog('paper_asset_fallback', `reason=${reason}`);
    traceStartup('STARTUP_ASSET_FALLBACK', `reason=${reason}`);
  }, [markAssetLoaded]);

  const handleAssetFailure = useCallback((key: AssetKey | 'bundle', error?: unknown) => {
    if (completedRef.current) return;
    const details = error instanceof Error ? error.message : String(error ?? 'unknown');
    launchDevLog('paper_asset_failed', `key=${key} error=${details}`);
    if (key === 'bundle') {
      activateFallback(PAPER_ASSET_KEYS, `bundle:${details}`);
      return;
    }

    const retryCount = assetRetryCountRef.current[key];
    if (retryCount < 1) {
      assetRetryCountRef.current[key] = retryCount + 1;
      launchDevLog('paper_asset_retry', `key=${key}`);
      traceStartup('STARTUP_ASSET_RETRY', `key=${key}`);
      setTimeout(() => {
        if (!mountedRef.current || completedRef.current) return;
        setAssetRetryEpoch((current) => ({ ...current, [key]: current[key] + 1 }));
      }, 180);
      return;
    }

    activateFallback([key], `asset:${key}:${details}`);
  }, [activateFallback]);

  const emergencyFinish = useCallback(() => {
    if (completedRef.current) return;
    activateFallback(PAPER_ASSET_KEYS, 'watchdog');
  }, [activateFallback]);

  useEffect(() => {
    mountedRef.current = true;
    traceStartup('STARTUP_EXPERIENCE_MOUNTED');
    traceStartup('INTRO_COMPONENT_MOUNTED');
    if (shouldAnimate) requireAuthIntroCompletion();
    if (!shouldAnimate) {
      void hideNativeSplashOnce('auth_intro_inactive');
      return () => {
        mountedRef.current = false;
      };
    }

    launchDevLog('paper_assets_load_started');
    traceStartup('STARTUP_ASSET_PRELOAD_STARTED');
    traceStartup('INTRO_ASSETS_PRELOAD_STARTED');
    emergencyTimerRef.current = setTimeout(emergencyFinish, AUTH_PAPER_MOON_EMERGENCY_FINISH_MS);
    decodeFallbackTimerRef.current = setTimeout(() => {
      if (completedRef.current || decodedAssetsRef.current.size === EXPECTED_DECODED_ASSETS) return;
      const missing = PAPER_ASSET_KEYS.filter((key) => !decodedAssetsRef.current.has(key));
      activateFallback(missing, 'decode_timeout');
    }, AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS);
    layoutFallbackTimerRef.current = setTimeout(() => {
      if (layoutReadyRef.current || completedRef.current) return;
      layoutReadyRef.current = true;
      setLayoutReady(true);
      launchDevLog('paper_layout_fallback');
      traceStartup('STARTUP_FALLBACK', 'layout_timeout');
    }, AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS);
    let cancelled = false;
    void Asset.loadAsync(AUTH_INTRO_ASSETS)
      .then(() => {
        if (cancelled || !mountedRef.current) return;
        setAssetFilesReady(true);
        launchDevLog('paper_asset_files_ready');
        traceStartup('STARTUP_ASSET_READY');
        traceStartup('INTRO_ASSETS_PRELOAD_FINISHED');
      })
      .catch((error: unknown) => {
        if (cancelled || !mountedRef.current) return;
        handleAssetFailure('bundle', error);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
      if (decodeFallbackTimerRef.current) clearTimeout(decodeFallbackTimerRef.current);
      if (layoutFallbackTimerRef.current) clearTimeout(layoutFallbackTimerRef.current);
    };
  }, [activateFallback, emergencyFinish, handleAssetFailure, shouldAnimate]);

  useEffect(() => {
    if (decodedAssetCount < EXPECTED_DECODED_ASSETS || !decodeFallbackTimerRef.current) return;
    clearTimeout(decodeFallbackTimerRef.current);
    decodeFallbackTimerRef.current = null;
  }, [decodedAssetCount]);

  const startAnimation = useCallback((reduceMotion: boolean) => {
    if (startedRef.current || completedRef.current) return;
    startedRef.current = true;
    const calmScene = reduceMotion || fallbackMode;
    const timeline = getStartupPaperMoonTimeline(reduceMotion, fallbackMode);
    const travel = getAuthPaperCloudTravel(scene.sceneWidth, calmScene);
    launchDevLog('intro_started', `reduceMotion=${String(reduceMotion)} fallback=${String(fallbackMode)}`);
    traceStartup('STARTUP_ANIMATION_STARTED', `fallback=${String(fallbackMode)}`);
    if (reduceMotion) traceStartup('STARTUP_REDUCED_MOTION');
    traceStartup('INTRO_TIMELINE_STARTED', `reduceMotion=${String(reduceMotion)}`);
    traceStartup('MOON_STARTED');
    traceStartup('CLOUDS_STARTED');

    traceStartup('FORM_REVEAL_STARTED', `delay=${timeline.formDelay}`);
    contentOpacity.value = withDelay(timeline.formDelay, withTiming(1, { duration: timeline.formDuration, easing: REVEAL_EASING }));
    contentTranslateY.value = withDelay(timeline.formDelay, withTiming(0, { duration: timeline.formDuration, easing: REVEAL_EASING }));
    contentScale.value = withDelay(timeline.formDelay, withTiming(1, { duration: timeline.formDuration, easing: REVEAL_EASING }));
    veilOpacity.value = withDelay(timeline.veilDelay, withTiming(0, { duration: timeline.veilDuration, easing: Easing.inOut(Easing.cubic) }));

    moonTranslateY.value = withDelay(
      timeline.moonDelay,
      withTiming(calmScene ? -14 : scene.moonTravel, { duration: timeline.moonDuration, easing: MOTION_EASING }),
    );
    threadOpacity.value = withDelay(
      timeline.moonDelay + Math.max(timeline.moonDuration - 320, 0),
      withTiming(calmScene ? 0.8 : 0, { duration: calmScene ? 240 : 300, easing: Easing.out(Easing.cubic) }),
    );
    moonScale.value = withDelay(timeline.moonDelay, withTiming(calmScene ? 0.995 : 0.94, { duration: timeline.moonDuration, easing: MOTION_EASING }));
    moonRotate.value = calmScene
      ? withDelay(timeline.moonDelay, withTiming(0, { duration: timeline.moonDuration }))
      : withDelay(
          timeline.moonDelay,
          withSequence(
            withTiming(0.42, { duration: 520, easing: Easing.inOut(Easing.sin) }),
            withTiming(-0.26, { duration: 620, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 600, easing: Easing.out(Easing.sin) }),
          ),
        );

    // The centre cloud is the curtain. It clears before the account form is
    // visible, while the outer layers slide aside at different depths.
    centreCloudY.value = withDelay(
      timeline.cloudsBackDelay,
      withTiming(calmScene ? -3 : -Math.min(scene.sceneWidth * 0.24, 94), {
        duration: timeline.cloudsBackDuration,
        easing: MOTION_EASING,
      }),
    );
    centreCloudOpacity.value = withDelay(
      calmScene ? timeline.overlayDelay - 340 : 720,
      withTiming(calmScene ? 0.78 : 0, {
        duration: calmScene ? 400 : 720,
        easing: Easing.out(Easing.cubic),
      }),
    );

    leftBackX.value = withDelay(timeline.cloudsBackDelay, withTiming(travel.leftBack, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));
    leftBackY.value = withDelay(timeline.cloudsBackDelay, withTiming(calmScene ? -2 : -12, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));
    leftBackRotate.value = withDelay(timeline.cloudsBackDelay, withTiming(calmScene ? -0.2 : -2.4, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));
    rightBackX.value = withDelay(timeline.cloudsBackDelay, withTiming(travel.rightBack, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));
    rightBackY.value = withDelay(timeline.cloudsBackDelay, withTiming(calmScene ? -2 : -8, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));
    rightBackRotate.value = withDelay(timeline.cloudsBackDelay, withTiming(calmScene ? 0.2 : 2.4, { duration: timeline.cloudsBackDuration, easing: MOTION_EASING }));

    leftFrontX.value = withDelay(timeline.cloudsFrontDelay, withTiming(travel.leftFront, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));
    leftFrontY.value = withDelay(timeline.cloudsFrontDelay, withTiming(calmScene ? 2 : 14, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));
    leftFrontRotate.value = withDelay(timeline.cloudsFrontDelay, withTiming(calmScene ? -0.3 : -3.2, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));
    rightFrontX.value = withDelay(timeline.cloudsFrontDelay, withTiming(travel.rightFront, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));
    rightFrontY.value = withDelay(timeline.cloudsFrontDelay, withTiming(calmScene ? 2 : 16, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));
    rightFrontRotate.value = withDelay(timeline.cloudsFrontDelay, withTiming(calmScene ? 0.3 : 3.2, { duration: timeline.cloudsFrontDuration, easing: MOTION_EASING }));

    // The brand gets a brief, quiet moment in the centre while the clouds open.
    // It leaves before the real account screen reaches the same visual area.
    brandOpacity.value = withDelay(
      1_050,
      withSequence(
        withTiming(1, { duration: 520, easing: REVEAL_EASING }),
        withDelay(180, withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) })),
      ),
    );
    brandTranslateY.value = withDelay(
      1_050,
      withSequence(
        withTiming(0, { duration: 520, easing: REVEAL_EASING }),
        withDelay(180, withTiming(-14, { duration: 360, easing: Easing.out(Easing.cubic) })),
      ),
    );

    overlayOpacity.value = withDelay(
      timeline.overlayDelay,
      withTiming(0, { duration: timeline.overlayDuration, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finishAfterTimeline)(fallbackMode ? 'fallback' : 'animation');
      }),
    );
  }, [
    contentOpacity, contentScale, contentTranslateY, finishAfterTimeline, leftBackRotate, leftBackX, leftBackY,
    leftFrontRotate, leftFrontX, leftFrontY, moonRotate, moonScale, moonTranslateY, overlayOpacity,
    rightBackRotate, rightBackX, rightBackY, rightFrontRotate, rightFrontX, rightFrontY, scene,
    veilOpacity, fallbackMode, threadOpacity, brandOpacity, brandTranslateY, centreCloudOpacity, centreCloudY,
  ]);

  // The Paper Moon is the first visible React frame. It must begin as soon as its
  // own scene is ready, never wait for a session redirect that can be delayed by
  // Expo Router or secure-storage restoration. The route gate only guards the
  // final handoff to content after the animation has already played.
  const launchReady = shouldAnimate && assetFilesReady && decodedAssetCount >= EXPECTED_DECODED_ASSETS && layoutReady;

  useEffect(() => {
    if (!launchReady || startedRef.current || completedRef.current) return;
    launchDevLog('paper_first_frame_ready');
    traceStartup('STARTUP_FIRST_FRAME_READY');
    traceStartup('FIRST_PAPER_FRAME_READY');

    let secondFrame = 0;
    let startFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const reduceMotionQuery = AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
        const reduceMotionFallback = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), REDUCE_MOTION_QUERY_TIMEOUT_MS));
        void Promise.race([reduceMotionQuery, reduceMotionFallback]).then(async (reduceMotion) => {
          if (!mountedRef.current || completedRef.current) return;
          try {
            let handoffTimer: ReturnType<typeof setTimeout> | null = null;
            const handoffResult = await Promise.race([
              hideNativeSplashOnce('paper_moon_first_frame_ready').then(() => 'hidden' as const),
              new Promise<'timed_out'>((resolve) => {
                handoffTimer = setTimeout(() => resolve('timed_out'), AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS);
              }),
            ]);
            if (handoffTimer) clearTimeout(handoffTimer);
            if (handoffResult === 'timed_out') {
              traceStartup('STARTUP_FALLBACK', 'native_splash_handoff_timeout');
            } else {
              traceStartup('STARTUP_NATIVE_SPLASH_HIDDEN');
            }
          } catch (error: unknown) {
            launchDevLog('paper_moon_handoff_failed', error instanceof Error ? error.message : String(error));
            // The native splash may already be gone after an Android process
            // restore. The React overlay is fully rendered, so this is never a
            // reason to skip the visible Paper Moon timeline.
            traceStartup('STARTUP_FALLBACK', 'native_splash_handoff_failed_continue_intro');
          }
          if (!mountedRef.current || completedRef.current) return;
          startFrame = requestAnimationFrame(() => startAnimation(reduceMotion));
        });
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (startFrame) cancelAnimationFrame(startFrame);
    };
  }, [launchReady, startAnimation]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
    if (decodeFallbackTimerRef.current) clearTimeout(decodeFallbackTimerRef.current);
    if (layoutFallbackTimerRef.current) clearTimeout(layoutFallbackTimerRef.current);
    [
      contentOpacity, contentTranslateY, contentScale, overlayOpacity, veilOpacity, moonTranslateY,
      moonRotate, moonScale, threadOpacity, brandOpacity, brandTranslateY, leftBackX, leftBackY, leftBackRotate,
      rightBackX, rightBackY, rightBackRotate, leftFrontX, leftFrontY, leftFrontRotate,
      rightFrontX, rightFrontY, rightFrontRotate, centreCloudY, centreCloudOpacity,
    ].forEach(cancelAnimation);
  }, [
    contentOpacity, contentScale, contentTranslateY, leftBackRotate, leftBackX, leftBackY,
    leftFrontRotate, leftFrontX, leftFrontY, moonRotate, moonScale, moonTranslateY, overlayOpacity,
    rightBackRotate, rightBackX, rightBackY, rightFrontRotate, rightFrontX, rightFrontY,
    veilOpacity, threadOpacity, brandOpacity, brandTranslateY, centreCloudOpacity, centreCloudY,
  ]);

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    if (layoutReady) return;
    layoutReadyRef.current = true;
    if (layoutFallbackTimerRef.current) {
      clearTimeout(layoutFallbackTimerRef.current);
      layoutFallbackTimerRef.current = null;
    }
    setLayoutReady(true);
    launchDevLog('paper_layout_ready');
    traceStartup('INTRO_LAYOUT_READY');
  }, [layoutReady]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }, { scale: contentScale.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veilOpacity.value }));
  const moonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: moonTranslateY.value },
      { rotate: `${moonRotate.value}deg` },
      { scale: moonScale.value },
    ],
  }));
  const threadStyle = useAnimatedStyle(() => ({
    height: getThreadHeightForMoonOffset(scene.threadStartHeight, moonTranslateY.value),
    opacity: threadOpacity.value,
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));
  const centreCloudStyle = useAnimatedStyle(() => ({
    opacity: centreCloudOpacity.value,
    transform: [{ translateY: centreCloudY.value }],
  }));
  const leftBackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftBackX.value }, { translateY: leftBackY.value }, { rotate: `${leftBackRotate.value}deg` }] }));
  const rightBackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightBackX.value }, { translateY: rightBackY.value }, { rotate: `${rightBackRotate.value}deg` }] }));
  const leftFrontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftFrontX.value }, { translateY: leftFrontY.value }, { rotate: `${leftFrontRotate.value}deg` }] }));
  const rightFrontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightFrontX.value }, { translateY: rightFrontY.value }, { rotate: `${rightFrontRotate.value}deg` }] }));

  return (
    <View style={styles.host} onLayout={handleLayout}>
      <Animated.View pointerEvents={overlayVisible ? 'none' : 'auto'} style={[styles.content, contentStyle]}>
        {children}
      </Animated.View>

      {overlayVisible ? (
        <Animated.View
          testID="auth-paper-intro"
          pointerEvents="auto"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.overlay, overlayStyle]}
        >
          <Animated.View style={[styles.veil, veilStyle]} />
          <View style={[styles.scene, { width: scene.sceneWidth }]}> 
            <Animated.View
              testID="auth-paper-thread"
              style={[
                styles.thread,
                { top: scene.threadTop, left: scene.sceneWidth / 2 - 1 },
                threadStyle,
              ]}
            >
              <View style={styles.threadHighlight} />
            </Animated.View>
            {failedAssets.has('moon') ? (
              <Animated.View
                testID="auth-paper-moon-fallback"
                style={[
                  styles.moon,
                  styles.moonFallback,
                  {
                    width: scene.moonWidth,
                    height: scene.moonHeight,
                    top: scene.moonStartTop,
                    left: scene.sceneWidth / 2 - scene.moonWidth / 2,
                  },
                  moonStyle,
                ]}
              >
                <View style={styles.moonFallbackInset} />
              </Animated.View>
            ) : (
              <Animated.Image
                key={`moon-${assetRetryEpoch.moon}`}
                testID="auth-paper-moon"
                source={PAPER_MOON_THEATRE}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('moon')}
                onError={(event) => handleAssetFailure('moon', event.nativeEvent.error)}
                style={[
                  styles.moon,
                  {
                    width: scene.moonWidth,
                    height: scene.moonHeight,
                    top: scene.moonStartTop,
                    left: scene.sceneWidth / 2 - scene.moonWidth / 2,
                  },
                  moonStyle,
                ]}
              />
            )}

            {!failedAssets.has('cloud-back-left') ? (
              <Animated.Image
                key={`cloud-back-left-${assetRetryEpoch['cloud-back-left']}`}
                source={CLOUD_BACK_LEFT}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('cloud-back-left')}
                onError={(event) => handleAssetFailure('cloud-back-left', event.nativeEvent.error)}
                style={[
                  styles.cloud,
                  styles.cloudBack,
                  { width: scene.sceneWidth * 0.54, height: scene.sceneWidth * 0.16, left: -scene.sceneWidth * 0.18, top: scene.cloudBackTop + 8 },
                  leftBackStyle,
                ]}
              />
            ) : null}
            {!failedAssets.has('cloud-back-right') ? (
              <Animated.Image
                key={`cloud-back-right-${assetRetryEpoch['cloud-back-right']}`}
                source={CLOUD_BACK_RIGHT}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('cloud-back-right')}
                onError={(event) => handleAssetFailure('cloud-back-right', event.nativeEvent.error)}
                style={[
                  styles.cloud,
                  styles.cloudBack,
                  { width: scene.sceneWidth * 0.61, height: scene.sceneWidth * 0.28, right: -scene.sceneWidth * 0.19, top: scene.cloudBackTop },
                  rightBackStyle,
                ]}
              />
            ) : null}
            {!failedAssets.has('cloud-centre') ? (
              <Animated.Image
                key={`cloud-centre-${assetRetryEpoch['cloud-centre']}`}
                source={CLOUD_CENTRE}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('cloud-centre')}
                onError={(event) => handleAssetFailure('cloud-centre', event.nativeEvent.error)}
                style={[
                  styles.cloud,
                  styles.cloudCentre,
                  { width: scene.sceneWidth * 0.76, height: scene.sceneWidth * 0.32, left: scene.sceneWidth * 0.12, top: scene.cloudCentreTop },
                  centreCloudStyle,
                ]}
              />
            ) : null}
            {!failedAssets.has('cloud-front-left') ? (
              <Animated.Image
                key={`cloud-front-left-${assetRetryEpoch['cloud-front-left']}`}
                source={CLOUD_FRONT_LEFT}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('cloud-front-left')}
                onError={(event) => handleAssetFailure('cloud-front-left', event.nativeEvent.error)}
                style={[
                  styles.cloud,
                  styles.cloudFront,
                  { width: scene.sceneWidth * 0.7, height: scene.sceneWidth * 0.3, left: -scene.sceneWidth * 0.16, top: scene.cloudFrontTop },
                  leftFrontStyle,
                ]}
              />
            ) : null}
            {!failedAssets.has('cloud-front-right') ? (
              <Animated.Image
                key={`cloud-front-right-${assetRetryEpoch['cloud-front-right']}`}
                source={CLOUD_FRONT_RIGHT}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => markAssetLoaded('cloud-front-right')}
                onError={(event) => handleAssetFailure('cloud-front-right', event.nativeEvent.error)}
                style={[
                  styles.cloud,
                  styles.cloudFront,
                  { width: scene.sceneWidth * 0.8, height: scene.sceneWidth * 0.37, right: -scene.sceneWidth * 0.18, top: scene.cloudFrontTop + 30 },
                  rightFrontStyle,
                ]}
              />
            ) : null}
            <Animated.View
              pointerEvents="none"
              style={[styles.brand, { top: scene.brandTop, width: scene.sceneWidth }, brandStyle]}
            >
              <Text style={styles.brandName}>LOUSA</Text>
              <Text style={styles.brandMoon}>MOON</Text>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: '#FFF8F5' },
  content: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFF8F5' },
  scene: { flex: 1, position: 'relative', alignSelf: 'center' },
  thread: {
    position: 'absolute',
    width: 2,
    zIndex: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(133, 91, 99, 0.68)',
  },
  threadHighlight: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 250, 243, 0.78)',
  },
  moon: { position: 'absolute', zIndex: 5 },
  moonFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#FFF4E7',
    borderWidth: 1,
    borderColor: 'rgba(139, 103, 119, 0.28)',
    shadowColor: '#5B365F',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  moonFallbackInset: {
    width: '77%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#FFFDF6',
    borderWidth: 1,
    borderColor: 'rgba(185, 120, 114, 0.16)',
  },
  cloud: { position: 'absolute' },
  cloudBack: { zIndex: 4, opacity: 0.58 },
  cloudCentre: { zIndex: 7, opacity: 0.88 },
  cloudFront: { zIndex: 9 },
  brand: {
    position: 'absolute',
    zIndex: 12,
    alignItems: 'center',
  },
  brandName: {
    color: '#3E2A3E',
    fontFamily: 'serif',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 5.6,
    lineHeight: 38,
    textAlign: 'center',
  },
  brandMoon: {
    marginLeft: 7,
    color: '#896D7B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 7.2,
    lineHeight: 18,
    textAlign: 'center',
  },
  brandRule: {
    width: 42,
    height: 1,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(115, 73, 95, 0.38)',
  },
  brandCaption: {
    color: '#806675',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 17,
  },
});
