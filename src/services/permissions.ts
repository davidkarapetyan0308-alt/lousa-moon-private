import { Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { PermissionState } from '../domain/models';

function mapGranted(canAskAgain: boolean, granted: boolean, status?: string): PermissionState {
  if (granted) return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return canAskAgain ? 'denied' : 'blocked';
}

export interface PermissionService {
  getPhotoPermission(): Promise<PermissionState>;
  requestPhotoPermission(): Promise<PermissionState>;
  getNotificationPermission(): Promise<PermissionState>;
  requestNotificationPermission(): Promise<PermissionState>;
  openSettings(): Promise<void>;
}

export const permissionService: PermissionService = {
  async getPhotoPermission() {
    if (Platform.OS === 'android') return 'granted'; // System Photo Picker does not require broad library access.
    const result = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (result.accessPrivileges === 'limited') return 'limited';
    return mapGranted(result.canAskAgain, result.granted, result.status);
  },
  async requestPhotoPermission() {
    if (Platform.OS === 'android') return 'granted';
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (result.accessPrivileges === 'limited') return 'limited';
    return mapGranted(result.canAskAgain, result.granted, result.status);
  },
  async getNotificationPermission() {
    const result = await Notifications.getPermissionsAsync();
    return mapGranted(result.canAskAgain, result.granted, result.status);
  },
  async requestNotificationPermission() {
    const result = await Notifications.requestPermissionsAsync();
    return mapGranted(result.canAskAgain, result.granted, result.status);
  },
  async openSettings() {
    await Linking.openSettings();
  },
};
