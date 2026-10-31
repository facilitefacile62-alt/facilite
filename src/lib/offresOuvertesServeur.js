// Lecture serveur des offres ouvertes pour les liens de /offres (clé publique : seulement ce que la lecture anonyme autorise, comme un navigateur ; la règle de lecture
// ne laisse passer que les offres approuvées et actives). Colonnes EXPLICITES. En cas de panne : aucun lien, la page reste exactement comme avant.
import { LIMITE_LIENS_OFFRES, SELECT_LIENS_OFFRES, offresOuvertes } from "./offresOuvertes.js";

export async function chargerOffresOuvertes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return [];
  try {
    const r = await fetch(
      `${url}/rest/v1/job_offers?select=${SELECT_LIENS_OFFRES}&is_active=eq.true&order=created_at.desc&limit=${LIMITE_LIENS_OFFRES * 3}`,
      { headers: { apikey: cle, Authorization: `Bearer ${cle}` }, next: { revalidate: 300 } }
    );
    if (!r.ok) return [];
    return offresOuvertes(await r.json());
  } catch {
    return [];
  }
}
