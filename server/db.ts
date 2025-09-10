import { supabase } from './supabase';

console.log('Supabase URL:', process.env.SUPABASE_URL);
console.log('Supabase client initialized successfully');

export { supabase as db };