import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
  CheckboxRow,
  ChoiceChip,
  IconButton,
  InlineMessage,
  PressScale,
  PrimaryButton,
  SecondaryButton,
  SectionSurface,
  StatusPill,
  StickyBottomAction,
  SurfaceCard,
} from "../../src/components/ui";
import type {
  DeliveryAddress,
  DeliveryAddressType,
  DeliveryHandoffType,
  SupportedLanguage,
} from "../../src/domain/models";
import {
  type AddressPrediction,
  type GeocodedAddress,
  checkRealDeliveryZone,
  getRealPlaceDetails,
  requestCurrentDeviceLocation,
  reverseGeocodeRealCoordinate,
  searchRealAddresses,
  saveDeliveryAddressRemote,
} from "../../src/services/maps";
import { GYUMRI_DELIVERY_CENTER } from "../../src/services/deliveryZone";
import type { DeliveryZoneTruth } from "../../src/services/deliveryZoneLocal";
import {
  getLousaMapProviderConfig,
  shouldRenderInteractiveMap,
} from "../../src/services/mapProvider";
import { checkApiEnvironment } from "../../src/services/apiEnvironment";
import { useBoxStore, useUserStore } from "../../src/store";
import { useAddressPickerStore } from "../../src/store/addressPicker";
import {
  clearDeliveryAddressDraft,
  loadDeliveryAddressDraft,
  saveDeliveryAddressDraft,
} from "../../src/services/addressDraft";
import { useTheme } from "../../src/theme/ThemeProvider";
import { LousaPalette } from "../../src/theme/designSystem";
import { GuestAccountGate } from "../../src/features/auth/components/GuestAccountGate";

const INITIAL_REGION = {
  latitude: GYUMRI_DELIVERY_CENTER.latitude,
  longitude: GYUMRI_DELIVERY_CENTER.longitude,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

const COPY = {
  ru: {
    title: "Выбери адрес доставки",
    subtitle:
      "Найди адрес или открой карту на весь экран, чтобы указать точное место.",
    search: "Поиск адреса в Армении",
    myLocation: "Моё местоположение",
    addressDetails: "Детали адреса",
    recipient: "Получатель",
    phone: "Телефон для доставки",
    contactRequired: "Укажи имя получателя и номер телефона.",
    missingField: (field: string) => `Не заполнено поле «${field}».`,
    street: "Улица",
    house: "Дом",
    entrance: "Подъезд",
    floor: "Этаж",
    apartment: "Квартира",
    intercom: "Домофон",
    label: "Название адреса",
    home: "Дом",
    work: "Работа",
    other: "Другой",
    addressType: "Тип места",
    apartmentType: "Квартира",
    privateHouseType: "Частный дом",
    officeType: "Офис",
    workplaceType: "Место работы",
    hotelType: "Отель",
    otherType: "Другое",
    company: "Компания или бизнес-центр",
    contact: "Контактное лицо",
    officeNumber: "Офис / помещение",
    hotelName: "Название отеля",
    roomNumber: "Номер комнаты",
    landmark: "Ориентир",
    gateDetails: "Ворота и вход",
    handoff: "Как передать заказ",
    handToRecipient: "Передать лично",
    leaveAtDoor: "Оставить у двери",
    leaveReception: "Оставить на ресепшене",
    leaveSecurity: "Оставить у охраны",
    callArrival: "Позвонить по прибытии",
    handoffOther: "Другое",
    leaveLocation: "Где именно оставить",
    callBefore: "Позвонить перед доставкой",
    doNotKnock: "Не стучать",
    photoProof: "Фото подтверждения",
    note: "Комментарий курьеру",
    notePlaceholder: "Ориентир, где оставить заказ, особенности входа",
    confirm: "Да, доставить сюда",
    locating: "Определяем местоположение…",
    resolving: "Уточняем настоящий адрес…",
    checking: "Проверяем зону доставки…",
    available: "Доставка доступна",
    outside: "Пока мы не доставляем сюда",
    fee: "Доставка",
    eta: "Около",
    minutes: "мин",
    included: "Включена в ваш тариф — дополнительной платы нет",
    openMap: "Открыть карту полностью",
    manualWarning:
      "Не удалось уточнить адрес автоматически. Точка сохранена, поля можно заполнить вручную.",
    permissionDenied: "Геолокация недоступна. Выбери адрес в Армении вручную.",
    locationDisabled: "Геолокация выключена. Карта оставлена в Гюмри.",
    searchUnavailable:
      "Поиск временно недоступен. Нажми на карту или заполни адрес вручную.",
    addressRequired: "Выбери точку и укажи улицу с номером дома.",
    zoneRequired: "Выбранный адрес находится вне текущей зоны доставки.",
    mapWeb:
      "Интерактивная MapLibre-карта доступна в Android/iOS-сборке. В web-версии используй ручной ввод.",
    providerMap: "MapLibre / OSM",
    mapNotConfigured:
      "Карта не настроена для этой сборки. Введите адрес вручную — LOUSA проверит зону доставки перед заказом.",
    serverNotConfigured:
      "Сервис адресов временно недоступен. Черновик сохранён на телефоне — попробуйте ещё раз позже.",
    zoneUnselected: "Адрес ещё не проверен",
    zoneUnavailable: "Зона не проверена",
    zoneUnavailableBody:
      "Не удалось подтвердить зону доставки через сервер. Зелёный статус не будет показан без реальной проверки.",
    saveUnavailable: "Сервис адресов временно недоступен. Черновик сохранён на телефоне — попробуйте позже.",
    saveFailed:
      "Адрес пока не сохранён. Заполненные данные остались на экране — проверь интернет и повтори.",
    mapLoadFailed: "Не удалось загрузить карту.",
    retry: "Повторить",
    openSettings: "Открыть настройки",
    draftRestored:
      "Восстановлен несохранённый адрес. Проверь данные и повтори сохранение.",
    addressChanged:
      "Улица или дом изменены. Проверь, что точка на карте совпадает, и повторно подтверди зону.",
    recheckPoint: "Точка совпадает — проверить зону",
    pointRequired: "Сначала выбери точную точку на карте.",
  },
  en: {
    title: "Choose your delivery address",
    subtitle:
      "Find an address or open the full map to choose the exact delivery point.",
    search: "Search address in Armenia",
    myLocation: "My location",
    addressDetails: "Address details",
    recipient: "Recipient",
    phone: "Delivery phone",
    contactRequired: "Enter the recipient name and phone number.",
    missingField: (field: string) => `The “${field}” field is missing.`,
    street: "Street",
    house: "Building",
    entrance: "Entrance",
    floor: "Floor",
    apartment: "Apartment",
    intercom: "Intercom",
    label: "Address label",
    home: "Home",
    work: "Work",
    other: "Other",
    addressType: "Place type",
    apartmentType: "Apartment",
    privateHouseType: "Private house",
    officeType: "Office",
    workplaceType: "Workplace",
    hotelType: "Hotel",
    otherType: "Other",
    company: "Company or business center",
    contact: "Contact person",
    officeNumber: "Office / room",
    hotelName: "Hotel name",
    roomNumber: "Room number",
    landmark: "Landmark",
    gateDetails: "Gate and entrance details",
    handoff: "How to hand over the order",
    handToRecipient: "Hand to recipient",
    leaveAtDoor: "Leave at the door",
    leaveReception: "Leave with reception",
    leaveSecurity: "Leave with security",
    callArrival: "Call on arrival",
    handoffOther: "Other",
    leaveLocation: "Exact leave location",
    callBefore: "Call before delivery",
    doNotKnock: "Do not knock",
    photoProof: "Photo confirmation",
    note: "Courier instructions",
    notePlaceholder: "Landmark, entry details, where to leave the order",
    confirm: "Yes, deliver here",
    locating: "Getting your location…",
    resolving: "Resolving the real address…",
    checking: "Checking the delivery zone…",
    available: "Delivery is available",
    outside: "We do not deliver here yet",
    fee: "Delivery",
    eta: "About",
    minutes: "min",
    included: "Included in your plan — no extra charge",
    openMap: "Open full map",
    manualWarning:
      "The map could not resolve this address automatically. Keep the point and complete the fields manually.",
    permissionDenied:
      "Location permission was not granted. You can still choose a home on the map or search.",
    locationDisabled: "Location services are disabled on this device.",
    searchUnavailable:
      "Address search is temporarily unavailable. The real map and manual selection still work.",
    addressRequired: "Choose a point and enter a street and building number.",
    zoneRequired: "The selected address is outside the current delivery zone.",
    mapWeb:
      "The interactive map is available in Android/iOS builds. Use manual address entry on web.",
    providerMap: "MapLibre / OSM",
    mapNotConfigured:
      "Map provider is not configured for this build. Enter the address manually and LOUSA will check the delivery zone.",
    serverNotConfigured:
      "The address service is temporarily unavailable. Your draft is saved on this phone—try again later.",
    zoneUnselected: "Address not verified yet",
    zoneUnavailable: "Zone not verified",
    zoneUnavailableBody:
      "LOUSA could not confirm the delivery zone with the server. A green status is never shown without a real check.",
    saveUnavailable:
      "The address service is temporarily unavailable. Your draft is saved on this phone—try again later.",
    saveFailed:
      "The address is not saved yet. Your entries remain on screen — check the connection and retry.",
    mapLoadFailed: "The map could not be loaded.",
    retry: "Retry",
    openSettings: "Open settings",
    draftRestored:
      "Your unsaved address was restored. Review it and retry saving.",
    addressChanged:
      "The street or building changed. Check that the map point still matches and verify the zone again.",
    recheckPoint: "The point matches — verify zone",
    pointRequired: "Choose the exact point on the map first.",
  },
  hy: {
    title: "Ընտրիր առաքման հասցեն",
    subtitle:
      "Գտիր հասցեն կամ բացիր ամբողջ քարտեզը՝ ճշգրիտ վայրը նշելու համար։",
    search: "Փողոցի և տան որոնում",
    myLocation: "Իմ գտնվելու վայրը",
    addressDetails: "Հասցեի մանրամասներ",
    recipient: "Ստացող",
    phone: "Առաքման հեռախոս",
    contactRequired: "Նշիր ստացողի անունը և հեռախոսահամարը։",
    missingField: (field: string) => `«${field}» դաշտը լրացված չէ։`,
    street: "Փողոց",
    house: "Տուն",
    entrance: "Մուտք",
    floor: "Հարկ",
    apartment: "Բնակարան",
    intercom: "Դոմոֆոն",
    label: "Հասցեի անունը",
    home: "Տուն",
    work: "Աշխատանք",
    other: "Այլ",
    addressType: "Վայրի տեսակ",
    apartmentType: "Բնակարան",
    privateHouseType: "Առանձնատուն",
    officeType: "Գրասենյակ",
    workplaceType: "Աշխատավայր",
    hotelType: "Հյուրանոց",
    otherType: "Այլ",
    company: "Ընկերություն կամ բիզնես կենտրոն",
    contact: "Կոնտակտային անձ",
    officeNumber: "Գրասենյակ / սենյակ",
    hotelName: "Հյուրանոցի անուն",
    roomNumber: "Սենյակի համար",
    landmark: "Կողմնորոշիչ",
    gateDetails: "Դարպաս և մուտք",
    handoff: "Ինչպես հանձնել պատվերը",
    handToRecipient: "Հանձնել անձամբ",
    leaveAtDoor: "Թողնել դռան մոտ",
    leaveReception: "Թողնել ընդունարանում",
    leaveSecurity: "Թողնել պահակակետում",
    callArrival: "Զանգահարել հասնելիս",
    handoffOther: "Այլ",
    leaveLocation: "Որտեղ ճիշտ թողնել",
    callBefore: "Զանգահարել առաքումից առաջ",
    doNotKnock: "Չթակել",
    photoProof: "Լուսանկար հաստատման համար",
    note: "Մեկնաբանություն առաքիչին",
    notePlaceholder: "Կողմնորոշիչ, մուտքի առանձնահատկություններ",
    confirm: "Այո, առաքել այստեղ",
    locating: "Որոշում ենք գտնվելու վայրը…",
    resolving: "Ճշտում ենք իրական հասցեն…",
    checking: "Ստուգում ենք առաքման գոտին…",
    available: "Առաքումը հասանելի է",
    outside: "Այստեղ դեռ չենք առաքում",
    fee: "Առաքում",
    eta: "Մոտ",
    minutes: "րոպե",
    included: "Ներառված է քո սակագնում՝ հավելյալ վճար չկա",
    openMap: "Բացել ամբողջ քարտեզը",
    manualWarning:
      "Քարտեզը չկարողացավ ավտոմատ ճշտել հասցեն։ Պահիր կետը և լրացրու դաշտերը ձեռքով։",
    permissionDenied:
      "Գեոլոկացիայի թույլտվություն չկա։ Կարող ես ընտրել տունը քարտեզով կամ որոնմամբ։",
    locationDisabled: "Սարքում գեոլոկացիան անջատված է։",
    searchUnavailable:
      "Հասցեների որոնումը ժամանակավորապես անհասանելի է։ Քարտեզը և ձեռքով ընտրությունը շարունակում են աշխատել։",
    addressRequired: "Ընտրիր կետ և նշիր փողոցն ու տան համարը։",
    zoneRequired: "Ընտրված հասցեն առաքման ընթացիկ գոտուց դուրս է։",
    mapWeb:
      "Ինտերակտիվ քարտեզը հասանելի է Android/iOS տարբերակում։ Web-ում լրացրու հասցեն ձեռքով։",
    providerMap: "MapLibre / OSM",
    mapNotConfigured:
      "Այս տարբերակում քարտեզը կարգավորված չէ։ Մուտքագրեք հասցեն ձեռքով, իսկ LOUSA-ն կստուգի առաքման գոտին։",
    serverNotConfigured:
      "Հասցեների ծառայությունը ժամանակավորապես անհասանելի է։ Սևագիրը պահպանված է հեռախոսում․ փորձեք ավելի ուշ։",
    zoneUnselected: "Հասցեն դեռ չի ստուգվել",
    zoneUnavailable: "Գոտին չի ստուգվել",
    zoneUnavailableBody:
      "Չհաջողվեց սերվերով հաստատել առաքման գոտին։ Առանց իրական ստուգման կանաչ կարգավիճակ չի ցուցադրվի։",
    saveUnavailable:
      "Հասցեների ծառայությունը ժամանակավորապես անհասանելի է։ Սևագիրը պահպանված է հեռախոսում․ փորձեք ավելի ուշ։",
    saveFailed: "Չհաջողվեց հասցեն պահպանել սերվերում։ Ստուգիր կապը և կրկնիր։",
    mapLoadFailed: "Չհաջողվեց բեռնել քարտեզը։",
    retry: "Կրկնել",
    openSettings: "Բացել կարգավորումները",
    draftRestored:
      "Չպահպանված հասցեն վերականգնվել է։ Ստուգիր տվյալները և կրկնիր պահպանումը։",
    addressChanged:
      "Փողոցը կամ տունը փոխվել է։ Ստուգիր քարտեզի կետը և կրկին հաստատիր գոտին։",
    recheckPoint: "Կետը ճիշտ է՝ ստուգել գոտին",
    pointRequired: "Նախ ընտրիր ճշգրիտ կետը քարտեզի վրա։",
  },
} as const;

function localizedCopy(language: SupportedLanguage) {
  return COPY[language];
}

function isNearArmenia(latitude: number, longitude: number) {
  return (
    latitude >= 38.5 && latitude <= 42.5 && longitude >= 43 && longitude <= 47.8
  );
}

type ZoneStatus = "idle" | "checking" | "verified" | "outside" | "unavailable";

function makeSessionToken() {
  try {
    return Crypto.randomUUID();
  } catch {
    return `map-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function AddressMapScreen() {
  const language = useUserStore((state) => state.language);
  const isGuestMode = useUserStore((state) => state.isGuestMode);
  const copy = COPY[language] || COPY.ru;
  if (isGuestMode) return <GuestAccountGate screenTitle={copy.title} />;
  return <AuthenticatedAddressMapScreen />;
}

function AuthenticatedAddressMapScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const userName = useUserStore((state) => state.name);
  const box = useBoxStore();
  const existing = box.deliveryAddress;
  const pickerSelection = useAddressPickerStore(
    (state) => state.confirmedSelection,
  );
  const openPicker = useAddressPickerStore((state) => state.openWith);
  const clearPickerSelection = useAddressPickerStore(
    (state) => state.clearConfirmed,
  );
  const copy = localizedCopy(language);
  const mapProvider = useMemo(() => getLousaMapProviderConfig(), []);
  const apiEnvironment = useMemo(() => checkApiEnvironment(), []);
  const realMapReady = shouldRenderInteractiveMap(mapProvider);
  const searchEnabled = realMapReady && apiEnvironment.isUsableOnDevice;
  const mapRef = useRef<LousaDeliveryMapHandle | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);
  const sessionToken = useRef(makeSessionToken());
  const draftAppliedRef = useRef(false);
  const mapHeight = width < 360 ? 238 : width < 400 ? 270 : 300;

  const initialCoordinate = existing
    ? { latitude: existing.latitude, longitude: existing.longitude }
    : GYUMRI_DELIVERY_CENTER;

  const [coordinate, setCoordinate] = useState(initialCoordinate);
  const [searchText, setSearchText] = useState(
    existing?.formattedAddress || "",
  );
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const initialVerifiedZone: DeliveryZoneTruth | null =
    existing?.validationStatus === "verified"
      ? {
          isAvailable: true,
          deliveryZoneId: existing.deliveryZoneId,
          distanceKm: 0,
          deliveryFeeMinor: 0,
          estimatedMinutes: existing.estimatedMinutes,
          availableSlots: [],
          reason: null,
          source: "backend",
          requiresManualReview: false,
        }
      : existing?.validationStatus === "outside_zone"
        ? {
            isAvailable: false,
            deliveryZoneId: null,
            distanceKm: 0,
            deliveryFeeMinor: null,
            estimatedMinutes: null,
            availableSlots: [],
            reason: "OUTSIDE_GYUMRI_DELIVERY_ZONE",
            source: "backend",
            requiresManualReview: false,
          }
        : null;
  const [zone, setZone] = useState<DeliveryZoneTruth | null>(
    initialVerifiedZone,
  );
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus>(
    existing?.validationStatus === "verified"
      ? "verified"
      : existing?.validationStatus === "outside_zone"
        ? "outside"
        : "idle",
  );

  const [baseAddress, setBaseAddress] = useState<GeocodedAddress>({
    provider:
      existing?.provider === "manual"
        ? "device"
        : existing?.provider || "device",
    providerPlaceId: existing?.providerPlaceId || null,
    formattedAddress: existing?.formattedAddress || "",
    country: existing?.country || "Armenia",
    region: existing?.region || "Shirak",
    city: existing?.city || "Gyumri",
    district: existing?.district || "",
    street: existing?.street || "",
    house: existing?.house || "",
    postalCode: existing?.postalCode || "",
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  });
  const [label, setLabel] = useState<DeliveryAddress["label"]>(
    existing?.label || "home",
  );
  const [addressType, setAddressType] = useState<DeliveryAddressType>(
    existing?.addressType ||
      (existing?.label === "work" ? "office" : "apartment"),
  );
  const [handoffType, setHandoffType] = useState<DeliveryHandoffType>(
    existing?.handoffType || "hand_to_recipient",
  );
  const [street, setStreet] = useState(existing?.street || "");
  const [house, setHouse] = useState(existing?.house || "");
  const [entrance, setEntrance] = useState(existing?.entrance || "");
  const [floor, setFloor] = useState(existing?.floor || "");
  const [apartment, setApartment] = useState(existing?.apartment || "");
  const [intercomCode, setIntercomCode] = useState(
    existing?.intercomCode || "",
  );
  const [instructions, setInstructions] = useState(
    existing?.instructions || box.deliveryNote || "",
  );
  const [recipientName, setRecipientName] = useState(
    existing?.recipientName || userName || "",
  );
  const [deliveryPhone, setDeliveryPhone] = useState(
    existing?.phone || box.phone || "",
  );
  const [companyName, setCompanyName] = useState(existing?.companyName || "");
  const [contactPerson, setContactPerson] = useState(
    existing?.contactPerson || "",
  );
  const [officeNumber, setOfficeNumber] = useState(
    existing?.officeNumber || "",
  );
  const [hotelName, setHotelName] = useState(existing?.hotelName || "");
  const [roomNumber, setRoomNumber] = useState(existing?.roomNumber || "");
  const [landmark, setLandmark] = useState(existing?.landmark || "");
  const [gateDetails, setGateDetails] = useState(existing?.gateDetails || "");
  const [leaveAtDoorLocation, setLeaveAtDoorLocation] = useState(
    existing?.leaveAtDoorLocation || "",
  );
  const [callOnArrival, setCallOnArrival] = useState(
    existing?.callOnArrival ?? true,
  );
  const [doNotKnock, setDoNotKnock] = useState(existing?.doNotKnock ?? false);
  const [photoConfirmation, setPhotoConfirmation] = useState(
    existing?.photoConfirmation ?? false,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [coordinateChosen, setCoordinateChosen] = useState(Boolean(existing));
  const [addressIdentityDirty, setAddressIdentityDirty] = useState(false);

  useEffect(() => {
    if (!recipientName.trim() && userName.trim())
      setRecipientName(userName.trim());
  }, [recipientName, userName]);

  useEffect(() => {
    if (!deliveryPhone.trim() && box.phone.trim())
      setDeliveryPhone(box.phone.trim());
  }, [box.phone, deliveryPhone]);

  useEffect(() => {
    if (existing || draftAppliedRef.current) return;
    draftAppliedRef.current = true;
    let cancelled = false;
    void loadDeliveryAddressDraft<DeliveryAddress>()
      .then((draft) => {
        if (!draft || cancelled) return;
        const restoredCoordinate = {
          latitude: draft.latitude,
          longitude: draft.longitude,
        };
        setCoordinate(restoredCoordinate);
        setCoordinateChosen(true);
        setAddressIdentityDirty(false);
        setBaseAddress({
          provider: draft.provider === "manual" ? "device" : draft.provider,
          providerPlaceId: draft.providerPlaceId,
          formattedAddress: draft.formattedAddress,
          country: draft.country,
          region: draft.region,
          city: draft.city,
          district: draft.district,
          street: draft.street,
          house: draft.house,
          postalCode: draft.postalCode,
          latitude: draft.latitude,
          longitude: draft.longitude,
        });
        setSearchText(draft.formattedAddress);
        setLabel(draft.label);
        setAddressType(draft.addressType || "apartment");
        setHandoffType(draft.handoffType || "hand_to_recipient");
        setStreet(draft.street);
        setHouse(draft.house);
        setEntrance(draft.entrance);
        setFloor(draft.floor);
        setApartment(draft.apartment);
        setIntercomCode(draft.intercomCode);
        setInstructions(draft.instructions);
        setRecipientName(draft.recipientName || "");
        setDeliveryPhone(draft.phone || "");
        setCompanyName(draft.companyName || "");
        setContactPerson(draft.contactPerson || "");
        setOfficeNumber(draft.officeNumber || "");
        setHotelName(draft.hotelName || "");
        setRoomNumber(draft.roomNumber || "");
        setLandmark(draft.landmark || "");
        setGateDetails(draft.gateDetails || "");
        setLeaveAtDoorLocation(draft.leaveAtDoorLocation || "");
        setCallOnArrival(draft.callOnArrival ?? true);
        setDoNotKnock(draft.doNotKnock ?? false);
        setPhotoConfirmation(draft.photoConfirmation ?? false);
        setZone(null);
        setZoneStatus("checking");
        setMessage(copy.draftRestored);
        mapRef.current?.animateToCoordinate(
          draft.latitude,
          draft.longitude,
          16,
        );
        void checkRealDeliveryZone(draft.latitude, draft.longitude)
          .then((truth) => {
            if (cancelled) return;
            setZone(truth);
            setZoneStatus(truth.isAvailable ? "verified" : "outside");
          })
          .catch(() => {
            if (cancelled) return;
            setZone(null);
            setZoneStatus("unavailable");
          });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [copy.draftRestored, existing]);

  const formattedAddress = useMemo(() => {
    const main = [street.trim(), house.trim()].filter(Boolean).join(" ");
    const locality = [baseAddress.city, baseAddress.region, baseAddress.country]
      .filter(Boolean)
      .join(", ");
    return (
      [main, locality].filter(Boolean).join(", ") ||
      baseAddress.formattedAddress
    );
  }, [
    baseAddress.city,
    baseAddress.country,
    baseAddress.formattedAddress,
    baseAddress.region,
    house,
    street,
  ]);

  const applyGeocodedAddress = (address: GeocodedAddress) => {
    setCoordinateChosen(true);
    setAddressIdentityDirty(false);
    setBaseAddress(address);
    setStreet(address.street || "");
    setHouse(address.house || "");
    setSearchText(address.formattedAddress);
    setCoordinate({ latitude: address.latitude, longitude: address.longitude });
  };

  useEffect(() => {
    if (!pickerSelection) return;
    applyGeocodedAddress(pickerSelection);
    clearPickerSelection();
    void resolveCoordinate(
      pickerSelection.latitude,
      pickerSelection.longitude,
      false,
    );
    // The picker selection is a one-shot handoff from the fullscreen map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerSelection]);

  const resolveCoordinate = async (
    latitude: number,
    longitude: number,
    animate = false,
  ) => {
    const sequence = ++requestSequence.current;
    setCoordinate({ latitude, longitude });
    setCoordinateChosen(true);
    setAddressIdentityDirty(false);
    setResolving(true);
    setZone(null);
    setZoneStatus("checking");
    setMessage(copy.resolving);
    setError("");
    if (animate) {
      mapRef.current?.animateToCoordinate(latitude, longitude, 16);
    }

    const [addressResult, zoneResult] = await Promise.allSettled([
      reverseGeocodeRealCoordinate(latitude, longitude, language),
      checkRealDeliveryZone(latitude, longitude),
    ]);

    if (sequence !== requestSequence.current) return;

    if (addressResult.status === "fulfilled") {
      applyGeocodedAddress(addressResult.value);
    } else {
      setBaseAddress((previous) => ({
        ...previous,
        latitude,
        longitude,
        formattedAddress: "",
      }));
    }

    if (zoneResult.status === "fulfilled") {
      setZone(zoneResult.value);
      setZoneStatus(zoneResult.value.isAvailable ? "verified" : "outside");
    } else {
      setZone(null);
      setZoneStatus("unavailable");
    }

    if (addressResult.status === "rejected") {
      setMessage(
        zoneResult.status === "rejected"
          ? copy.zoneUnavailableBody
          : copy.manualWarning,
      );
    } else if (zoneResult.status === "rejected") {
      setMessage(copy.zoneUnavailableBody);
    } else {
      setMessage("");
    }
    setResolving(false);
  };

  const handleMapPress = (latitude: number, longitude: number) => {
    void resolveCoordinate(latitude, longitude);
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setError("");
    if (!searchEnabled) {
      setPredictions([]);
      setSearching(false);
      setMessage(
        realMapReady ? copy.serverNotConfigured : copy.mapNotConfigured,
      );
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const items = await searchRealAddresses(
          value,
          language,
          sessionToken.current,
        );
        setPredictions(items);
        setMessage("");
      } catch {
        setPredictions([]);
        setMessage(copy.searchUnavailable);
      } finally {
        setSearching(false);
      }
    }, 420);
  };

  const selectPrediction = async (prediction: AddressPrediction) => {
    setPredictions([]);
    setSearchText(prediction.fullText);
    setResolving(true);
    setZone(null);
    setZoneStatus("checking");
    setMessage(copy.resolving);
    try {
      const detail = await getRealPlaceDetails(
        prediction.placeId,
        language,
        sessionToken.current,
      );
      applyGeocodedAddress(detail);
      mapRef.current?.animateToCoordinate(
        detail.latitude,
        detail.longitude,
        16,
      );
      try {
        const zoneResult = await checkRealDeliveryZone(
          detail.latitude,
          detail.longitude,
        );
        setZone(zoneResult);
        setZoneStatus(zoneResult.isAvailable ? "verified" : "outside");
        setMessage("");
      } catch {
        setZone(null);
        setZoneStatus("unavailable");
        setMessage(copy.zoneUnavailableBody);
      }
      sessionToken.current = makeSessionToken();
    } catch {
      setZone(null);
      setZoneStatus("unavailable");
      setMessage(copy.searchUnavailable);
    } finally {
      setResolving(false);
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    setLocationBlocked(false);
    setMessage(copy.locating);
    setError("");
    try {
      const location = await requestCurrentDeviceLocation();
      if (!isNearArmenia(location.latitude, location.longitude)) {
        setMessage(
          language === "en"
            ? "You seem to be outside Armenia. Choose a delivery address in Armenia manually."
            : language === "hy"
              ? "Կարծես Հայաստանից դուրս ես։ Ընտրիր առաքման հասցե Հայաստանում ձեռքով։"
              : "Похоже, ты вне Армении. Выбери адрес доставки в Армении вручную.",
        );
        mapRef.current?.animateToCoordinate(
          INITIAL_REGION.latitude,
          INITIAL_REGION.longitude,
          13,
        );
        setCoordinate(GYUMRI_DELIVERY_CENTER);
        return;
      }
      await resolveCoordinate(location.latitude, location.longitude, true);
    } catch (cause) {
      const code = (cause as Error & { code?: string }).code;
      setLocationBlocked(code === "LOCATION_PERMISSION_BLOCKED");
      setMessage(
        code === "LOCATION_SERVICES_DISABLED"
          ? copy.locationDisabled
          : copy.permissionDenied,
      );
    } finally {
      setLocating(false);
    }
  };

  const handleManualAddressIdentityChange = (
    field: "street" | "house",
    value: string,
  ) => {
    if (field === "street") setStreet(value);
    else setHouse(value);
    setAddressIdentityDirty(true);
    setZone(null);
    setZoneStatus("idle");
    setError("");
    setMessage(copy.addressChanged);
  };

  const recheckManualAddressPoint = async () => {
    setError("");
    if (!coordinateChosen) {
      setError(copy.pointRequired);
      return;
    }
    setZone(null);
    setZoneStatus("checking");
    setMessage(copy.checking);
    try {
      const truth = await checkRealDeliveryZone(
        coordinate.latitude,
        coordinate.longitude,
      );
      setZone(truth);
      setZoneStatus(truth.isAvailable ? "verified" : "outside");
      setAddressIdentityDirty(false);
      setMessage("");
    } catch {
      setZone(null);
      setZoneStatus("unavailable");
      setMessage(copy.zoneUnavailableBody);
    }
  };

  const confirmAddress = async () => {
    setError("");
    const requiredFields: Array<[string, string]> = [
      [recipientName, copy.recipient],
      [deliveryPhone, copy.phone],
      [street, copy.street],
      [house, copy.house],
    ];
    if (addressType === "apartment") requiredFields.push([apartment, copy.apartment]);
    if (addressType === "office" || addressType === "workplace") requiredFields.push([officeNumber, copy.officeNumber]);
    if (addressType === "hotel") requiredFields.push([hotelName, copy.hotelName], [roomNumber, copy.roomNumber]);
    const missingField = requiredFields.find(([value]) => !value.trim())?.[1];
    if (missingField) {
      if (!recipientName.trim() || !deliveryPhone.trim()) {
        setError(copy.contactRequired);
        return;
      }
      setError(copy.missingField(missingField));
      return;
    }
    if (!coordinateChosen) {
      setError(copy.pointRequired);
      return;
    }
    if (addressIdentityDirty) {
      setError(copy.addressChanged);
      return;
    }
    if (zoneStatus === "outside" || (zone && !zone.isAvailable)) {
      setError(copy.zoneRequired);
      return;
    }
    if (
      zoneStatus !== "verified" ||
      !zone ||
      zone.source !== "backend" ||
      !zone.isAvailable
    ) {
      setError(copy.zoneUnavailableBody);
      return;
    }
    if (!apiEnvironment.isUsableOnDevice) {
      setError(copy.saveUnavailable);
      return;
    }

    const now = new Date().toISOString();
    const address: DeliveryAddress = {
      id: existing?.id || `address-${Date.now()}`,
      userId: existing?.userId || null,
      label,
      addressType,
      handoffType,
      country: baseAddress.country,
      region: baseAddress.region,
      city: baseAddress.city || "Gyumri",
      district: baseAddress.district,
      street: street.trim(),
      house: house.trim(),
      entrance: entrance.trim(),
      floor: floor.trim(),
      apartment: apartment.trim(),
      postalCode: baseAddress.postalCode,
      intercomCode: intercomCode.trim(),
      instructions: instructions.trim(),
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      officeNumber: officeNumber.trim(),
      hotelName: hotelName.trim(),
      roomNumber: roomNumber.trim(),
      landmark: landmark.trim(),
      gateDetails: gateDetails.trim(),
      leaveAtDoorLocation: leaveAtDoorLocation.trim(),
      callOnArrival,
      doNotKnock,
      photoConfirmation,
      recipientName: recipientName.trim(),
      phone: deliveryPhone.trim(),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      formattedAddress,
      provider: baseAddress.provider,
      providerPlaceId: baseAddress.providerPlaceId,
      fieldOrigins: {
        ...(baseAddress.fieldOrigins || {}),
        street: street.trim() === baseAddress.street ? (baseAddress.fieldOrigins?.street || 'provider_confirmed') : 'user_entered',
        house: house.trim() === baseAddress.house ? (baseAddress.fieldOrigins?.house || 'provider_confirmed') : 'user_entered',
      },
      deliveryZoneId: zone.deliveryZoneId,
      deliveryFeeMinor: 0,
      estimatedMinutes: zone.estimatedMinutes,
      validationStatus: "verified",
      deliveryIncludedInPlan: true,
      planCode: box.planId || "comfort",
      zoneVerifiedAt: new Date().toISOString(),
      syncStatus: "pending",
      isDefault: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setSaving(true);
    try {
      const savedAddress = await saveDeliveryAddressRemote(
        address,
        Boolean(existing?.userId),
      );
      box.setDeliveryAddress({
        ...savedAddress,
        syncStatus: "synced",
        deliveryIncludedInPlan: true,
        deliveryFeeMinor: 0,
      });
      await clearDeliveryAddressDraft();
      router.back();
    } catch {
      await saveDeliveryAddressDraft({
        ...address,
        updatedAt: new Date().toISOString(),
      });
      setError(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const labelChoices: { value: DeliveryAddress["label"]; label: string }[] = [
    { value: "home", label: copy.home },
    { value: "work", label: copy.work },
    { value: "other", label: copy.other },
  ];

  const addressTypeChoices: { value: DeliveryAddressType; label: string }[] = [
    { value: "apartment", label: copy.apartmentType },
    { value: "private_house", label: copy.privateHouseType },
    { value: "office", label: copy.officeType },
    { value: "workplace", label: copy.workplaceType },
    { value: "hotel", label: copy.hotelType },
    { value: "other", label: copy.otherType },
  ];
  const handoffChoices: { value: DeliveryHandoffType; label: string }[] = [
    { value: "hand_to_recipient", label: copy.handToRecipient },
    { value: "leave_at_door", label: copy.leaveAtDoor },
    { value: "leave_with_reception", label: copy.leaveReception },
    { value: "leave_with_security", label: copy.leaveSecurity },
    { value: "call_on_arrival", label: copy.callArrival },
    { value: "other", label: copy.handoffOther },
  ];

  const zoneLabel =
    zoneStatus === "checking"
      ? copy.checking
      : zoneStatus === "verified"
        ? copy.available
        : zoneStatus === "outside"
          ? copy.outside
          : zoneStatus === "unavailable"
            ? copy.zoneUnavailable
            : copy.zoneUnselected;
  const zoneTone =
    zoneStatus === "verified"
      ? "success"
      : zoneStatus === "outside"
        ? "warning"
        : "neutral";

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.screenContent,
            { paddingBottom: 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
        >
          <View style={styles.header}>
            <IconButton
              icon="arrow_back"
              label={language === "ru" ? "Назад" : language === "hy" ? "Հետ" : "Back"}
              onPress={() => router.back()}
            />
            <View style={styles.headerText}>
              <Text
                style={[
                  styles.title,
                  width < 380 && styles.titleCompact,
                  { color: colors.onBackground },
                ]}
              >
                {copy.title}
              </Text>
              <Text
                style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
              >
                {realMapReady ? copy.subtitle : copy.mapNotConfigured}
              </Text>
              {!apiEnvironment.isUsableOnDevice ? (
                <Text style={styles.setupWarning}>
                  {copy.serverNotConfigured}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.mapArea, { height: mapHeight }]}>
            <LousaMapLibreAddressMap
              key={mapInstanceKey}
              ref={mapRef}
              latitude={coordinate.latitude}
              longitude={coordinate.longitude}
              height={mapHeight}
              interactive
              dark={isDark}
              initialZoom={15}
              onExpand={() => {
                openPicker({
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                  formattedAddress,
                });
                router.push("/screens/address-map-picker");
              }}
              expandLabel={copy.openMap}
              label={formattedAddress || copy.addressDetails}
              onSelectCoordinate={handleMapPress}
              onMapReady={() => {
                setMapReady(true);
                setMapError("");
              }}
              onMapError={(nextError) => {
                setMapReady(false);
                setMapError(nextError || "MAP_LOAD_FAILED");
              }}
              loadingText={
                !mapReady && !mapError
                  ? language === "en"
                    ? "Loading LOUSA map…"
                    : language === "hy"
                      ? "LOUSA քարտեզը բեռնվում է…"
                      : "Загружаем карту LOUSA…"
                  : undefined
              }
              unavailableText={copy.mapNotConfigured}
            />

            {searchEnabled ? (
              <View style={[styles.searchWrap, { top: 12 }]}>
                <View
                  style={[
                    styles.searchBox,
                    { backgroundColor: isDark ? "#251F28" : "#FFFDFE" },
                  ]}
                >
                  <MaterialSymbol
                    name="search"
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                  <TextInput
                    value={searchText}
                    onChangeText={handleSearchChange}
                    placeholder={copy.search}
                    placeholderTextColor={colors.outline}
                    style={[styles.searchInput, { color: colors.onBackground }]}
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {searching || resolving ? (
                    <ActivityIndicator
                      size="small"
                      color={LousaPalette.berry}
                    />
                  ) : null}
                </View>
                {predictions.length ? (
                  <SurfaceCard padding={0} style={styles.predictionsCard}>
                    {predictions.map((item, index) => (
                      <Pressable
                        key={item.placeId}
                        onPress={() => void selectPrediction(item)}
                        style={[
                          styles.predictionRow,
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
                            style={[
                              styles.predictionPrimary,
                              { color: colors.onBackground },
                            ]}
                            numberOfLines={1}
                          >
                            {item.primaryText}
                          </Text>
                          <Text
                            style={[
                              styles.predictionSecondary,
                              { color: colors.onSurfaceVariant },
                            ]}
                            numberOfLines={2}
                          >
                            {item.secondaryText}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </SurfaceCard>
                ) : null}
              </View>
            ) : null}

            {realMapReady && !mapReady && !mapError && Platform.OS !== "web" ? (
              <View pointerEvents="none" style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="small" color={LousaPalette.berry} />
                <Text style={styles.mapLoadingText}>
                  {language === "en"
                    ? "Loading LOUSA map…"
                    : language === "hy"
                      ? "LOUSA քարտեզը բեռնվում է…"
                      : "Загружаем карту LOUSA…"}
                </Text>
              </View>
            ) : null}
            {mapError ? (
              <View style={styles.mapErrorOverlay}>
                <MaterialSymbol
                  name="map"
                  size={26}
                  color={LousaPalette.berry}
                />
                <Text style={styles.mapErrorText}>{copy.mapLoadFailed}</Text>
                <SecondaryButton
                  label={copy.retry}
                  compact
                  fullWidth={false}
                  onPress={() => {
                    setMapError("");
                    setMapReady(false);
                    setMapInstanceKey((value) => value + 1);
                  }}
                />
              </View>
            ) : null}
            {realMapReady ? (
              <PressScale
                onPress={() => void handleUseMyLocation()}
                style={[
                  styles.locationButton,
                  { backgroundColor: colors.surface },
                ]}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={LousaPalette.berry} />
                ) : (
                  <MaterialSymbol
                    name="my_location"
                    size={22}
                    color={LousaPalette.berry}
                  />
                )}
              </PressScale>
            ) : null}
          </View>

          {realMapReady ? (
            <SecondaryButton
              label={copy.openMap}
              icon="open_in_full"
              iconPlacement="left"
              onPress={() => {
                openPicker({
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                  formattedAddress,
                });
                router.push("/screens/address-map-picker");
              }}
            />
          ) : null}

          {message ? (
            <View
              style={[
                styles.message,
                {
                  backgroundColor: isDark
                    ? "rgba(217,133,165,0.12)"
                    : "#FAEAF0",
                },
              ]}
            >
              {resolving || locating ? (
                <ActivityIndicator size="small" color={LousaPalette.berry} />
              ) : (
                <MaterialSymbol
                  name="info"
                  size={18}
                  color={LousaPalette.berry}
                />
              )}
              <Text
                style={[styles.messageText, { color: colors.onSurfaceVariant }]}
              >
                {message}
              </Text>
              {locationBlocked ? (
                <PressScale
                  onPress={() => void Linking.openSettings()}
                  style={styles.settingsButton}
                >
                  <Text style={styles.settingsButtonText}>
                    {copy.openSettings}
                  </Text>
                </PressScale>
              ) : null}
            </View>
          ) : null}

          <SectionSurface>
            <View style={styles.zoneHead}>
              <View style={styles.flex}>
                <Text
                  style={[styles.sectionTitle, { color: colors.onBackground }]}
                >
                  {copy.addressDetails}
                </Text>
                <Text
                  style={[
                    styles.formattedAddress,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {formattedAddress || baseAddress.formattedAddress || "—"}
                </Text>
              </View>
              <StatusPill label={zoneLabel} tone={zoneTone} />
            </View>
            {zoneStatus === "verified" && zone?.isAvailable ? (
              <View style={styles.zoneMeta}>
                <View style={styles.includedDeliveryRow}>
                  <MaterialSymbol
                    name="check_circle"
                    size={18}
                    color={LousaPalette.success}
                  />
                  <Text
                    style={[
                      styles.zoneMetaText,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {copy.included}
                  </Text>
                </View>
                {zone.estimatedMinutes ? (
                  <Text
                    style={[
                      styles.zoneMetaText,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {copy.eta}: {zone.estimatedMinutes} {copy.minutes}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.twoColumns}>
              <Field
                label={copy.recipient}
                value={recipientName}
                onChangeText={setRecipientName}
                flex={1.25}
              />
              <Field
                label={copy.phone}
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                flex={1}
                keyboardType="phone-pad"
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>
              {copy.label}
            </Text>
            <View style={styles.labelRow}>
              {labelChoices.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  selected={label === item.value}
                  onPress={() => setLabel(item.value)}
                />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>
              {copy.addressType}
            </Text>
            <View style={styles.labelRow}>
              {addressTypeChoices.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  selected={addressType === item.value}
                  onPress={() => setAddressType(item.value)}
                />
              ))}
            </View>

            <View style={styles.twoColumns}>
              <Field
                label={copy.street}
                value={street}
                onChangeText={(value) =>
                  handleManualAddressIdentityChange("street", value)
                }
                flex={2}
              />
              <Field
                label={copy.house}
                value={house}
                onChangeText={(value) =>
                  handleManualAddressIdentityChange("house", value)
                }
                flex={1}
              />
            </View>
            {addressIdentityDirty ? (
              <View style={styles.addressRecheckCard}>
                <MaterialSymbol
                  name="warning"
                  size={19}
                  color={LousaPalette.warning}
                />
                <Text
                  style={[
                    styles.addressRecheckText,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {copy.addressChanged}
                </Text>
                <SecondaryButton
                  label={copy.recheckPoint}
                  compact
                  fullWidth={false}
                  onPress={() => void recheckManualAddressPoint()}
                />
              </View>
            ) : null}
            {addressType === "apartment" ? (
              <>
                <View style={styles.twoColumns}>
                  <Field
                    label={copy.entrance}
                    value={entrance}
                    onChangeText={setEntrance}
                    flex={1}
                  />
                  <Field
                    label={copy.floor}
                    value={floor}
                    onChangeText={setFloor}
                    flex={1}
                    keyboardType="number-pad"
                  />
                  <Field
                    label={copy.apartment}
                    value={apartment}
                    onChangeText={setApartment}
                    flex={1}
                  />
                </View>
                <Field
                  label={copy.intercom}
                  value={intercomCode}
                  onChangeText={setIntercomCode}
                />
              </>
            ) : null}
            {addressType === "private_house" ? (
              <>
                <Field
                  label={copy.landmark}
                  value={landmark}
                  onChangeText={setLandmark}
                />
                <Field
                  label={copy.gateDetails}
                  value={gateDetails}
                  onChangeText={setGateDetails}
                />
              </>
            ) : null}
            {addressType === "office" || addressType === "workplace" ? (
              <>
                <Field
                  label={copy.company}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
                <View style={styles.twoColumns}>
                  <Field
                    label={copy.floor}
                    value={floor}
                    onChangeText={setFloor}
                    keyboardType="number-pad"
                  />
                  <Field
                    label={copy.officeNumber}
                    value={officeNumber}
                    onChangeText={setOfficeNumber}
                  />
                </View>
                <Field
                  label={copy.contact}
                  value={contactPerson}
                  onChangeText={setContactPerson}
                />
              </>
            ) : null}
            {addressType === "hotel" ? (
              <>
                <Field
                  label={copy.hotelName}
                  value={hotelName}
                  onChangeText={setHotelName}
                />
                <View style={styles.twoColumns}>
                  <Field
                    label={copy.roomNumber}
                    value={roomNumber}
                    onChangeText={setRoomNumber}
                  />
                  <Field
                    label={copy.contact}
                    value={contactPerson}
                    onChangeText={setContactPerson}
                  />
                </View>
              </>
            ) : null}
            {addressType === "other" ? (
              <Field
                label={copy.landmark}
                value={landmark}
                onChangeText={setLandmark}
              />
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>
              {copy.handoff}
            </Text>
            <View style={styles.labelRow}>
              {handoffChoices.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  selected={handoffType === item.value}
                  onPress={() => setHandoffType(item.value)}
                />
              ))}
            </View>
            {handoffType === "leave_at_door" ? (
              <>
                <Field
                  label={copy.leaveLocation}
                  value={leaveAtDoorLocation}
                  onChangeText={setLeaveAtDoorLocation}
                />
                <View style={styles.deliveryOptions}>
                  <BooleanOption
                    label={copy.callBefore}
                    value={callOnArrival}
                    onPress={() => setCallOnArrival((value) => !value)}
                  />
                  <BooleanOption
                    label={copy.doNotKnock}
                    value={doNotKnock}
                    onPress={() => setDoNotKnock((value) => !value)}
                  />
                  <BooleanOption
                    label={copy.photoProof}
                    value={photoConfirmation}
                    onPress={() => setPhotoConfirmation((value) => !value)}
                  />
                </View>
              </>
            ) : null}
            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>
              {copy.note}
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder={copy.notePlaceholder}
              placeholderTextColor={colors.outline}
              multiline
              style={[
                styles.input,
                styles.textArea,
                {
                  color: colors.onBackground,
                  borderColor: colors.outlineVariant,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "#FCF8FA",
                },
              ]}
            />
          </SectionSurface>

        </ScrollView>
        {error ? (
          <View style={styles.footerMessage}>
            <InlineMessage body={error} tone="danger" />
          </View>
        ) : null}
        <StickyBottomAction
          primaryLabel={copy.confirm}
          primaryIcon="location_on"
          primaryLoading={saving}
          onPrimary={() => void confirmAddress()}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BooleanOption({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return <CheckboxRow label={label} checked={value} onPress={onPress} />;
}

function Field({
  label,
  value,
  onChangeText,
  flex = 1,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  flex?: number;
  keyboardType?: "default" | "number-pad" | "phone-pad";
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex, minWidth: 82 }}>
      <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.outline}
        style={[
          styles.input,
          {
            color: colors.onBackground,
            borderColor: colors.outlineVariant,
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FCF8FA",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  screenContent: { paddingHorizontal: 14, paddingTop: 6, gap: 12 },
  footerMessage: { paddingHorizontal: 20, paddingTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "sans-serif-medium",
    fontSize: 24,
    lineHeight: 29,
    flexShrink: 1,
  },
  titleCompact: { fontSize: 21, lineHeight: 26 },
  subtitle: {
    fontFamily: "sans-serif",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  setupWarning: {
    color: LousaPalette.danger,
    fontFamily: "sans-serif-medium",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 5,
  },
  mapArea: {
    width: "100%",
    borderRadius: 28,
    overflow: "visible",
    backgroundColor: "transparent",
    zIndex: 5,
  },
  searchWrap: { position: "absolute", left: 12, right: 12, zIndex: 20 },
  searchBox: {
    height: 50,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    shadowColor: "#2B1F27",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInput: { flex: 1, height: 50, fontFamily: "sans-serif", fontSize: 14 },
  predictionsCard: {
    marginTop: 7,
    maxHeight: 210,
    overflow: "hidden",
    zIndex: 30,
  },
  predictionRow: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  predictionPrimary: { fontFamily: "sans-serif-medium", fontSize: 13 },
  predictionSecondary: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  locationButton: {
    position: "absolute",
    right: 14,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B1F27",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(247,240,242,0.72)",
  },
  mapLoadingText: {
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    color: LousaPalette.inkSoft,
  },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(251,244,247,0.94)",
    padding: 20,
  },
  mapErrorText: {
    color: LousaPalette.ink,
    fontFamily: "sans-serif-medium",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LousaPalette.berry,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: "sans-serif-medium",
    fontSize: 13,
  },
  openMapButton: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  openMapButtonText: {
    color: LousaPalette.berry,
    fontFamily: "sans-serif-medium",
    fontSize: 13,
  },
  message: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
  },
  messageText: {
    flex: 1,
    minWidth: 190,
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 17,
  },
  settingsButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LousaPalette.berry,
  },
  settingsButtonText: {
    color: "#FFFFFF",
    fontFamily: "sans-serif-medium",
    fontSize: 11.5,
  },
  zoneHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: { fontFamily: "sans-serif-medium", fontSize: 18 },
  formattedAddress: {
    fontFamily: "sans-serif",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  zoneMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LousaPalette.line,
  },
  includedDeliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
    minWidth: 220,
  },
  zoneMetaText: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    lineHeight: 17,
  },
  fieldLabel: {
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    marginTop: 14,
    marginBottom: 6,
  },
  labelRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  labelChip: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  labelChipText: { fontFamily: "sans-serif-medium", fontSize: 12 },
  deliveryOptions: { gap: 8, marginTop: 8 },
  booleanOption: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  booleanCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  booleanText: { flex: 1, fontFamily: "sans-serif-medium", fontSize: 12 },
  twoColumns: { flexDirection: "row", gap: 9, flexWrap: "wrap" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    fontFamily: "sans-serif",
    fontSize: 13.5,
  },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  addressRecheckCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    gap: 9,
    backgroundColor: "#FFF7E8",
    borderWidth: 1,
    borderColor: "#E9C98E",
  },
  addressRecheckText: {
    fontFamily: "sans-serif",
    fontSize: 12.5,
    lineHeight: 18,
  },
  addressRecheckButton: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: LousaPalette.plum,
  },
  addressRecheckButtonText: {
    color: "#FFFFFF",
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
  },
  error: {
    color: LousaPalette.danger,
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
});
