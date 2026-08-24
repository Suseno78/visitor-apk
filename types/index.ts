export type VisitorCategory = 'VIP' | 'Reguler' | 'Family' | 'Partner';

export interface Visit {
  id: string;
  date: string;
  time: string;
  duration?: string;
  problem: string;
  solution: string;
  notes?: string;
}

export interface Visitor {
  id: string;
  name: string;
  category: VisitorCategory;
  occupation?: string;
  address: string;
  phone?: string;
  visits: Visit[];
  status: 'Aktif' | 'Selesai';
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Backup envelope
export interface VisitraBackup {
  backupVersion: number;
  appName: string;
  createdAt: string;
  data: {
    visitors: Visitor[];
  };
}

// Legacy shape used for on-the-fly migration of old AsyncStorage records
export interface LegacyVisitor {
  id: string;
  name: string;
  category: VisitorCategory;
  occupation: string;
  address: string;
  phone: string;
  visitDay: string;
  visitMonth: string;
  visitYear: string;
  visitTime: string;
  estimatedDuration: string;
  visitNotes: string;
  problem: string;
  solution: string;
  purposeNotes: string;
  status: 'Aktif' | 'Selesai';
  createdAt: number;
  visitDate?: string;
  notes?: string;
}
