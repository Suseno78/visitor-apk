import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Visitor, Visit, VisitorCategory } from '../types';
import { VisitorStorage } from '../storage/storage';

export function useVisitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    const data = await VisitorStorage.getAll();
    setVisitors(data.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVisitors();
    }, [loadVisitors])
  );

  // -----------------------------------------------------------------------
  // Visitor CRUD
  // -----------------------------------------------------------------------
  const addVisitor = async (visitor: Visitor) => {
    // Auto-merge: if a visitor with the same name already exists, append the
    // visit to the existing profile instead of creating a duplicate.
    const normalised = visitor.name.trim().toLowerCase();
    const existing = visitors.find(
      (v) => v.name.trim().toLowerCase() === normalised
    );

    if (existing && visitor.visits.length > 0) {
      // Append the new visit(s) to the existing visitor
      for (const visit of visitor.visits) {
        await VisitorStorage.addVisit(existing.id, visit);
      }
      // Also update profile fields if they changed (e.g. user upgraded to VIP)
      const updated: Visitor = {
        ...existing,
        category: visitor.category,
        occupation: visitor.occupation,
        address: visitor.address || existing.address,
        phone: visitor.phone || existing.phone,
        visits: [...existing.visits, ...visitor.visits],
      };
      await VisitorStorage.update(updated);
      await loadVisitors();
      return existing.id;
    }

    await VisitorStorage.save(visitor);
    await loadVisitors();
    return visitor.id;
  };

  const updateVisitor = async (visitor: Visitor) => {
    await VisitorStorage.update(visitor);
    await loadVisitors();
  };

  const deleteVisitor = async (id: string) => {
    await VisitorStorage.delete(id);
    await loadVisitors();
  };

  const deleteMultipleVisitors = async (ids: string[]) => {
    await VisitorStorage.deleteMultiple(ids);
    await loadVisitors();
  };

  const clearAll = async () => {
    await VisitorStorage.clearAll();
    await loadVisitors();
  };

  // -----------------------------------------------------------------------
  // Visit CRUD
  // -----------------------------------------------------------------------
  const addVisit = async (visitorId: string, visit: Visit) => {
    await VisitorStorage.addVisit(visitorId, visit);
    await loadVisitors();
  };

  const deleteVisit = async (visitorId: string, visitId: string) => {
    await VisitorStorage.deleteVisit(visitorId, visitId);
    await loadVisitors();
  };

  const updateVisit = async (visitorId: string, visit: Visit) => {
    await VisitorStorage.updateVisit(visitorId, visit);
    await loadVisitors();
  };

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const getStats = () => {
    const totalVisitors = visitors.length;
    const totalVisits = visitors.reduce((acc, v) => acc + (v.visits?.length || 0), 0);
    const vip = visitors.filter((v) => v.category === 'VIP').length;
    const reguler = visitors.filter((v) => v.category === 'Reguler').length;
    const family = visitors.filter((v) => v.category === 'Family').length;
    const partner = visitors.filter((v) => v.category === 'Partner').length;
    return { total: totalVisitors, totalVisits, vip, reguler, family, partner };
  };

  const getRecent = (count = 5) => visitors.slice(0, count);

  const searchByName = (query: string) =>
    visitors.filter((v) =>
      v.name.toLowerCase().includes(query.toLowerCase())
    );

  const filterByCategory = (category: VisitorCategory | 'Semua') =>
    category === 'Semua' ? visitors : visitors.filter((v) => v.category === category);

  return {
    visitors,
    loading,
    loadVisitors,
    addVisitor,
    updateVisitor,
    deleteVisitor,
    deleteMultipleVisitors,
    clearAll,
    addVisit,
    deleteVisit,
    updateVisit,
    getStats,
    getRecent,
    searchByName,
    filterByCategory,
  };
}
