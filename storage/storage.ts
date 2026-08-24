import AsyncStorage from '@react-native-async-storage/async-storage';
import { Visitor, Visit, LegacyVisitor } from '../types';

const STORAGE_KEY = '@visitors';

/**
 * Migrate a single legacy record (flat visit fields on root) into the new
 * Visitor shape with a `visits[]` array.  If the record already has a `visits`
 * array it is returned as-is.
 */
function migrateRecord(raw: any): Visitor {
  // Already migrated
  if (Array.isArray(raw.visits)) {
    return raw as Visitor;
  }

  // Treat as legacy
  const legacy = raw as LegacyVisitor;
  const visitDate =
    [legacy.visitDay, legacy.visitMonth, legacy.visitYear].filter(Boolean).join(' ') ||
    legacy.visitDate ||
    '';

  const initialVisit: Visit = {
    id: `v-${legacy.createdAt || Date.now()}`,
    date: visitDate,
    time: legacy.visitTime || '',
    duration: legacy.estimatedDuration || '',
    problem: legacy.problem || '',
    solution: legacy.solution || '',
    notes: legacy.purposeNotes || legacy.notes || '',
  };

  // Only include the initial visit if there is meaningful data
  const hasVisitData =
    initialVisit.date || initialVisit.time || initialVisit.problem || initialVisit.solution;

  const visitor: Visitor = {
    id: legacy.id,
    name: legacy.name,
    category: legacy.category,
    occupation: legacy.occupation || undefined,
    address: legacy.address,
    phone: legacy.phone || undefined,
    visits: hasVisitData ? [initialVisit] : [],
    status: legacy.status || 'Aktif',
    createdAt: legacy.createdAt,
  };

  return visitor;
}

export const VisitorStorage = {
  async getAll(): Promise<Visitor[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed: any[] = JSON.parse(data);
    return parsed.map(migrateRecord);
  },

  async getById(id: string): Promise<Visitor | null> {
    const visitors = await this.getAll();
    return visitors.find((v) => v.id === id) || null;
  },

  async save(visitor: Visitor): Promise<void> {
    const visitors = await this.getAll();
    visitors.push(visitor);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
  },

  async update(updated: Visitor): Promise<void> {
    const visitors = await this.getAll();
    const index = visitors.findIndex((v) => v.id === updated.id);
    if (index !== -1) {
      visitors[index] = updated;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
    }
  },

  async delete(id: string): Promise<void> {
    const visitors = await this.getAll();
    const filtered = visitors.filter((v) => v.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  async deleteMultiple(ids: string[]): Promise<void> {
    const visitors = await this.getAll();
    const filtered = visitors.filter((v) => !ids.includes(v.id));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  /** Add a visit to an existing visitor. */
  async addVisit(visitorId: string, visit: Visit): Promise<void> {
    const visitors = await this.getAll();
    const visitor = visitors.find((v) => v.id === visitorId);
    if (visitor) {
      visitor.visits.push(visit);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
    }
  },

  /** Delete a single visit from a visitor. */
  async deleteVisit(visitorId: string, visitId: string): Promise<void> {
    const visitors = await this.getAll();
    const visitor = visitors.find((v) => v.id === visitorId);
    if (visitor) {
      visitor.visits = visitor.visits.filter((vt) => vt.id !== visitId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
    }
  },

  /** Update a single visit within a visitor. */
  async updateVisit(visitorId: string, updatedVisit: Visit): Promise<void> {
    const visitors = await this.getAll();
    const visitor = visitors.find((v) => v.id === visitorId);
    if (visitor) {
      const idx = visitor.visits.findIndex((vt) => vt.id === updatedVisit.id);
      if (idx !== -1) {
        visitor.visits[idx] = updatedVisit;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
      }
    }
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
