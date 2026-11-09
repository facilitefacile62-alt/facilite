/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { getSupabasePublicClient } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { safeJsonLdString } from "@/lib/jsonLd";
import { SELECT_FICHE_OFFRE, retirerChampsInternes } from "@/lib/colonnesOffres";
import { adresseImage } from "@/lib/imagesPubliques";
import { adresseJobPosting, offreCloturee, offreHorsReferencement, validThroughIso } from "@/lib/offreReferencement";
import { choisirOffresSimilaires } from "@/lib/offresSimilaires";
import { descriptionOffre, titreOffre } from "@/lib/titresReferencement";
import { trouverOffreSecours } from "@/lib/offresSecours";
import { candidatureDansFacilite } from "@/lib/contactExterne";
import { nettoyerOffreAffichee } from "@/lib/nettoyerTexteOffre";
import OffreDetailClient from "./OffreDetailClient";
import OffresSimilaires from "./OffresSimilaires";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";


// Panne passagère de la base (réseau, délai dépassé, service indisponible) :
// à ne JAMAIS confondre avec « cette offre n'existe pas ». Répondre 404 dans ce
// cas faisait croire à Google que la page était supprimée (Search Console,
// « Introuvable (404) » sur des offres pourtant actives) ; une erreur serveur
// 5xx lui dit au contraire de réessayer plus tard sans désindexer.
class OffreIndisponibleError extends Error {
  constructor(message) {
    super(message);
    this.name = "OffreIndisponibleError";
  }
}

// PostgREST renvoie PGRST116 quand .single() ne trouve aucune ligne : c'est le
// seul cas « l'offre n'existe pas ». Toute autre erreur est une panne.
const CODE_AUCUNE_LIGNE = "PGRST116";

async function fetchOffer(id) {
  if (!id) return null;
  const strId = String(id).trim();
  let panneBase = false;

  // 1. Offres statiques de secours (exemples) : développement et test SEULEMENT. En production trouverOffreSecours renvoie null (la fiche répond 404 pour
  //    « 1 » à « 7 », « 100 »…), et aucune ne porte jamais « recruteur vérifié ».
  const secours = trouverOffreSecours(strId);
  if (secours) {
    return nettoyerOffreAffichee({ ...retirerChampsInternes(secours), recruiterVerified: false });
  }

  // 2. Si c'est un format UUID, interrogation de Supabase
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strId);
  if (isUuid) {
    try {
      let supabase;
      try {
        supabase = getSupabaseAdmin();
      } catch {
        supabase = getSupabasePublicClient();
      }

      const { data, error } = await supabase
        .from("job_offers")
        // Colonnes de la fiche seulement (+ recruiter_id, lu ici pour le badge puis retiré avant l'envoi au navigateur).
        .select(`${SELECT_FICHE_OFFRE}, recruiter_id`)
        .eq("id", strId)
        .single();

      if (error && error.code !== CODE_AUCUNE_LIGNE) {
        console.error("fetchOffer DB error:", error.message);
        panneBase = true;
      }

      if (!error && data) {
        const { recruiter_id: recruteurId, ...donneesPubliques } = data;
        let recruiterVerified = false;
        if (recruteurId) {
          try {
            const { data: verified } = await supabase.rpc("has_badge", {
              check_user_id: recruteurId,
              badge_name: "verified_recruiter",
            });
            recruiterVerified = verified === true;
          } catch (e) {}
        }
        return nettoyerOffreAffichee({ ...retirerChampsInternes(donneesPubliques), recruiterVerified });
      }
    } catch (err) {
      console.error("fetchOffer DB error:", err);
      panneBase = true;
    }
  }

  if (panneBase) {
    throw new OffreIndisponibleError(`Lecture de l'offre ${strId} impossible : base indisponible`);
  }

  return null;
}

// schema.org JobPosting.employmentType n'a pas d'équivalent 1:1 avec
// contract_type (texte libre saisi par le recruteur, ex. "CDD / Formation") :
// mapping best-effort, FULL_TIME par défaut plutôt qu'une valeur inventée.
function mapEmploymentType(contractType) {
  const normalized = (contractType || "").toUpperCase();
  // Type de contrat non renseigné : le champ est OMIS (schema.org le permet) plutôt que « FULL_TIME » supposé, qui serait une donnée inventée.
  if (!normalized.trim()) return undefined;
  if (normalized.includes("STAGE") || normalized.includes("INTERN")) return "INTERN";
  if (normalized.includes("CDD")) return "TEMPORARY";
  if (normalized.includes("FREELANCE") || normalized.includes("INDÉPENDANT")) return "CONTRACTOR";
  if (normalized.includes("TEMPS PARTIEL") || normalized.includes("PART")) return "PART_TIME";
  return "FULL_TIME";
}

// schema.org exige un Number pour QuantitativeValue.value — salary_range
// est un champ texte libre saisi par le recruteur ("Selon profil &
// expérience", "Grille Institutionnelle BCEAO"...), jamais un nombre brut
// (vérifié le 2026-08-21 sur les 15 valeurs distinctes réellement en
// production : une seule contient un montant chiffré). Extraction
// best-effort du seul cas exploitable : un montant explicitement libellé
// en FCFA. Motif "X FCFA / an (~Y FCFA/mois)" observé en production ->
// préfère la DERNIÈRE occurrence (le mensuel, cohérent avec
// unitText: "MONTH" déjà utilisé ici). Bornes 10 000-10 000 000 pour
// écarter un faux positif improbable (un nombre isolé sans rapport avec
// un salaire, jamais rencontré en pratique mais pas à exclure). Aucune
// correspondance ou hors bornes -> baseSalary omis entièrement plutôt
// qu'une valeur inventée ou mal typée : omettre le champ est valide pour
// schema.org, un texte au mauvais type ne l'est jamais.
function extractMonthlySalaryFcfa(salaryRangeText) {
  if (!salaryRangeText) return null;
  const matches = [...salaryRangeText.matchAll(/(\d[\d\s.,]*\d|\d)\s*(?:FCFA|F\s?CFA|XOF)/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1][1];
  const numeric = Number(last.replace(/[\s.,]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 10000 || numeric > 10000000) return null;
  return numeric;
}

function formatJobDescriptionToHtml(text) {
  if (!text) return "";
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+\./.test(trimmed)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const itemContent = trimmed.replace(/^[•\-\d\.]+\s*/, "");
      html += `<li>${itemContent}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<p>${trimmed}</p>`;
    }
  }

  if (inList) {
    html += "</ul>";
  }

  return html || `<p>${text}</p>`;
}

// Offres encore ouvertes à proposer sous une offre clôturée. Lecture publique (la règle de lecture ne laisse passer que les offres approuvées et actives) ;
// une panne ne casse jamais la page : le bloc est simplement omis.
async function chargerOffresSimilaires(offer) {
  try {
    const { data } = await getSupabasePublicClient()
      .from("job_offers")
      .select("id, title, company, location, listing_type, deadline, created_at, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    return choisirOffresSimilaires(offer, data || [], 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  let offer;
  try {
    offer = await fetchOffer(id);
  } catch (err) {
    if (!(err instanceof OffreIndisponibleError)) throw err;
    // Panne passagère : titre neutre, la page elle-même répondra par une erreur serveur.
    return { title: "Offre d'emploi" };
  }

  if (!offer) {
    return { title: "Offre d'emploi introuvable" };
  }

  // Le modèle de titre du site (layout.js) ajoute la marque : le titre d'ici ne la contient pas, et tient en 49 caractères (60 avec la marque).
  const title = titreOffre(offer);
  const description = descriptionOffre(offer);
  const url = `${SITE_URL}/offres/${offer.id}`;
  // Aperçu de partage (WhatsApp, Facebook, Google) : l'image est servie par le Worker Cloudflare (cache d'un an) quand l'interrupteur est ouvert, sinon par
  // Supabase comme avant. Réécriture pour l'affichage seulement : rien n'est enregistré.
  const imageUrl = adresseImage(
    offer.image_url
      ? offer.image_url.startsWith("http")
        ? offer.image_url
        : `${SITE_URL}${offer.image_url}`
      : `${SITE_URL}/logo.jpeg`
  );

  return {
    title,
    description,
    // Offre clôturée ou arrivée au bout de sa validité : la page reste ouverte aux visiteurs (liens partagés, onglet « Offres expirées »)
    // mais ne doit plus être indexée.
    ...(offreHorsReferencement(offer) ? { robots: { index: false, follow: true } } : {}),
    keywords: [
      offer.title,
      offer.company,
      offer.location || "Sénégal",
      "Offre d'emploi Sénégal",
      "Recrutement Dakar",
      "Concours Sénégal",
      "Facilité",
    ],
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Facilite`,
      description,
      url,
      type: "article",
      locale: "fr_SN",
      siteName: "Facilité",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: offer.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Facilite`,
      description,
      images: [imageUrl],
    },
  };
}

export default async function OffreDetailPage({ params }) {
  const { id } = await params;
  // Une panne de la base lève OffreIndisponibleError (réponse 5xx, page
  // d'erreur) ; seul « l'offre n'existe pas » mène au 404.
  const offer = await fetchOffer(id);

  if (!offer) {
    notFound();
  }

  const formattedDescription = formatJobDescriptionToHtml(offer.description || offer.title);
  const datePosted = offer.created_at ? new Date(offer.created_at).toISOString() : new Date().toISOString();
  const horsReferencement = offreHorsReferencement(offer);

  const logoUrl = adresseImage(
    offer.image_url
      ? offer.image_url.startsWith("http")
        ? offer.image_url
        : `${SITE_URL}${offer.image_url}`
      : `${SITE_URL}/logo.jpeg`
  );

  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: formattedDescription,
    datePosted: datePosted,
    validThrough: validThroughIso(offer),
    employmentType: mapEmploymentType(offer.contract_type),
    hiringOrganization: {
      "@type": "Organization",
      name: offer.company || "Facilité",
      sameAs: offer.external_link || SITE_URL,
      logo: logoUrl,
    },
    jobLocation: {
      "@type": "Place",
      address: adresseJobPosting(offer.location),
    },
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Sénégal",
    },
    // true seulement si la candidature se fait réellement dans Facilité ; false pour un portail officiel, un lien externe ou WhatsApp.
    directApply: candidatureDansFacilite(offer),
    identifier: {
      "@type": "PropertyValue",
      name: "Facilité",
      value: offer.id,
    },
    url: `${SITE_URL}/offres/${offer.id}`,
    ...(() => {
      const monthlySalary = extractMonthlySalaryFcfa(offer.salary_range);
      return monthlySalary
        ? {
            baseSalary: {
              "@type": "MonetaryAmount",
              currency: "XOF",
              value: {
                "@type": "QuantitativeValue",
                value: monthlySalary,
                unitText: "MONTH",
              },
            },
          }
        : {};
    })(),
  };

  return (
    <>
      {/* JobPosting seulement pour une offre ouverte ET qui est un emploi : un événement (type « autre », ex. un salon) n'est pas un poste à pourvoir. */}
      {!horsReferencement && offer.listing_type !== "autre" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdString(jobPostingSchema) }}
        />
      )}
      <OffreDetailClient initialOffer={offer} />
      {offreCloturee(offer) && <OffresSimilaires offres={await chargerOffresSimilaires(offer)} />}
    </>
  );
}
