import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
export function AuthErrorBanner({ message, style }: { message?: string; style?: StyleProp<TextStyle> }) {
  if (!message) return null;
  return <Text style={style}>{message}</Text>;
}
