import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Checks and requests media library permission with user-friendly Indonesian feedback.
 *
 * Behavior:
 * - On Web: returns true (browser handles file inputs natively).
 * - If already granted or limited: returns true.
 * - If undetermined: requests permission from the user.
 * - If granted after prompt: returns true.
 * - If denied: shows an informative Alert in Indonesian.
 *   - If canAskAgain is false (permanently denied) and Linking.openSettings is available,
 *     provides a button to open device Settings.
 *   - Otherwise provides an "OK" button.
 * - Returns false when permission is denied so calling code can gracefully stop without errors.
 *
 * @param purposeLabel Descriptive label for what the permission is needed for (e.g., "foto profil", "foto kunjungan", "foto catatan").
 */
export async function ensureMediaLibraryPermission(purposeLabel: string = 'foto'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  try {
    // 1. Check current permission status
    const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (currentPermission.granted || currentPermission.accessPrivileges === 'limited') {
      return true;
    }

    // 2. If undetermined or can ask again, request permission
    if (currentPermission.canAskAgain) {
      const requestedPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (requestedPermission.granted || requestedPermission.accessPrivileges === 'limited') {
        return true;
      }

      // If user just denied
      showPermissionDeniedAlert(purposeLabel, requestedPermission.canAskAgain);
      return false;
    }

    // 3. Permanently denied (canAskAgain === false)
    showPermissionDeniedAlert(purposeLabel, false);
    return false;
  } catch (err) {
    console.warn('[PhotoPermissionHelper] Error checking media library permissions:', err);
    // On unexpected permission error, allow picker attempt or notify user
    return false;
  }
}

let isAlertShowing = false;

function showPermissionDeniedAlert(purposeLabel: string, canAskAgain: boolean): void {
  if (isAlertShowing) {
    return;
  }
  isAlertShowing = true;

  const resetAlertFlag = () => {
    isAlertShowing = false;
  };

  const title = 'Izin Akses Galeri Diperlukan';
  const message = `Visitra membutuhkan izin akses galeri foto untuk memilih ${purposeLabel}. ${
    !canAskAgain
      ? 'Izin telah dinonaktifkan. Silakan aktifkan izin foto pada Pengaturan perangkat Anda.'
      : 'Silakan berikan izin akses foto agar dapat melanjutkan.'
  }`;

  if (!canAskAgain && Linking.openSettings) {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Batal',
          style: 'cancel',
          onPress: resetAlertFlag,
        },
        {
          text: 'Buka Pengaturan',
          onPress: () => {
            resetAlertFlag();
            Linking.openSettings().catch(() => {
              // Safe fallback if opening settings is unsupported on platform
            });
          },
        },
      ],
      { onDismiss: resetAlertFlag }
    );
  } else {
    Alert.alert(
      title,
      message,
      [{ text: 'Mengerti', onPress: resetAlertFlag }],
      { onDismiss: resetAlertFlag }
    );
  }
}
