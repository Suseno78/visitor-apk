import { supabase } from '../lib/supabase';
import { VisitorStorage } from '../storage/storage';
import { NoteStorage } from '../storage/noteStorage';
import { NotePhotoService } from '../storage/notePhotoService';
import { SyncMetadataService } from '../storage/syncMetadataService';
import { Visitor, Visit, VisitorCategory, Note, NoteAttachment } from '../types';

// =============================================================================
// Helper: UUID v4 Generator
// =============================================================================

/**
 * Generates a standard RFC 4122 version 4 UUID.
 * Uses globalThis.crypto.randomUUID if available, with crypto.getRandomValues fallback.
 */
export function generateUUID(): string {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fall through to crypto.getRandomValues if randomUUID throws
    }
  }

  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set UUID v4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Math.random fallback (RFC 4122 v4 compliant layout)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// Helper: Date & Time Conversions
// =============================================================================

const INDO_MONTH_MAP: Record<string, string> = {
  januari: '01',
  februari: '02',
  maret: '03',
  april: '04',
  mei: '05',
  juni: '06',
  juli: '07',
  agustus: '08',
  september: '09',
  oktober: '10',
  november: '11',
  desember: '12',
};

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Converts local Indonesian display date (e.g. "Rabu, 23 September 2026" or "23 September 2026")
 * or standard format into PostgreSQL `date` format (YYYY-MM-DD).
 */
export function formatIndoDateToYMD(indoDate: string | null | undefined): string | null {
  if (!indoDate || typeof indoDate !== 'string') return null;
  const trimmed = indoDate.trim();
  if (!trimmed) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Matches "23 September 2026" optionally preceded by day name "Rabu, "
  const match = trimmed.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase();
    const month = INDO_MONTH_MAP[monthKey];
    const year = match[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Attempt Date parse fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Converts PostgreSQL `date` format (YYYY-MM-DD) into Indonesian display date
 * (e.g. "Rabu, 23 September 2026").
 */
export function formatYMDToIndoDate(ymd: string | null | undefined): string {
  if (!ymd || typeof ymd !== 'string') return '';
  const trimmed = ymd.trim();
  if (!trimmed) return '';

  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, monthIndex, day);
    if (!isNaN(d.getTime())) {
      const dayName = INDO_DAYS[d.getDay()];
      const monthName = INDO_MONTHS[monthIndex];
      return `${dayName}, ${day} ${monthName} ${year}`;
    }
  }

  return trimmed;
}

/**
 * Normalizes time string (e.g. "09:30" or "09:30:00") for PostgreSQL `time` column.
 */
export function formatTimeToTimeCol(timeStr: string | null | undefined): string | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// =============================================================================
// Cloud Types
// =============================================================================

export interface CloudVisitorRow {
  id: string;
  workspace_id: string;
  name: string;
  occupation: string | null;
  category: string;
  address: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudVisitRow {
  id: string;
  visitor_id: string;
  visit_date: string | null;
  visit_time: string | null;
  duration: string | null;
  problem: string | null;
  solution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudNoteRow {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CloudNoteImageRow {
  id: string;
  note_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SyncResult {
  success: boolean;
  visitorsUploaded?: number;
  visitsUploaded?: number;
  visitorsPulled?: number;
  visitsPulled?: number;
  notesUploaded?: number;
  notesPulled?: number;
  attachmentsUploaded?: number;
  attachmentsDownloaded?: number;
  totalActiveVisitors?: number;
  totalActiveVisits?: number;
  totalActiveNotes?: number;
  totalActiveAttachments?: number;
  error?: string;
}

// =============================================================================
// SyncService Implementation
// =============================================================================

export const SyncService = {
  /**
   * OWNER DEVICE: Local → Cloud Migration
   *
   * 1. Verifies authentication and owner role in workspace.
   * 2. Loads all local visitors including soft-deleted ones.
   * 3. Assigns a persistent UUID `remoteId` to any visitor and visit lacking one.
   * 4. Persists assigned remoteIds to local storage so future retries are idempotent.
   * 5. Upserts visitors to `public.visitors`.
   * 6. Upserts visits to `public.visits`.
   * 7. Preserves `deleted_at` tombstones in cloud rows.
   * 8. Updates local `@visitra_sync_metadata` upon full completion.
   */
  async syncLocalToCloud(workspaceId: string, role: string | null): Promise<SyncResult> {
    try {
      // 1. Role verification
      if (!workspaceId) {
        return { success: false, error: 'Workspace ID tidak ditemukan.' };
      }

      // Check active auth session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        return { success: false, error: 'Sesi autentikasi tidak aktif.' };
      }

      // -----------------------------------------------------------------------
      // Step 1: FETCH CLOUD DATA FIRST (Protect newer data via LWW)
      // -----------------------------------------------------------------------
      const { data: cloudVisitors, error: vError } = await supabase
        .from('visitors')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (vError) {
        console.error('[SyncService] Failed to fetch cloud visitors:', vError);
        return { success: false, error: `Gagal mengambil data visitor dari cloud: ${vError.message}` };
      }

      const cloudVisitorIds = (cloudVisitors || []).map((v) => v.id);
      let cloudVisits: CloudVisitRow[] = [];

      if (cloudVisitorIds.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < cloudVisitorIds.length; i += CHUNK_SIZE) {
          const chunkIds = cloudVisitorIds.slice(i, i + CHUNK_SIZE);
          const { data: visitsChunk, error: vtError } = await supabase
            .from('visits')
            .select('*')
            .in('visitor_id', chunkIds);

          if (vtError) {
            console.error('[SyncService] Failed to fetch cloud visits:', vtError);
            return {
              success: false,
              error: `Gagal mengambil data riwayat kunjungan: ${vtError.message}`,
            };
          }
          if (visitsChunk) {
            cloudVisits = cloudVisits.concat(visitsChunk as CloudVisitRow[]);
          }
        }
      }

      // Group cloud visits by visitor_id
      const visitsByVisitorRemoteId = new Map<string, CloudVisitRow[]>();
      for (const vt of cloudVisits) {
        const list = visitsByVisitorRemoteId.get(vt.visitor_id) || [];
        list.push(vt);
        visitsByVisitorRemoteId.set(vt.visitor_id, list);
      }

      const cloudVisitorMap = new Map<string, CloudVisitorRow>();
      for (const cv of (cloudVisitors as CloudVisitorRow[]) || []) {
        cloudVisitorMap.set(cv.id, cv);
      }

      // -----------------------------------------------------------------------
      // Step 2: LOAD LOCAL DATA & ASSIGN STABLE remoteIds IF MISSING
      // -----------------------------------------------------------------------
      const initialLocalVisitors = await VisitorStorage.getAll(true);
      let hasGeneratedIds = false;

      const preparedLocalVisitors: Visitor[] = initialLocalVisitors.map((v) => {
        let vRemoteId = v.remoteId;
        if (!vRemoteId) {
          vRemoteId = generateUUID();
          hasGeneratedIds = true;
        }

        const preparedVisits = (v.visits || []).map((vt) => {
          let vtRemoteId = vt.remoteId;
          if (!vtRemoteId) {
            vtRemoteId = generateUUID();
            hasGeneratedIds = true;
          }
          return {
            ...vt,
            remoteId: vtRemoteId,
          };
        });

        return {
          ...v,
          remoteId: vRemoteId,
          visits: preparedVisits,
        };
      });

      if (hasGeneratedIds) {
        await VisitorStorage.saveAll(preparedLocalVisitors);
      }

      // Build map of prepared local visitors by remoteId
      const localByRemoteId = new Map<string, Visitor>();
      for (const lv of preparedLocalVisitors) {
        if (lv.remoteId) {
          localByRemoteId.set(lv.remoteId, lv);
        }
      }

      // -----------------------------------------------------------------------
      // Step 3 & 4: COMPARE RECORDS & DETERMINE PUSH VS MERGE
      // -----------------------------------------------------------------------
      const visitorsToUpload: CloudVisitorRow[] = [];
      const visitsToUpload: CloudVisitRow[] = [];
      const mergedVisitors: Visitor[] = [];
      const processedRemoteIds = new Set<string>();

      // A. Process all Local records
      for (const lv of preparedLocalVisitors) {
        const lvRemoteId = lv.remoteId!;
        processedRemoteIds.add(lvRemoteId);
        const cv = cloudVisitorMap.get(lvRemoteId);
        const relatedCloudVisits = visitsByVisitorRemoteId.get(lvRemoteId) || [];

        if (cv) {
          // Record exists BOTH locally and in Cloud: Compare timestamps (LWW)
          const localUpdatedMs = new Date(lv.updatedAt || 0).getTime();
          const cloudUpdatedMs = new Date(cv.updated_at).getTime();

          let targetVisitor: Visitor;

          if (localUpdatedMs > cloudUpdatedMs) {
            // Local is strictly newer: Upload local profile to Cloud
            const categoryVal =
              lv.category === 'VIP' || lv.category === 'Family' ? lv.category : 'Reguler';
            const createdAtIso =
              typeof lv.createdAt === 'number'
                ? new Date(lv.createdAt).toISOString()
                : new Date().toISOString();

            visitorsToUpload.push({
              id: lvRemoteId,
              workspace_id: workspaceId,
              name: lv.name,
              occupation: lv.occupation || null,
              category: categoryVal,
              address: lv.address || null,
              phone: lv.phone || null,
              status: lv.status || 'Aktif',
              created_at: createdAtIso,
              updated_at: lv.updatedAt || createdAtIso,
              deleted_at: lv.deletedAt || null,
            });

            targetVisitor = lv;
          } else if (cloudUpdatedMs > localUpdatedMs) {
            // Cloud is strictly newer: Take cloud values into local
            targetVisitor = {
              ...lv,
              name: cv.name,
              category: (cv.category as VisitorCategory) || 'Reguler',
              occupation: cv.occupation || undefined,
              address: cv.address || '',
              phone: cv.phone || undefined,
              status: (cv.status as 'Aktif' | 'Selesai') || 'Aktif',
              deletedAt: cv.deleted_at,
              updatedAt: cv.updated_at,
            };
          } else {
            // Timestamps are equal: Already in sync
            targetVisitor = lv;
          }

          // Merge visits independently by Visit.remoteId
          const cloudVisitMap = new Map<string, CloudVisitRow>();
          for (const cvt of relatedCloudVisits) {
            cloudVisitMap.set(cvt.id, cvt);
          }

          // Check which local visits need to be uploaded
          for (const lvt of lv.visits || []) {
            const cvt = lvt.remoteId ? cloudVisitMap.get(lvt.remoteId) : undefined;
            if (!cvt) {
              // Local visit missing in cloud: Upload
              const visitDateYMD = formatIndoDateToYMD(lvt.date);
              const visitTimeCol = formatTimeToTimeCol(lvt.time);
              const vtCreatedAt = lvt.createdAt || lv.updatedAt || new Date().toISOString();
              const vtUpdatedAt = lvt.updatedAt || vtCreatedAt;

              visitsToUpload.push({
                id: lvt.remoteId!,
                visitor_id: lvRemoteId,
                visit_date: visitDateYMD,
                visit_time: visitTimeCol,
                duration: lvt.duration || null,
                problem: lvt.problem || null,
                solution: lvt.solution || null,
                notes: lvt.notes || null,
                created_at: vtCreatedAt,
                updated_at: vtUpdatedAt,
                deleted_at: lvt.deletedAt || null,
              });
            } else {
              // Both have visit: Check if local is strictly newer
              const localVtUpdatedMs = new Date(lvt.updatedAt || 0).getTime();
              const cloudVtUpdatedMs = new Date(cvt.updated_at).getTime();
              if (localVtUpdatedMs > cloudVtUpdatedMs) {
                const visitDateYMD = formatIndoDateToYMD(lvt.date);
                const visitTimeCol = formatTimeToTimeCol(lvt.time);
                visitsToUpload.push({
                  id: lvt.remoteId!,
                  visitor_id: lvRemoteId,
                  visit_date: visitDateYMD,
                  visit_time: visitTimeCol,
                  duration: lvt.duration || null,
                  problem: lvt.problem || null,
                  solution: lvt.solution || null,
                  notes: lvt.notes || null,
                  created_at: lvt.createdAt || cvt.created_at,
                  updated_at: lvt.updatedAt,
                  deleted_at: lvt.deletedAt || null,
                });
              }
            }
          }

          const mergedVisits = mergeVisitsList(lv.visits || [], relatedCloudVisits);
          mergedVisitors.push({
            ...targetVisitor,
            visits: mergedVisits,
          });
        } else {
          // Local-only visitor (missing in Cloud): Upload local visitor and its visits
          const categoryVal =
            lv.category === 'VIP' || lv.category === 'Family' ? lv.category : 'Reguler';
          const createdAtIso =
            typeof lv.createdAt === 'number'
              ? new Date(lv.createdAt).toISOString()
              : new Date().toISOString();

          visitorsToUpload.push({
            id: lvRemoteId,
            workspace_id: workspaceId,
            name: lv.name,
            occupation: lv.occupation || null,
            category: categoryVal,
            address: lv.address || null,
            phone: lv.phone || null,
            status: lv.status || 'Aktif',
            created_at: createdAtIso,
            updated_at: lv.updatedAt || createdAtIso,
            deleted_at: lv.deletedAt || null,
          });

          for (const lvt of lv.visits || []) {
            const visitDateYMD = formatIndoDateToYMD(lvt.date);
            const visitTimeCol = formatTimeToTimeCol(lvt.time);
            const vtCreatedAt = lvt.createdAt || lv.updatedAt || new Date().toISOString();
            const vtUpdatedAt = lvt.updatedAt || vtCreatedAt;

            visitsToUpload.push({
              id: lvt.remoteId!,
              visitor_id: lvRemoteId,
              visit_date: visitDateYMD,
              visit_time: visitTimeCol,
              duration: lvt.duration || null,
              problem: lvt.problem || null,
              solution: lvt.solution || null,
              notes: lvt.notes || null,
              created_at: vtCreatedAt,
              updated_at: vtUpdatedAt,
              deleted_at: lvt.deletedAt || null,
            });
          }

          mergedVisitors.push(lv);
        }
      }

      // B. Process Cloud-only visitors (missing locally, e.g. created by BY0W)
      for (const cv of (cloudVisitors as CloudVisitorRow[]) || []) {
        if (!processedRemoteIds.has(cv.id)) {
          const createdEpoch = new Date(cv.created_at).getTime();
          const localId = `v-${createdEpoch}-${Math.random().toString(36).substring(2, 6)}`;
          const relatedCloudVisits = visitsByVisitorRemoteId.get(cv.id) || [];

          const localVisitsFromCloud: Visit[] = relatedCloudVisits.map((rvt) => {
            const vtEpoch = new Date(rvt.created_at).getTime();
            return {
              id: `vt-${vtEpoch}-${Math.random().toString(36).substring(2, 6)}`,
              remoteId: rvt.id,
              date: formatYMDToIndoDate(rvt.visit_date),
              time: rvt.visit_time || '',
              duration: rvt.duration || undefined,
              problem: rvt.problem || '',
              solution: rvt.solution || '',
              notes: rvt.notes || undefined,
              createdAt: rvt.created_at,
              updatedAt: rvt.updated_at,
              deletedAt: rvt.deleted_at || null,
            };
          });

          mergedVisitors.push({
            id: localId,
            remoteId: cv.id,
            name: cv.name,
            category: (cv.category as VisitorCategory) || 'Reguler',
            occupation: cv.occupation || undefined,
            address: cv.address || '',
            phone: cv.phone || undefined,
            status: (cv.status as 'Aktif' | 'Selesai') || 'Aktif',
            createdAt: createdEpoch,
            updatedAt: cv.updated_at,
            deletedAt: cv.deleted_at,
            visits: localVisitsFromCloud,
          });
        }
      }

      // -----------------------------------------------------------------------
      // Step 5: EXECUTE UPLOADS TO SUPABASE (If any local changes need pushing)
      // -----------------------------------------------------------------------
      const CHUNK_SIZE = 50;
      if (visitorsToUpload.length > 0) {
        for (let i = 0; i < visitorsToUpload.length; i += CHUNK_SIZE) {
          const chunk = visitorsToUpload.slice(i, i + CHUNK_SIZE);
          const { error: vError } = await supabase
            .from('visitors')
            .upsert(chunk, { onConflict: 'id' });

          if (vError) {
            console.error('[SyncService] Failed to upsert visitors:', vError);
            return {
              success: false,
              error: `Gagal mengunggah data visitor ke cloud: ${vError.message}`,
            };
          }
        }
      }

      if (visitsToUpload.length > 0) {
        for (let i = 0; i < visitsToUpload.length; i += CHUNK_SIZE) {
          const chunk = visitsToUpload.slice(i, i + CHUNK_SIZE);
          const { error: vtError } = await supabase
            .from('visits')
            .upsert(chunk, { onConflict: 'id' });

          if (vtError) {
            console.error('[SyncService] Failed to upsert visits:', vtError);
            return {
              success: false,
              error: `Gagal mengunggah data riwayat kunjungan: ${vtError.message}`,
            };
          }
        }
      }

      // -----------------------------------------------------------------------
      // Step 6: PERSIST FINAL MERGED DATASET TO ASYNCSTORAGE
      // -----------------------------------------------------------------------
      await VisitorStorage.saveAll(mergedVisitors);

      // -----------------------------------------------------------------------
      // Step 7: UPDATE SYNC METADATA UPON FULL SUCCESS
      // -----------------------------------------------------------------------
      const syncTimestamp = new Date().toISOString();
      await SyncMetadataService.setMetadata({
        lastSyncedAt: syncTimestamp,
        workspaceId,
      });

      // Active records counting (excluding soft-deleted)
      const activeTotalVisitors = mergedVisitors.filter((v) => !v.deletedAt).length;
      const activeTotalVisits = mergedVisitors.reduce(
        (sum, v) => sum + (v.visits || []).filter((vt) => !vt.deletedAt).length,
        0
      );

      return {
        success: true,
        visitorsUploaded: visitorsToUpload.filter((r) => !r.deleted_at).length,
        visitsUploaded: visitsToUpload.filter((r) => !r.deleted_at).length,
        visitorsPulled: (cloudVisitors || []).filter((r) => !r.deleted_at).length,
        visitsPulled: cloudVisits.filter((r) => !r.deleted_at).length,
        totalActiveVisitors: activeTotalVisitors,
        totalActiveVisits: activeTotalVisits,
      };
    } catch (err: any) {
      console.error('[SyncService] Unexpected error in syncLocalToCloud:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * MEMBER DEVICE: Cloud → Local Pull
   *
   * 1. Verifies authentication and workspace membership.
   * 2. Queries cloud visitors belonging to `workspace_id` (including soft-deleted).
   * 3. Queries cloud visits belonging to those visitors.
   * 4. Merges into local storage:
   *    - Matches visitors by `remoteId`.
   *    - Merges visits independently by Visit `remoteId` (does NOT blindly replace visits[]).
   *    - Applies Last-Write-Wins based on `updatedAt` / `updated_at`.
   *    - Soft-deletions propagate as tombstones without cascading hard-deletes.
   * 5. Updates local `@visitra_sync_metadata`.
   */
  async syncCloudToLocal(workspaceId: string): Promise<SyncResult> {
    try {
      if (!workspaceId) {
        return { success: false, error: 'Workspace ID tidak ditemukan.' };
      }

      // Check active auth session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        return { success: false, error: 'Sesi autentikasi tidak aktif.' };
      }

      // -----------------------------------------------------------------------
      // Step A: MEMBER PUSH NEW LOCAL RECORDS (remoteId == null)
      // -----------------------------------------------------------------------
      const initialLocalVisitors = await VisitorStorage.getAll(true);
      let hasNewLocalAssignments = false;

      // 1. Assign persistent UUID remoteIds to any unlinked local visitors or visits
      const preparedLocalVisitors: Visitor[] = initialLocalVisitors.map((v) => {
        let vRemoteId = v.remoteId;
        if (!vRemoteId) {
          vRemoteId = generateUUID();
          hasNewLocalAssignments = true;
        }

        const preparedVisits = (v.visits || []).map((vt) => {
          let vtRemoteId = vt.remoteId;
          if (!vtRemoteId) {
            vtRemoteId = generateUUID();
            hasNewLocalAssignments = true;
          }
          return {
            ...vt,
            remoteId: vtRemoteId,
          };
        });

        return {
          ...v,
          remoteId: vRemoteId,
          visits: preparedVisits,
        };
      });

      // 2. Persist newly assigned remoteIds immediately so local state is stable
      if (hasNewLocalAssignments) {
        await VisitorStorage.saveAll(preparedLocalVisitors);
      }

      // 3. Identify and upload newly created visitors (previously remoteId == null)
      const newVisitorsToUpload: CloudVisitorRow[] = [];
      const newVisitsToUpload: CloudVisitRow[] = [];

      for (let i = 0; i < initialLocalVisitors.length; i++) {
        const origV = initialLocalVisitors[i];
        const prepV = preparedLocalVisitors[i];

        const isNewVisitor = !origV.remoteId;
        if (isNewVisitor) {
          const categoryVal =
            prepV.category === 'VIP' || prepV.category === 'Family' ? prepV.category : 'Reguler';
          const createdAtIso =
            typeof prepV.createdAt === 'number'
              ? new Date(prepV.createdAt).toISOString()
              : new Date().toISOString();

          newVisitorsToUpload.push({
            id: prepV.remoteId!,
            workspace_id: workspaceId,
            name: prepV.name,
            occupation: prepV.occupation || null,
            category: categoryVal,
            address: prepV.address || null,
            phone: prepV.phone || null,
            status: prepV.status || 'Aktif',
            created_at: createdAtIso,
            updated_at: prepV.updatedAt || createdAtIso,
            deleted_at: prepV.deletedAt || null,
          });
        }

        // Check new visits under this visitor
        const origVisits = origV.visits || [];
        const prepVisits = prepV.visits || [];
        for (let j = 0; j < prepVisits.length; j++) {
          const origVt = origVisits[j];
          const prepVt = prepVisits[j];

          // If visitor itself is new, all its visits are new. If visitor existed, visit is new if !origVt?.remoteId
          const isNewVisit = isNewVisitor || !origVt || !origVt.remoteId;
          if (isNewVisit) {
            const visitDateYMD = formatIndoDateToYMD(prepVt.date);
            const visitTimeCol = formatTimeToTimeCol(prepVt.time);
            const vtCreatedAt = prepVt.createdAt || prepV.updatedAt || new Date().toISOString();
            const vtUpdatedAt = prepVt.updatedAt || vtCreatedAt;

            newVisitsToUpload.push({
              id: prepVt.remoteId!,
              visitor_id: prepV.remoteId!,
              visit_date: visitDateYMD,
              visit_time: visitTimeCol,
              duration: prepVt.duration || null,
              problem: prepVt.problem || null,
              solution: prepVt.solution || null,
              notes: prepVt.notes || null,
              created_at: vtCreatedAt,
              updated_at: vtUpdatedAt,
              deleted_at: prepVt.deletedAt || null,
            });
          }
        }
      }

      // 4. Upsert new visitors to Supabase
      if (newVisitorsToUpload.length > 0) {
        const { error: newVError } = await supabase
          .from('visitors')
          .upsert(newVisitorsToUpload, { onConflict: 'id' });

        if (newVError) {
          console.error('[SyncService] Member failed to upload new visitors:', newVError);
          return {
            success: false,
            error: `Gagal mengunggah visitor baru ke cloud: ${newVError.message}`,
          };
        }
      }

      // 5. Upsert new visits to Supabase
      if (newVisitsToUpload.length > 0) {
        const { error: newVtError } = await supabase
          .from('visits')
          .upsert(newVisitsToUpload, { onConflict: 'id' });

        if (newVtError) {
          console.error('[SyncService] Member failed to upload new visits:', newVtError);
          return {
            success: false,
            error: `Gagal mengunggah kunjungan baru ke cloud: ${newVtError.message}`,
          };
        }
      }

      // -----------------------------------------------------------------------
      // Step B: CLOUD PULL & LOCAL MERGE
      // -----------------------------------------------------------------------
      // 1. Fetch cloud visitors
      const { data: cloudVisitors, error: vError } = await supabase
        .from('visitors')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (vError) {
        console.error('[SyncService] Failed to fetch cloud visitors:', vError);
        return { success: false, error: `Gagal mengambil data visitor: ${vError.message}` };
      }

      // 2. Fetch cloud visits for these visitors
      const cloudVisitorIds = (cloudVisitors || []).map((v) => v.id);
      let cloudVisits: CloudVisitRow[] = [];

      if (cloudVisitorIds.length > 0) {
        // Query visits in chunks if large
        const CHUNK_SIZE = 100;
        for (let i = 0; i < cloudVisitorIds.length; i += CHUNK_SIZE) {
          const chunkIds = cloudVisitorIds.slice(i, i + CHUNK_SIZE);
          const { data: visitsChunk, error: vtError } = await supabase
            .from('visits')
            .select('*')
            .in('visitor_id', chunkIds);

          if (vtError) {
            console.error('[SyncService] Failed to fetch cloud visits:', vtError);
            return {
              success: false,
              error: `Gagal mengambil data riwayat kunjungan: ${vtError.message}`,
            };
          }
          if (visitsChunk) {
            cloudVisits = cloudVisits.concat(visitsChunk as CloudVisitRow[]);
          }
        }
      }

      // Group cloud visits by visitor_id
      const visitsByVisitorRemoteId = new Map<string, CloudVisitRow[]>();
      for (const vt of cloudVisits) {
        const list = visitsByVisitorRemoteId.get(vt.visitor_id) || [];
        list.push(vt);
        visitsByVisitorRemoteId.set(vt.visitor_id, list);
      }

      // 3. Load updated local visitors (which now include newly assigned remoteIds)
      const localVisitors = await VisitorStorage.getAll(true);

      // Build map of existing local visitors by remoteId
      const localByRemoteId = new Map<string, Visitor>();
      for (const lv of localVisitors) {
        if (lv.remoteId) {
          localByRemoteId.set(lv.remoteId, lv);
        }
      }

      // Also track un-synced local records that have no remoteId
      const unmappedLocals = localVisitors.filter((lv) => !lv.remoteId);

      const mergedVisitors: Visitor[] = [];
      const processedLocalRemoteIds = new Set<string>();

      // 4. Merge each cloud visitor
      for (const cv of (cloudVisitors as CloudVisitorRow[]) || []) {
        const existingLocal = localByRemoteId.get(cv.id);
        const relatedCloudVisits = visitsByVisitorRemoteId.get(cv.id) || [];

        if (existingLocal) {
          processedLocalRemoteIds.add(cv.id);

          // Compare timestamps for Visitor profile fields (Last-Write-Wins)
          const localUpdatedMs = new Date(existingLocal.updatedAt || 0).getTime();
          const cloudUpdatedMs = new Date(cv.updated_at).getTime();

          let mergedCategory = existingLocal.category;
          let mergedName = existingLocal.name;
          let mergedOccupation = existingLocal.occupation;
          let mergedAddress = existingLocal.address;
          let mergedPhone = existingLocal.phone;
          let mergedStatus = existingLocal.status;
          let mergedDeletedAt = existingLocal.deletedAt;
          let mergedUpdatedAt = existingLocal.updatedAt;

          if (cloudUpdatedMs >= localUpdatedMs) {
            // Cloud is newer or equal: take cloud profile
            mergedName = cv.name;
            mergedCategory = (cv.category as VisitorCategory) || 'Reguler';
            mergedOccupation = cv.occupation || undefined;
            mergedAddress = cv.address || '';
            mergedPhone = cv.phone || undefined;
            mergedStatus = (cv.status as 'Aktif' | 'Selesai') || 'Aktif';
            mergedDeletedAt = cv.deleted_at;
            mergedUpdatedAt = cv.updated_at;
          }

          // Merge visits independently by Visit.remoteId (do NOT replace visits[] blindly)
          const mergedVisits = mergeVisitsList(existingLocal.visits || [], relatedCloudVisits);

          mergedVisitors.push({
            ...existingLocal,
            name: mergedName,
            category: mergedCategory,
            occupation: mergedOccupation,
            address: mergedAddress,
            phone: mergedPhone,
            status: mergedStatus,
            deletedAt: mergedDeletedAt,
            updatedAt: mergedUpdatedAt,
            visits: mergedVisits,
          });
        } else {
          // Cloud visitor doesn't exist locally: create new local visitor
          const createdEpoch = new Date(cv.created_at).getTime();
          const localId = `v-${createdEpoch}-${Math.random().toString(36).substring(2, 6)}`;

          // Convert cloud visits to local visits
          const localVisitsFromCloud: Visit[] = relatedCloudVisits.map((rvt) => {
            const vtEpoch = new Date(rvt.created_at).getTime();
            return {
              id: `vt-${vtEpoch}-${Math.random().toString(36).substring(2, 6)}`,
              remoteId: rvt.id,
              date: formatYMDToIndoDate(rvt.visit_date),
              time: rvt.visit_time || '',
              duration: rvt.duration || undefined,
              problem: rvt.problem || '',
              solution: rvt.solution || '',
              notes: rvt.notes || undefined,
              createdAt: rvt.created_at,
              updatedAt: rvt.updated_at,
              deletedAt: rvt.deleted_at || null,
            };
          });

          mergedVisitors.push({
            id: localId,
            remoteId: cv.id,
            name: cv.name,
            category: (cv.category as VisitorCategory) || 'Reguler',
            occupation: cv.occupation || undefined,
            address: cv.address || '',
            phone: cv.phone || undefined,
            status: (cv.status as 'Aktif' | 'Selesai') || 'Aktif',
            createdAt: createdEpoch,
            updatedAt: cv.updated_at,
            deletedAt: cv.deleted_at,
            visits: localVisitsFromCloud,
          });
        }
      }

      // Preserve any local visitors that were synced previously but not in cloud response (safety)
      for (const lv of localVisitors) {
        if (lv.remoteId && !processedLocalRemoteIds.has(lv.remoteId)) {
          mergedVisitors.push(lv);
        }
      }

      // Preserve any local-only visitors that have no remoteId yet
      for (const unmapped of unmappedLocals) {
        mergedVisitors.push(unmapped);
      }

      // 5. Centralized persistence to local storage
      await VisitorStorage.saveAll(mergedVisitors);

      // 6. Update sync metadata
      const syncTimestamp = new Date().toISOString();
      await SyncMetadataService.setMetadata({
        lastSyncedAt: syncTimestamp,
        workspaceId,
      });

      const activeVisitorsUploaded = newVisitorsToUpload.filter((r) => !r.deleted_at).length;
      const activeVisitsUploaded = newVisitsToUpload.filter((r) => !r.deleted_at).length;

      return {
        success: true,
        visitorsUploaded: activeVisitorsUploaded,
        visitsUploaded: activeVisitsUploaded,
        visitorsPulled: (cloudVisitors || []).filter((r) => !r.deleted_at).length,
        visitsPulled: cloudVisits.filter((r) => !r.deleted_at).length,
      };
    } catch (err: any) {
      console.error('[SyncService] Unexpected error in syncCloudToLocal:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Synchronizes Notes and Note Attachments (Metadata + Storage binary transfer).
   * Follows Cloud-First LWW with soft-deletion tombstones.
   */
  async syncNotes(workspaceId: string): Promise<{
    success: boolean;
    notesUploaded: number;
    notesPulled: number;
    attachmentsUploaded: number;
    attachmentsDownloaded: number;
    totalActiveNotes: number;
    totalActiveAttachments: number;
    error?: string;
  }> {
    try {
      if (!workspaceId) {
        return {
          success: false,
          notesUploaded: 0,
          notesPulled: 0,
          attachmentsUploaded: 0,
          attachmentsDownloaded: 0,
          totalActiveNotes: 0,
          totalActiveAttachments: 0,
          error: 'Workspace ID tidak ditemukan.',
        };
      }

      // -----------------------------------------------------------------------
      // Step N1: FETCH CLOUD NOTES & NOTE_IMAGES
      // -----------------------------------------------------------------------
      const { data: cloudNotes, error: cnError } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (cnError) {
        console.error('[SyncService] Failed to fetch cloud notes:', cnError);
        return {
          success: false,
          notesUploaded: 0,
          notesPulled: 0,
          attachmentsUploaded: 0,
          attachmentsDownloaded: 0,
          totalActiveNotes: 0,
          totalActiveAttachments: 0,
          error: `Gagal mengambil data catatan dari cloud: ${cnError.message}`,
        };
      }

      const cloudNoteIds = (cloudNotes || []).map((n) => n.id);
      let cloudImages: CloudNoteImageRow[] = [];

      if (cloudNoteIds.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < cloudNoteIds.length; i += CHUNK_SIZE) {
          const chunkIds = cloudNoteIds.slice(i, i + CHUNK_SIZE);
          const { data: imgChunk, error: imgError } = await supabase
            .from('note_images')
            .select('*')
            .in('note_id', chunkIds);

          if (imgError) {
            console.error('[SyncService] Failed to fetch cloud note_images:', imgError);
            return {
              success: false,
              notesUploaded: 0,
              notesPulled: 0,
              attachmentsUploaded: 0,
              attachmentsDownloaded: 0,
              totalActiveNotes: 0,
              totalActiveAttachments: 0,
              error: `Gagal mengambil lampiran catatan dari cloud: ${imgError.message}`,
            };
          }

          if (imgChunk) {
            cloudImages = cloudImages.concat(imgChunk as CloudNoteImageRow[]);
          }
        }
      }

      // Group cloud images by note_id
      const cloudImagesByNoteId = new Map<string, CloudNoteImageRow[]>();
      for (const img of cloudImages) {
        const list = cloudImagesByNoteId.get(img.note_id) || [];
        list.push(img);
        cloudImagesByNoteId.set(img.note_id, list);
      }

      // -----------------------------------------------------------------------
      // Step N2: LOAD LOCAL NOTES AND ASSIGN STABLE UUID REMOTE IDs
      // -----------------------------------------------------------------------
      const localNotes = await NoteStorage.getAllWithDeleted();
      let hasNewLocalAssignments = false;

      const preparedLocalNotes: Note[] = localNotes.map((n) => {
        let nRemoteId = n.remoteId;
        if (!nRemoteId) {
          nRemoteId = generateUUID();
          hasNewLocalAssignments = true;
        }

        const preparedAttachments: NoteAttachment[] = (n.attachments || []).map((att) => {
          let attRemoteId = att.remoteId;
          if (!attRemoteId) {
            attRemoteId = generateUUID();
            hasNewLocalAssignments = true;
          }
          return {
            ...att,
            remoteId: attRemoteId,
          };
        });

        return {
          ...n,
          remoteId: nRemoteId,
          attachments: preparedAttachments,
        };
      });

      if (hasNewLocalAssignments) {
        await NoteStorage.saveAll(preparedLocalNotes);
      }

      // -----------------------------------------------------------------------
      // Step N3: DETERMINE LWW MERGES & PREPARE UPLOADS / PULLS
      // -----------------------------------------------------------------------
      const cloudNotesByRemoteId = new Map<string, CloudNoteRow>();
      for (const cn of cloudNotes || []) {
        cloudNotesByRemoteId.set(cn.id, cn as CloudNoteRow);
      }

      const notesToUpload: CloudNoteRow[] = [];
      const imagesToUploadMetadata: CloudNoteImageRow[] = [];
      const attachmentsToUploadFiles: {
        noteRemoteId: string;
        attachmentRemoteId: string;
        storagePath: string;
        localUri: string;
        mimeType: string;
      }[] = [];

      const mergedNotes: Note[] = [];
      const processedNoteRemoteIds = new Set<string>();

      // Existing cloud image IDs set for fast lookup
      const existingCloudImageIds = new Set<string>(cloudImages.map((img) => img.id));

      for (const ln of preparedLocalNotes) {
        const lnRemoteId = ln.remoteId!;
        processedNoteRemoteIds.add(lnRemoteId);

        const cn = cloudNotesByRemoteId.get(lnRemoteId);

        let finalNote: Note;

        if (cn) {
          // Exists both locally and in cloud -> compare timestamps
          const localTime = new Date(ln.updatedAt).getTime();
          const cloudTime = new Date(cn.updated_at).getTime();

          if (localTime > cloudTime) {
            // Local is newer -> stage upload
            notesToUpload.push({
              id: lnRemoteId,
              workspace_id: workspaceId,
              title: ln.title,
              content: ln.content,
              created_at: ln.createdAt,
              updated_at: ln.updatedAt,
              deleted_at: ln.deletedAt || null,
            });
            finalNote = ln;
          } else if (cloudTime > localTime) {
            // Cloud is newer -> apply cloud version to local note metadata
            finalNote = {
              ...ln,
              title: cn.title,
              content: cn.content,
              createdAt: cn.created_at,
              updatedAt: cn.updated_at,
              deletedAt: cn.deleted_at,
            };
          } else {
            // Same timestamp
            finalNote = ln;
          }
        } else {
          // Local only -> stage upload
          notesToUpload.push({
            id: lnRemoteId,
            workspace_id: workspaceId,
            title: ln.title,
            content: ln.content,
            created_at: ln.createdAt,
            updated_at: ln.updatedAt,
            deleted_at: ln.deletedAt || null,
          });
          finalNote = ln;
        }

        // Merge attachments for this note
        const noteCloudImgs = cloudImagesByNoteId.get(lnRemoteId) || [];
        const mergedAttachments = await mergeNoteAttachmentsList(
          workspaceId,
          lnRemoteId,
          finalNote.attachments || [],
          noteCloudImgs,
          imagesToUploadMetadata,
          attachmentsToUploadFiles,
          existingCloudImageIds
        );

        finalNote.attachments = mergedAttachments;
        mergedNotes.push(finalNote);
      }

      // Add cloud-only notes
      for (const cn of cloudNotes || []) {
        if (!processedNoteRemoteIds.has(cn.id)) {
          const noteCloudImgs = cloudImagesByNoteId.get(cn.id) || [];
          const mergedAttachments = await mergeNoteAttachmentsList(
            workspaceId,
            cn.id,
            [],
            noteCloudImgs,
            imagesToUploadMetadata,
            attachmentsToUploadFiles,
            existingCloudImageIds
          );

          mergedNotes.push({
            id: `note-${Date.now()}-${generateUUID().substring(0, 6)}`,
            remoteId: cn.id,
            title: cn.title,
            content: cn.content,
            createdAt: cn.created_at,
            updatedAt: cn.updated_at,
            deletedAt: cn.deleted_at,
            attachments: mergedAttachments,
          });
        }
      }

      // -----------------------------------------------------------------------
      // Step N4: UPSERT PARENT NOTE ROWS TO public.notes FIRST
      // (Required so Storage RLS policy can verify parent note existence in public.notes)
      // -----------------------------------------------------------------------
      if (notesToUpload.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < notesToUpload.length; i += CHUNK_SIZE) {
          const chunk = notesToUpload.slice(i, i + CHUNK_SIZE);
          const { error: nUpError } = await supabase
            .from('notes')
            .upsert(chunk, { onConflict: 'id' });

          if (nUpError) {
            console.error('[SyncService] Failed to upsert notes:', nUpError);
            return {
              success: false,
              notesUploaded: 0,
              notesPulled: 0,
              attachmentsUploaded: 0,
              attachmentsDownloaded: 0,
              totalActiveNotes: 0,
              totalActiveAttachments: 0,
              error: `Gagal menyimpan data catatan ke cloud: ${nUpError.message}`,
            };
          }
        }
      }

      // -----------------------------------------------------------------------
      // Step N5: UPLOAD NOTE ATTACHMENT BINARY FILES TO STORAGE
      // (Now parent note exists in public.notes, satisfying the Storage RLS policy)
      // -----------------------------------------------------------------------
      let uploadedFileCount = 0;
      for (const item of attachmentsToUploadFiles) {
        const bytes = await NotePhotoService.readAttachmentBytes(item.localUri);
        if (!bytes) {
          console.warn('[SyncService] Local attachment file missing or unreadable:', item.localUri);
          // If local file is missing, skip storage upload but continue so metadata is not lost
          continue;
        }

        const { error: uploadError } = await supabase.storage
          .from('note-attachments')
          .upload(item.storagePath, bytes, {
            contentType: item.mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error('[SyncService] Failed to upload note attachment file:', uploadError);
          return {
            success: false,
            notesUploaded: 0,
            notesPulled: 0,
            attachmentsUploaded: 0,
            attachmentsDownloaded: 0,
            totalActiveNotes: 0,
            totalActiveAttachments: 0,
            error: `Gagal mengunggah foto catatan: ${uploadError.message}`,
          };
        }
        uploadedFileCount++;
      }

      // -----------------------------------------------------------------------
      // Step N6: UPSERT NOTE IMAGE METADATA ROWS TO public.note_images
      // -----------------------------------------------------------------------
      if (imagesToUploadMetadata.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < imagesToUploadMetadata.length; i += CHUNK_SIZE) {
          const chunk = imagesToUploadMetadata.slice(i, i + CHUNK_SIZE);
          const { error: niUpError } = await supabase
            .from('note_images')
            .upsert(chunk, { onConflict: 'id' });

          if (niUpError) {
            console.error('[SyncService] Failed to upsert note_images metadata:', niUpError);
            return {
              success: false,
              notesUploaded: 0,
              notesPulled: 0,
              attachmentsUploaded: 0,
              attachmentsDownloaded: 0,
              totalActiveNotes: 0,
              totalActiveAttachments: 0,
              error: `Gagal menyimpan metadata lampiran catatan ke cloud: ${niUpError.message}`,
            };
          }
        }
      }

      // -----------------------------------------------------------------------
      // Step N7: PERSIST MERGED NOTES TO ASYNCSTORAGE
      // -----------------------------------------------------------------------
      await NoteStorage.saveAll(mergedNotes);

      // Calculate active counts
      const totalActiveNotes = mergedNotes.filter((n) => !n.deletedAt).length;
      const totalActiveAttachments = mergedNotes.reduce(
        (sum, n) => sum + (n.attachments || []).filter((a) => !a.deletedAt).length,
        0
      );

      const notesUploadedCount = notesToUpload.filter((n) => !n.deleted_at).length;
      const notesPulledCount = (cloudNotes || []).filter((n) => !n.deleted_at).length;

      return {
        success: true,
        notesUploaded: notesUploadedCount,
        notesPulled: notesPulledCount,
        attachmentsUploaded: uploadedFileCount,
        attachmentsDownloaded: 0, // download performed during mergeNoteAttachmentsList
        totalActiveNotes,
        totalActiveAttachments,
      };
    } catch (err: any) {
      console.error('[SyncService] Unexpected error in syncNotes:', err);
      return {
        success: false,
        notesUploaded: 0,
        notesPulled: 0,
        attachmentsUploaded: 0,
        attachmentsDownloaded: 0,
        totalActiveNotes: 0,
        totalActiveAttachments: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Unified entry point called from the UI.
   * Runs the safe Cloud-first LWW synchronization for Visitors, Visits, Notes, and Attachments.
   */
  async syncWorkspace(workspaceId: string, role: string | null): Promise<SyncResult> {
    // 1. Sync Visitors & Visits
    const visitorResult = await this.syncLocalToCloud(workspaceId, role);
    if (!visitorResult.success) {
      return visitorResult;
    }

    // 2. Sync Notes & Note Attachments
    const notesResult = await this.syncNotes(workspaceId);
    if (!notesResult.success) {
      return {
        ...visitorResult,
        success: false,
        error: notesResult.error || 'Gagal menyinkronkan data catatan.',
      };
    }

    // 3. Update sync metadata timestamp only after COMPLETE success
    const syncTimestamp = new Date().toISOString();
    await SyncMetadataService.setMetadata({
      lastSyncedAt: syncTimestamp,
      workspaceId,
    });

    return {
      success: true,
      visitorsUploaded: visitorResult.visitorsUploaded,
      visitsUploaded: visitorResult.visitsUploaded,
      visitorsPulled: visitorResult.visitorsPulled,
      visitsPulled: visitorResult.visitsPulled,
      notesUploaded: notesResult.notesUploaded,
      notesPulled: notesResult.notesPulled,
      attachmentsUploaded: notesResult.attachmentsUploaded,
      attachmentsDownloaded: notesResult.attachmentsDownloaded,
      totalActiveVisitors: visitorResult.totalActiveVisitors,
      totalActiveVisits: visitorResult.totalActiveVisits,
      totalActiveNotes: notesResult.totalActiveNotes,
      totalActiveAttachments: notesResult.totalActiveAttachments,
    };
  },
};

// =============================================================================
// Helper: Visit-Level Merging (Independent Merge by remoteId)
// =============================================================================

/**
 * Merges local visits and cloud visits independently by Visit.remoteId.
 * Preserves unrelated local visits and applies Last-Write-Wins per visit.
 */
function mergeVisitsList(localVisits: Visit[], cloudVisits: CloudVisitRow[]): Visit[] {
  const merged: Visit[] = [];
  const processedRemoteIds = new Set<string>();

  // Map local visits by remoteId
  const localByRemoteId = new Map<string, Visit>();
  const unmappedLocalVisits: Visit[] = [];

  for (const lv of localVisits) {
    if (lv.remoteId) {
      localByRemoteId.set(lv.remoteId, lv);
    } else {
      unmappedLocalVisits.push(lv);
    }
  }

  // Iterate cloud visits
  for (const cvt of cloudVisits) {
    const existingVisit = localByRemoteId.get(cvt.id);
    if (existingVisit) {
      processedRemoteIds.add(cvt.id);
      const localUpdatedMs = new Date(existingVisit.updatedAt || 0).getTime();
      const cloudUpdatedMs = new Date(cvt.updated_at).getTime();

      if (cloudUpdatedMs >= localUpdatedMs) {
        // Cloud is newer: take cloud values while preserving local id
        merged.push({
          id: existingVisit.id,
          remoteId: cvt.id,
          date: formatYMDToIndoDate(cvt.visit_date),
          time: cvt.visit_time || '',
          duration: cvt.duration || undefined,
          problem: cvt.problem || '',
          solution: cvt.solution || '',
          notes: cvt.notes || undefined,
          createdAt: cvt.created_at,
          updatedAt: cvt.updated_at,
          deletedAt: cvt.deleted_at || null,
        });
      } else {
        // Local is newer: preserve local visit
        merged.push(existingVisit);
      }
    } else {
      // New visit from cloud
      const vtEpoch = new Date(cvt.created_at).getTime();
      merged.push({
        id: `vt-${vtEpoch}-${Math.random().toString(36).substring(2, 6)}`,
        remoteId: cvt.id,
        date: formatYMDToIndoDate(cvt.visit_date),
        time: cvt.visit_time || '',
        duration: cvt.duration || undefined,
        problem: cvt.problem || '',
        solution: cvt.solution || '',
        notes: cvt.notes || undefined,
        createdAt: cvt.created_at,
        updatedAt: cvt.updated_at,
        deletedAt: cvt.deleted_at || null,
      });
    }
  }

  // Preserve local visits that have remoteIds not in this cloud set
  for (const lv of localVisits) {
    if (lv.remoteId && !processedRemoteIds.has(lv.remoteId)) {
      merged.push(lv);
    }
  }

  // Preserve local-only visits (not yet synced)
  for (const unmapped of unmappedLocalVisits) {
    merged.push(unmapped);
  }

  return merged;
}

// =============================================================================
// Helper: Note-Attachment Level Merging & Private Storage Transfer
// =============================================================================

/**
 * Merges local note attachments and cloud note images.
 * Stages missing cloud images for upload.
 * Downloads missing local files from private Storage to app document directory.
 */
async function mergeNoteAttachmentsList(
  workspaceId: string,
  noteRemoteId: string,
  localAttachments: NoteAttachment[],
  cloudImages: CloudNoteImageRow[],
  imagesToUploadMetadata: CloudNoteImageRow[],
  attachmentsToUploadFiles: {
    noteRemoteId: string;
    attachmentRemoteId: string;
    storagePath: string;
    localUri: string;
    mimeType: string;
  }[],
  existingCloudImageIds: Set<string>
): Promise<NoteAttachment[]> {
  const merged: NoteAttachment[] = [];
  const processedRemoteIds = new Set<string>();

  // Map local attachments by remoteId
  const localByRemoteId = new Map<string, NoteAttachment>();
  const unmappedLocalAttachments: NoteAttachment[] = [];

  for (const latt of localAttachments) {
    if (latt.remoteId) {
      localByRemoteId.set(latt.remoteId, latt);
    } else {
      unmappedLocalAttachments.push(latt);
    }
  }

  // 1. Process cloud images
  for (const cimg of cloudImages) {
    processedRemoteIds.add(cimg.id);
    const existingAtt = localByRemoteId.get(cimg.id);

    if (existingAtt) {
      // Exists locally and in cloud
      let localUri = existingAtt.localUri;

      // Verify file actually exists on device
      const fileExists = NotePhotoService.fileExists(localUri);
      if (!fileExists && !cimg.deleted_at) {
        // Missing local file -> download via signed URL (RN-compatible)
        try {
          const { data: signedData, error: signError } = await supabase.storage
            .from('note-attachments')
            .createSignedUrl(cimg.storage_path, 300);

          if (!signError && signedData?.signedUrl) {
            const ext = cimg.file_name?.split('.').pop() || 'jpg';
            const dlFileName = `note-img-${cimg.id}.${ext}`;
            const downloadedUri = await NotePhotoService.downloadFromSignedUrl(
              signedData.signedUrl,
              dlFileName
            );
            if (downloadedUri) {
              localUri = downloadedUri;
            }
            // If download failed, keep the existing localUri (may still be valid)
          }
        } catch (dlErr) {
          console.warn('[SyncService] Failed to download cloud attachment:', cimg.storage_path, dlErr);
        }
      }

      // Check if local was soft-deleted while cloud was not
      if (existingAtt.deletedAt && !cimg.deleted_at) {
        imagesToUploadMetadata.push({
          id: cimg.id,
          note_id: noteRemoteId,
          storage_path: cimg.storage_path,
          file_name: cimg.file_name,
          mime_type: cimg.mime_type,
          file_size: cimg.file_size,
          created_at: cimg.created_at,
          deleted_at: existingAtt.deletedAt,
        });
      }

      merged.push({
        ...existingAtt,
        localUri,
        deletedAt: existingAtt.deletedAt || cimg.deleted_at,
      });
    } else {
      // Cloud image not present locally -> download and create NoteAttachment
      let localUri = '';
      const ext = cimg.file_name?.split('.').pop() || 'jpg';
      const fileName = cimg.file_name || `note-img-${cimg.id}.${ext}`;

      if (!cimg.deleted_at) {
        try {
          const { data: signedData, error: signError } = await supabase.storage
            .from('note-attachments')
            .createSignedUrl(cimg.storage_path, 300);

          if (!signError && signedData?.signedUrl) {
            const downloadedUri = await NotePhotoService.downloadFromSignedUrl(
              signedData.signedUrl,
              fileName
            );
            if (downloadedUri) {
              localUri = downloadedUri;
            }
          }
        } catch (dlErr) {
          console.warn('[SyncService] Failed to download cloud attachment:', cimg.storage_path, dlErr);
        }
      }

      merged.push({
        id: `att-${cimg.id.substring(0, 8)}`,
        remoteId: cimg.id,
        localUri,
        fileName,
        mimeType: cimg.mime_type || 'image/jpeg',
        createdAt: cimg.created_at,
        updatedAt: cimg.created_at,
        deletedAt: cimg.deleted_at,
      });
    }
  }

  // 2. Process local attachments that exist locally but NOT in cloud
  for (const latt of localAttachments) {
    if (latt.remoteId && !processedRemoteIds.has(latt.remoteId)) {
      merged.push(latt);

      // Stage for upload if not already in cloud and not soft-deleted
      if (!existingCloudImageIds.has(latt.remoteId)) {
        const ext = latt.fileName?.split('.').pop() || 'jpg';
        const storagePath = `${workspaceId}/${noteRemoteId}/${latt.remoteId}.${ext}`;
        const mimeType = latt.mimeType || (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

        imagesToUploadMetadata.push({
          id: latt.remoteId,
          note_id: noteRemoteId,
          storage_path: storagePath,
          file_name: latt.fileName,
          mime_type: mimeType,
          file_size: null,
          created_at: latt.createdAt || new Date().toISOString(),
          deleted_at: latt.deletedAt || null,
        });

        if (!latt.deletedAt && latt.localUri) {
          attachmentsToUploadFiles.push({
            noteRemoteId,
            attachmentRemoteId: latt.remoteId,
            storagePath,
            localUri: latt.localUri,
            mimeType,
          });
        }
      }
    }
  }

  // 3. Preserve unmapped local attachments (if any)
  for (const unmapped of unmappedLocalAttachments) {
    merged.push(unmapped);
  }

  return merged;
}

