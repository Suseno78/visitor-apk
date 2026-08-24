import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Visitor, VisitraBackup } from '../types';

const STORAGE_KEY = '@visitors';
const BACKUP_VERSION = 1;
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
   * Create a JSON backup of all Visitra data and open the share sheet.
   */
  async createBackup(): Promise<{ success: boolean; error?: string }> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const visitors: Visitor[] = raw ? JSON.parse(raw) : [];

      const backup: VisitraBackup = {
        backupVersion: BACKUP_VERSION,
        appName: APP_NAME,
        createdAt: new Date().toISOString(),
        data: { visitors },
      };

      const filename = `visitra-backup-${formatDate()}.json`;
      const file = new File(Paths.cache, filename);
      file.write(JSON.stringify(backup, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Fitur berbagi tidak tersedia di perangkat ini.' };
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Simpan Backup Visitra',
        UTI: 'public.json',
      });

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat backup.';
      return { success: false, error: message };
    }
  },

  /**
   * Let the user pick a JSON backup file, validate it, and return parsed data.
   */
  async pickAndValidateBackup(): Promise<{
    success: boolean;
    visitors?: Visitor[];
    error?: string;
  }> {
    try {
      // Use File.pickFileAsync from expo-file-system directly.
      // This returns a File object with proper read permissions,
      // unlike expo-document-picker which returns a content:// URI
      // that the new File class cannot read without explicit permissions.
      const result = await File.pickFileAsync({
        mimeTypes: ['application/json', '*/*'],
      });

      if (result.canceled) {
        return { success: false }; // User cancelled — not an error
      }

      const pickedFile = result.result;
      if (!pickedFile) {
        return { success: false, error: 'Tidak dapat membaca file yang dipilih.' };
      }

      const content = await pickedFile.text();

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { success: false, error: 'File bukan format JSON yang valid.' };
      }

      const validation = validateBackup(parsed);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const backupData = parsed as VisitraBackup;
      return { success: true, visitors: backupData.data.visitors };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membaca file backup.';
      return { success: false, error: message };
    }
  },

  /**
   * Atomically write validated visitor data to AsyncStorage.
   */
  async commitRestore(visitors: Visitor[]): Promise<{ success: boolean; error?: string }> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
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
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const visitors: Visitor[] = raw ? JSON.parse(raw) : [];

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
