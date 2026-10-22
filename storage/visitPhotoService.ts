import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { VisitAttachment } from '../types';
import { ensureMediaLibraryPermission } from './photoPermissionHelper';

const VISIT_PHOTO_DIR_NAME = 'visit-photos';

/**
 * Returns the permanent directory for visit photo attachments.
 * Creates it if it doesn't exist yet.
 */
function getVisitPhotoDir(): Directory {
  const dir = new Directory(Paths.document, VISIT_PHOTO_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

export const VisitPhotoService = {
  /**
   * Opens the device gallery and allows the user to pick one or more photos.
   * Compresses photos via ImageManipulator (max dimension 1200px, JPEG quality 0.7),
   * persists selected photos to app-owned persistent document directory,
   * and returns VisitAttachment objects.
   *
   * @param currentCount Current number of active attachments on the visit
   * @param maxPhotos Maximum allowed attachments (default 5)
   */
  async pickPhotos(currentCount: number = 0, maxPhotos: number = 5): Promise<VisitAttachment[]> {
    const remainingSlots = maxPhotos - currentCount;
    if (remainingSlots <= 0) {
      return [];
    }

    try {
      const hasPermission = await ensureMediaLibraryPermission('foto bukti kunjungan');
      if (!hasPermission) {
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const attachments: VisitAttachment[] = [];
      const dir = getVisitPhotoDir();
      const assetsToProcess = result.assets.slice(0, remainingSlots);

      for (const asset of assetsToProcess) {
        if (!asset.uri) continue;

        try {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);

          // Resize and compress if possible
          let processedUri = asset.uri;
          let outWidth = asset.width;
          let outHeight = asset.height;

          try {
            const manipActions: ImageManipulator.Action[] = [];
            const maxDim = 1200;
            if (asset.width && asset.height && (asset.width > maxDim || asset.height > maxDim)) {
              if (asset.width >= asset.height) {
                manipActions.push({ resize: { width: maxDim } });
              } else {
                manipActions.push({ resize: { height: maxDim } });
              }
            }

            const manipResult = await ImageManipulator.manipulateAsync(
              asset.uri,
              manipActions,
              {
                compress: 0.7,
                format: ImageManipulator.SaveFormat.JPEG,
              }
            );
            processedUri = manipResult.uri;
            outWidth = manipResult.width;
            outHeight = manipResult.height;
          } catch (manipErr) {
            console.warn('[VisitPhotoService] Image manipulation skipped/failed:', manipErr);
          }

          const extension = 'jpg';
          const newFileName = `visit-img-${timestamp}-${randomSuffix}.${extension}`;

          const srcFile = new File(processedUri);
          const destFile = new File(dir, newFileName);

          // Copy the compressed asset to persistent app-owned document storage
          srcFile.copy(destFile);

          const nowIso = new Date().toISOString();
          let fileSize: number | undefined = undefined;
          try {
            fileSize = destFile.size;
          } catch {
            // Ignore if size is not immediately readable
          }

          attachments.push({
            id: `att-v-${timestamp}-${randomSuffix}`,
            remoteId: null,
            localUri: destFile.uri,
            fileName: newFileName,
            mimeType: 'image/jpeg',
            fileSize,
            width: outWidth,
            height: outHeight,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        } catch (copyErr) {
          console.warn('[VisitPhotoService] Failed to persist asset to local dir:', copyErr);
          const fallbackIso = new Date().toISOString();
          attachments.push({
            id: `att-v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            remoteId: null,
            localUri: asset.uri,
            fileName: asset.fileName || `visit-image-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
            fileSize: asset.fileSize,
            width: asset.width,
            height: asset.height,
            createdAt: fallbackIso,
            updatedAt: fallbackIso,
            deletedAt: null,
          });
        }
      }

      return attachments;
    } catch (error) {
      console.warn('[VisitPhotoService] Error picking photos:', error);
      return [];
    }
  },

  /**
   * Safely deletes a single attachment file from local storage.
   */
  deleteAttachmentFile(localUri: string): void {
    try {
      if (!localUri) return;
      const file = new File(localUri);
      if (file.exists) {
        file.delete();
      }
    } catch (err) {
      console.warn('[VisitPhotoService] Failed to delete file:', localUri, err);
    }
  },

  /**
   * Checks if an attachment file exists locally at the given URI.
   */
  fileExists(localUri: string): boolean {
    try {
      if (!localUri) return false;
      const file = new File(localUri);
      return file.exists;
    } catch {
      return false;
    }
  },

  /**
   * Reads raw bytes of an attachment file for cloud upload.
   */
  async readAttachmentBytes(localUri: string): Promise<Uint8Array | null> {
    try {
      if (!localUri) return null;
      const file = new File(localUri);
      if (!file.exists) return null;
      return await file.bytes();
    } catch (err) {
      console.warn('[VisitPhotoService] Failed to read attachment bytes:', localUri, err);
      return null;
    }
  },

  /**
   * Writes downloaded or restored attachment bytes to permanent local document storage.
   * Returns the persistent local URI.
   */
  async writeAttachmentBytes(fileName: string, bytes: Uint8Array): Promise<string> {
    const dir = getVisitPhotoDir();
    const destFile = new File(dir, fileName);
    if (destFile.exists) {
      destFile.delete();
    }
    await destFile.write(bytes);
    return destFile.uri;
  },

  /**
   * Downloads a file from an authenticated signed URL directly to persistent local storage.
   * Uses File.downloadFileAsync which streams the response to disk,
   * avoiding the Blob/ArrayBuffer conversion that fails in React Native Hermes.
   *
   * @param signedUrl - Authenticated, short-lived signed URL from Supabase Storage.
   * @param fileName - Deterministic local filename (e.g. `visit-img-{remoteId}.jpg`).
   * @returns The persistent local file URI, or null if the download fails.
   */
  async downloadFromSignedUrl(signedUrl: string, fileName: string): Promise<string | null> {
    try {
      const dir = getVisitPhotoDir();
      const destFile = new File(dir, fileName);

      const downloaded = await File.downloadFileAsync(signedUrl, destFile, {
        idempotent: true,
      });

      if (downloaded && downloaded.exists) {
        return downloaded.uri;
      }
      return null;
    } catch (err) {
      console.warn('[VisitPhotoService] Failed to download from signed URL:', fileName, err);
      return null;
    }
  },

  /**
   * Deletes ALL photos in the visit-photos directory.
   */
  clearAll(): void {
    const dir = getVisitPhotoDir();
    if (dir.exists) {
      dir.delete();
      dir.create();
    }
  },
};
