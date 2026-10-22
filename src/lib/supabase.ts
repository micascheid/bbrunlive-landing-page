import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pquskkvnebbvgxwqtgol.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXNra3ZuZWJidmd4d3F0Z29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3OTcxOTUsImV4cCI6MjA2NDM3MzE5NX0.NJpjgXkpOY118ISfUiSapMeB5d3IAUqQznJiv9xM6c4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
