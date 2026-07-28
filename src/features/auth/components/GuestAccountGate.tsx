import React from 'react';
import { router } from 'expo-router';

import { ModalScreen, ScreenScroll } from '../../../components/layout';
import { EmptyState } from '../../../components/ui';
import { useUserStore } from '../../../store';
import { beginGuestAccountUpgrade } from '../guest/guestSession';

const COPY = {
  ru: {
    title: 'Нужен аккаунт LOUSA',
    body: 'В гостевом режиме цикл и заметки хранятся только на этом устройстве. Для адреса, заказа LOUSA BOX, оплаты и синхронизации нужен аккаунт.',
    create: 'Создать аккаунт',
    signIn: 'Уже есть аккаунт',
  },
  en: {
    title: 'A LOUSA account is required',
    body: 'In guest mode, cycle data and notes stay only on this device. An account is required for delivery addresses, LOUSA BOX orders, payments and sync.',
    create: 'Create account',
    signIn: 'I already have an account',
  },
  hy: {
    title: 'Անհրաժեշտ է LOUSA հաշիվ',
    body: 'Հյուրի ռեժիմում ցիկլի տվյալներն ու գրառումները պահվում են միայն այս սարքում։ Հասցեի, LOUSA BOX պատվերի, վճարման և համաժամացման համար հաշիվ է պետք։',
    create: 'Ստեղծել հաշիվ',
    signIn: 'Ես արդեն ունեմ հաշիվ',
  },
} as const;

export function GuestAccountGate({ screenTitle }: { screenTitle: string }) {
  const language = useUserStore((state) => state.language);
  const copy = COPY[language] || COPY.ru;
  const openAuth = (mode: 'signup' | 'signin') => {
    beginGuestAccountUpgrade();
    router.replace({ pathname: '/auth/login', params: { mode } });
  };

  return (
    <ModalScreen title={screenTitle} closeIcon="arrow_back">
      <ScreenScroll>
        <EmptyState
          icon="lock"
          title={copy.title}
          body={copy.body}
          actionLabel={copy.create}
          onAction={() => openAuth('signup')}
          secondaryLabel={copy.signIn}
          onSecondary={() => openAuth('signin')}
        />
      </ScreenScroll>
    </ModalScreen>
  );
}
