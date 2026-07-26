import { NextResponse } from "next/server";

export async function middleware(req) {
  // Le middleware laisse passer la requête et la protection stricte est exécutée côté client dans profil/page.js
  return NextResponse.next();
}

export const config = {
  matcher: ["/profil"],
};
