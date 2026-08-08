import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromCookies } from '@/lib/apiAuth';

export async function GET() {
  // Le cookie canva_access_token à lui seul ne prouve rien sur l'identité
  // Facilite de l'appelant (obtenu via une redirection OAuth qui pouvait
  // être complétée par n'importe qui avant ce correctif) — vérifie
  // d'abord qu'une session Facilite valide est associée à la requête.
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('canva_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Non authentifié avec Canva' }, { status: 401 });
  }

  try {
    // Exemple d'appel API : Récupérer la liste des designs récents (vérifier la doc exacte pour l'endpoint)
    const response = await fetch('https://api.canva.com/rest/v1/designs', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Gérer l'expiration ici via le refresh_token si le status est 401
      throw new Error(data.message || 'Erreur API Canva');
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
