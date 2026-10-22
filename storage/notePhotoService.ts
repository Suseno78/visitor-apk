import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { NoteAttachment } from '../types';
import { ensureMediaLibraryPermission } from './photoPermissionHelper';

const NOTE_PHOTO_DIR_NAME = 'note-photos';

/**
 * Returns the permanent directory for note photo attachments.
 * Creates it if it doesn't exist yet.
 */
function getNotePhotoDir(): Directory {
  const dir = new Directory(Paths.document, NOTE_PHOTO_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

export const NotePhotoService = {
  /**
   * Opens the device gallery and allows the user to pick one or more photos.
   * Persists selected photos to app's document directory and returns NoteAttachment objects.
   * Returns an empty array if the user cancels or permission is denied.
   */
  async pickPhotos(): Promise<NoteAttachment[]> {
    try {
      const hasPermission = await ensureMediaLibraryPermission('foto lampiran catatan');
      if (!hasPermission) {
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const attachments: NoteAttachment[] = [];
      const dir = getNotePhotoDir();

      for (const asset of result.assets) {
        if (!asset.uri) continue;

        try {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const extension = asset.fileName?.split('.').pop() || 'jpg';
          const newFileName = `note-img-${timestamp}-${randomSuffix}.${extension}`;

          const srcFile = new File(asset.uri);
          const destFile = new File(dir, newFileName);

          // Copy the picker asset to the permanent directory
          srcFile.copy(destFile);

          const nowIso = new Date().toISOString();
          attachments.push({
            id: `att-${timestamp}-${randomSuffix}`,
            remoteId: null,
            localUri: destFile.uri,
            fileName: newFileName,
            mimeType: asset.mimeType || 'image/jpeg',
            width: asset.width,
            height: asset.height,
            createdAt: nowIso,
            updatedAt: nowIso,
            deletedAt: null,
          });
        } catch (copyErr) {
          console.warn('[NotePhotoService] Failed to copy asset to local dir:', copyErr);
          const fallbackIso = new Date().toISOString();
          // Fallback: use picker uri if copy fails
          attachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            remoteId: null,
            localUri: asset.uri,
            fileName: asset.fileName || `image-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
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
      console.warn('[NotePhotoService] Error picking photos:', error);
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
      console.warn('[NotePhotoService] Failed to delete file:', localUri, err);
    }
  },

  /**
   * Safely deletes all files associated with a note's attachments.
   */
  deleteNoteAttachmentFiles(attachments?: NoteAttachment[]): void {
    if (!attachments || !Array.isArray(attachments)) return;
    for (const att of attachments) {
      if (att.localUri) {
        this.deleteAttachmentFile(att.localUri);
      }
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
      console.warn('[NotePhotoService] Failed to read attachment bytes:', localUri, err);
      return null;
    }
  },

  /**
   * Writes downloaded cloud attachment bytes to permanent local document storage.
   * Returns the persistent local URI.
   */
  async writeAttachmentBytes(fileName: string, bytes: Uint8Array): Promise<string> {
    const dir = getNotePhotoDir();
    const destFile = new File(dir, fileName);
    if (destFile.exists) {
      destFile.delete();
    }
    await destFile.write(bytes);
    return destFile.uri;
  },

  /**
   * Downloads a file from a signed URL directly to persistent local storage.
   * Uses File.downloadFileAsync which streams the response to disk,
   * avoiding the Blob/ArrayBuffer conversion that is unsupported in React Native Hermes.
   *
   * @param signedUrl - Authenticated, short-lived signed URL from Supabase Storage.
   * @param fileName - Deterministic local filename (e.g. `note-img-{remoteId}.jpg`).
   * @returns The persistent local file URI, or null if the download fails.
   */
  async downloadFromSignedUrl(signedUrl: string, fileName: string): Promise<string | null> {
    try {
      const dir = getNotePhotoDir();
      const destFile = new File(dir, fileName);

      const downloaded = await File.downloadFileAsync(signedUrl, destFile, {
        idempotent: true,
      });

      if (downloaded && downloaded.exists) {
        return downloaded.uri;
      }
      return null;
    } catch (err) {
      console.warn('[NotePhotoService] Failed to download from signed URL:', fileName, err);
      return null;
    }
  },

  /**
   * Deletes ALL photos in the note-photos directory.
   */
  clearAll(): void {
    const dir = getNotePhotoDir();
    if (dir.exists) {
      dir.delete();
      dir.create();
    }
  },
};
