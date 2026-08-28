import { canonicalMetadata } from "@/lib/staticPageMetadata";
import { getSupabasePublicClient } from "@/lib/supabase";
import { isOfferExpired } from "@/lib/offerExpiration";
import HomeClient from "./HomeClient";

export const metadata = canonicalMetadata("/");
export const revalidate = 60;

async function getInitialOffers() {
  try {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("job_offers")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) return [];

    const nonExpired = data.filter((offer) => !isOfferExpired(offer));
    return nonExpired.map((offer) => ({
      id: offer.id,
      titleFR: offer.title || "Offre d'emploi",
      titleEN: offer.title || "Job offer",
      company: offer.company || "Entreprise confidentielle",
      logo: offer.image_url || null,
      logoColor: "bg-gray-500",
      initials: offer.company ? offer.company.substring(0, 2).toUpperCase() : "CO",
      location: offer.location || "Non spécifié",
      timeFR: new Date(offer.created_at).toLocaleDateString("fr-FR"),
      timeEN: new Date(offer.created_at).toLocaleDateString("en-US"),
      contract: offer.contract_type || "Non spécifié",
      descFR: offer.description || "",
      descEN: offer.description || "",
      tags: [offer.location, offer.contract_type].filter(Boolean),
      image: offer.image_url || null,
      image_url: offer.image_url || null,
      recruiterEmail: offer.contact_email || null,
      contact_email: offer.contact_email || null,
      recruiterPhone: offer.contact_phone || null,
      contact_phone: offer.contact_phone || null,
      externalLink: offer.external_link || null,
      deadline: offer.deadline || null,
      status: offer.status,
      is_active: offer.is_active,
      listing_type: offer.listing_type || "offre_emploi",
      is_sponsored: offer.is_sponsored || false,
      sponsor_priority: offer.sponsor_priority || 0,
      positions_count: offer.positions_count || null,
      sector: offer.sector || null,
      category: offer.category || null,
      project: offer.project || null,
      domain: offer.domain || null,
    }));
  } catch (err) {
    console.warn("[Home SSR] Impossible de précharger les offres initiales:", err.message);
    return [];
  }
}

export default async function Page() {
  const initialOffers = await getInitialOffers();
  return <HomeClient initialOffers={initialOffers} />;
}
