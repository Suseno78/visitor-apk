import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '../types';

const STORAGE_KEY = '@notes';

export const NoteStorage = {
  /**
   * Mendapatkan semua catatan dari local storage
   */
  async getAll(): Promise<Note[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  },

  /**
   * Mendapatkan detail catatan berdasarkan ID
   */
  async getById(id: string): Promise<Note | null> {
    try {
      const notes = await this.getAll();
      return notes.find((n) => n.id === id) || null;
    } catch (error) {
      console.error('Error getting note by ID:', error);
      return null;
    }
  },

  /**
   * Menyimpan catatan baru
   */
  async save(note: Note): Promise<boolean> {
    try {
      const notes = await this.getAll();
      notes.push(note);
      
      // Urutkan berdasarkan tanggal terbaru
      notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch (error) {
      console.error('Error saving note:', error);
      return false;
    }
  },

  /**
   * Memperbarui catatan yang sudah ada
   */
  async update(noteId: string, updates: Partial<Note>): Promise<boolean> {
    try {
      const notes = await this.getAll();
      const noteIndex = notes.findIndex((n) => n.id === noteId);

      if (noteIndex === -1) return false;

      notes[noteIndex] = { ...notes[noteIndex], ...updates, updatedAt: new Date().toISOString() };
      
      // Urutkan ulang berdasarkan tanggal terbaru
      notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      return false;
    }
  },

  /**
   * Menghapus catatan berdasarkan ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const notes = await this.getAll();
      const updatedNotes = notes.filter((n) => n.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  },

  /**
   * Menghapus semua catatan (biasanya dipanggil saat reset aplikasi)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing notes:', error);
    }
  }
};
