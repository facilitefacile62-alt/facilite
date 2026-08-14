import { getSupabasePublicClient } from "@/lib/supabase";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/service", changeFrequency: "weekly", priority: 0.8 },
  { path: "/offres", changeFrequency: "daily", priority: 0.9 },
  { path: "/modeles", changeFrequency: "weekly", priority: 0.8 },
  { path: "/recrutement-spontane", changeFrequency: "weekly", priority: 0.8 },
  { path: "/recrutement-journalier", changeFrequency: "daily", priority: 0.8 },
  { path: "/boite-a-idees", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
];

export default async function sitemap() {
  const now = new Date();
  const entries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const supabase = getSupabasePublicClient();
    const { data: offers, error } = await supabase
      .from("job_offers")
      .select("id, updated_at, created_at")
      .eq("is_active", true);

    if (error) throw error;

    for (const offer of offers || []) {
      entries.push({
        url: `${SITE_URL}/offres/${offer.id}`,
        lastModified: offer.updated_at || offer.created_at || now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (err) {
    // Le sitemap ne doit jamais faire échouer le build/la requête pour une
    // panne Supabase transitoire : on renvoie au moins les pages statiques.
    console.error("[sitemap] Échec du chargement des offres d'emploi :", err.message);
  }

  return entries;
}
