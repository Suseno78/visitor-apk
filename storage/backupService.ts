import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync, unzipSync } from 'fflate';
import { Visitor, Note, VisitraBackup } from '../types';
import { PhotoService } from './photoService';
import { VisitorStorage } from './storage';
import { NoteStorage } from './noteStorage';
import { VisitPhotoService } from './visitPhotoService';
import { NotePhotoService } from './notePhotoService';
import { SyncMetadataService } from './syncMetadataService';

const STORAGE_KEY = '@visitors';
const BACKUP_VERSION = 3;
const APP_NAME = 'Visitra';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Escape a single CSV field value for Excel compatibility. */
function escapeCsvField(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateBackup(json: unknown): ValidationResult {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'File bukan format JSON yang valid.' };
  }

  const obj = json as Record<string, unknown>;

  if (obj.appName !== APP_NAME) {
    return { valid: false, error: 'File ini bukan backup Visitra.' };
  }

  if (typeof obj.backupVersion !== 'number' || obj.backupVersion > BACKUP_VERSION) {
    return {
      valid: false,
      error: `Versi backup tidak didukung (v${obj.backupVersion}). Versi yang didukung: v${BACKUP_VERSION}.`,
    };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: 'Struktur backup tidak lengkap: data tidak ditemukan.' };
  }

  const data = obj.data as Record<string, unknown>;

  if (!Array.isArray(data.visitors)) {
    return { valid: false, error: 'Struktur backup tidak lengkap: daftar visitor tidak ditemukan.' };
  }

  for (let i = 0; i < data.visitors.length; i++) {
    const v = data.visitors[i] as Record<string, unknown>;
    if (!v || typeof v !== 'object') {
      return { valid: false, error: `Visitor ke-${i + 1} memiliki format yang tidak valid.` };
    }
    if (typeof v.id !== 'string' || typeof v.name !== 'string') {
      return { valid: false, error: `Visitor ke-${i + 1} tidak memiliki id atau nama yang valid.` };
    }
    if (!Array.isArray(v.visits)) {
      return { valid: false, error: `Visitor "${v.name}" tidak memiliki array kunjungan yang valid.` };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Parsed backup result shared between pick and commit
// ---------------------------------------------------------------------------

export interface ParsedBackupResult {
  success: boolean;
  visitors?: Visitor[];
  notes?: Note[];
  visitPhotos?: Record<string, Uint8Array>;
  notePhotos?: Record<string, Uint8Array>;
  workspaceId?: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const BackupService = {
  /**
   * Create a ZIP backup of all Visitra data (visitors, notes, visit photos,
   * note photos) and open the share sheet.
   *
   * Requirement 4: Uses `getAllWithDeleted()` for both visitors and notes so that
   * soft-delete tombstones are preserved in the backup manifest.
   *
   * Requirement 2: Strictly tracks every unreadable/missing photo attachment.
   * Aborts immediately if any photo cannot be read, cleans up cache, and reports failure.
   */
  async createBackup(): Promise<{ success: boolean; error?: string }> {
    let zipFile: File | null = null;
    try {
      // Preserve tombstones (deletedAt) so restored backups don't resurrect deleted records
      const visitors = await VisitorStorage.getAllWithDeleted();
      const notes = await NoteStorage.getAllWithDeleted();

      // Read active workspace ID
      const syncMeta = await SyncMetadataService.getMetadata();

      // Clean visitor data for backup (strip any legacy photoUri)
      const visitorsForBackup = visitors.map((v) => {
        const { photoUri, ...rest } = v;
        return rest;
      });

      const backup: VisitraBackup = {
        backupVersion: BACKUP_VERSION,
        appName: APP_NAME,
        createdAt: new Date().toISOString(),
        workspaceId: syncMeta.workspaceId || null,
        data: {
          visitors: visitorsForBackup as Visitor[],
          notes: notes.length > 0 ? notes : undefined,
        },
      };

      const dataJson = JSON.stringify(backup, null, 2);

      // Build the ZIP contents
      const zipData: Record<string, Uint8Array> = {
        'data.json': new TextEncoder().encode(dataJson),
      };

      const missingPhotos: string[] = [];

      // ----- Visit photo binaries -----
      for (const visitor of visitors) {
        if (!visitor.visits) continue;
        for (const visit of visitor.visits) {
          if (!visit.attachments) continue;
          for (const att of visit.attachments) {
            // If attachment is soft-deleted, skip photo binary export
            if (att.deletedAt) continue;
            if (!att.localUri || !att.fileName) continue;

            const bytes = await VisitPhotoService.readAttachmentBytes(att.localUri);
            if (!bytes || bytes.length === 0) {
              missingPhotos.push(`Foto kunjungan: ${att.fileName} (${visitor.name})`);
            } else {
              zipData[`visit-photos/${att.fileName}`] = bytes;
            }
          }
        }
      }

      // ----- Note photo binaries -----
      for (const note of notes) {
        if (!note.attachments) continue;
        for (const att of note.attachments) {
          if (att.deletedAt) continue;
          if (!att.localUri || !att.fileName) continue;

          const bytes = await NotePhotoService.readAttachmentBytes(att.localUri);
          if (!bytes || bytes.length === 0) {
            missingPhotos.push(`Foto catatan: ${att.fileName} ("${note.title || 'Tanpa Judul'}")`);
          } else {
            zipData[`note-photos/${att.fileName}`] = bytes;
          }
        }
      }

      // Requirement 2: Abort if any photo binary is missing or unreadable
      if (missingPhotos.length > 0) {
        const sample = missingPhotos.slice(0, 3).join('\n• ');
        const extra = missingPhotos.length > 3 ? `\n...dan ${missingPhotos.length - 3} file lainnya` : '';
        return {
          success: false,
          error: `Backup dibatalkan karena ${missingPhotos.length} file foto lampiran tidak ditemukan atau rusak di penyimpanan lokal:\n• ${sample}${extra}\n\nPastikan semua file lampiran dapat diakses sebelum membuat backup.`,
        };
      }

      // Create ZIP
      const zipped = zipSync(zipData);

      // Write to cache and share
      const filename = `visitra-backup-${formatDate()}.zip`;
      zipFile = new File(Paths.cache, filename);
      if (zipFile.exists) zipFile.delete();
      zipFile.write(zipped);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        if (zipFile.exists) zipFile.delete();
        return { success: false, error: 'Fitur berbagi tidak tersedia di perangkat ini.' };
      }

      await Sharing.shareAsync(zipFile.uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Simpan Backup Visitra',
        UTI: 'public.zip-archive',
      });

      return { success: true };
    } catch (err: unknown) {
      if (zipFile && zipFile.exists) {
        try {
          zipFile.delete();
        } catch {
          // ignore cache cleanup error
        }
      }
      const message = err instanceof Error ? err.message : 'Gagal membuat backup.';
      return { success: false, error: message };
    }
  },

  /**
   * Let the user pick a backup file, validate it, and return parsed data.
   * Supports both old JSON backups and new ZIP backups.
   */
  async pickAndValidateBackup(): Promise<ParsedBackupResult> {
    try {
      const result = await File.pickFileAsync({
        mimeTypes: ['application/json', 'application/zip', 'application/x-zip-compressed', '*/*'],
      });

      if (result.canceled) {
        return { success: false };
      }

      const pickedFile = result.result;
      if (!pickedFile) {
        return { success: false, error: 'Tidak dapat membaca file yang dipilih.' };
      }

      // Determine if it's a ZIP or JSON
      const fileBytes = await pickedFile.bytes();

      // ZIP magic bytes: PK (0x50, 0x4B)
      const isZip = fileBytes.length >= 2 && fileBytes[0] === 0x50 && fileBytes[1] === 0x4B;

      if (isZip) {
        return this.parseZipBackup(fileBytes);
      } else {
        return this.parseJsonBackup(fileBytes);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membaca file backup.';
      return { success: false, error: message };
    }
  },

  /**
   * Parse a legacy JSON backup.
   */
  parseJsonBackup(fileBytes: Uint8Array): ParsedBackupResult {
    try {
      const content = new TextDecoder().decode(fileBytes);
      const parsed = JSON.parse(content);

      const validation = validateBackup(parsed);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const backupData = parsed as VisitraBackup;
      return {
        success: true,
        visitors: backupData.data.visitors,
        notes: backupData.data.notes || undefined,
        visitPhotos: {},
        notePhotos: {},
        workspaceId: backupData.workspaceId || null,
      };
    } catch {
      return { success: false, error: 'File bukan format JSON yang valid.' };
    }
  },

  /**
   * Parse a ZIP backup containing data.json and optional visit-photos/ and note-photos/.
   * Also supports legacy photos/ prefix for backward compatibility.
   */
  parseZipBackup(zipBytes: Uint8Array): ParsedBackupResult {
    try {
      const unzipped = unzipSync(zipBytes);

      // Find data.json
      const dataJsonBytes = unzipped['data.json'];
      if (!dataJsonBytes) {
        return { success: false, error: 'Backup ZIP tidak berisi data.json.' };
      }

      const content = new TextDecoder().decode(dataJsonBytes);
      const parsed = JSON.parse(content);

      const validation = validateBackup(parsed);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Extract visit photos
      const visitPhotos: Record<string, Uint8Array> = {};
      // Extract note photos
      const notePhotos: Record<string, Uint8Array> = {};

      for (const [path, bytes] of Object.entries(unzipped)) {
        if (path.startsWith('visit-photos/') && path.length > 13) {
          const filename = path.substring(13); // strip 'visit-photos/'
          visitPhotos[filename] = bytes;
        } else if (path.startsWith('note-photos/') && path.length > 12) {
          const filename = path.substring(12); // strip 'note-photos/'
          notePhotos[filename] = bytes;
        } else if (path.startsWith('photos/') && path.length > 7) {
          // Legacy v2 format — treat as visit photos
          const filename = path.substring(7);
          visitPhotos[filename] = bytes;
        }
      }

      const backupData = parsed as VisitraBackup;
      return {
        success: true,
        visitors: backupData.data.visitors,
        notes: backupData.data.notes || undefined,
        visitPhotos,
        notePhotos,
        workspaceId: backupData.workspaceId || null,
      };
    } catch {
      return { success: false, error: 'File ZIP tidak dapat dibaca.' };
    }
  },

  /**
   * Commit restored data with rollback protection.
   *
   * Safeguards:
   * 1. Validates all inputs before touching disk or AsyncStorage.
   * 2. Takes in-memory snapshot of current visitors and notes.
   * 3. Backs up any existing physical photo files that might be overwritten.
   * 4. Tracks newly created photo files during restoration.
   * 5. If legacy backup without Notes is restored (`notes === undefined`), existing Notes are preserved intact.
   * 6. If any step throws, restores previous AsyncStorage data and original files, deletes newly written files.
   * 7. Reports critical recovery error if rollback itself fails.
   */
  async commitRestore(
    visitors: Visitor[],
    notes?: Note[],
    visitPhotos?: Record<string, Uint8Array>,
    notePhotos?: Record<string, Uint8Array>,
  ): Promise<{ success: boolean; error?: string; restoredVisitPhotos?: number; restoredNotePhotos?: number }> {
    // Phase 1: Pre-commit snapshot of existing data
    const snapshotVisitors = await AsyncStorage.getItem(STORAGE_KEY);
    const snapshotNotes = await AsyncStorage.getItem('@notes');

    // Tracking for rollback
    const newlyCreatedFiles: File[] = [];
    const overwrittenBackups: { file: File; originalBytes: Uint8Array }[] = [];

    const visitPhotoDir = new Directory(Paths.document, 'visit-photos');
    if (!visitPhotoDir.exists) visitPhotoDir.create();

    const notePhotoDir = new Directory(Paths.document, 'note-photos');
    if (!notePhotoDir.exists) notePhotoDir.create();

    let restoredVisitPhotos = 0;
    let restoredNotePhotos = 0;

    try {
      // Clear legacy photo directory if present
      PhotoService.clearAll();

      // Deep copy visitor objects so rollback does not modify caller objects
      const targetVisitors: Visitor[] = JSON.parse(JSON.stringify(visitors));

      // ----- Write visit photo binaries -----
      if (visitPhotos && Object.keys(visitPhotos).length > 0) {
        for (const visitor of targetVisitors) {
          if (!visitor.visits) continue;
          for (const visit of visitor.visits) {
            if (!visit.attachments) continue;
            for (const att of visit.attachments) {
              if (att.deletedAt) continue;
              const photoBytes = visitPhotos[att.fileName];
              if (photoBytes && photoBytes.length > 0) {
                const destFile = new File(visitPhotoDir, att.fileName);
                if (destFile.exists) {
                  // Capture previous content for rollback
                  try {
                    const existingBytes = await destFile.bytes();
                    overwrittenBackups.push({ file: destFile, originalBytes: existingBytes });
                  } catch {
                    // ignore read error
                  }
                  destFile.delete();
                } else {
                  newlyCreatedFiles.push(destFile);
                }

                await destFile.write(photoBytes);
                att.localUri = destFile.uri;
                restoredVisitPhotos++;
              }
            }
          }
        }
      }

      // ----- Write note photo binaries -----
      let targetNotes: Note[] | undefined = undefined;
      if (notes !== undefined) {
        targetNotes = JSON.parse(JSON.stringify(notes));
        if (notePhotos && Object.keys(notePhotos).length > 0 && targetNotes) {
          for (const note of targetNotes) {
            if (!note.attachments) continue;
            for (const att of note.attachments) {
              if (att.deletedAt) continue;
              const photoBytes = notePhotos[att.fileName];
              if (photoBytes && photoBytes.length > 0) {
                const destFile = new File(notePhotoDir, att.fileName);
                if (destFile.exists) {
                  try {
                    const existingBytes = await destFile.bytes();
                    overwrittenBackups.push({ file: destFile, originalBytes: existingBytes });
                  } catch {
                    // ignore read error
                  }
                  destFile.delete();
                } else {
                  newlyCreatedFiles.push(destFile);
                }

                await destFile.write(photoBytes);
                att.localUri = destFile.uri;
                restoredNotePhotos++;
              }
            }
          }
        }
      }

      // Ensure restored visitors do not have dangling photoUri references
      const updatedVisitors = targetVisitors.map((v) => {
        const { photoUri, ...rest } = v;
        return rest as Visitor;
      });

      // Save visitors to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVisitors));

      // Save notes only if backup provided notes (protect existing notes on legacy backup)
      if (targetNotes !== undefined) {
        await NoteStorage.saveAll(targetNotes);
      }

      return { success: true, restoredVisitPhotos, restoredNotePhotos };
    } catch (err: unknown) {
      console.error('[BackupService] Restore commit failed, beginning rollback:', err);

      // Rollback Phase: Restore AsyncStorage and revert disk mutations
      let rollbackFailed = false;
      try {
        if (snapshotVisitors !== null) {
          await AsyncStorage.setItem(STORAGE_KEY, snapshotVisitors);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }

        if (snapshotNotes !== null) {
          await AsyncStorage.setItem('@notes', snapshotNotes);
        } else {
          await AsyncStorage.removeItem('@notes');
        }

        // Delete newly created files
        for (const file of newlyCreatedFiles) {
          if (file.exists) file.delete();
        }

        // Re-write overwritten files
        for (const backup of overwrittenBackups) {
          if (backup.file.exists) backup.file.delete();
          await backup.file.write(backup.originalBytes);
        }
      } catch (rollbackErr) {
        console.error('[BackupService] Rollback procedure failed:', rollbackErr);
        rollbackFailed = true;
      }

      const commitError = err instanceof Error ? err.message : 'Kesalahan tidak diketahui.';
      if (rollbackFailed) {
        return {
          success: false,
          error: `Pemulihan gagal (${commitError}) dan proses pengembalian data otomatis mengalami kegagalan sebagian. Silakan periksa data Anda atau pulihkan dari backup yang valid.`,
        };
      }

      return {
        success: false,
        error: `Pemulihan gagal: ${commitError}. Data lokal berhasil dikembalikan ke kondisi sebelum pemulihan.`,
      };
    }
  },

  /**
   * Export summary metrics to a CSV file and open the share sheet.
   * Produces a 2-column summary (Metrik,Total) matching the Excel Ringkasan scope.
   */
  async exportCSV(): Promise<{ success: boolean; error?: string }> {
    try {
      const visitors = await VisitorStorage.getAll(false);
      const notes = await NoteStorage.getAll(false);

      let totalVisits = 0;
      for (const v of visitors) {
        totalVisits += (v.visits || []).filter((vt) => !vt.deletedAt).length;
      }

      const now = new Date();
      const indoMonths = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      const day = now.getDate();
      const month = indoMonths[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const formattedDateTime = `${day} ${month} ${year}, ${hours}:${minutes} WIB`;

      const headers = ['Metrik', 'Total'];
      const rows: string[] = [
        headers.map(escapeCsvField).join(','),
        `${escapeCsvField('Total Pengunjung')},${visitors.length}`,
        `${escapeCsvField('Total Kunjungan')},${totalVisits}`,
        `${escapeCsvField('Total Catatan')},${notes.length}`,
        `${escapeCsvField('Tanggal Pembuatan')},${escapeCsvField(formattedDateTime)}`,
      ];

      // UTF-8 BOM for Excel on Windows
      const BOM = '\uFEFF';
      const csvContent = BOM + rows.join('\r\n');
      const filename = `visitra-export-${formatDate()}.csv`;
      const file = new File(Paths.cache, filename);
      file.write(csvContent);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Fitur berbagi tidak tersedia di perangkat ini.' };
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV Visitra',
        UTI: 'public.comma-separated-values-text',
      });

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat file CSV.';
      return { success: false, error: message };
    }
  },
};
