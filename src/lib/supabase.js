import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ocfhzwwjvljintabxxlg.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZmh6d3dqdmxqaW50YWJ4eGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjYyNTgsImV4cCI6MjEwMDY0MjI1OH0.AX-8_1iGwTawUJMU3wwXms0UcaBh4orX-Bas31X1F7s";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
