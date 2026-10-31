import { getSupabasePublicClient } from "@/lib/supabase";
import { offreHorsReferencement } from "@/lib/offreReferencement";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

// Date de dernière modification annoncée pour les pages fixes : une valeur STABLE, à changer à la main quand leur contenu change. « Maintenant » à chaque
// lecture disait aux moteurs que tout changeait en permanence, ce qui leur fait ignorer ce signal.
const DATE_PAGES_FIXES = new Date("2026-10-31T00:00:00Z");

// Search Console (octobre 2026) a signalé ce que le plan du site annonçait à
// tort :
// - /recherche : interdite par robots.txt, elle n'a pas à figurer ici ;
// - /confidentialite et /conditions-utilisation : doublons exacts de
//   /politique-de-confidentialite et /conditions (même contenu, ré-exporté).
//   Seules les URL canoniques restent annoncées (voir les layout.js de ces
//   dossiers qui déclarent la canonique) ;
// - /modeles et /service : redirigées vers /fonctionnalite-indisponible quand
//   leur interrupteur (feature_flags) est coupé, voir filtrerRoutesDesactivees.
const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/offres", changeFrequency: "daily", priority: 1.0 },
  { path: "/service", changeFrequency: "weekly", priority: 0.8 },
  { path: "/modeles", changeFrequency: "weekly", priority: 0.8 },
  { path: "/recrutement-spontane", changeFrequency: "weekly", priority: 0.8 },
  { path: "/recrutement-journalier", changeFrequency: "daily", priority: 0.8 },
  { path: "/fonctionnalites", changeFrequency: "weekly", priority: 0.9 },
  { path: "/boite-a-idees", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  // Exigée par Google Play et devant rester atteignable sans compte : elle
  // doit donc aussi être annoncée aux moteurs comme les autres pages légales.
  { path: "/suppression-compte", changeFrequency: "yearly", priority: 0.4 },
  { path: "/conditions", changeFrequency: "monthly", priority: 0.5 },
  { path: "/politique-de-confidentialite", changeFrequency: "monthly", priority: 0.4 },
];

// Même règle que src/proxy.js pour un visiteur anonyme : si une entrée
// feature_flags de ce chemin est coupée (ou interdit les visiteurs), l'URL
// redirige — inutile de l'annoncer aux moteurs. Fail-open : en cas de panne
// de lecture, on garde toutes les routes (jamais de page retirée sur erreur).
async function filtrerRoutesDesactivees(routes) {
  try {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase.from("feature_flags").select("id, path, enabled, roles");
    if (error || !data) return routes;
    const IGNORES = new Set(["feat_matching_ia_postuler", "feat_diagnostic_cv", "feat_card_pret_candidature", "feat_voice_assistant"]);
    return routes.filter((route) => {
      const bloque = data.some(
        (f) =>
          f.path === route.path &&
          !String(f.id).startsWith("feat_offres_") &&
          !IGNORES.has(f.id) &&
          !(f.enabled && f.roles?.visitor !== false)
      );
      return !bloque;
    });
  } catch (err) {
    console.error("[sitemap] Lecture des interrupteurs impossible, routes conservées :", err.message);
    return routes;
  }
}

// Sans cette ligne, Next.js fige le plan du site au moment du build : une offre arrivée à sa date limite resterait annoncée jusqu'au prochain déploiement.
// Régénéré au plus une fois par heure.
export const revalidate = 3600;

const OFFRE_SECOURS = { id: "9b125270-1234-4567-89ab-cdef25272026", deadline: "2026-08-28" };

export default async function sitemap() {
  const now = new Date();
  const routes = await filtrerRoutesDesactivees(STATIC_ROUTES);
  const entries = routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: DATE_PAGES_FIXES,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const knownOfferIds = new Set();

  try {
    const supabase = getSupabasePublicClient();
    const { data: offers, error } = await supabase
      .from("job_offers")
      .select("id, updated_at, created_at, deadline, status, is_active")
      .eq("is_active", true);

    if (!error && offers) {
      for (const offer of offers) {
        knownOfferIds.add(offer.id);
        // Offre clôturée ou arrivée au bout de sa validité : retirée du plan du site (sa page reste ouverte, mais en noindex).
        if (offreHorsReferencement(offer)) continue;
        entries.push({
          url: `${SITE_URL}/offres/${offer.id}`,
          lastModified: offer.updated_at ? new Date(offer.updated_at) : (offer.created_at ? new Date(offer.created_at) : now),
          changeFrequency: "daily",
          priority: 0.9,
        });
      }
    }
  } catch (err) {
    console.error("[sitemap] Échec du chargement des offres d'emploi :", err.message);
  }

  // Offre statique de secours (Concours Enseignants, définie dans offres/[id]/page.js) : annoncée seulement tant que sa date limite n'est pas dépassée.
  if (!knownOfferIds.has(OFFRE_SECOURS.id) && !offreHorsReferencement({ deadline: OFFRE_SECOURS.deadline })) {
    entries.push({
      url: `${SITE_URL}/offres/${OFFRE_SECOURS.id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    });
  }

  return entries;
}
