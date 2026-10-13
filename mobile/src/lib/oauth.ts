import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Google OAuth côté RN diffère du web (login/page.js) : signInWithOAuth() ne
// peut pas rediriger le navigateur lui-même, il renvoie une URL à ouvrir
// dans un onglet système (expo-web-browser), qui revient ensuite dans l'app
// via le scheme déclaré dans app.json ("facilite://"). Les jetons arrivent
// dans cette URL de retour — il faut les extraire et les poser manuellement
// avec setSession(), Supabase ne le fait pas seul sur mobile.
WebBrowser.maybeCompleteAuthSession();

export async function seConnecterAvecGoogle() {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Impossible de démarrer la connexion Google.");

  const resultat = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultat.type !== 'success' || !('url' in resultat) || !resultat.url) {
    throw new Error('Connexion annulée.');
  }

  const { params, errorCode } = getQueryParams(resultat.url);
  if (errorCode) throw new Error(errorCode);

  const { access_token: accessToken, refresh_token: refreshToken } = params;
  if (!accessToken || !refreshToken) {
    throw new Error('Réponse Google incomplète.');
  }

  const { error: erreurSession } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (erreurSession) throw erreurSession;
}
