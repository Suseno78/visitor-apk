import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL environment variable. ' +
      'Add it to your .env file.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable. ' +
      'Add it to your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
