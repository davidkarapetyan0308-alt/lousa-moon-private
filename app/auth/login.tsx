import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { useUserStore } from "../../src/store";
import { LousaPalette, LousaShadow } from "../../src/theme/designSystem";
import { PressScale } from "../../src/components/ui";
import { useTranslation } from "../../src/utils/i18n";
import { getAuthProviderMode, getServiceMode, services } from "../../src/services";
import { signInWithNativeGoogle } from "../../src/services/nativeGoogleSignIn";
import { PremiumAuthShell } from "../../src/features/auth/components/PremiumAuthShell";
import { getAuthBackTarget } from "../../src/features/auth/services/authFlow";
import { getUserFacingErrorMessage } from "../../src/services/errorMessages";

type AuthMode =
  | "welcome"
  | "signin"
  | "signup"
  | "verify"
  | "success"
  | "recovery"
  | "phone"
  | "verifyPhone"
  | "recoveryCode"
  | "reset"
  | "resetSuccess";

type Language = "ru" | "en" | "hy";

const COPY = {
  ru: {
    tagline: "LOUSA Moon",
    welcomeBody:
      "Календарь цикла, личные заметки и LOUSA BOX — спокойно, приватно и без лишнего шума.",
    create: "Создать профиль",
    haveAccount: "У меня уже есть аккаунт",
    continueGoogle: "Продолжить с Google",
    continuePhone: "Продолжить по номеру телефона",
    phoneTitle: "Вход по номеру",
    phoneBody: "Мы отправим одноразовый код. Для Армении используйте +374.",
    phone: "Номер телефона",
    sendPhoneCode: "Получить SMS-код",
    verifyPhoneTitle: "Введите SMS-код",
    verifyPhoneBody: "Код отправлен на",
    changePhone: "Изменить номер",
    phoneError: "Введите номер в формате +374XXXXXXXX",
    phoneOtpInvalid: "Код неверный или истёк.",
    phoneDevNotice: "Dev-режим: SMS-провайдер не настроен, поэтому код показан здесь:",
    smsProviderRequired: "SMS-вход не настроен для этой сборки. Используйте email или настройте SMS_PROVIDER.",
    continueApple: "Продолжить с Apple",
    terms:
      "Продолжая, вы принимаете Условия использования и Политику конфиденциальности.",
    signInTitle: "Вход в LOUSA",
    signInBody: "Продолжите там, где остановились.",
    signUpTitle: "Профиль LOUSA",
    signUpBody:
      "Для записей, настроек и заказов LOUSA BOX — спокойно и приватно.",
    name: "Имя",
    email: "Электронная почта",
    password: "Пароль",
    repeatPassword: "Повторите пароль",
    forgot: "Не помните пароль?",
    signIn: "Войти",
    continue: "Создать профиль",
    noAccount: "Нет аккаунта? Создать профиль",
    already: "Уже есть аккаунт? Войти",
    otherWay: "или продолжить через",
    privacy:
      "Курьер видит только информацию для доставки. Данные цикла остаются приватными.",
    emailError: "Проверь адрес электронной почты",
    nameError: "Укажите имя",
    passwordError: "Минимум 8 символов, одна заглавная буква и одна цифра",
    repeatError: "Пароли не совпадают",
    accountExists: "Аккаунт с такой электронной почтой уже существует.",
    signInExisting: "Войти в существующий аккаунт",
    verifyTitle: "Проверь почту",
    verifyBody: "Мы отправили шестизначный код на",
    verifyFirebaseBody: "Мы отправили ссылку подтверждения на",
    verifyFirebaseAction: "Я подтвердил email",
    verificationPending: "Email пока не подтверждён. Открой письмо Firebase, нажми ссылку и вернись сюда.",
    verify: "Подтвердить",
    resend: "Отправить код повторно",
    changeEmail: "Изменить email",
    codeError: "Введите шестизначный код",
    readyTitle: "Аккаунт готов",
    readyBody:
      "Теперь можно настроить цикл, чтобы LOUSA строила осторожный прогноз только на основе ваших данных.",
    setupCycle: "Настроить цикл",
    later: "Позже",
    recoveryTitle: "Восстановление пароля",
    recoveryBody:
      "Укажите email, связанный с аккаунтом. Мы отправим код подтверждения.",
    getCode: "Получить код",
    recoveryCodeTitle: "Введите код",
    recoveryCodeBody: "Шестизначный код отправлен на",
    resetTitle: "Новый пароль",
    resetBody: "Создайте новый надёжный пароль для аккаунта.",
    savePassword: "Сохранить пароль",
    resetSuccessTitle: "Проверьте почту",
    resetSuccessBody: "Если аккаунт существует, LOUSA отправила письмо для восстановления пароля.",
    backToSignIn: "Войти в аккаунт",
    passwordRule1: "Минимум 8 символов",
    passwordRule2: "Одна заглавная буква",
    passwordRule3: "Одна цифра",
    oauthTitle: "Вход через Google",
    oauthBody:
      "Используй свой Google-аккаунт для быстрого и безопасного входа.",
    googleServerRequired:
      "Сервис входа временно недоступен. Проверь подключение и попробуй снова.",
    googlePlayServicesUnavailable:
      "На устройстве недоступны или устарели сервисы Google Play. Используй вход по email.",
    googleCancelled: "Вход через Google отменён.",
    googleTokenMissing: "Google не вернул токен входа. Попробуй ещё раз.",
    googleFailed: "Не удалось войти через Google.",
    codeHint: "Код действует 10 минут.",
    devCodeNotice: "Dev-режим: email-провайдер не настроен, поэтому код показан здесь:",
    devEmailNotice: "В development код также напечатан в консоли backend API.",
    invalidCode: "Неверный или просроченный код.",
  },
  en: {
    tagline: "LOUSA Moon",
    welcomeBody:
      "A private place for cycle tracking, self-care and your LOUSA BOX.",
    create: "Create account",
    haveAccount: "I already have an account",
    continueGoogle: "Continue with Google",
    continuePhone: "Continue with phone number",
    phoneTitle: "Phone sign-in",
    phoneBody: "We will send a one-time code. Armenia numbers can start with +374.",
    phone: "Phone number",
    sendPhoneCode: "Get SMS code",
    verifyPhoneTitle: "Enter SMS code",
    verifyPhoneBody: "The code was sent to",
    changePhone: "Change phone",
    phoneError: "Enter a phone number like +374XXXXXXXX",
    phoneOtpInvalid: "The code is invalid or expired.",
    phoneDevNotice: "Dev mode: SMS delivery is not configured, so the code is shown here:",
    smsProviderRequired: "Phone sign-in is not configured for this build. Use email or configure SMS_PROVIDER.",
    continueApple: "Continue with Apple",
    terms: "By continuing, you agree to the Terms of Use and Privacy Policy.",
    signInTitle: "Sign in to LOUSA",
    signInBody: "Continue where you left off.",
    signUpTitle: "LOUSA profile",
    signUpBody:
      "For your notes, settings and LOUSA BOX orders — calm and private.",
    name: "Name",
    email: "Email address",
    password: "Password",
    repeatPassword: "Repeat password",
    forgot: "Can’t remember your password?",
    signIn: "Sign in",
    continue: "Continue",
    noAccount: "No account? Create one",
    already: "Already have an account? Sign in",
    otherWay: "or continue with",
    privacy:
      "Cycle data is never shared with the courier. They only see delivery details.",
    emailError: "Check your email address",
    nameError: "Enter your name",
    passwordError: "Use 8+ characters, one uppercase letter and one number",
    repeatError: "Passwords do not match",
    accountExists: "An account with this email already exists.",
    signInExisting: "Sign in to the existing account",
    verifyTitle: "Check your inbox",
    verifyBody: "We sent a six-digit code to",
    verifyFirebaseBody: "We sent a verification link to",
    verifyFirebaseAction: "I verified my email",
    verificationPending: "Your email is not verified yet. Open the Firebase email, follow the link, then return here.",
    verify: "Verify",
    resend: "Send code again",
    changeEmail: "Change email",
    codeError: "Enter the six-digit code",
    readyTitle: "Your account is ready",
    readyBody:
      "Now set up your cycle so LOUSA can prepare a personal forecast.",
    setupCycle: "Set up cycle",
    later: "Do it later",
    recoveryTitle: "Reset password",
    recoveryBody:
      "Enter the email connected to your account. We will send a verification code.",
    getCode: "Get code",
    recoveryCodeTitle: "Enter the code",
    recoveryCodeBody: "A six-digit code was sent to",
    resetTitle: "New password",
    resetBody: "Create a new secure password for your account.",
    savePassword: "Save password",
    resetSuccessTitle: "Check your inbox",
    resetSuccessBody: "If the account exists, LOUSA sent a password reset email.",
    backToSignIn: "Sign in",
    passwordRule1: "at least 8 characters",
    passwordRule2: "one uppercase letter",
    passwordRule3: "one number",
    oauthTitle: "Google sign-in",
    oauthBody: "Use your Google account for a fast and secure sign-in.",
    googleServerRequired:
      "The sign-in service is temporarily unavailable. Check your connection and try again.",
    googlePlayServicesUnavailable:
      "Google Play Services are unavailable or out of date. Use email sign-in instead.",
    googleCancelled: "Google sign-in was cancelled.",
    googleTokenMissing:
      "Google did not return a sign-in token. Please try again.",
    googleFailed: "Google sign-in failed.",
    codeHint: "The code is valid for 10 minutes.",
    devCodeNotice: "Dev mode: email delivery is not configured, so the code is shown here:",
    devEmailNotice: "In development, the code is also printed in the backend API console.",
    invalidCode: "The code is invalid or expired.",
  },
  hy: {
    tagline: "LOUSA Moon",
    welcomeBody:
      "Անձնական տարածք՝ ցիկլին հետևելու, ինքնախնամքի և LOUSA BOX-ի համար։",
    create: "Ստեղծել հաշիվ",
    haveAccount: "Ես արդեն ունեմ հաշիվ",
    continueGoogle: "Շարունակել Google-ով",
    continuePhone: "Շարունակել հեռախոսահամարով",
    phoneTitle: "Մուտք հեռախոսահամարով",
    phoneBody: "Մենք կուղարկենք մեկանգամյա կոդ։ Հայաստանի համար օգտագործեք +374։",
    phone: "Հեռախոսահամար",
    sendPhoneCode: "Ստանալ SMS կոդը",
    verifyPhoneTitle: "Մուտքագրեք SMS կոդը",
    verifyPhoneBody: "Կոդն ուղարկվել է",
    changePhone: "Փոխել համարը",
    phoneError: "Մուտքագրեք համար +374XXXXXXXX ձևաչափով",
    phoneOtpInvalid: "Կոդը սխալ է կամ ժամկետանց։",
    phoneDevNotice: "Dev ռեժիմ․ SMS-ը կարգավորված չէ, կոդը ցուցադրվում է այստեղ․",
    smsProviderRequired: "Հեռախոսով մուտքը կարգավորված չէ այս build-ում։",
    continueApple: "Շարունակել Apple-ով",
    terms:
      "Շարունակելով՝ ընդունում եք Օգտագործման պայմանները և Գաղտնիության քաղաքականությունը։",
    signInTitle: "Բարի վերադարձ",
    signInBody: "Մուտք գործեք՝ ինքնախնամքը շարունակելու համար։",
    signUpTitle: "LOUSA պրոֆիլ",
    signUpBody:
      "Ձեր գրառումների, կարգավորումների և LOUSA BOX պատվերների համար։",
    name: "Անուն",
    email: "Էլ․ փոստ",
    password: "Գաղտնաբառ",
    repeatPassword: "Կրկնել գաղտնաբառը",
    forgot: "Մոռացե՞լ եք գաղտնաբառը",
    signIn: "Մուտք գործել",
    continue: "Շարունակել",
    noAccount: "Չունե՞ք հաշիվ։ Ստեղծել",
    already: "Արդեն ունե՞ք հաշիվ։ Մուտք",
    otherWay: "կամ շարունակել",
    privacy:
      "Ցիկլի տվյալները չեն փոխանցվում առաքիչին։ Նա տեսնում է միայն առաքման տվյալները։",
    emailError: "Ստուգեք էլ․ փոստի հասցեն",
    nameError: "Մուտքագրեք անունը",
    passwordError: "Առնվազն 8 նիշ, մեկ մեծատառ և մեկ թիվ",
    repeatError: "Գաղտնաբառերը չեն համընկնում",
    accountExists: "Այս էլ․ փոստով հաշիվ արդեն գոյություն ունի։",
    signInExisting: "Մուտք գործել գոյություն ունեցող հաշիվ",
    verifyTitle: "Ստուգեք փոստը",
    verifyBody: "Վեցանիշ կոդն ուղարկվել է",
    verifyFirebaseBody: "Հաստատման հղումն ուղարկել ենք",
    verifyFirebaseAction: "Ես հաստատել եմ էլ․ փոստը",
    verificationPending: "Էլ․ փոստը դեռ հաստատված չէ։ Բացեք Firebase-ի նամակը, սեղմեք հղումը և վերադարձեք այստեղ։",
    verify: "Հաստատել",
    resend: "Կրկին ուղարկել կոդը",
    changeEmail: "Փոխել էլ․ փոստը",
    codeError: "Մուտքագրեք վեցանիշ կոդը",
    readyTitle: "Հաշիվը պատրաստ է",
    readyBody:
      "Այժմ կարգավորենք ցիկլը՝ անձնական կանխատեսում պատրաստելու համար։",
    setupCycle: "Կարգավորել ցիկլը",
    later: "Ավելի ուշ",
    recoveryTitle: "Գաղտնաբառի վերականգնում",
    recoveryBody:
      "Մուտքագրեք հաշվին կապված էլ․ փոստը։ Մենք կուղարկենք հաստատման կոդ։",
    getCode: "Ստանալ կոդը",
    recoveryCodeTitle: "Մուտքագրեք կոդը",
    recoveryCodeBody: "Վեցանիշ կոդն ուղարկվել է",
    resetTitle: "Նոր գաղտնաբառ",
    resetBody: "Ստեղծեք նոր անվտանգ գաղտնաբառ։",
    savePassword: "Պահպանել գաղտնաբառը",
    resetSuccessTitle: "Ստուգեք էլ․ փոստը",
    resetSuccessBody: "Եթե հաշիվը գոյություն ունի, LOUSA-ն ուղարկել է գաղտնաբառի վերականգնման նամակ։",
    backToSignIn: "Մուտք գործել",
    passwordRule1: "առնվազն 8 նիշ",
    passwordRule2: "մեկ մեծատառ",
    passwordRule3: "մեկ թիվ",
    oauthTitle: "Մուտք Google-ով",
    oauthBody: "Օգտագործեք ձեր Google հաշիվը՝ արագ և անվտանգ մուտքի համար։",
    googleServerRequired:
      "Մուտքի ծառայությունը ժամանակավորապես անհասանելի է։ Ստուգեք կապը և փորձեք կրկին։",
    googlePlayServicesUnavailable:
      "Google Play ծառայությունները անհասանելի կամ հնացած են։ Օգտագործեք էլ․ փոստով մուտքը։",
    googleCancelled: "Google մուտքը չեղարկվել է։",
    googleTokenMissing: "Google-ը մուտքի token չի վերադարձրել։ Փորձեք կրկին։",
    googleFailed: "Չհաջողվեց մուտք գործել Google-ով։",
    codeHint: "Կոդը գործում է 10 րոպե։",
    devCodeNotice: "Dev ռեժիմ․ email-ի ուղարկումը կարգավորված չէ, կոդը ցուցադրվում է այստեղ․",
    devEmailNotice: "Development-ում կոդը նաև գրվում է backend API console-ում։",
    invalidCode: "Կոդը սխալ է կամ ժամկետանց։",
  },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
function AuthInput({
  label,
  value,
  onChangeText,
  icon,
  secure,
  keyboardType,
  autoCapitalize = "none",
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "words";
  error?: string;
}) {
  const [hidden, setHidden] = useState(Boolean(secure));
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          error && styles.inputShellError,
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={focused ? LousaPalette.berry : "#8F7C87"}
        />
        <View style={styles.inputTextBlock}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secure ? hidden : false}
            keyboardType={keyboardType || "default"}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
            selectionColor={LousaPalette.berry}
            accessibilityLabel={label}
          />
        </View>
        {secure ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={styles.eyeButton}
            onPress={() => setHidden((value) => !value)}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color="#7E6D78"
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  secondary,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, secondary && styles.actionButtonSecondary]}
      accessibilityLabel={label}
    >
      <Text
        numberOfLines={2}
        style={[
          styles.actionButtonText,
          secondary && styles.actionButtonSecondaryText,
        ]}
      >
        {label}
      </Text>
      {icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={secondary ? LousaPalette.berry : "#FFFFFF"}
        />
      ) : null}
    </PressScale>
  );
}

function GoogleButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.googleButton, disabled && styles.googleButtonDisabled]}
      accessibilityLabel={label}
    >
      <View style={styles.googleMark}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
      <Text numberOfLines={2} style={styles.googleButtonText}>{loading ? "…" : label}</Text>
    </PressScale>
  );
}

function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => ref.current?.focus()}
      style={styles.codeRow}
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.hiddenCodeInput}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
      />
      {Array.from({ length: 6 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.codeCell,
            value.length === index && styles.codeCellActive,
          ]}
        >
          <Text style={styles.codeDigit}>{value[index] || ""}</Text>
        </View>
      ))}
    </TouchableOpacity>
  );
}


function authErrorText(
  result: { ok: false; error: { code: string; message: string } } | null | undefined,
  fallback: string,
) {
  return result && !result.ok
    ? getUserFacingErrorMessage(result.error, fallback)
    : fallback;
}

export default function LoginScreen() {
  const { language } = useTranslation();
  const copy = COPY[(language || "ru") as Language] || COPY.ru;
  const { height: screenHeight } = useWindowDimensions();
  const isShortScreen = screenHeight < 760;
  const heroHeight = Math.round(Math.min(isShortScreen ? 210 : 252, Math.max(190, screenHeight * 0.28)));
  const { setLanguage, setName, setOnboarded } = useUserStore();

  const [mode, setMode] = useState<AuthMode>("welcome");
  const [name, setNameInput] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+374");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendSeconds(0);
      return;
    }
    const update = () =>
      setResendSeconds(
        Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAvailableAt]);

  const handleGoogleSignIn = async () => {
    if (googleSubmitting) return;
    if (getServiceMode() !== "api") {
      setErrors((current) => ({
        ...current,
        oauth: copy.googleServerRequired,
      }));
      return;
    }

    setErrors((current) => ({ ...current, oauth: "" }));
    setGoogleSubmitting(true);

    const nativeResult = await signInWithNativeGoogle();
    if (!nativeResult.ok) {
      setGoogleSubmitting(false);
      const message =
        nativeResult.code === "GOOGLE_CANCELLED"
          ? copy.googleCancelled
          : nativeResult.code === "GOOGLE_PLAY_SERVICES_UNAVAILABLE"
            ? copy.googlePlayServicesUnavailable
            : nativeResult.code === "GOOGLE_AUTH_NOT_CONFIGURED"
              ? getUserFacingErrorMessage({ code: "GOOGLE_AUTH_NOT_CONFIGURED", message: copy.googleFailed }, copy.googleFailed)
              : nativeResult.code === "GOOGLE_TOKEN_MISSING"
                ? copy.googleTokenMissing
                : copy.googleFailed;
      if (__DEV__ && nativeResult.technicalMessage)
        console.warn("[Google sign-in]", nativeResult.technicalMessage);
      setErrors((current) => ({ ...current, oauth: message }));
      return;
    }

    const result = await services.auth
      .signInWithGoogle?.(nativeResult.idToken)
      .catch(() => null);
    setGoogleSubmitting(false);

    if (!result?.ok) {
      if (__DEV__ && result && !result.ok)
        console.warn(
          "[LOUSA Google auth]",
          result.error.code,
          result.error.message,
        );
      setErrors((current) => ({
        ...current,
        oauth: authErrorText(result, copy.googleFailed),
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return;
    }

    useUserStore.setState({
      name: result.data.name || useUserStore.getState().name,
      avatarUri: result.data.avatarUri ?? useUserStore.getState().avatarUri,
      isDemoMode: false,
      isOnboarded: !result.data.isNewUser,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    router.replace(result.data.isNewUser ? "/auth/onboarding" : "/(tabs)");
  };

  const passwordRules = useMemo(
    () => [
      { label: copy.passwordRule1, done: password.length >= 8 },
      { label: copy.passwordRule2, done: /[A-Z]/.test(password) },
      { label: copy.passwordRule3, done: /\d/.test(password) },
    ],
    [copy, password],
  );

  const changeMode = (next: AuthMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setErrors({});
    setCode("");
    if (!["verify", "verifyPhone", "recoveryCode"].includes(next)) setDevOtpHint(null);
    setMode(next);
  };

  const validateEmail = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: copy.emailError });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return false;
    }
    return true;
  };

  const handleSignIn = async () => {
    const next: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) next.email = copy.emailError;
    if (!PASSWORD_RE.test(password)) next.password = copy.passwordError;
    setErrors(next);
    if (Object.keys(next).length || submitting) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return;
    }

    setSubmitting(true);
    setDevOtpHint(null);
    const result = await services.auth
      .signIn(email.trim(), password)
      .catch(() => null);
    setSubmitting(false);
    if (!result?.ok) {
      if (result?.error.code === "FIREBASE_EMAIL_NOT_VERIFIED") {
        setResendAvailableAt(Date.now() + 60_000);
        changeMode("verify");
        setErrors({ code: copy.verificationPending });
        return;
      }
      setErrors({
        form: authErrorText(result, copy.googleServerRequired),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    router.replace("/(tabs)");
  };

  const requestRegistrationCode = async (): Promise<false | "verify" | "onboarding"> => {
    if (getServiceMode() !== "api" || !services.auth.register) {
      setErrors({ form: copy.googleServerRequired });
      return false;
    }

    setSubmitting(true);
    setDevOtpHint(null);
    const result = await services.auth
      .register({
        name: name.trim(),
        email: email.trim(),
        password,
        language: (language || "ru") as Language,
      })
      .catch(() => null);
    setSubmitting(false);

    if (!result?.ok) {
      if (result?.error.code === "FIREBASE_EMAIL_ALREADY_IN_USE") {
        setErrors({
          form: copy.accountExists,
          accountExists: "true",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => {},
        );
        return false;
      }
      setErrors({
        form: authErrorText(result, copy.googleServerRequired),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return false;
    }

    if ((result.data as any).firebaseSessionReady && (result.data as any).session) {
      const session = (result.data as any).session;
      useUserStore.setState({
        name: session.name || name.trim(),
        avatarUri: session.avatarUri ?? useUserStore.getState().avatarUri,
        isDemoMode: false,
        isOnboarded: false,
      });
      setName(session.name || name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return "onboarding";
    }

    setDevOtpHint(result.data.devCode || null);
    setResendAvailableAt(Date.now() + ((result.data.resendAfterSeconds || 60) * 1000));
    return "verify";
  };

  const handleSignUp = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = copy.nameError;
    if (!EMAIL_RE.test(email.trim())) next.email = copy.emailError;
    if (!PASSWORD_RE.test(password)) next.password = copy.passwordError;
    if (password !== confirmPassword) next.confirmPassword = copy.repeatError;
    setErrors(next);
    if (Object.keys(next).length || submitting) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      return;
    }

    const registrationStep = await requestRegistrationCode();
    if (registrationStep === "onboarding") {
      router.replace("/auth/onboarding");
      return;
    }
    if (registrationStep === "verify") changeMode("verify");
  };

  const handleResendRegistrationCode = async () => {
    if (submitting || resendSeconds > 0) return;
    setCode("");
    setErrors({});
    if (getAuthProviderMode() === "firebase" && services.auth.resendRegistrationVerification) {
      setSubmitting(true);
      const result = await services.auth.resendRegistrationVerification().catch(() => null);
      setSubmitting(false);
      if (!result?.ok) {
        setErrors({ code: authErrorText(result, copy.googleServerRequired) });
        return;
      }
      setResendAvailableAt(Date.now() + ((result.data.resendAfterSeconds || 60) * 1000));
      return;
    }
    await requestRegistrationCode();
  };

  const handleVerify = async () => {
    const firebaseVerification = getAuthProviderMode() === "firebase";
    if ((!firebaseVerification && code.length !== 6) || submitting) {
      setErrors({ code: copy.codeError });
      return;
    }
    if (getServiceMode() !== "api" || !services.auth.verifyRegistration) {
      setErrors({ code: copy.googleServerRequired });
      return;
    }

    setSubmitting(true);
    const result = await services.auth
      .verifyRegistration(email.trim(), firebaseVerification ? "" : code)
      .catch(() => null);
    setSubmitting(false);
    if (!result?.ok) {
      setErrors({
        code: authErrorText(
          result,
          firebaseVerification ? copy.verificationPending : copy.invalidCode,
        ),
      });
      return;
    }

    useUserStore.setState({
      name: result.data.name || name.trim(),
      isDemoMode: false,
      isOnboarded: false,
    });
    setName(result.data.name || name.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    router.replace("/auth/onboarding");
  };

  const normalizePhoneInput = (value: string) => {
    const trimmed = value.trim().replace(/[\s()-]/g, "");
    if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
    if (trimmed.startsWith("0") && !trimmed.startsWith("+")) return `+374${trimmed.slice(1)}`;
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  };

  const handlePhoneStart = async () => {
    const normalized = normalizePhoneInput(phone);
    setPhone(normalized);
    if (!PHONE_RE.test(normalized)) {
      setErrors({ phone: copy.phoneError });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (getServiceMode() !== "api" || !services.auth.startPhoneAuth) {
      setErrors({ form: copy.smsProviderRequired });
      return;
    }

    setSubmitting(true);
    setDevOtpHint(null);
    const result = await services.auth
      .startPhoneAuth({ phone: normalized, language: (language || "ru") as Language })
      .catch(() => null);
    setSubmitting(false);

    if (!result?.ok) {
      setErrors({ form: authErrorText(result, copy.smsProviderRequired) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    setDevOtpHint(result.data.devCode || null);
    setResendAvailableAt(Date.now() + ((result.data.resendAfterSeconds || 60) * 1000));
    setCode("");
    changeMode("verifyPhone");
  };

  const handleVerifyPhone = async () => {
    if (code.length !== 6 || submitting) {
      setErrors({ code: copy.codeError });
      return;
    }
    if (getServiceMode() !== "api" || !services.auth.verifyPhoneAuth) {
      setErrors({ code: copy.smsProviderRequired });
      return;
    }

    setSubmitting(true);
    const result = await services.auth
      .verifyPhoneAuth({ phone: normalizePhoneInput(phone), code })
      .catch(() => null);
    setSubmitting(false);

    if (!result?.ok) {
      setErrors({ code: authErrorText(result, copy.phoneOtpInvalid) });
      return;
    }

    useUserStore.setState({
      name: result.data.name || useUserStore.getState().name || "LOUSA",
      avatarUri: result.data.avatarUri ?? useUserStore.getState().avatarUri,
      isDemoMode: false,
      isOnboarded: !result.data.isNewUser,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(result.data.isNewUser ? "/auth/onboarding" : "/(tabs)");
  };

  const handleResendPhoneCode = async () => {
    if (submitting || resendSeconds > 0) return;
    setCode("");
    setErrors({});
    await handlePhoneStart();
  };

  const handleRecoveryEmail = async () => {
    if (!validateEmail() || submitting) return;
    if (getServiceMode() !== "api" || !services.auth.requestPasswordReset) {
      setErrors({ form: copy.googleServerRequired });
      return;
    }

    setSubmitting(true);
    setDevOtpHint(null);
    const result = await services.auth
      .requestPasswordReset(email.trim(), (language || "ru") as Language)
      .catch(() => null);
    setSubmitting(false);
    if (!result?.ok) {
      setErrors({
        form: authErrorText(result, copy.googleServerRequired),
      });
      return;
    }
    if (getAuthProviderMode() === "firebase") {
      changeMode("resetSuccess");
      return;
    }
    const recoveryPayload = result.data as { devCode?: string } | undefined;
    setDevOtpHint(recoveryPayload?.devCode || null);
    setResendAvailableAt(Date.now() + 60_000);
    changeMode("recoveryCode");
  };

  const handleRecoveryCode = () => {
    if (code.length !== 6) {
      setErrors({ code: copy.codeError });
      return;
    }
    setPassword("");
    setConfirmPassword("");
    changeMode("reset");
  };

  const handleReset = async () => {
    const next: Record<string, string> = {};
    if (!PASSWORD_RE.test(password)) next.password = copy.passwordError;
    if (password !== confirmPassword) next.confirmPassword = copy.repeatError;
    setErrors(next);
    if (Object.keys(next).length || submitting) return;

    if (getServiceMode() !== "api" || !services.auth.resetPassword) {
      setErrors({ password: copy.googleServerRequired });
      return;
    }

    setSubmitting(true);
    const result = await services.auth
      .resetPassword({ email: email.trim(), code, newPassword: password })
      .catch(() => null);
    setSubmitting(false);
    if (!result?.ok) {
      setErrors({
        password: authErrorText(result, copy.invalidCode),
      });
      return;
    }
    changeMode("resetSuccess");
  };

  return (
    <PremiumAuthShell
      variant={mode === "welcome" ? "welcome" : "form"}
      testID="lousa-auth-screen-frame"
      contentContainerStyle={[
        styles.scrollContent,
        mode === "welcome"
          ? styles.scrollContentWelcome
          : styles.scrollContentForm,
        mode === "signup" && styles.scrollContentSignup,
      ]}
    >
      <View
        style={[
          styles.authFlow,
          mode === "welcome" ? styles.authFlowWelcome : styles.authFlowForm,
        ]}
      >
          {mode === "welcome" ? (
            <>
              <View style={styles.topBar}>
                <View style={styles.topBrand}>
                  <Image
                    source={require("../../assets/images/icon.png")}
                    style={styles.topBrandIcon}
                  />
                  <View>
                    <Text style={styles.topBrandName}>LOUSA</Text>
                    <Text style={styles.topBrandMoon}>MOON</Text>
                  </View>
                </View>
                <View style={styles.languageSwitch}>
                  {(["ru", "en", "hy"] as Language[]).map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      hitSlop={4}
                      style={[
                        styles.languageItem,
                        language === lang && styles.languageItemActive,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={[
                          styles.languageText,
                          language === lang && styles.languageTextActive,
                        ]}
                      >
                        {lang === "hy" ? "HY" : lang.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ImageBackground
                source={require("../../assets/images/auth/auth-hero-wide.png")}
                style={[styles.hero, { height: heroHeight }]}
                imageStyle={styles.heroImage}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={["rgba(42,22,38,0.00)", "rgba(42,22,38,0.16)"]}
                  style={StyleSheet.absoluteFillObject}
                />
              </ImageBackground>
            </>
          ) : (
            <View style={styles.formHeader}>
              <PressScale
                onPress={() =>
                  changeMode(getAuthBackTarget(mode))
                }
                style={styles.backButton}
              >
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color={LousaPalette.ink}
                />
              </PressScale>

              <View style={styles.formBrand}>
                <Image
                  source={require("../../assets/images/icon.png")}
                  style={styles.formBrandIcon}
                />
                <View>
                  <Text numberOfLines={1} style={styles.formBrandName}>LOUSA</Text>
                  <Text numberOfLines={1} style={styles.formBrandMoon}>MOON</Text>
                </View>
              </View>

              <View
                style={[styles.languageSwitch, styles.languageSwitchCompact]}
              >
                {(["ru", "en", "hy"] as Language[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    hitSlop={4}
                    style={[
                      styles.languageItem,
                      styles.languageItemCompact,
                      language === lang && styles.languageItemActive,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[
                        styles.languageText,
                        language === lang && styles.languageTextActive,
                      ]}
                    >
                      {lang === "hy" ? "HY" : lang.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View
            style={[
              styles.sheet,
              mode === "welcome" ? styles.welcomeSheet : styles.formSheet,
              mode === "signup" && styles.signupSheet,
            ]}
          >
            {mode === "welcome" ? (
              <View>
                <Text style={styles.welcomeTitle}>{copy.tagline}</Text>
                <Text style={styles.welcomeBody}>{copy.welcomeBody}</Text>
                <View style={styles.actionStack}>
                  <ActionButton
                    label={copy.create}
                    onPress={() => changeMode("signup")}
                    icon="arrow-forward"
                  />
                  <ActionButton
                    label={copy.haveAccount}
                    onPress={() => changeMode("signin")}
                    secondary
                  />
                </View>
                <View style={styles.oauthBlock}>
                  <View style={styles.oauthDividerRow}>
                    <View style={styles.oauthDivider} />
                    <Text style={styles.oauthDividerText}>{copy.otherWay}</Text>
                    <View style={styles.oauthDivider} />
                  </View>
                  <GoogleButton
                    label={copy.continueGoogle}
                    onPress={() => {
                      handleGoogleSignIn().catch(() => {});
                    }}
                    disabled={googleSubmitting}
                    loading={googleSubmitting}
                  />
                  <ActionButton
                    label={copy.continuePhone}
                    onPress={() => changeMode("phone")}
                    secondary
                    icon="call-outline"
                  />
                  {errors.oauth ? (
                    <Text style={styles.oauthError}>{errors.oauth}</Text>
                  ) : null}
                </View>
                <Text style={styles.terms}>{copy.terms}</Text>
              </View>
            ) : null}

            {mode === "signin" ? (
              <View
              >
                <Text style={styles.formTitle}>{copy.signInTitle}</Text>
                <Text style={styles.formBody}>{copy.signInBody}</Text>
                <View style={styles.formFields}>
                  <AuthInput
                    label={copy.email}
                    value={email}
                    onChangeText={setEmail}
                    icon="mail-outline"
                    keyboardType="email-address"
                    error={errors.email}
                  />
                  <AuthInput
                    label={copy.password}
                    value={password}
                    onChangeText={setPassword}
                    icon="lock-closed-outline"
                    secure
                    error={errors.password}
                  />
                </View>
                {errors.form ? (
                  <Text style={styles.formError}>{errors.form}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => changeMode("recovery")}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>{copy.forgot}</Text>
                </TouchableOpacity>
                <ActionButton
                  label={submitting ? "…" : copy.signIn}
                  onPress={() => {
                    handleSignIn().catch(() => {});
                  }}
                  icon="arrow-forward"
                  disabled={submitting}
                />
                <View style={styles.oauthBlockCompact}>
                  <View style={styles.oauthDividerRow}>
                    <View style={styles.oauthDivider} />
                    <Text style={styles.oauthDividerText}>{copy.otherWay}</Text>
                    <View style={styles.oauthDivider} />
                  </View>
                  <GoogleButton
                    label={copy.continueGoogle}
                    onPress={() => {
                      handleGoogleSignIn().catch(() => {});
                    }}
                    disabled={googleSubmitting}
                    loading={googleSubmitting}
                  />
                  <ActionButton
                    label={copy.continuePhone}
                    onPress={() => changeMode("phone")}
                    secondary
                    icon="call-outline"
                  />
                  {errors.oauth ? (
                    <Text style={styles.oauthError}>{errors.oauth}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => changeMode("signup")}
                  style={styles.modeLink}
                >
                  <Text style={styles.modeLinkText}>{copy.noAccount}</Text>
                </TouchableOpacity>
                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color={LousaPalette.berry}
                  />
                  <Text style={styles.privacyText}>{copy.privacy}</Text>
                </View>
              </View>
            ) : null}

            {mode === "signup" ? (
              <View
              >
                <Text style={styles.formTitle}>{copy.signUpTitle}</Text>
                <Text style={styles.formBody}>{copy.signUpBody}</Text>
                <View style={styles.formFields}>
                  <AuthInput
                    label={copy.name}
                    value={name}
                    onChangeText={setNameInput}
                    icon="person-outline"
                    autoCapitalize="words"
                    error={errors.name}
                  />
                  <AuthInput
                    label={copy.email}
                    value={email}
                    onChangeText={setEmail}
                    icon="mail-outline"
                    keyboardType="email-address"
                    error={errors.email}
                  />
                  <AuthInput
                    label={copy.password}
                    value={password}
                    onChangeText={setPassword}
                    icon="lock-closed-outline"
                    secure
                    error={errors.password}
                  />
                  <View style={styles.passwordRules}>
                    {passwordRules.map((rule) => (
                      <View key={rule.label} style={styles.passwordRule}>
                        <Ionicons
                          name={
                            rule.done ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={15}
                          color={rule.done ? LousaPalette.success : "#A897A0"}
                        />
                        <Text
                          style={[
                            styles.passwordRuleText,
                            rule.done && styles.passwordRuleDone,
                          ]}
                        >
                          {rule.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <AuthInput
                    label={copy.repeatPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    icon="lock-closed-outline"
                    secure
                    error={errors.confirmPassword}
                  />
                  {errors.form ? (
                    <Text style={styles.formError}>{errors.form}</Text>
                  ) : null}
                  {errors.accountExists ? (
                    <TouchableOpacity
                      onPress={() => {
                        setPassword("");
                        setConfirmPassword("");
                        changeMode("signin");
                      }}
                      style={styles.existingAccountAction}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="log-in-outline"
                        size={19}
                        color={LousaPalette.berry}
                      />
                      <Text style={styles.existingAccountActionText}>
                        {copy.signInExisting}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ActionButton
                  label={submitting ? "…" : copy.continue}
                  onPress={() => {
                    handleSignUp().catch(() => {});
                  }}
                  icon="arrow-forward"
                  disabled={submitting}
                />
                <Text style={styles.termsCompact}>{copy.terms}</Text>
                <View style={styles.oauthBlockCompact}>
                  <View style={styles.oauthDividerRow}>
                    <View style={styles.oauthDivider} />
                    <Text style={styles.oauthDividerText}>{copy.otherWay}</Text>
                    <View style={styles.oauthDivider} />
                  </View>
                  <GoogleButton
                    label={copy.continueGoogle}
                    onPress={() => {
                      handleGoogleSignIn().catch(() => {});
                    }}
                    disabled={googleSubmitting}
                    loading={googleSubmitting}
                  />
                  <ActionButton
                    label={copy.continuePhone}
                    onPress={() => changeMode("phone")}
                    secondary
                    icon="call-outline"
                  />
                  {errors.oauth ? (
                    <Text style={styles.oauthError}>{errors.oauth}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => changeMode("signin")}
                  style={styles.modeLink}
                >
                  <Text style={styles.modeLinkText}>{copy.already}</Text>
                </TouchableOpacity>
                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color={LousaPalette.berry}
                  />
                  <Text style={styles.privacyText}>{copy.privacy}</Text>
                </View>
              </View>
            ) : null}

            {mode === "phone" ? (
              <View
              >
                <Text style={styles.formTitle}>{copy.phoneTitle}</Text>
                <Text style={styles.formBody}>{copy.phoneBody}</Text>
                <View style={styles.formFields}>
                  <AuthInput
                    label={copy.phone}
                    value={phone}
                    onChangeText={setPhone}
                    icon="call-outline"
                    keyboardType="phone-pad"
                    error={errors.phone}
                  />
                  {errors.form ? (
                    <Text style={styles.formError}>{errors.form}</Text>
                  ) : null}
                </View>
                <ActionButton
                  label={submitting ? "…" : copy.sendPhoneCode}
                  onPress={() => {
                    handlePhoneStart().catch(() => {});
                  }}
                  icon="arrow-forward"
                  disabled={submitting}
                />
                <TouchableOpacity
                  onPress={() => changeMode("signin")}
                  style={styles.modeLink}
                >
                  <Text style={styles.modeLinkText}>{copy.backToSignIn}</Text>
                </TouchableOpacity>
                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color={LousaPalette.berry}
                  />
                  <Text style={styles.privacyText}>{copy.privacy}</Text>
                </View>
              </View>
            ) : null}

            {mode === "verifyPhone" ? (
              <View
                style={styles.centeredStep}
              >
                <Text style={styles.formTitle}>{copy.verifyPhoneTitle}</Text>
                <Text style={styles.formBody}>
                  {copy.verifyPhoneBody}
                  {"\n"}
                  <Text style={styles.emphasis}>{phone}</Text>
                </Text>
                <CodeInput value={code} onChange={setCode} />
                <Text style={styles.codeHint}>{copy.codeHint}</Text>
                {devOtpHint ? (
                  <View style={styles.devCodeBox}>
                    <Text style={styles.devCodeLabel}>{copy.phoneDevNotice}</Text>
                    <Text style={styles.devCodeValue}>{devOtpHint}</Text>
                  </View>
                ) : null}
                {errors.code ? (
                  <Text style={styles.codeError}>{errors.code}</Text>
                ) : null}
                <ActionButton
                  label={submitting ? "…" : copy.verify}
                  onPress={() => {
                    handleVerifyPhone().catch(() => {});
                  }}
                  disabled={code.length !== 6 || submitting}
                />
                <View style={styles.inlineLinks}>
                  <TouchableOpacity
                    disabled={resendSeconds > 0 || submitting}
                    onPress={() => {
                      handleResendPhoneCode().catch(() => {});
                    }}
                  >
                    <Text
                      style={[
                        styles.smallLink,
                        (resendSeconds > 0 || submitting) &&
                          styles.smallLinkDisabled,
                      ]}
                    >
                      {resendSeconds > 0
                        ? `${copy.resend} (${resendSeconds})`
                        : copy.resend}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => changeMode("phone")}>
                    <Text style={styles.smallLink}>{copy.changePhone}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {mode === "verify" ? (
              <View
                style={styles.centeredStep}
              >
                <Image
                  source={require("../../assets/images/auth/email-verification.png")}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
                <Text style={styles.formTitle}>{copy.verifyTitle}</Text>
                <Text style={styles.formBody}>
                  {getAuthProviderMode() === "firebase"
                    ? copy.verifyFirebaseBody
                    : copy.verifyBody}
                  {"\n"}
                  <Text style={styles.emphasis}>{email}</Text>
                </Text>
                {getAuthProviderMode() !== "firebase" ? (
                  <>
                    <CodeInput value={code} onChange={setCode} />
                    <Text style={styles.codeHint}>{copy.codeHint}</Text>
                  </>
                ) : null}
                {getAuthProviderMode() !== "firebase" && devOtpHint ? (
                  <View style={styles.devCodeBox}>
                    <Text style={styles.devCodeLabel}>{copy.devCodeNotice}</Text>
                    <Text style={styles.devCodeValue}>{devOtpHint}</Text>
                    <Text style={styles.devCodeLabel}>{copy.devEmailNotice}</Text>
                  </View>
                ) : null}
                {errors.code ? (
                  <Text style={styles.codeError}>{errors.code}</Text>
                ) : null}
                <ActionButton
                  label={submitting ? "…" : getAuthProviderMode() === "firebase" ? copy.verifyFirebaseAction : copy.verify}
                  onPress={() => {
                    handleVerify().catch(() => {});
                  }}
                  disabled={(getAuthProviderMode() !== "firebase" && code.length !== 6) || submitting}
                />
                <View style={styles.inlineLinks}>
                  <TouchableOpacity
                    disabled={resendSeconds > 0 || submitting}
                    onPress={() => {
                      handleResendRegistrationCode().catch(() => {});
                    }}
                  >
                    <Text
                      style={[
                        styles.smallLink,
                        (resendSeconds > 0 || submitting) &&
                          styles.smallLinkDisabled,
                      ]}
                    >
                      {resendSeconds > 0
                        ? `${copy.resend} (${resendSeconds})`
                        : copy.resend}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => changeMode("signup")}>
                    <Text style={styles.smallLink}>{copy.changeEmail}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {mode === "success" ? (
              <View
                style={styles.centeredStep}
              >
                <Image
                  source={require("../../assets/images/auth/account-success.png")}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
                <Text style={styles.formTitle}>{copy.readyTitle}</Text>
                <Text style={styles.formBody}>{copy.readyBody}</Text>
                <View style={styles.actionStackWide}>
                  <ActionButton
                    label={copy.setupCycle}
                    onPress={() => router.replace("/auth/onboarding")}
                    icon="arrow-forward"
                  />
                  <ActionButton
                    label={copy.later}
                    secondary
                    onPress={() => {
                      setOnboarded(true);
                      router.replace("/(tabs)");
                    }}
                  />
                </View>
              </View>
            ) : null}

            {mode === "recovery" ? (
              <View
                style={styles.centeredStep}
              >
                <Image
                  source={require("../../assets/images/auth/password-recovery.png")}
                  style={styles.stepImageSmall}
                  resizeMode="contain"
                />
                <Text style={[styles.formTitle, styles.formTitleLong]}>{copy.recoveryTitle}</Text>
                <Text style={styles.formBody}>{copy.recoveryBody}</Text>
                <View style={[styles.formFields, { width: "100%" }]}>
                  <AuthInput
                    label={copy.email}
                    value={email}
                    onChangeText={setEmail}
                    icon="mail-outline"
                    keyboardType="email-address"
                    error={errors.email}
                  />
                </View>
                <View style={{ width: "100%" }}>
                  <ActionButton
                    label={submitting ? "…" : copy.getCode}
                    onPress={() => {
                      handleRecoveryEmail().catch(() => {});
                    }}
                    disabled={submitting}
                  />
                </View>
              </View>
            ) : null}

            {mode === "recoveryCode" ? (
              <View
                style={styles.centeredStep}
              >
                <Image
                  source={require("../../assets/images/auth/email-verification.png")}
                  style={styles.stepImageSmall}
                  resizeMode="contain"
                />
                <Text style={styles.formTitle}>{copy.recoveryCodeTitle}</Text>
                <Text style={styles.formBody}>
                  {copy.recoveryCodeBody}
                  {"\n"}
                  <Text style={styles.emphasis}>{email}</Text>
                </Text>
                <CodeInput value={code} onChange={setCode} />
                {devOtpHint ? (
                  <View style={styles.devCodeBox}>
                    <Text style={styles.devCodeLabel}>{copy.devCodeNotice}</Text>
                    <Text style={styles.devCodeValue}>{devOtpHint}</Text>
                    <Text style={styles.devCodeLabel}>{copy.devEmailNotice}</Text>
                  </View>
                ) : null}
                {errors.code ? (
                  <Text style={styles.codeError}>{errors.code}</Text>
                ) : null}
                <View style={{ width: "100%" }}>
                  <ActionButton
                    label={copy.verify}
                    onPress={handleRecoveryCode}
                    disabled={code.length !== 6}
                  />
                </View>
              </View>
            ) : null}

            {mode === "reset" ? (
              <View
              >
                <Text style={styles.formTitle}>{copy.resetTitle}</Text>
                <Text style={styles.formBody}>{copy.resetBody}</Text>
                <View style={styles.formFields}>
                  <AuthInput
                    label={copy.password}
                    value={password}
                    onChangeText={setPassword}
                    icon="lock-closed-outline"
                    secure
                    error={errors.password}
                  />
                  <AuthInput
                    label={copy.repeatPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    icon="lock-closed-outline"
                    secure
                    error={errors.confirmPassword}
                  />
                  {errors.form ? (
                    <Text style={styles.formError}>{errors.form}</Text>
                  ) : null}
                </View>
                <ActionButton
                  label={submitting ? "…" : copy.savePassword}
                  onPress={() => {
                    handleReset().catch(() => {});
                  }}
                  disabled={submitting}
                />
              </View>
            ) : null}

            {mode === "resetSuccess" ? (
              <View
                style={styles.centeredStep}
              >
                <Image
                  source={require("../../assets/images/auth/account-success.png")}
                  style={styles.stepImage}
                  resizeMode="contain"
                />
                <Text style={styles.formTitle}>{copy.resetSuccessTitle}</Text>
                <Text style={styles.formBody}>{copy.resetSuccessBody}</Text>
                <View style={{ width: "100%" }}>
                  <ActionButton
                    label={copy.backToSignIn}
                    onPress={() => changeMode("signin")}
                  />
                </View>
              </View>
            ) : null}
          </View>
      </View>
    </PremiumAuthShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFF8F5" },
  safe: { flex: 1 },
  scrollContent: { width: "100%", alignItems: "center" },
  scrollContentWelcome: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingTop: 6,
  },
  scrollContentForm: {
    flexGrow: 0,
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  scrollContentSignup: { paddingTop: 4 },
  authFlow: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "stretch",
  },
  authFlowWelcome: { paddingBottom: 0 },
  authFlowForm: { paddingBottom: 0 },
  topBar: {
    width: "100%",
    maxWidth: 520,
    minHeight: 58,
    paddingHorizontal: 4,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  topBrandIcon: { width: 38, height: 38, borderRadius: 12 },
  topBrandName: {
    fontFamily: "serif",
    fontSize: 17,
    lineHeight: 18,
    color: LousaPalette.ink,
    letterSpacing: 1.7,
  },
  topBrandMoon: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    lineHeight: 16,
    color: LousaPalette.inkSoft,
    letterSpacing: 3.4,
  },
  hero: {
    width: "100%",
    maxWidth: 520,
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "#CDA9AE",
  },
  heroImage: { borderRadius: 32 },
  formHeader: {
    width: "100%",
    minHeight: 58,
    marginTop: 0,
    paddingHorizontal: 2,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formBrand: { flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  formBrandIcon: { width: 38, height: 38, borderRadius: 12 },
  formBrandName: {
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 17,
    color: LousaPalette.ink,
    letterSpacing: 1.5,
  },
  formBrandMoon: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    lineHeight: 16,
    color: LousaPalette.inkSoft,
    letterSpacing: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFDFE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EADDE2",
    ...LousaShadow.soft,
  },
  languageSwitch: {
    flexDirection: "row",
    backgroundColor: "#FFFDFE",
    padding: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EADDE2",
    ...LousaShadow.soft,
  },
  languageSwitchCompact: { padding: 3 },
  languageItem: {
    minWidth: 35,
    height: 36,
    paddingHorizontal: 7,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  languageItemCompact: { minWidth: 48, height: 48, paddingHorizontal: 5 },
  languageItemActive: { backgroundColor: LousaPalette.berry },
  languageText: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: "#705F69",
    letterSpacing: 0.6,
  },
  languageTextActive: { color: "#FFFFFF" },
  sheet: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderRadius: 28,
    backgroundColor: "#FFFDFE",
    borderWidth: 1,
    borderColor: "rgba(75,53,78,0.10)",
    ...LousaShadow.soft,
  },
  welcomeSheet: { marginTop: 14 },
  formSheet: { marginTop: 14 },
  signupSheet: { marginTop: 14, paddingTop: 20, paddingBottom: 28 },
  welcomeTitle: {
    fontFamily: "serif",
    fontSize: 28,
    lineHeight: 34,
    color: LousaPalette.ink,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  welcomeBody: {
    fontFamily: "sans-serif",
    fontSize: 14.5,
    lineHeight: 22,
    color: LousaPalette.inkSoft,
    textAlign: "center",
    marginTop: 9,
    marginHorizontal: 5,
  },
  actionStack: { gap: 10, marginTop: 22 },
  actionStackWide: { width: "100%", gap: 11, marginTop: 8 },
  actionButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: LousaPalette.berry,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...LousaShadow.soft,
  },
  actionButtonSecondary: {
    backgroundColor: "#FFFDFE",
    borderWidth: 1,
    borderColor: "#E6D7DE",
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: {
    flexShrink: 1,
    fontFamily: "sans-serif-medium",
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "center",
  },
  actionButtonSecondaryText: { color: LousaPalette.berry },
  oauthBlock: { gap: 10, marginTop: 18 },
  oauthBlockCompact: { gap: 9, marginTop: 12 },
  oauthDividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  oauthDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E4D7DD",
  },
  oauthDividerText: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: "#94818B",
  },
  googleButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFD6DA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  googleButtonDisabled: { opacity: 0.55 },
  googleMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E4E4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleMarkText: {
    fontFamily: "sans-serif-medium",
    fontSize: 16,
    color: "#4285F4",
  },
  googleButtonText: {
    flexShrink: 1,
    fontFamily: "sans-serif-medium",
    fontSize: 14.5,
    color: LousaPalette.ink,
    textAlign: "center",
  },
  oauthError: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    lineHeight: 16,
    color: LousaPalette.danger,
    textAlign: "center",
  },
  formError: {
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    lineHeight: 18,
    color: LousaPalette.danger,
    textAlign: "center",
    marginTop: 0,
    marginBottom: 8,
  },
  existingAccountAction: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6D7DE",
    backgroundColor: "#FFF8FB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  existingAccountActionText: {
    flexShrink: 1,
    fontFamily: "sans-serif-medium",
    fontSize: 13.5,
    lineHeight: 18,
    color: LousaPalette.berry,
    textAlign: "center",
  },
  demoCard: {
    marginTop: 18,
    padding: 15,
    borderRadius: 22,
    backgroundColor: "#FCF1F5",
    borderWidth: 1,
    borderColor: "#EAD5DE",
    gap: 13,
  },
  demoCompactLink: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5DE",
    backgroundColor: "#FCF1F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  demoCompactText: {
    fontFamily: "sans-serif-medium",
    fontSize: 13,
    color: LousaPalette.berry,
  },
  demoCardHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  demoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#FFFDFE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E9D8DF",
  },
  demoCardTitleBlock: { flex: 1 },
  demoTitle: {
    fontFamily: "sans-serif-medium",
    fontSize: 14,
    color: LousaPalette.ink,
  },
  demoBody: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 17,
    color: LousaPalette.inkSoft,
    marginTop: 2,
  },
  demoCredentials: {
    gap: 7,
    padding: 11,
    borderRadius: 15,
    backgroundColor: "#FFFDFE",
  },
  demoCredentialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  demoCredentialLabel: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: "#8C7883",
  },
  demoCredentialValue: {
    flexShrink: 1,
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    color: LousaPalette.ink,
    textAlign: "right",
  },
  terms: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 17,
    color: "#93818B",
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 6,
  },
  termsCompact: {
    fontFamily: "sans-serif",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#93818B",
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  formTitle: {
    fontFamily: "sans-serif-medium",
    fontSize: 25,
    lineHeight: 31,
    color: LousaPalette.ink,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  formBody: {
    fontFamily: "sans-serif",
    fontSize: 14,
    lineHeight: 20,
    color: LousaPalette.inkSoft,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  formFields: { gap: 10, marginBottom: 12 },
  fieldBlock: { gap: 7 },
  inputShell: {
    minHeight: 54,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E7DADF",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 12,
  },
  inputShellFocused: {
    borderColor: LousaPalette.rose,
    shadowColor: LousaPalette.rose,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  inputShellError: { borderColor: LousaPalette.danger },
  inputTextBlock: { flex: 1, paddingVertical: 4 },
  inputLabel: {
    fontFamily: "sans-serif-medium",
    fontSize: 13,
    color: "#7E6C77",
    paddingLeft: 4,
  },
  input: {
    fontFamily: "sans-serif",
    fontSize: 15,
    color: LousaPalette.ink,
    padding: 0,
    minHeight: 24,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldError: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: LousaPalette.danger,
    paddingLeft: 6,
  },
  forgotButton: {
    alignSelf: "flex-end",
    minHeight: 48,
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 10,
  },
  forgotText: {
    fontFamily: "sans-serif-medium",
    fontSize: 13,
    color: LousaPalette.berry,
  },
  modeLink: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 10 },
  modeLinkText: {
    fontFamily: "sans-serif-medium",
    fontSize: 13,
    color: LousaPalette.berry,
  },
  demoInlineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 13,
    borderRadius: 17,
    backgroundColor: "#FCF1F5",
    borderWidth: 1,
    borderColor: "#E9D5DE",
  },
  demoInlineTextBlock: { flex: 1 },
  demoInlineTitle: {
    fontFamily: "sans-serif-medium",
    fontSize: 12.5,
    color: LousaPalette.ink,
  },
  demoInlineCredentials: {
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 16,
    color: "#806C77",
    marginTop: 2,
  },
  demoFillButton: {
    minHeight: 48,
    maxWidth: 116,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#FFFDFE",
    borderWidth: 1,
    borderColor: "#E3CDD7",
    alignItems: "center",
    justifyContent: "center",
  },
  demoFillText: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: LousaPalette.berry,
    textAlign: "center",
  },
  privacyNote: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: "#FCF3F6",
    borderRadius: 17,
    padding: 13,
    alignItems: "flex-start",
    marginTop: 2,
  },
  privacyText: {
    flex: 1,
    fontFamily: "sans-serif",
    fontSize: 12,
    lineHeight: 17,
    color: "#6D5965",
  },
  passwordRules: {
    gap: 4,
    paddingHorizontal: 5,
    marginTop: 0,
    marginBottom: 0,
  },
  passwordRule: { flexDirection: "row", alignItems: "center", gap: 6 },
  passwordRuleText: {
    fontFamily: "sans-serif",
    fontSize: 11.5,
    color: "#8A7882",
  },
  passwordRuleDone: { color: LousaPalette.success },
  centeredStep: { alignItems: "center", width: "100%" },
  stepImage: { width: 120, height: 120, marginTop: 0, marginBottom: 2 },
  stepImageSmall: { width: 96, height: 96, marginTop: 0, marginBottom: 2 },
  formTitleLong: { fontSize: 22, lineHeight: 28 },
  emphasis: { fontFamily: "sans-serif-medium", color: LousaPalette.ink },
  codeRow: {
    width: "100%",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  hiddenCodeInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  codeCell: {
    flex: 1,
    minWidth: 32,
    maxWidth: 43,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E3D5DC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  codeCellActive: { borderColor: LousaPalette.rose, borderWidth: 1.5 },
  codeDigit: {
    fontFamily: "sans-serif-medium",
    fontSize: 21,
    color: LousaPalette.ink,
  },
  codeHint: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: LousaPalette.berry,
    textAlign: "center",
    marginBottom: 10,
  },
  devCodeBox: {
    width: "100%",
    gap: 5,
    padding: 11,
    borderRadius: 16,
    backgroundColor: "#FCF1F5",
    borderWidth: 1,
    borderColor: "#EAD5DE",
    marginBottom: 12,
  },
  devCodeLabel: {
    fontFamily: "sans-serif",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#806C77",
    textAlign: "center",
  },
  devCodeValue: {
    fontFamily: "sans-serif-medium",
    fontSize: 20,
    lineHeight: 26,
    color: LousaPalette.berry,
    textAlign: "center",
    letterSpacing: 3,
  },
  codeError: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: LousaPalette.danger,
    marginBottom: 12,
  },
  inlineLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
  },
  smallLink: {
    fontFamily: "sans-serif-medium",
    fontSize: 12,
    color: LousaPalette.berry,
    paddingVertical: 8,
  },
  smallLinkDisabled: { opacity: 0.45 },
});
