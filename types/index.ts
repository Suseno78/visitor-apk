export type VisitorCategory = 'VIP' | 'Reguler' | 'Family';
// Legacy category type supporting pre-existing records if any exist
export type AnyVisitorCategory = VisitorCategory | 'Partner';

export interface VisitAttachment {
  id: string;
  remoteId?: string | null;
  localUri: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Visit {
  id: string;
  remoteId?: string | null;
  date: string;
  time: string;
  duration?: string;
  problem: string;
  solution: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  attachments?: VisitAttachment[];
}

export interface Visitor {
  id: string;
  remoteId?: string | null;
  name: string;
  category: AnyVisitorCategory;
  occupation?: string;
  address: string;
  phone?: string;
  photoUri?: string;
  visits: Visit[];
  status: 'Aktif' | 'Selesai';
  createdAt: number;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface NoteAttachment {
  id: string;
  remoteId?: string | null;
  localUri: string;
  fileName: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Note {
  id: string;
  remoteId?: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  attachments?: NoteAttachment[];
}

// Backup envelope
export interface VisitraBackup {
  backupVersion: number;
  appName: string;
  createdAt: string;
  workspaceId?: string | null;
  data: {
    visitors: Visitor[];
    notes?: Note[];
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
