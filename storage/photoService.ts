import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHOTO_DIR_NAME = 'photos';
const MAX_DIMENSION = 400;
const JPEG_QUALITY = 0.7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPhotoDir(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function photoFilename(visitorId: string): string {
  return `visitor-${visitorId}.jpg`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const PhotoService = {
  /**
   * Open the device gallery and let the user pick one image.
   * Returns the picker URI (temporary) or null if cancelled.
   */
  async pickPhoto(): Promise<string | null> {
    // Request permission (no-op on web)
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets[0].uri;
  },

  /**
   * Resize, compress, and persist a photo for the given visitor.
   * Returns the persistent local URI.
   */
  async processAndSave(visitorId: string, sourceUri: string): Promise<string> {
    // Resize + compress
    const manipulated = await manipulateAsync(
      sourceUri,
      [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: SaveFormat.JPEG }
    );

    const dir = getPhotoDir();
    const filename = photoFilename(visitorId);
    const destFile = new File(dir, filename);

    // Remove old file if it exists
    if (destFile.exists) {
      destFile.delete();
    }

    // Copy the manipulated file to the persistent directory
    const sourceFile = new File(manipulated.uri);
    sourceFile.move(destFile);

    return destFile.uri;
  },

  /**
   * Get the persistent photo URI for a visitor, or null if none exists.
   */
  getPhotoUri(visitorId: string): string | null {
    const dir = getPhotoDir();
    const file = new File(dir, photoFilename(visitorId));
    return file.exists ? file.uri : null;
  },

  /**
   * Delete the photo file for a visitor.
   */
  deletePhoto(visitorId: string): void {
    const dir = getPhotoDir();
    const file = new File(dir, photoFilename(visitorId));
    if (file.exists) {
      file.delete();
    }
  },

  /**
   * Delete photos for multiple visitor IDs.
   */
  deletePhotos(visitorIds: string[]): void {
    for (const id of visitorIds) {
      this.deletePhoto(id);
    }
  },

  /**
   * Delete ALL photos in the photos directory.
   */
  clearAll(): void {
    const dir = getPhotoDir();
    if (dir.exists) {
      dir.delete();
      // Recreate the empty dir
      dir.create();
    }
  },

  /**
   * Read photo file bytes for backup. Returns null if no photo exists.
   */
  async readPhotoBytes(visitorId: string): Promise<Uint8Array | null> {
    const dir = getPhotoDir();
    const file = new File(dir, photoFilename(visitorId));
    if (!file.exists) return null;
    try {
      return await file.bytes();
    } catch {
      return null;
    }
  },

  /**
   * Write photo bytes from a backup restore.
   */
  writePhotoBytes(visitorId: string, data: Uint8Array): string {
    const dir = getPhotoDir();
    const filename = photoFilename(visitorId);
    const file = new File(dir, filename);
    if (file.exists) file.delete();
    file.write(data);
    return file.uri;
  },

  /**
   * Get the filename used for a visitor's photo (for backup references).
   */
  getFilename(visitorId: string): string {
    return photoFilename(visitorId);
  },
};
