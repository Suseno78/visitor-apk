import AsyncStorage from '@react-native-async-storage/async-storage';
import { Visitor, Visit, LegacyVisitor } from '../types';

const STORAGE_KEY = '@visitors';

/**
 * Normalizes a single visit, ensuring sync fields (remoteId, createdAt, updatedAt, deletedAt)
 * are populated deterministically.
 */
function normalizeVisit(v: any, fallbackTimestamp: string): Visit {
  const createdAt = typeof v.createdAt === 'string' ? v.createdAt : fallbackTimestamp;
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : createdAt;
  return {
    id: String(v.id),
    remoteId: typeof v.remoteId === 'string' ? v.remoteId : null,
    date: v.date || '',
    time: v.time || '',
    duration: v.duration || undefined,
    problem: v.problem || '',
    solution: v.solution || '',
    notes: v.notes || undefined,
    createdAt,
    updatedAt,
    deletedAt: typeof v.deletedAt === 'string' ? v.deletedAt : null,
  };
}

/**
 * Migrate a single legacy record (flat visit fields on root) into the new
 * Visitor shape with a `visits[]` array and synchronization metadata.
 */
function migrateRecord(raw: any): Visitor {
  const nowIso = new Date().toISOString();

  // If already has visits array
  if (Array.isArray(raw.visits)) {
    const rawCreatedAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
    const defaultVisitIso = new Date(rawCreatedAt).toISOString();

    const normalizedVisits = raw.visits.map((vt: any) => normalizeVisit(vt, defaultVisitIso));

    const updatedAt =
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : normalizedVisits.length > 0
        ? normalizedVisits[normalizedVisits.length - 1].updatedAt
        : defaultVisitIso;

    return {
      id: String(raw.id),
      remoteId: typeof raw.remoteId === 'string' ? raw.remoteId : null,
      name: raw.name || '',
      category: raw.category || 'Reguler',
      occupation: raw.occupation || undefined,
      address: raw.address || '',
      phone: raw.phone || undefined,
      visits: normalizedVisits,
      status: raw.status || 'Aktif',
      createdAt: rawCreatedAt,
      updatedAt,
      deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
    };
  }

  // Treat as legacy flat record
  const legacy = raw as LegacyVisitor;
  const visitDate =
    [legacy.visitDay, legacy.visitMonth, legacy.visitYear].filter(Boolean).join(' ') ||
    legacy.visitDate ||
    '';

  const rawCreatedAt = typeof legacy.createdAt === 'number' ? legacy.createdAt : Date.now();
  const defaultIso = new Date(rawCreatedAt).toISOString();

  const initialVisit: Visit = {
    id: `v-${rawCreatedAt}`,
    remoteId: null,
    date: visitDate,
    time: legacy.visitTime || '',
    duration: legacy.estimatedDuration || '',
    problem: legacy.problem || '',
    solution: legacy.solution || '',
    notes: legacy.purposeNotes || legacy.notes || '',
    createdAt: defaultIso,
    updatedAt: defaultIso,
    deletedAt: null,
  };

  const hasVisitData =
    initialVisit.date || initialVisit.time || initialVisit.problem || initialVisit.solution;

  const visitor: Visitor = {
    id: String(legacy.id),
    remoteId: null,
    name: legacy.name || '',
    category: legacy.category || 'Reguler',
    occupation: legacy.occupation || undefined,
    address: legacy.address || '',
    phone: legacy.phone || undefined,
    visits: hasVisitData ? [initialVisit] : [],
    status: legacy.status || 'Aktif',
    createdAt: rawCreatedAt,
    updatedAt: defaultIso,
    deletedAt: null,
  };

  return visitor;
}

export const VisitorStorage = {
  /**
   * Retrieves all visitor records from local storage.
   * By default (`includeDeleted = false`), excludes records where `deletedAt != null`,
   * and excludes nested visits where `deletedAt != null`.
   * When `includeDeleted = true` (for sync), returns all records including tombstones.
   */
  async getAll(includeDeleted = false): Promise<Visitor[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      const parsed: any[] = JSON.parse(data);
      const migrated = parsed.map(migrateRecord);

      if (includeDeleted) {
        return migrated;
      }

      // Filter out soft-deleted visitors and soft-deleted visits for UI
      return migrated
        .filter((v) => !v.deletedAt)
        .map((v) => ({
          ...v,
          visits: (v.visits || []).filter((vt) => !vt.deletedAt),
        }));
    } catch (err) {
      console.error('[VisitorStorage] Error loading visitors:', err);
      return [];
    }
  },

  /**
   * Retrieves raw records for sync / migration purposes (including deleted).
   */
  async getAllWithDeleted(): Promise<Visitor[]> {
    return this.getAll(true);
  },

  async getById(id: string): Promise<Visitor | null> {
    const visitors = await this.getAll(false);
    return visitors.find((v) => v.id === id) || null;
  },

  async save(visitor: Visitor): Promise<void> {
    const all = await this.getAllWithDeleted();
    const nowIso = new Date().toISOString();

    const normalized: Visitor = {
      ...visitor,
      updatedAt: visitor.updatedAt || nowIso,
      deletedAt: visitor.deletedAt || null,
      visits: (visitor.visits || []).map((vt) => ({
        ...vt,
        createdAt: vt.createdAt || nowIso,
        updatedAt: vt.updatedAt || nowIso,
        deletedAt: vt.deletedAt || null,
      })),
    };

    all.push(normalized);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  /**
   * Centralized persistence operation for a full list of visitors.
   * Preserves existing data in AsyncStorage if serialization or write fails.
   */
  async saveAll(visitors: Visitor[]): Promise<void> {
    const payload = JSON.stringify(visitors);
    await AsyncStorage.setItem(STORAGE_KEY, payload);
  },

  async update(updated: Visitor): Promise<void> {
    const all = await this.getAllWithDeleted();
    const index = all.findIndex((v) => v.id === updated.id);
    const nowIso = new Date().toISOString();

    if (index !== -1) {
      all[index] = {
        ...all[index],
        ...updated,
        updatedAt: nowIso,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  },

  /**
   * Soft deletes a visitor by setting `deletedAt` and refreshing `updatedAt`.
   * Also soft-deletes its nested visits.
   */
  async delete(id: string): Promise<void> {
    const all = await this.getAllWithDeleted();
    const index = all.findIndex((v) => v.id === id);
    const nowIso = new Date().toISOString();

    if (index !== -1) {
      all[index] = {
        ...all[index],
        deletedAt: nowIso,
        updatedAt: nowIso,
        visits: (all[index].visits || []).map((vt) => ({
          ...vt,
          deletedAt: vt.deletedAt || nowIso,
          updatedAt: nowIso,
        })),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  },

  /**
   * Soft deletes multiple visitors.
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    const all = await this.getAllWithDeleted();
    const nowIso = new Date().toISOString();

    const updated = all.map((v) => {
      if (ids.includes(v.id)) {
        return {
          ...v,
          deletedAt: nowIso,
          updatedAt: nowIso,
          visits: (v.visits || []).map((vt) => ({
            ...vt,
            deletedAt: vt.deletedAt || nowIso,
            updatedAt: nowIso,
          })),
        };
      }
      return v;
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  /** Add a visit to an existing visitor and update visitor's `updatedAt`. */
  async addVisit(visitorId: string, visit: Visit): Promise<void> {
    const all = await this.getAllWithDeleted();
    const visitor = all.find((v) => v.id === visitorId);
    const nowIso = new Date().toISOString();

    if (visitor) {
      const normalizedVisit: Visit = {
        ...visit,
        createdAt: visit.createdAt || nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };

      visitor.visits = visitor.visits || [];
      visitor.visits.push(normalizedVisit);
      visitor.updatedAt = nowIso;

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  },

  /** Soft deletes a single visit from a visitor. */
  async deleteVisit(visitorId: string, visitId: string): Promise<void> {
    const all = await this.getAllWithDeleted();
    const visitor = all.find((v) => v.id === visitorId);
    const nowIso = new Date().toISOString();

    if (visitor && visitor.visits) {
      const vt = visitor.visits.find((item) => item.id === visitId);
      if (vt) {
        vt.deletedAt = nowIso;
        vt.updatedAt = nowIso;
        visitor.updatedAt = nowIso;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    }
  },

  /** Update a single visit within a visitor and update timestamps. */
  async updateVisit(visitorId: string, updatedVisit: Visit): Promise<void> {
    const all = await this.getAllWithDeleted();
    const visitor = all.find((v) => v.id === visitorId);
    const nowIso = new Date().toISOString();

    if (visitor && visitor.visits) {
      const idx = visitor.visits.findIndex((vt) => vt.id === updatedVisit.id);
      if (idx !== -1) {
        visitor.visits[idx] = {
          ...visitor.visits[idx],
          ...updatedVisit,
          updatedAt: nowIso,
        };
        visitor.updatedAt = nowIso;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    }
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
