import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  LousaMapLibreAddressMap,
  type LousaDeliveryMapHandle,
} from "../../src/components/LousaMapLibreAddressMap";
import { MaterialSymbol } from "../../src/components/MaterialSymbol";
import {
  PressScale,
  PrimaryAction,
  SurfaceCard,
} from "../../src/components/ui";
import type { SupportedLanguage } from "../../src/domain/models";
import { useAddressPickerStore } from "../../src/store/addressPicker";
import { useUserStore } from "../../src/store";
import { useTheme } from "../../src/theme/ThemeProvider";
import { LousaPalette } from "../../src/theme/designSystem";
import {
  type AddressPrediction,
  type GeocodedAddress,
  getRealPlaceDetails,
  requestCurrentDeviceLocation,
  reverseGeocodeRealCoordinate,
  searchRealAddresses,
} from "../../src/services/maps";
import { GYUMRI_DELIVERY_CENTER } from "../../src/services/deliveryZone";

const COPY = {
  ru: {
    title: "Точное место доставки",
    help: "Передвинь карту так, чтобы прицел оказался над нужным входом.",
    search: "Найти улицу или дом",
    selected: "Выбрано место",
    resolving: "Уточняем адрес…",
    unknown: "Уточни улицу и номер дома после подтверждения точки.",
    confirm: "Подтвердить эту точку",
    location: "Моё местоположение",
    error: "Не удалось уточнить адрес. Точка останется выбранной.",
  },
  en: {
    title: "Exact delivery point",
    help: "Move the map until the crosshair is over the correct entrance.",
    search: "Find a street or building",
    selected: "Selected place",
    resolving: "Resolving address…",
    unknown: "Confirm the point and complete the street and building manually.",
    confirm: "Confirm this point",
    location: "My location",
    error: "The address could not be resolved. The point remains selected.",
  },
  hy: {
    title: "Առաքման ճշգրիտ վայրը",
    help: "Տեղափոխիր քարտեզը, մինչև նշանը լինի ճիշտ մուտքի վրա։",
    search: "Գտնել փողոց կամ տուն",
    selected: "Ընտրված վայր",
    resolving: "Ճշտում ենք հասցեն…",
    unknown: "Հաստատիր կետը և լրացրու փողոցն ու տունը ձեռքով։",
    confirm: "Հաստատել այս կետը",
    location: "Իմ գտնվելու վայրը",
    error: "Չհաջողվեց ճշտել հասցեն։ Կետը կմնա ընտրված։",
  },
} as const;

function makeSessionToken() {
  try {
    return Crypto.randomUUID();
  } catch {
    return `picker-${Date.now()}`;
  }
}

function fallbackAddress(latitude: number, longitude: number): GeocodedAddress {
  return {
    provider: "device",
    providerPlaceId: null,
    formattedAddress: "",
    country: "Armenia",
    region: "Shirak",
    city: "Gyumri",
    district: "",
    street: "",
    house: "",
    postalCode: "",
    latitude,
    longitude,
  };
}

export default function AddressMapPickerScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language) as SupportedLanguage;
  const copy = COPY[language];
  const seed = useAddressPickerStore((state) => state.seed);
  const confirmSelection = useAddressPickerStore((state) => state.confirm);
  const start = seed || {
    latitude: GYUMRI_DELIVERY_CENTER.latitude,
    longitude: GYUMRI_DELIVERY_CENTER.longitude,
    formattedAddress: "",
  };
  const [coordinate, setCoordinate] = useState({
    latitude: start.latitude,
    longitude: start.longitude,
  });
  const [address, setAddress] = useState<GeocodedAddress>(() => ({
    ...fallbackAddress(start.latitude, start.longitude),
    formattedAddress: start.formattedAddress || "",
  }));
  const [searchText, setSearchText] = useState("");
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [resolvedCoordinate, setResolvedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    start.formattedAddress
      ? { latitude: start.latitude, longitude: start.longitude }
      : null,
  );
  const mapRef = useRef<LousaDeliveryMapHandle | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const sessionToken = useRef(makeSessionToken());

  const mapHeight = Math.max(
    240,
    Math.min(640, windowHeight - insets.top - insets.bottom - 250),
  );
  const displayAddress = useMemo(
    () =>
      address.formattedAddress ||
      [address.street, address.house, address.city].filter(Boolean).join(", "),
    [address],
  );
  const coordinateMatches = (
    value: { latitude: number; longitude: number } | null,
  ) =>
    Boolean(
      value &&
      Math.abs(value.latitude - coordinate.latitude) < 0.000001 &&
      Math.abs(value.longitude - coordinate.longitude) < 0.000001,
    );
  const selectionResolved = coordinateMatches(resolvedCoordinate);
  const canConfirm = selectionResolved && !resolving;

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      searchRequestId.current += 1;
      geocodeRequestId.current += 1;
    },
    [],
  );

  const handleCameraCenterChanged = (latitude: number, longitude: number) => {
    setCoordinate({ latitude, longitude });
    setResolvedCoordinate(null);
    setMessage("");
    // Invalidate an in-flight reverse-geocode request immediately. Waiting until
    // the debounce timer fires can otherwise apply an address for the previous point.
    geocodeRequestId.current += 1;
  };

  const resolve = (latitude: number, longitude: number) => {
    const id = ++geocodeRequestId.current;
    setCoordinate({ latitude, longitude });
    setResolvedCoordinate(null);
    setResolving(true);
    setMessage("");
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const next = await reverseGeocodeRealCoordinate(
          latitude,
          longitude,
          language,
        );
        if (id === geocodeRequestId.current) {
          setAddress(next);
          setResolvedCoordinate({ latitude, longitude });
        }
      } catch {
        if (id === geocodeRequestId.current) {
          setAddress(fallbackAddress(latitude, longitude));
          setResolvedCoordinate({ latitude, longitude });
          setMessage(copy.error);
        }
      } finally {
        if (id === geocodeRequestId.current) setResolving(false);
      }
    }, 550);
  };

  const onSearchChange = (value: string) => {
    const id = ++searchRequestId.current;
    setSearchText(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const next = await searchRealAddresses(
          value,
          language,
          sessionToken.current,
        );
        if (id === searchRequestId.current) setPredictions(next);
      } catch {
        if (id === searchRequestId.current) {
          setPredictions([]);
          setMessage(copy.error);
        }
      } finally {
        if (id === searchRequestId.current) setSearching(false);
      }
    }, 420);
  };

  const selectPrediction = async (item: AddressPrediction) => {
    const id = ++searchRequestId.current;
    geocodeRequestId.current += 1;
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    Keyboard.dismiss();
    setPredictions([]);
    setSearchText(item.fullText);
    setResolving(true);
    setResolvedCoordinate(null);
    setMessage("");
    try {
      const detail = await getRealPlaceDetails(
        item.placeId,
        language,
        sessionToken.current,
      );
      if (id !== searchRequestId.current) return;
      const nextCoordinate = {
        latitude: detail.latitude,
        longitude: detail.longitude,
      };
      setAddress(detail);
      setCoordinate(nextCoordinate);
      setResolvedCoordinate(nextCoordinate);
      mapRef.current?.animateToCoordinate(
        detail.latitude,
        detail.longitude,
        17,
      );
      sessionToken.current = makeSessionToken();
    } catch {
      if (id === searchRequestId.current) setMessage(copy.error);
    } finally {
      if (id === searchRequestId.current) setResolving(false);
    }
  };

  const locateUser = async () => {
    setLocating(true);
    try {
      const current = await requestCurrentDeviceLocation();
      setResolvedCoordinate(null);
      mapRef.current?.animateToCoordinate(
        current.latitude,
        current.longitude,
        17,
      );
      // The map idle callback resolves the final camera center. Calling reverse
      // geocoding here as well can race the animation and attach a stale address.
    } catch {
      setMessage(copy.error);
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!canConfirm) return;
    confirmSelection({
      ...address,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.header}>
        <PressScale
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: colors.surface }]}
        >
          <MaterialSymbol
            name="arrow_back"
            size={23}
            color={colors.onBackground}
          />
        </PressScale>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.onBackground }]}>
            {copy.title}
          </Text>
          <Text style={[styles.help, { color: colors.onSurfaceVariant }]}>
            {copy.help}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <LousaMapLibreAddressMap
          ref={mapRef}
          latitude={start.latitude}
          longitude={start.longitude}
          height={mapHeight}
          initialZoom={16}
          interactive
          selectionMode="crosshair"
          showDeliveryZone
          showAttribution
          dark={isDark}
          onCameraCenterChanged={handleCameraCenterChanged}
          onCameraIdle={resolve}
        />

        <View style={styles.searchLayer}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: isDark ? "#251F28" : "#FFFDFE" },
            ]}
          >
            <MaterialSymbol
              name="search"
              size={21}
              color={colors.onSurfaceVariant}
            />
            <TextInput
              value={searchText}
              onChangeText={onSearchChange}
              placeholder={copy.search}
              placeholderTextColor={colors.outline}
              style={[styles.searchInput, { color: colors.onBackground }]}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searching ? (
              <ActivityIndicator size="small" color={LousaPalette.berry} />
            ) : null}
          </View>
          {predictions.length ? (
            <SurfaceCard padding={0} style={styles.predictions}>
              {predictions.map((item, index) => (
                <Pressable
                  key={item.placeId}
                  onPress={() => void selectPrediction(item)}
                  style={[
                    styles.prediction,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <MaterialSymbol
                    name="location_on"
                    size={19}
                    color={LousaPalette.berry}
                  />
                  <View style={styles.flex}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.predictionTitle,
                        { color: colors.onBackground },
                      ]}
                    >
                      {item.primaryText}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.predictionBody,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {item.secondaryText}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </SurfaceCard>
          ) : null}
        </View>

        <PressScale
          onPress={() => void locateUser()}
          style={[styles.locationButton, { backgroundColor: colors.surface }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={LousaPalette.berry} />
          ) : (
            <MaterialSymbol
              name="my_location"
              size={23}
              color={LousaPalette.berry}
            />
          )}
        </PressScale>
      </View>

      <View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(12, insets.bottom),
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.sheetTitleRow}>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: LousaPalette.berry }]}>
              {copy.selected}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.address, { color: colors.onBackground }]}
            >
              {resolving
                ? copy.resolving
                : selectionResolved
                  ? displayAddress || copy.unknown
                  : copy.unknown}
            </Text>
          </View>
          {resolving ? (
            <ActivityIndicator size="small" color={LousaPalette.berry} />
          ) : null}
        </View>
        {message ? (
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>
            {message}
          </Text>
        ) : null}
        <PrimaryAction
          label={copy.confirm}
          icon="check"
          onPress={confirm}
          disabled={!canConfirm}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  back: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
  title: { fontFamily: "sans-serif-medium", fontSize: 20, lineHeight: 25 },
  help: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 10,
    borderRadius: 26,
    overflow: "hidden",
  },
  searchLayer: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    zIndex: 20,
  },
  searchBox: {
    height: 52,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowColor: "#2B1F27",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  searchInput: { flex: 1, height: 52, fontFamily: "sans-serif", fontSize: 14 },
  predictions: { marginTop: 7, maxHeight: 260, overflow: "hidden" },
  prediction: {
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  predictionTitle: { fontFamily: "sans-serif-medium", fontSize: 13 },
  predictionBody: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  locationButton: {
    position: "absolute",
    right: 14,
    bottom: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B1F27",
    shadowOpacity: 0.15,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  sheet: {
    marginTop: 8,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: {
    fontFamily: "sans-serif-medium",
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  address: {
    fontFamily: "sans-serif-medium",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 3,
  },
  message: { fontFamily: "sans-serif", fontSize: 12, lineHeight: 17 },
});
