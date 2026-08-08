import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromCookies } from '@/lib/apiAuth';

export async function GET(request) {
  // Redirection OAuth Canva, jamais un fetch() : même contrôle que
  // /api/canva/auth, cookie de session Supabase plutôt qu'un en-tête
  // Authorization. Sans lui, n'importe quel visiteur non connecté pouvait
  // compléter l'échange de jeton OAuth et se voir attribuer un
  // canva_access_token, sans rapport avec un compte Facilite.
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL(`/?error=${error || 'no_code'}`, request.url));
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get('canva_code_verifier')?.value;

  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/?error=missing_verifier', request.url));
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  // Encodage Basic Auth pour Canva
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenResponse = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Token fetch failed');
    }

    // Sauvegarde des tokens (Ici dans des cookies sécurisés pour l'exemple)
    cookieStore.set('canva_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: tokenData.expires_in,
    });
    
    if (tokenData.refresh_token) {
      cookieStore.set('canva_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 jours
      });
    }

    // Nettoyer le verifier
    cookieStore.delete('canva_code_verifier');

    // Rediriger vers le dashboard ou la page d'origine
    return NextResponse.redirect(new URL('/profil?canva_connected=true', request.url));

  } catch (err) {
    console.error('Erreur Canva OAuth:', err);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}
