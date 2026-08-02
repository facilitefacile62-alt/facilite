/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabasePublicClient } from "@/lib/supabase";
import OffreApplySection from "@/components/OffreApplySection";
import { safeJsonLdString } from "@/lib/jsonLd";
import BadgeDisplay from "@/components/BadgeDisplay";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ffacilite.com";

async function fetchOffer(id) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("job_offers")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  // has_badge() est GRANT à anon (public.has_badge, migration
  // 20260802080000) : l'affichage du badge "Recruteur vérifié" est
  // volontairement public, comme le reste de la page.
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
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(jobPostingSchema) }}
      />

      <header className="bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/offres" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition">
            <i className="fa-solid fa-arrow-left"></i>
            <span className="text-sm font-bold">Toutes les offres</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          {offer.image_url && (
            <div className="relative w-full h-[380px] sm:h-[480px] max-h-[550px] overflow-hidden bg-gray-100">
              {/* Fond flouté + image en object-contain (façon Facebook) : une
                  affiche recruteur au format A4 n'est plus coupée en haut/bas. */}
              <img
                src={offer.image_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none select-none"
              />
              <img
                src={offer.image_url}
                alt={offer.title}
                className="relative z-10 w-full h-full object-contain mx-auto block"
                loading="lazy"
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                {offer.contract_type}
              </span>
              {offer.min_education_level && offer.min_education_level !== "Aucun" && (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                  🎓 {offer.min_education_level}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">{offer.title}</h1>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-base font-bold text-gray-600">{offer.company}</p>
              {offer.recruiterVerified && <BadgeDisplay badges={["verified_recruiter"]} />}
            </div>
            <p className="text-sm text-gray-400 font-medium mb-6">
              <i className="fa-solid fa-location-dot mr-1"></i>
              {offer.location}
              {offer.salary_range && <span> · {offer.salary_range}</span>}
            </p>

            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed mb-8">
              {offer.description}
            </div>

            <div className="max-w-sm">
              <OffreApplySection offer={offer} />
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite. Toutes les offres d'emploi.
      </footer>
    </div>
  );
}
