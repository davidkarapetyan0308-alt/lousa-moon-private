import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as MapLibre from '@maplibre/maplibre-react-native';

import { LousaMapMarker } from './LousaMapMarker';
import { MaterialSymbol } from './MaterialSymbol';
import { GYUMRI_DELIVERY_CENTER, DEFAULT_DELIVERY_RADIUS_KM } from '../services/deliveryZone';
import {
  LOUSA_MAP_DEFAULT_ZOOM,
  LOUSA_MAP_MIN_ZOOM,
  LOUSA_MAP_PICKER_ZOOM,
  getLousaMapProviderConfig,
  shouldRenderInteractiveMap,
  makeDeliveryZoneCircleGeoJson,
} from '../services/mapProvider';
import { LousaPalette } from '../theme/designSystem';

export interface LousaDeliveryMapHandle {
  animateToCoordinate: (latitude: number, longitude: number, zoomLevel?: number) => void;
}

export type MapSelectionMode = 'marker' | 'crosshair' | 'none';

interface Props {
  latitude: number;
  longitude: number;
  height?: number;
  interactive?: boolean;
  label?: string;
  dark?: boolean;
  initialZoom?: number;
  selectionMode?: MapSelectionMode;
  onMapReady?: () => void;
  onSelectCoordinate?: (latitude: number, longitude: number) => void;
  onCameraCenterChanged?: (latitude: number, longitude: number) => void;
  onCameraIdle?: (latitude: number, longitude: number) => void;
  showDeliveryZone?: boolean;
  showAttribution?: boolean;
  loadingText?: string;
  unavailableText?: string;
  onMapError?: (message: string) => void;
  onExpand?: () => void;
  expandLabel?: string;
}

type AnyRecord = Record<string, any>;
const ML = MapLibre as unknown as AnyRecord;
const MapComponent = (ML.MapView || ML.Map) as React.ComponentType<any> | undefined;
const CameraComponent = ML.Camera as React.ComponentType<any> | undefined;
const PointAnnotationComponent = ML.PointAnnotation as React.ComponentType<any> | undefined;
const MarkerViewComponent = ML.MarkerView as React.ComponentType<any> | undefined;
const ShapeSourceComponent = ML.ShapeSource as React.ComponentType<any> | undefined;
const FillLayerComponent = ML.FillLayer as React.ComponentType<any> | undefined;
const LineLayerComponent = ML.LineLayer as React.ComponentType<any> | undefined;

function getCoordinate(event: AnyRecord): [number, number] | null {
  const candidates = [
    event?.geometry?.coordinates,
    event?.coordinates,
    event?.nativeEvent?.coordinate,
    event?.properties?.center,
    event?.nativeEvent?.properties?.center,
    event?.features?.[0]?.geometry?.coordinates,
  ];
  for (const direct of candidates) {
    if (Array.isArray(direct) && typeof direct[0] === 'number' && typeof direct[1] === 'number') {
      return [direct[0], direct[1]];
    }
    if (direct && typeof direct.longitude === 'number' && typeof direct.latitude === 'number') {
      return [direct.longitude, direct.latitude];
    }
  }
  return null;
}

function ManualFallback({ height, label, latitude, longitude, text }: { height: number; label?: string; latitude: number; longitude: number; text?: string }) {
  return (
    <View style={[styles.fallback, { minHeight: Math.max(210, height) }]}>
      <View style={styles.fallbackIconWrap}>
        <MaterialSymbol name="map_pin" size={34} color={LousaPalette.berry} />
      </View>
      <Text style={styles.fallbackTitle}>{text || 'Карта не настроена для этой сборки'}</Text>
      <Text style={styles.fallbackBody}>{label || 'Введите адрес вручную — LOUSA проверит зону доставки перед заказом.'}</Text>
      <Text style={styles.coordinates}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
    </View>
  );
}

function CenterCrosshair({ moving }: { moving: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.crosshairWrap, moving && styles.crosshairMoving]}>
      <View style={styles.crosshairHalo} />
      <View style={styles.crosshairPin}>
        <View style={styles.crosshairDot} />
      </View>
      <View style={styles.crosshairShadow} />
    </View>
  );
}

export const LousaMapLibreAddressMap = forwardRef<LousaDeliveryMapHandle, Props>(function LousaMapLibreAddressMap(
  {
    latitude,
    longitude,
    height = 315,
    interactive = true,
    label,
    dark = false,
    initialZoom = LOUSA_MAP_DEFAULT_ZOOM,
    selectionMode = 'marker',
    onMapReady,
    onSelectCoordinate,
    onCameraCenterChanged,
    onCameraIdle,
    showDeliveryZone = true,
    showAttribution = true,
    loadingText,
    unavailableText,
    onMapError,
    onExpand,
    expandLabel,
  },
  ref,
) {
  const cameraRef = useRef<any>(null);
  const movingRef = useRef(false);
  const [moving, setMoving] = useState(false);
  const provider = useMemo(() => getLousaMapProviderConfig(), []);
  const deliveryZoneShape = useMemo(
    () => makeDeliveryZoneCircleGeoJson(GYUMRI_DELIVERY_CENTER.latitude, GYUMRI_DELIVERY_CENTER.longitude, DEFAULT_DELIVERY_RADIUS_KM),
    [],
  );
  const initialCamera = useRef({ centerCoordinate: [longitude, latitude], zoomLevel: initialZoom });

  useImperativeHandle(ref, () => ({
    animateToCoordinate: (nextLatitude: number, nextLongitude: number, zoomLevel = LOUSA_MAP_PICKER_ZOOM) => {
      cameraRef.current?.setCamera?.({
        centerCoordinate: [nextLongitude, nextLatitude],
        zoomLevel,
        animationDuration: 450,
      });
    },
  }));

  if (!shouldRenderInteractiveMap(provider) || !MapComponent || !CameraComponent) {
    return <ManualFallback height={height} label={label} latitude={latitude} longitude={longitude} text={unavailableText || 'Карта не настроена для этой сборки'} />;
  }

  const markerCoordinate = [longitude, latitude];
  const handleMoving = (event: AnyRecord) => {
    // MapLibre emits this event continuously while the camera moves. Update
    // React state only once per gesture/animation to avoid frame-by-frame rerenders.
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    const next = getCoordinate(event);
    if (next && onCameraCenterChanged) onCameraCenterChanged(next[1], next[0]);
  };
  const handleIdle = (event: AnyRecord) => {
    movingRef.current = false;
    setMoving(false);
    const next = getCoordinate(event);
    if (next && onCameraIdle) onCameraIdle(next[1], next[0]);
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapComponent
        style={StyleSheet.absoluteFill}
        mapStyle={provider.styleUrl}
        logoEnabled={false}
        compassEnabled={interactive}
        attributionEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onDidFinishLoadingMap={onMapReady}
        onDidFailLoadingMap={() => onMapError?.('MAP_LOAD_FAILED')}
        onRegionIsChanging={handleMoving}
        onRegionDidChange={handleIdle}
        onPress={(event: AnyRecord) => {
          if (!interactive || !onSelectCoordinate || selectionMode === 'crosshair') return;
          const next = getCoordinate(event);
          if (!next) return;
          onSelectCoordinate(next[1], next[0]);
        }}
      >
        <CameraComponent
          ref={cameraRef}
          defaultSettings={initialCamera.current}
          minZoomLevel={LOUSA_MAP_MIN_ZOOM}
        />

        {showDeliveryZone && ShapeSourceComponent && FillLayerComponent && LineLayerComponent ? (
          <ShapeSourceComponent id="lousa-delivery-zone" shape={deliveryZoneShape}>
            <FillLayerComponent id="lousa-delivery-zone-fill" style={{ fillColor: dark ? 'rgba(180,90,123,0.16)' : 'rgba(180,90,123,0.13)' }} />
            <LineLayerComponent id="lousa-delivery-zone-line" style={{ lineColor: '#B45A7B', lineWidth: 1.4, lineOpacity: 0.72 }} />
          </ShapeSourceComponent>
        ) : null}

        {selectionMode === 'marker' && PointAnnotationComponent ? (
          <PointAnnotationComponent
            id="selected-delivery-address"
            coordinate={markerCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            draggable={interactive}
            onDragEnd={(event: AnyRecord) => {
              if (!interactive || !onSelectCoordinate) return;
              const next = getCoordinate(event);
              if (!next) return;
              onSelectCoordinate(next[1], next[0]);
            }}
          >
            <LousaMapMarker compact={!interactive} />
          </PointAnnotationComponent>
        ) : selectionMode === 'marker' && MarkerViewComponent ? (
          <MarkerViewComponent coordinate={markerCoordinate} anchor={{ x: 0.5, y: 1 }}>
            <LousaMapMarker compact={!interactive} />
          </MarkerViewComponent>
        ) : null}
      </MapComponent>

      {selectionMode === 'crosshair' ? <CenterCrosshair moving={moving} /> : null}

      {label ? (
        <View style={styles.labelPill}>
          <Text style={styles.labelText} numberOfLines={2}>{label}</Text>
        </View>
      ) : null}

      {onExpand ? (
        <Pressable accessibilityRole="button" accessibilityLabel={expandLabel || 'Открыть карту'} onPress={onExpand} style={styles.expandButton}>
          <MaterialSymbol name="open_in_full" size={20} color={LousaPalette.berry} />
        </Pressable>
      ) : null}

      {showAttribution ? (
        <View style={styles.attributionPill}>
          <Text style={styles.attributionText}>{provider.attribution}</Text>
        </View>
      ) : null}

      {loadingText ? (
        <View pointerEvents="none" style={styles.loadingHint}>
          <Text style={styles.loadingHintText}>{loadingText}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 28, overflow: 'hidden', backgroundColor: '#EFE9EC', borderWidth: 1, borderColor: 'rgba(91,54,95,0.14)' },
  fallback: { width: '100%', borderRadius: 28, backgroundColor: '#FFFDFE', borderWidth: 1, borderColor: LousaPalette.line, alignItems: 'center', justifyContent: 'center', padding: 22 },
  fallbackIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8E7ED', marginBottom: 12 },
  fallbackTitle: { color: LousaPalette.ink, fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  fallbackBody: { color: LousaPalette.inkSoft, fontFamily: 'sans-serif', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  coordinates: { color: LousaPalette.inkSoft, fontFamily: 'sans-serif', fontSize: 12, marginTop: 5 },
  labelPill: { position: 'absolute', left: 10, right: 58, top: 10, minHeight: 34, borderRadius: 14, backgroundColor: 'rgba(255,253,254,0.94)', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 7 },
  labelText: { color: LousaPalette.ink, fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16 },
  expandButton: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 21, backgroundColor: 'rgba(255,253,254,0.96)', alignItems: 'center', justifyContent: 'center', shadowColor: '#2B1F27', shadowOpacity: 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  attributionPill: { position: 'absolute', left: 9, bottom: 8, maxWidth: '72%', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,253,254,0.88)' },
  attributionText: { color: LousaPalette.inkSoft, fontFamily: 'sans-serif-medium', fontSize: 9.5 },
  loadingHint: { position: 'absolute', top: '46%', left: 24, right: 24, alignItems: 'center' },
  loadingHintText: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(255,253,254,0.9)', color: LousaPalette.inkSoft, fontFamily: 'sans-serif-medium', fontSize: 12, textAlign: 'center' },
  crosshairWrap: { position: 'absolute', left: '50%', top: '50%', width: 56, height: 76, marginLeft: -28, marginTop: -58, alignItems: 'center', justifyContent: 'flex-end', transform: [{ translateY: 0 }] },
  crosshairMoving: { transform: [{ translateY: -8 }] },
  crosshairHalo: { position: 'absolute', bottom: 6, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(217,133,165,0.19)' },
  crosshairPin: { width: 42, height: 50, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 4, transform: [{ rotate: '45deg' }], backgroundColor: LousaPalette.berry, borderWidth: 3, borderColor: '#FFFDFE', alignItems: 'center', justifyContent: 'center' },
  crosshairDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFFDFE', transform: [{ rotate: '-45deg' }] },
  crosshairShadow: { width: 18, height: 6, borderRadius: 9, backgroundColor: 'rgba(33,26,36,0.24)', marginTop: 5 },
});
