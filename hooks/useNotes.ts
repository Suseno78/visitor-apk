import { useState, useCallback } from 'react';
import { NoteStorage } from '../storage/noteStorage';
import { Note } from '../types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    const data = await NoteStorage.getAll();
    setNotes(data);
    setIsLoading(false);
  }, []);

  const addNote = async (note: Note) => {
    const success = await NoteStorage.save(note);
    if (success) await loadNotes();
    return success;
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const success = await NoteStorage.update(id, updates);
    if (success) await loadNotes();
    return success;
  };

  const deleteNote = async (id: string) => {
    const success = await NoteStorage.delete(id);
    if (success) await loadNotes();
    return success;
  };

  const getNote = async (id: string) => {
    return await NoteStorage.getById(id);
  };

  const clearAll = async () => {
    await NoteStorage.clearAll();
    await loadNotes();
  };

  // Filter notes based on search query (case-insensitive)
  const filteredNotes = notes.filter((n) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = n.title.toLowerCase().includes(query);
    const contentMatch = n.content.toLowerCase().includes(query);
    return titleMatch || contentMatch;
  });

  return {
    notes: filteredNotes, // Return filtered list by default
    allNotes: notes, // Original list if needed
    searchQuery,
    setSearchQuery,
    isLoading,
    loadNotes,
    addNote,
    updateNote,
    deleteNote,
    getNote,
    clearAll,
  };
}
