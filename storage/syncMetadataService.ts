import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_METADATA_KEY = '@visitra_sync_metadata';

export interface SyncMetadata {
  lastSyncedAt: string | null;
  workspaceId: string | null;
}

const DEFAULT_METADATA: SyncMetadata = {
  lastSyncedAt: null,
  workspaceId: null,
};

export const SyncMetadataService = {
  /**
   * Retrieves the current sync metadata from local storage.
   * Tolerant of missing or corrupt JSON.
   */
  async getMetadata(): Promise<SyncMetadata> {
    try {
      const raw = await AsyncStorage.getItem(SYNC_METADATA_KEY);
      if (!raw) return { ...DEFAULT_METADATA };
      const parsed = JSON.parse(raw);
      return {
        lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
        workspaceId: typeof parsed.workspaceId === 'string' ? parsed.workspaceId : null,
      };
    } catch (err) {
      console.warn('[SyncMetadataService] Failed to read sync metadata:', err);
      return { ...DEFAULT_METADATA };
    }
  },

  /**
   * Updates partial or full sync metadata.
   */
  async setMetadata(updates: Partial<SyncMetadata>): Promise<void> {
    try {
      const current = await this.getMetadata();
      const updated: SyncMetadata = {
        ...current,
        ...updates,
      };
      await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[SyncMetadataService] Failed to set sync metadata:', err);
    }
  },

  /**
   * Clears sync metadata (used on reset).
   */
  async clearMetadata(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SYNC_METADATA_KEY);
    } catch (err) {
      console.warn('[SyncMetadataService] Failed to clear sync metadata:', err);
    }
  },
};
