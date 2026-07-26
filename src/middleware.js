import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ocfhzwwjvljintabxxlg.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZmh6d3dqdmxqaW50YWJ4eGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjYyNTgsImV4cCI6MjEwMDY0MjI1OH0.AX-8_1iGwTawUJMU3wwXms0UcaBh4orX-Bas31X1F7s";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  // Récupérer le cookie d'authentification de Supabase
  const token = req.cookies.get("sb-access-token")?.value || req.cookies.get("supabase-auth-token")?.value;

  const url = req.nextUrl.clone();

  // Routes protégées qui nécessitent d'être connecté
  const protectedRoutes = ["/profil"];

  if (protectedRoutes.includes(url.pathname)) {
    // Si aucun jeton n'est présent dans les cookies, rediriger vers /login
    if (!token) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/profil"],
};
