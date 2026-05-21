import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Retrieves the currently active Supabase configuration (either from localStorage or env variables)
 */
export const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');
  
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  return {
    url: localUrl || envUrl || '',
    anonKey: localKey || envKey || ''
  };
};

/**
 * Initializes or re-initializes the Supabase client
 */
export const initSupabaseClient = (url?: string, anonKey?: string): SupabaseClient | null => {
  const config = getSupabaseConfig();
  const activeUrl = url || config.url;
  const activeKey = anonKey || config.anonKey;
  
  if (!activeUrl || !activeKey) {
    supabaseInstance = null;
    return null;
  }
  
  try {
    // Basic validation of URL format
    if (!activeUrl.startsWith('http://') && !activeUrl.startsWith('https://')) {
      throw new Error('Invalid Supabase URL scheme');
    }
    supabaseInstance = createClient(activeUrl, activeKey);
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    supabaseInstance = null;
    return null;
  }
};

/**
 * Gets the current Supabase client instance, initializing it if not already done
 */
export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;
  return initSupabaseClient();
};

/**
 * Clears keys from localStorage and resets the client
 */
export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  supabaseInstance = null;
};
