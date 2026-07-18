import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { type MoonPhaseName } from '../utils/moonPhase';
import { getMoonShadowPath } from '../utils/moonRendering';

interface Props {
  size: number;
  illumination: number;
  phase: MoonPhaseName;
  glowColor?: string;
  showGlow?: boolean;
  showBorder?: boolean;
  accessibilityLabel?: string;
}

export function RealisticMoon({
  size,
  illumination,
  phase,
  glowColor = 'rgba(217,133,165,0.18)',
  showGlow = true,
  showBorder = true,
  accessibilityLabel,
}: Props) {
  const [textureFailed, setTextureFailed] = useState(false);
  const safeIllumination = Math.max(0, Math.min(1, Number.isFinite(illumination) ? illumination : 0));
  const shadowPath = useMemo(() => getMoonShadowPath(safeIllumination, phase), [safeIllumination, phase]);
  const overflow = showGlow ? Math.max(22, Math.round(size * 0.34)) : 0;
  const shadowOpacity = safeIllumination <= 0.08 ? 0.52 : safeIllumination < 0.25 ? 0.66 : 0.76;

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrapper, { width: size + overflow, height: size + overflow }]}
    >
      {showGlow ? (
        <View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width: size + overflow - 4,
              height: size + overflow - 4,
              borderRadius: (size + overflow - 4) / 2,
              backgroundColor: glowColor,
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.moon,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: showBorder ? StyleSheet.hairlineWidth : 0,
          },
          showGlow && styles.moonElevated,
        ]}
      >
        {!textureFailed ? (
          <Image
            source={require('../../assets/images/moon/moon-surface.png')}
            resizeMode="cover"
            fadeDuration={0}
            onError={() => setTextureFailed(true)}
            style={styles.texture}
            accessible={false}
          />
        ) : null}

        <Svg pointerEvents="none" width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id="moonSurfaceTint" cx="38%" cy="30%" rx="70%" ry="70%">
              <Stop offset="0" stopColor="#FFFDFB" stopOpacity={0.34} />
              <Stop offset="0.58" stopColor="#F2E9E6" stopOpacity={0.13} />
              <Stop offset="1" stopColor="#D8C7CC" stopOpacity={0.22} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.5" fill="url(#moonSurfaceTint)" />
          {textureFailed ? (
            <>
              <Circle cx="35" cy="30" r="7" fill="rgba(91,54,95,0.12)" />
              <Circle cx="66" cy="38" r="10" fill="rgba(91,54,95,0.10)" />
              <Circle cx="45" cy="70" r="8" fill="rgba(91,54,95,0.09)" />
              <Circle cx="72" cy="68" r="5" fill="rgba(91,54,95,0.08)" />
            </>
          ) : null}
          {shadowPath ? <Path d={shadowPath} fill={`rgba(33,26,36,${shadowOpacity})`} /> : null}
          <Circle cx="50" cy="50" r="49.2" fill="transparent" stroke="rgba(255,255,255,0.32)" strokeWidth="0.65" />
          <Circle cx="50" cy="50" r="48.2" fill="transparent" stroke="rgba(91,54,95,0.16)" strokeWidth="0.5" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', opacity: 0.58 },
  moon: {
    overflow: 'hidden',
    borderColor: 'rgba(91,54,95,0.18)',
    backgroundColor: '#EDE3E0',
  },
  moonElevated: {
    shadowColor: '#A64D72',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.88,
    transform: [{ scale: 1.015 }],
  },
});
