import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mhuqgvhgbfovjuhacjxw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXFndmhnYmZvdmp1aGFjanh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjY2OTUsImV4cCI6MjA4MzIwMjY5NX0.siSpeFR-vK4XuQz0AC6CBiojuSgj3JZ5vlYDXRUPsrU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
