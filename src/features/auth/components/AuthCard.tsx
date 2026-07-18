import React, { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type AuthCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthCard({ children, style }: AuthCardProps) {
  return <View style={style}>{children}</View>;
}
