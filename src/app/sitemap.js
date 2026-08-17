import { getSupabasePublicClient } from "@/lib/supabase";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

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
  { path: "/confidentialite", changeFrequency: "monthly", priority: 0.5 },
  { path: "/conditions", changeFrequency: "monthly", priority: 0.5 },
  { path: "/politique-de-confidentialite", changeFrequency: "monthly", priority: 0.4 },
  { path: "/conditions-utilisation", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap() {
  const now = new Date();
  const entries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const knownOfferIds = new Set();

  try {
    const supabase = getSupabasePublicClient();
    const { data: offers, error } = await supabase
      .from("job_offers")
      .select("id, updated_at, created_at")
      .eq("is_active", true);

    if (!error && offers) {
      for (const offer of offers) {
        knownOfferIds.add(offer.id);
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

  // Fallback static offer : Concours Enseignants
  const fallbackId = "9b125270-1234-4567-89ab-cdef25272026";
  if (!knownOfferIds.has(fallbackId)) {
    entries.push({
      url: `${SITE_URL}/offres/${fallbackId}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    });
  }

  return entries;
}
