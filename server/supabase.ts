import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Supabase client for all operations
export const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase initialized successfully');
