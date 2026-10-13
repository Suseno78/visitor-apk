import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, NoteAttachment } from '../types';

const STORAGE_KEY = '@notes';

function normalizeAttachment(att: any, noteCreatedIso: string): NoteAttachment {
  const createdAt = typeof att.createdAt === 'string' ? att.createdAt : noteCreatedIso;
  return {
    id: String(att.id),
    remoteId: typeof att.remoteId === 'string' ? att.remoteId : null,
    localUri: att.localUri || '',
    fileName: att.fileName || '',
    mimeType: att.mimeType || undefined,
    width: typeof att.width === 'number' ? att.width : undefined,
    height: typeof att.height === 'number' ? att.height : undefined,
    createdAt,
    updatedAt: typeof att.updatedAt === 'string' ? att.updatedAt : createdAt,
    deletedAt: typeof att.deletedAt === 'string' ? att.deletedAt : null,
  };
}

function normalizeNote(raw: any): Note {
  const nowIso = new Date().toISOString();
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : nowIso;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;

  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const attachments = rawAttachments.map((att: any) => normalizeAttachment(att, createdAt));

  return {
    id: String(raw.id),
    remoteId: typeof raw.remoteId === 'string' ? raw.remoteId : null,
    title: raw.title || '',
    content: raw.content || '',
    createdAt,
    updatedAt,
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
    attachments,
  };
}

export const NoteStorage = {
  /**
   * Mendapatkan semua catatan dari local storage.
   * By default (`includeDeleted = false`), excludes records where `deletedAt != null`,
   * and excludes attachments where `deletedAt != null`.
   */
  async getAll(includeDeleted = false): Promise<Note[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed: any[] = JSON.parse(data);
      const migrated = parsed.map(normalizeNote);

      if (includeDeleted) {
        return migrated;
      }

      // Filter out soft-deleted notes and soft-deleted attachments for UI
      return migrated
        .filter((n) => !n.deletedAt)
        .map((n) => ({
          ...n,
          attachments: (n.attachments || []).filter((att) => !att.deletedAt),
        }));
    } catch (error) {
      console.error('[NoteStorage] Error loading notes:', error);
      return [];
    }
  },

  /**
   * Raw read for sync operations (including deleted).
   */
  async getAllWithDeleted(): Promise<Note[]> {
    return this.getAll(true);
  },

  /**
   * Mendapatkan detail catatan berdasarkan ID
   */
  async getById(id: string): Promise<Note | null> {
    try {
      const notes = await this.getAll(false);
      return notes.find((n) => n.id === id) || null;
    } catch (error) {
      console.error('[NoteStorage] Error getting note by ID:', error);
      return null;
    }
  },

  /**
   * Menyimpan catatan baru
   */
  async save(note: Note): Promise<boolean> {
    try {
      const notes = await this.getAllWithDeleted();
      const nowIso = new Date().toISOString();

      const normalized: Note = {
        ...note,
        createdAt: note.createdAt || nowIso,
        updatedAt: note.updatedAt || nowIso,
        deletedAt: note.deletedAt || null,
        attachments: (note.attachments || []).map((att) => ({
          ...att,
          createdAt: att.createdAt || nowIso,
          updatedAt: att.updatedAt || nowIso,
          deletedAt: att.deletedAt || null,
        })),
      };

      notes.push(normalized);

      // Urutkan berdasarkan tanggal terbaru
      notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch (error) {
      console.error('[NoteStorage] Error saving note:', error);
      return false;
    }
  },

  /**
   * Memperbarui catatan yang sudah ada
   */
  async update(noteId: string, updates: Partial<Note>): Promise<boolean> {
    try {
      const notes = await this.getAllWithDeleted();
      const noteIndex = notes.findIndex((n) => n.id === noteId);

      if (noteIndex === -1) return false;

      const nowIso = new Date().toISOString();

      // Normalize attachments if updated
      let updatedAttachments = notes[noteIndex].attachments;
      if (updates.attachments) {
        updatedAttachments = updates.attachments.map((att) => ({
          ...att,
          createdAt: att.createdAt || nowIso,
          updatedAt: att.updatedAt || nowIso,
          deletedAt: att.deletedAt || null,
        }));
      }

      notes[noteIndex] = {
        ...notes[noteIndex],
        ...updates,
        attachments: updatedAttachments,
        updatedAt: nowIso,
      };

      // Urutkan ulang berdasarkan tanggal terbaru
      notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch (error) {
      console.error('[NoteStorage] Error updating note:', error);
      return false;
    }
  },

  /**
   * Soft deletes a note by setting `deletedAt` and refreshing `updatedAt`.
   * Also soft-deletes its attachments metadata while preserving them for future cloud sync.
   */
  async delete(id: string): Promise<boolean> {
    try {
      const notes = await this.getAllWithDeleted();
      const noteIndex = notes.findIndex((n) => n.id === id);

      if (noteIndex === -1) return false;

      const nowIso = new Date().toISOString();

      notes[noteIndex] = {
        ...notes[noteIndex],
        deletedAt: nowIso,
        updatedAt: nowIso,
        attachments: (notes[noteIndex].attachments || []).map((att) => ({
          ...att,
          deletedAt: att.deletedAt || nowIso,
          updatedAt: nowIso,
        })),
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch (error) {
      console.error('[NoteStorage] Error deleting note:', error);
      return false;
    }
  },

  /**
   * Soft-deletes a single attachment within a note.
   */
  async deleteAttachment(noteId: string, attachmentId: string): Promise<boolean> {
    try {
      const notes = await this.getAllWithDeleted();
      const note = notes.find((n) => n.id === noteId);
      if (!note || !note.attachments) return false;

      const nowIso = new Date().toISOString();
      const targetAtt = note.attachments.find((att) => att.id === attachmentId);

      if (targetAtt) {
        targetAtt.deletedAt = nowIso;
        targetAtt.updatedAt = nowIso;
        note.updatedAt = nowIso;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
      }

      return false;
    } catch (error) {
      console.error('[NoteStorage] Error deleting attachment:', error);
      return false;
    }
  },

  /**
   * Centralized persistence operation for a full list of notes (for sync operations).
   * Sorts by updatedAt descending before saving to AsyncStorage.
   */
  async saveAll(notes: Note[]): Promise<void> {
    try {
      const sorted = [...notes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch (error) {
      console.error('[NoteStorage] Error saving all notes:', error);
      throw error;
    }
  },

  /**
   * Menghapus semua catatan (biasanya dipanggil saat reset aplikasi)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[NoteStorage] Error clearing notes:', error);
    }
  },
};
