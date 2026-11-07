// Réglages de l'aide (table aide_reglages, une ligne) — modifiables par l'administrateur sans redéployer.
// Lecture FAIL-CLOSED : si la base ne répond pas, l'IA est considérée comme COUPÉE.

export const REGLAGES_PAR_DEFAUT = Object.freeze({
  ia_active: false,
  limite_ia_par_jour: 10,
  longueur_max_message: 500,
  max_tokens: 300,
  plafond_jour_usd: 1,
  plafond_mois_usd: 5,
  conservation_vocaux_jours: 30,
  vocaux_par_jour: 5,
  vocal_secondes_max: 60,
});

function entier(v, repli, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : repli;
}

/** Fusionne une ligne de la base avec les valeurs par défaut en bornant chaque nombre. */
export function fusionnerReglages(ligne, env = process.env) {
  const d = REGLAGES_PAR_DEFAUT;
  const l = ligne || {};
  // Le coupe-circuit d'environnement AIDE_IA_COUPEE=oui coupe l'IA quoi que dise la base.
  const coupeEnv = String(env?.AIDE_IA_COUPEE || "").toLowerCase() === "oui";
  return {
    ia_active: l.ia_active === true && !coupeEnv,
    limite_ia_par_jour: entier(l.limite_ia_par_jour, d.limite_ia_par_jour, 0, 200),
    longueur_max_message: entier(l.longueur_max_message, d.longueur_max_message, 50, 2000),
    max_tokens: entier(l.max_tokens, d.max_tokens, 50, 1500),
    plafond_jour_usd: Number.isFinite(Number(l.plafond_jour_usd)) ? Number(l.plafond_jour_usd) : d.plafond_jour_usd,
    plafond_mois_usd: Number.isFinite(Number(l.plafond_mois_usd)) ? Number(l.plafond_mois_usd) : d.plafond_mois_usd,
    conservation_vocaux_jours: entier(l.conservation_vocaux_jours, d.conservation_vocaux_jours, 1, 365),
    vocaux_par_jour: entier(l.vocaux_par_jour, d.vocaux_par_jour, 0, 50),
    vocal_secondes_max: entier(l.vocal_secondes_max, d.vocal_secondes_max, 5, 120),
  };
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
export async function lireReglages(admin, env = process.env) {
  try {
    const { data, error } = await admin.from("aide_reglages").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return { ...fusionnerReglages(null, env), ia_active: false, lecture_ok: false };
    return { ...fusionnerReglages(data, env), lecture_ok: true };
  } catch {
    return { ...fusionnerReglages(null, env), ia_active: false, lecture_ok: false };
  }
}
