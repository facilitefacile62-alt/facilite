/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { getSupabasePublicClient } from "@/lib/supabase";
import { safeJsonLdString } from "@/lib/jsonLd";
import OffreDetailClient from "./OffreDetailClient";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

const FALLBACK_STATIC_OFFERS = {
  "9b125270-1234-4567-89ab-cdef25272026": {
    id: "9b125270-1234-4567-89ab-cdef25272026",
    title: "Concours de Recrutement Spécial de 2 527 Enseignants (Préscolaire, Élémentaire, Moyen-Secondaire)",
    company: "Ministère de l'Éducation Nationale (MEN - DRH / MIRADOR)",
    location: "Sénégal (National)",
    contract_type: "Concours / Fonction Publique",
    salary_range: "Grille Fonction Publique",
    description: `Dans le cadre de la mise en œuvre du plan de résorption du déficit en personnel enseignant, le Gouvernement a autorisé un recrutement spécial complémentaire de 2 527 ENSEIGNANTS pour le Préscolaire, l'Élémentaire et le Moyen-Secondaire général.

🎯 CORPS & POSTES CONCERNÉS :
• Préscolaire et Élémentaire : Titulaires du Baccalauréat, diplôme professionnel CEAP ou CAP.
• Moyen et Secondaire général : Titulaires du Bac S1/S2, niveau Bac+2, Licence, Maîtrise ou Master d'enseignement (CAE-CEM, CAEM, CAES, CAPEPS, CAMEPS).

📋 CONDITIONS À REMPLIR :
1. Être de nationalité sénégalaise ;
2. Âge : 18 à 33 ans au plus au 31/12/2026 (né entre le 31/12/1993 et le 31/12/2008) pour les non-titulaires de diplômes professionnels ;
3. Âge : 18 à 34 ans au plus au 31/12/2026 (né entre le 31/12/1992 et le 31/12/2008) pour les titulaires de diplômes professionnels d'enseignement ;
4. Être prêt à servir partout sur le territoire national.

📅 CALENDRIER DU CONCOURS :
• Candidatures en ligne : Du 15 au 28 août 2026 (Date limite : 28 août 2026) sur https://mirador.education.gouv.sn/recr26
• Dépôt physique des dossiers des présélectionnés : Du 01 au 04 septembre 2026 à l'IEF choisie lors de la candidature.

📁 DOSSIER À FOURNIR POUR LES PRÉSÉLECTIONNÉS :
1. Demande adressée à Monsieur le Ministre
2. Copie légalisée du diplôme académique requis
3. Copie légalisée du diplôme professionnel ou arrêté d'admission
4. Certificat médical d'aptitude à l'Enseignement
5. Copie légalisée de la Carte Nationale d'Identité
6. Copie légalisée du certificat de nationalité
7. Certificat de bonne vie et mœurs
8. Attestation d'exercice signée par l'IA ou l'IEF (au besoin)

🌐 Lien officiel de postulation : https://mirador.education.gouv.sn/recr26`,
    image_url: "/concours_enseignants_2026.png",
    min_education_level: "Bac / Bac+2 / Licence / Master",
    deadline: "2026-08-28",
    contact_email: "contact@education.sn",
    external_link: "https://mirador.education.gouv.sn/recr26",
    is_active: true,
    created_at: new Date().toISOString(),
  }
};

async function fetchOffer(id) {
  try {
    const supabase = getSupabasePublicClient();
    const { data, error } = await supabase
      .from("job_offers")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!error && data) {
      let recruiterVerified = false;
      if (data.recruiter_id) {
        const { data: verified } = await supabase.rpc("has_badge", {
          check_user_id: data.recruiter_id,
          badge_name: "verified_recruiter",
        });
        recruiterVerified = verified === true;
      }
      return { ...data, recruiterVerified };
    }
  } catch (err) {
    console.error("fetchOffer DB error:", err);
  }

  if (FALLBACK_STATIC_OFFERS[id]) {
    return { ...FALLBACK_STATIC_OFFERS[id], recruiterVerified: true };
  }

  return null;
}

// schema.org JobPosting.employmentType n'a pas d'équivalent 1:1 avec
// contract_type (texte libre saisi par le recruteur, ex. "CDD / Formation") :
// mapping best-effort, FULL_TIME par défaut plutôt qu'une valeur inventée.
function mapEmploymentType(contractType) {
  const normalized = (contractType || "").toUpperCase();
  if (normalized.includes("STAGE") || normalized.includes("INTERN")) return "INTERN";
  if (normalized.includes("CDD")) return "TEMPORARY";
  if (normalized.includes("FREELANCE") || normalized.includes("INDÉPENDANT")) return "CONTRACTOR";
  if (normalized.includes("TEMPS PARTIEL") || normalized.includes("PART")) return "PART_TIME";
  return "FULL_TIME";
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    return { title: "Offre introuvable — Facilite" };
  }

  const title = `${offer.title} — ${offer.company} | Facilite`;
  const description = (offer.description || "").slice(0, 160) || `Offre d'emploi ${offer.title} chez ${offer.company} à ${offer.location}, publiée sur Facilite.`;
  const url = `${SITE_URL}/offres/${offer.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: "fr_SN",
      images: offer.image_url ? [{ url: offer.image_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: offer.image_url ? [offer.image_url] : undefined,
    },
  };
}

export default async function OffreDetailPage({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    notFound();
  }

  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: offer.description || offer.title,
    datePosted: offer.created_at,
    employmentType: mapEmploymentType(offer.contract_type),
    hiringOrganization: {
      "@type": "Organization",
      name: offer.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: offer.location || undefined,
        addressCountry: "SN",
      },
    },
    ...(offer.salary_range
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "XOF",
            value: {
              "@type": "QuantitativeValue",
              value: offer.salary_range,
              unitText: "MONTH",
            },
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(jobPostingSchema) }}
      />
      <OffreDetailClient initialOffer={offer} />
    </>
  );
}
