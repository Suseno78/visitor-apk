import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zipSync, unzipSync } from 'fflate';
import { Visitor, VisitraBackup } from '../types';
import { PhotoService } from './photoService';
import { VisitorStorage } from './storage';

const STORAGE_KEY = '@visitors';
const BACKUP_VERSION = 2;
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
// Public API
// ---------------------------------------------------------------------------

export const BackupService = {
  /**
   * Create a ZIP backup of all Visitra data (including photos) and open the share sheet.
   */
  async createBackup(): Promise<{ success: boolean; error?: string }> {
    try {
      const visitors = await VisitorStorage.getAll(false);

      // Clean visitor data for backup (strip any legacy photoUri)
      const visitorsForBackup = visitors.map((v) => {
        const { photoUri, ...rest } = v;
        return rest;
      });

      const backup: VisitraBackup = {
        backupVersion: BACKUP_VERSION,
        appName: APP_NAME,
        createdAt: new Date().toISOString(),
        data: { visitors: visitorsForBackup as Visitor[] },
      };

      const dataJson = JSON.stringify(backup, null, 2);

      // Build the ZIP contents
      const zipData: Record<string, Uint8Array> = {
        'data.json': new TextEncoder().encode(dataJson),
      };

      // Create ZIP
      const zipped = zipSync(zipData);

      // Write to cache and share
      const filename = `visitra-backup-${formatDate()}.zip`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.write(zipped);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Fitur berbagi tidak tersedia di perangkat ini.' };
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Simpan Backup Visitra',
        UTI: 'public.zip-archive',
      });

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat backup.';
      return { success: false, error: message };
    }
  },

  /**
   * Let the user pick a backup file, validate it, and return parsed data.
   * Supports both old JSON backups and new ZIP backups.
   */
  async pickAndValidateBackup(): Promise<{
    success: boolean;
    visitors?: Visitor[];
    photos?: Record<string, Uint8Array>;
    error?: string;
  }> {
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
  parseJsonBackup(fileBytes: Uint8Array): {
    success: boolean;
    visitors?: Visitor[];
    photos?: Record<string, Uint8Array>;
    error?: string;
  } {
    try {
      const content = new TextDecoder().decode(fileBytes);
      const parsed = JSON.parse(content);

      const validation = validateBackup(parsed);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const backupData = parsed as VisitraBackup;
      return { success: true, visitors: backupData.data.visitors, photos: {} };
    } catch {
      return { success: false, error: 'File bukan format JSON yang valid.' };
    }
  },

  /**
   * Parse a ZIP backup containing data.json and optional photos/.
   */
  parseZipBackup(zipBytes: Uint8Array): {
    success: boolean;
    visitors?: Visitor[];
    photos?: Record<string, Uint8Array>;
    error?: string;
  } {
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

      // Extract photos
      const photos: Record<string, Uint8Array> = {};
      for (const [path, bytes] of Object.entries(unzipped)) {
        if (path.startsWith('photos/') && path.length > 7) {
          const filename = path.replace('photos/', '');
          photos[filename] = bytes;
        }
      }

      const backupData = parsed as VisitraBackup;
      return { success: true, visitors: backupData.data.visitors, photos };
    } catch {
      return { success: false, error: 'File ZIP tidak dapat dibaca.' };
    }
  },

  /**
   * Commit restored data to AsyncStorage and restore photos.
   */
  async commitRestore(
    visitors: Visitor[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Clear legacy visitor photos if any exist on disk
      PhotoService.clearAll();

      // Ensure restored visitors do not have dangling photoUri references
      const updatedVisitors = visitors.map((v) => {
        const { photoUri, ...rest } = v;
        return rest as Visitor;
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVisitors));
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan data yang dipulihkan.';
      return { success: false, error: message };
    }
  },

  /**
   * Export all visitor + visit data to a CSV file and open the share sheet.
   */
  async exportCSV(): Promise<{ success: boolean; error?: string }> {
    try {
      const visitors = await VisitorStorage.getAll(false);

      const headers = [
        'Nama', 'Pekerjaan', 'Kategori', 'Alamat', 'Telepon', 'Status',
        'Tanggal Kunjungan', 'Jam', 'Durasi', 'Masalah', 'Solusi', 'Catatan',
      ];

      const rows: string[] = [];
      // UTF-8 BOM for Excel on Windows
      const BOM = '\uFEFF';

      rows.push(headers.map(escapeCsvField).join(','));

      for (const visitor of visitors) {
        if (!visitor.visits || visitor.visits.length === 0) {
          rows.push([
            escapeCsvField(visitor.name || ''),
            escapeCsvField(visitor.occupation || ''),
            escapeCsvField(visitor.category || ''),
            escapeCsvField(visitor.address || ''),
            escapeCsvField(visitor.phone || ''),
            escapeCsvField(visitor.status || ''),
            '', '', '', '', '', '',
          ].join(','));
        } else {
          for (const visit of visitor.visits) {
            rows.push([
              escapeCsvField(visitor.name || ''),
              escapeCsvField(visitor.occupation || ''),
              escapeCsvField(visitor.category || ''),
              escapeCsvField(visitor.address || ''),
              escapeCsvField(visitor.phone || ''),
              escapeCsvField(visitor.status || ''),
              escapeCsvField(visit.date || ''),
              escapeCsvField(visit.time || ''),
              escapeCsvField(visit.duration || ''),
              escapeCsvField(visit.problem || ''),
              escapeCsvField(visit.solution || ''),
              escapeCsvField(visit.notes || ''),
            ].join(','));
          }
        }
      }

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
