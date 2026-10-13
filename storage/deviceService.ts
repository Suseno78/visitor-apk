import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const DEVICE_ID_KEY = '@visitra_local_device_id';
const DEVICE_NAME_KEY = '@visitra_local_device_name';

export interface DeviceRecord {
  id: string;
  workspace_id: string;
  name: string;
  platform: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  updated_at: string;
}

export class DeviceService {
  /**
   * Get or generate a persistent local device installation ID.
   * Stored in AsyncStorage so restarts reuse the exact same device identity.
   */
  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch (err) {
      return 'dev_' + Date.now().toString(36);
    }
  }

  /**
   * Get or generate a human-readable local device name.
   */
  static async getDeviceName(): Promise<string> {
    try {
      let name = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      if (!name) {
        const platformName = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Device';
        name = `${platformName} (${Math.random().toString(36).substring(2, 6).toUpperCase()})`;
        await AsyncStorage.setItem(DEVICE_NAME_KEY, name);
      }
      return name;
    } catch {
      return 'Visitra Device';
    }
  }

  /**
   * Set custom device name
   */
  static async setDeviceName(name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(DEVICE_NAME_KEY, name.trim());
    } catch (err) {
      console.warn('[DeviceService] Failed to set device name:', err);
    }
  }

  /**
   * Register the device in Supabase public.devices table.
   * Avoids duplicate rows by checking if a device record with this name/workspace already exists.
   */
  static async registerDevice(workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false;

    try {
      const deviceName = await this.getDeviceName();
      const platform = Platform.OS;
      const now = new Date().toISOString();

      // Check if this device is already recorded in the workspace
      const { data: existing } = await supabase
        .from('devices')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .eq('name', deviceName)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update last_seen_at
        await supabase
          .from('devices')
          .update({ last_seen_at: now })
          .eq('id', existing[0].id);
        return true;
      }

      // Insert new device row
      const { error } = await supabase.from('devices').insert({
        workspace_id: workspaceId,
        name: deviceName,
        platform: platform,
        last_seen_at: now,
      });

      if (error) {
        console.warn('[DeviceService] Failed to insert device:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('[DeviceService] Error registering device:', err);
      return false;
    }
  }

  /**
   * Get all registered devices for a workspace
   */
  static async getWorkspaceDevices(workspaceId: string): Promise<DeviceRecord[]> {
    if (!workspaceId) return [];

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DeviceService] Failed to fetch devices:', error.message);
        return [];
      }

      return (data as DeviceRecord[]) || [];
    } catch (err) {
      console.warn('[DeviceService] Error fetching devices:', err);
      return [];
    }
  }
}
