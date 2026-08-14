import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getUserFromCookies } from '@/lib/apiAuth';

export async function GET(request) {
  // Atteinte par navigation (router.push depuis CanvaConnectButton), jamais
  // par fetch() : pas d'en-tête Authorization possible, vérification via le
  // cookie de session Supabase. Sans ce contrôle, n'importe quel visiteur
  // non connecté pouvait initier le flux OAuth Canva avec les identifiants
  // client de l'application.
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  if (!clientId || clientId.trim() === '' || clientId.includes('your_canva') || clientId === 'undefined') {
    // Si l'ID Client Canva OAuth n'est pas encore configuré, redirection directe vers le studio de création
    return NextResponse.redirect(new URL('/creer-cv', request.url));
  }

  // 1. Générer le PKCE Code Verifier et Challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // 2. Stocker le verifier dans un cookie HTTP-Only pour l'étape de callback
  const cookieStore = await cookies();
  cookieStore.set('canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  // 3. Construire l'URL d'autorisation Canva
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'design:content:read design:meta:read',
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
  });

  const authorizeUrl = `https://www.canva.com/api/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizeUrl);
}
