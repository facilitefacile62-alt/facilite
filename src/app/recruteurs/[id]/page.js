import { getSupabasePublicClient } from "@/lib/supabase";
import RecruiterShowcaseClient from "./RecruiterShowcaseClient";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

// Wrapper serveur pur (option B, validée) : RecruiterShowcaseClient reste
// intégralement inchangé et continue de faire son propre fetch (session
// visiteur, niveau d'études candidat, offres actives) — ce fichier ne fait
// qu'un second fetch minimal, séparé, pour generateMetadata uniquement.
async function fetchRecruiterForMetadata(recruiterId) {
  try {
    const supabase = getSupabasePublicClient();
    // Même RLS publique que RecruiterShowcaseClient ("Lecture publique des
    // profils recruteurs") — aucun accès élevé nécessaire ici.
    const { data } = await supabase
      .from("recruiter_profiles")
      .select("company_name, description, sector, location, logo_url, banner_url")
      .eq("user_id", recruiterId)
      .maybeSingle();
    return data || null;
  } catch (err) {
    console.error("[recruteurs/[id] generateMetadata] Échec du chargement du profil recruteur :", err.message);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const recruiterProfile = await fetchRecruiterForMetadata(id);

  if (!recruiterProfile) {
    return { title: "Recruteur" };
  }

  const companyName = recruiterProfile.company_name || "Recruteur Facilité";
  const cleanDesc = (recruiterProfile.description || "").replace(/\s+/g, " ").trim();
  const description =
    cleanDesc.slice(0, 160) ||
    `Découvrez les offres d'emploi de ${companyName}${recruiterProfile.location ? ` à ${recruiterProfile.location}` : ""} sur Facilité.`;
  const url = `${SITE_URL}/recruteurs/${id}`;
  const rawImage = recruiterProfile.logo_url || recruiterProfile.banner_url;
  const imageUrl = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${SITE_URL}${rawImage}`
    : `${SITE_URL}/logo.jpeg`;

  return {
    // Pas de "| Facilité" ici : le template du layout racine
    // (title.template: "%s | Facilite") l'ajoute déjà automatiquement.
    title: `${companyName} — Recruteur`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${companyName} sur Facilité`,
      description,
      url,
      type: "profile",
      locale: "fr_SN",
      siteName: "Facilité",
      images: [{ url: imageUrl, width: 400, height: 400, alt: companyName }],
    },
    twitter: {
      card: "summary",
      title: `${companyName} sur Facilité`,
      description,
      images: [imageUrl],
    },
  };
}

export default function Page() {
  return <RecruiterShowcaseClient />;
}
