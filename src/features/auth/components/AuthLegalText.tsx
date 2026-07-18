import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
export function AuthLegalText({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={style}>{children}</Text>;
}
