import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

export function AuthTopBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}
