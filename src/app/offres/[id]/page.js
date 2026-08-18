/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { getSupabasePublicClient } from "@/lib/supabase";
import { safeJsonLdString } from "@/lib/jsonLd";
import OffreDetailClient from "./OffreDetailClient";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

const FALLBACK_STATIC_OFFERS = {
  "df1477a7-88df-4817-a130-25b681c32413": {
    id: "df1477a7-88df-4817-a130-25b681c32413",
    title: "SEMI SARL recrute un(e) Chef(fe) de Chantier (BTP & Construction)",
    company: "SEMI SARL",
    location: "Sénégal (Pôles aquacoles)",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & expérience BTP",
    description: `Dans le cadre de son projet de construction de pôles aquacoles, SEMI SARL recrute un(e) Chef(fe) de Chantier pour le suivi opérationnel et la supervision des travaux.

📌 MISSIONS PRINCIPALES :
• Organiser et superviser les travaux sur le chantier.
• Coordonner les équipes et assurer la bonne exécution des activités.
• Suivre quotidiennement l’avancement et veiller au respect des plans et délais.
• Contrôler la qualité des travaux et faire respecter les règles HSE.
• Assurer le reporting auprès de la Direction des Travaux.

🎯 PROFIL RECHERCHÉ :
• Expérience confirmée en tant que Chef de Chantier (BTP / Génie Civil).
• Forte capacité d'organisation, de coordination et de gestion d'équipe.
• Sens des responsabilités, rigueur et autonomie.
• Disponibilité pour mobilité sur les différents sites du projet.

📩 COMMENT POSTULER :
Envoyez votre CV à : sarrsoda@semisenegal.sn
📌 Objet du mail : « Candidature – Chef de Chantier »`,
    image_url: "/semi_sarl_chef_chantier.jpg",
    min_education_level: "Bac+2 à Bac+5 (Génie Civil / BTP)",
    deadline: "2026-09-15",
    contact_email: "sarrsoda@semisenegal.sn",
    external_link: "mailto:sarrsoda@semisenegal.sn?subject=Candidature%20%E2%80%93%20Chef%20de%20Chantier",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "72ce49fa-efa7-4aa4-95ec-b1f73e6c581f": {
    id: "72ce49fa-efa7-4aa4-95ec-b1f73e6c581f",
    title: "Le Terrou-Bi Dakar recrute un(e) Agent de Réservation Individuelle (H/F)",
    company: "Hôtel & Resort Terrou-Bi Dakar",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & grille hôtelière 5 étoiles",
    description: `L’Hôtel & Resort Terrou-Bi Dakar recherche un(e) Agent de Réservation Individuelle (H/F) dynamique et orienté client pour assurer la gestion optimale des réservations et sublimer l'expérience client avant séjour.

📌 MISSIONS PRINCIPALES :
• Traitement et confirmation des réservations (téléphone, e-mail, site web, OTA & GDS).
• Application des techniques d'upselling et valorisation des offres du Resort.
• Accueil personnalisé, conseil client et respect des standards LQA de luxe.
• Préparation des confirmations, factures pro forma et réconciliation extranet.
• Coordination avec la réception, conciergerie et housekeeping.

🎯 PROFIL & QUALIFICATIONS :
• Formation : Bac+3 en Hôtellerie, Tourisme, Commerce ou Marketing.
• Expérience : Minimum 2 ans dans une fonction similaire en hôtellerie.
• Compétences : Maîtrise des PMS, OTA et GDS, gestion tarifaire & facturation.
• Langues : Très bonne maîtrise du français et de l'anglais.
• Disponibilité : Flexibilité horaire (travail en soirée, nuit ou week-ends).

🔗 COMMENT POSTULER :
Remplissez directement le formulaire de candidature officiel en ligne :
https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform`,
    image_url: "/terrou_bi_reservation.jpg",
    min_education_level: "Bac+3 (Hôtellerie / Tourisme / Commerce)",
    deadline: "2026-08-31",
    external_link: "https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "9d28564d-7084-4f71-8a71-f1c8a7796ff9": {
    id: "9d28564d-7084-4f71-8a71-f1c8a7796ff9",
    title: "BCEAO recrute 03 Assistants de direction à Dakar",
    company: "BCEAO (Banque Centrale des États de l'Afrique de l'Ouest)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Grille Institutionnelle BCEAO",
    description: `La Banque Centrale des États de l'Afrique de l'Ouest (BCEAO) recrute pour son Siège basé à Dakar (Sénégal) 03 Secrétaires / Assistants de direction.

📌 MISSIONS PRINCIPALES :
• Accueil téléphonique et physique des visiteurs.
• Gestion du courrier, classement et archivage.
• Gestion des agendas, réunions et constitution des dossiers.
• Saisie et mise en forme des documents officiels.

🎯 CRITÈRES D'ÉLIGIBILITÉ & PROFIL :
• Être ressortissant(e) d’un État membre de l’UMOA (18 à 40 ans).
• Niveau d'études : Bac +2 à Bac +4 en Assistanat de direction ou domaine connexe.
• Expérience : 2 ans minimum d’expérience en tant qu'Assistant(e) de direction.
• Langue : La maîtrise de l’anglais constitue un atout important.

📅 DATE LIMITE : 24 août 2026

🔗 COMMENT POSTULER :
Postulez directement sur la plateforme officielle de la BCEAO :
https://bceao2.tzportal.io//fr/jobs/1960-64`,
    image_url: "/bceao_assistant_direction.jpg",
    min_education_level: "Bac+2 à Bac+4",
    deadline: "2026-08-24",
    external_link: "https://bceao2.tzportal.io//fr/jobs/1960-64",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "ddc8c73d-7d1e-4ff0-a7af-153e5b5aa8a6": {
    id: "ddc8c73d-7d1e-4ff0-a7af-153e5b5aa8a6",
    title: "Recrutement Chantier (12 Profils Engins & BTP) - SECAM S.A.",
    company: "SECAM S.A.",
    location: "Kédougou, Sénégal",
    contract_type: "CDD (2 ans)",
    salary_range: "Selon profil & expérience",
    description: `Pour les besoins d’un chantier situé à Kédougou, SECAM S.A. recrute du personnel qualifié pour un contrat de deux (02) ans avec prise de fonction immédiate.

🏗️ 12 POSTES À POURVOIR :
• 06 Conducteurs de chargeurs
• 02 Conducteurs de tractopelles
• 01 Conducteur de compacteur lisse
• 01 Conducteur de bulldozer
• 01 Conducteur de niveleuse CAT 140K
• 01 Mécanicien hydraulicien

📌 PROFIL RECHERCHÉ :
• Expérience avérée dans le domaine visé.
• Disponibilité immédiate pour affectation à Kédougou.

📁 DOSSIER DE CANDIDATURE :
• Demande manuscrite + CV à jour
• Copie des diplômes / attestations + CNI

📅 MODALITÉS & CONTACTS :
• Date limite : 20 août 2026
• Dépôt physique : Siège SECAM S.A., Almadies (Dakar)
• Dépôt e-mail : secam.sa@secam.sn ou kancouba.ba@secam.sn
• Téléphones : +221 33 844 30 41 / +221 77 531 33 48`,
    image_url: "/secam_chantier_kedougou.jpg",
    min_education_level: "Professionnel / Technique",
    deadline: "2026-08-20",
    contact_email: "secam.sa@secam.sn",
    contact_whatsapp: "+221775313348",
    external_link: "mailto:secam.sa@secam.sn?cc=kancouba.ba@secam.sn&subject=Candidature%20Chantier%20SECAM%20Kedougou",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "f302e044-0ff5-4d60-9b33-b9db11fa2df7": {
    id: "f302e044-0ff5-4d60-9b33-b9db11fa2df7",
    title: "Chauffeur (Motor Pool) - Ambassade des États-Unis",
    company: "Ambassade des États-Unis au Sénégal",
    location: "Dakar, Sénégal",
    contract_type: "CDI",
    salary_range: "7 508 035 FCFA / an (~625 000 FCFA/mois)",
    description: `L’Ambassade des États-Unis à Dakar recrute un(e) Chauffeur (Motor Pool Chauffeur) pour assurer le transport sécurisé du personnel diplomatique, des visiteurs et du fret.

📌 PROFIL RECHERCHÉ :
• Expérience : Au moins 3 ans d'expérience continue comme chauffeur.
• Permis : Permis de conduire valide obligatoire.
• Connaissances : Excellente maîtrise des itinéraires et du trafic de Dakar.
• Langues : Français (bon niveau de travail) et notions d'anglais.

💰 SALAIRE & AVANTAGES :
• Salaire annuel : 7 508 035 FCFA / an (~625 000 FCFA / mois).
• Avantages : Assurance santé complète et indemnités de la Mission Américaine.

🔗 COMMENT POSTULER :
Postulez directement en ligne sur le portail officiel ERA de l'Ambassade des États-Unis :
https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17`,
    image_url: "/chauffeur_ambassade_usa.jpg",
    min_education_level: "Primaire",
    deadline: "2026-09-30",
    contact_email: "DakarHR@state.gov",
    external_link: "https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  "82dd1b8a-8234-4862-8580-dfe4e47897b0": {
    id: "82dd1b8a-8234-4862-8580-dfe4e47897b0",
    title: "Programme de Stages Internationaux - UNICEF 2026",
    company: "UNICEF",
    location: "International (Multi-pays)",
    contract_type: "Stage",
    salary_range: "Indemnité selon grille UNICEF",
    description: `L'UNICEF offre à des étudiants et jeunes diplômés du monde entier des opportunités de stage international.

📌 PROFIL & ÉLIGIBILITÉ :
• Niveau d'études : Bac+1 à Bac+8.
• Lieux : Divers bureaux internationaux UNICEF.
• Date limite : Candidatures ouvertes en continu tout au long de l'année.

🔗 CANDIDATURE :
Retrouvez toutes les informations et postulez sur :
https://youthmedia.net/opportunites/programme-de-stages-unicef-2026`,
    image_url: "/unicef_stage_2026.jpg",
    min_education_level: "Bac+1 à Bac+8",
    deadline: "2026-12-31",
    contact_email: "info@youthmedia.net",
    external_link: "https://youthmedia.net/opportunites/programme-de-stages-unicef-2026",
    is_active: true,
    created_at: new Date().toISOString(),
  },
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

export async function generateMetadata({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    return { title: "Offre d'emploi introuvable | Facilité" };
  }

  const title = `${offer.title} - ${offer.company} | Offre d'emploi Facilité`;
  const cleanDesc = (offer.description || "")
    .replace(/[#*•_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description =
    cleanDesc.slice(0, 160) ||
    `Découvrez l'offre d'emploi ${offer.title} chez ${offer.company} à ${offer.location}. Postulez directement en ligne sur Facilité.`;
  const url = `${SITE_URL}/offres/${offer.id}`;
  const imageUrl = offer.image_url
    ? offer.image_url.startsWith("http")
      ? offer.image_url
      : `${SITE_URL}${offer.image_url}`
    : `${SITE_URL}/logo.jpeg`;

  return {
    title,
    description,
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
      title,
      description,
      url,
      type: "article",
      locale: "fr_SN",
      siteName: "Facilité",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: offer.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function OffreDetailPage({ params }) {
  const { id } = await params;
  const offer = await fetchOffer(id);

  if (!offer) {
    notFound();
  }

  const formattedDescription = formatJobDescriptionToHtml(offer.description || offer.title);
  const datePosted = offer.created_at ? new Date(offer.created_at).toISOString() : new Date().toISOString();
  const validThrough = offer.deadline
    ? new Date(offer.deadline).toISOString()
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

  const logoUrl = offer.image_url
    ? offer.image_url.startsWith("http")
      ? offer.image_url
      : `${SITE_URL}${offer.image_url}`
    : `${SITE_URL}/logo.jpeg`;

  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: formattedDescription,
    datePosted: datePosted,
    validThrough: validThrough,
    employmentType: mapEmploymentType(offer.contract_type),
    hiringOrganization: {
      "@type": "Organization",
      name: offer.company || "Facilité",
      sameAs: offer.external_link || SITE_URL,
      logo: logoUrl,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: offer.location || "Sénégal",
        addressLocality: offer.location || "Dakar",
        addressRegion: offer.location || "Dakar",
        addressCountry: "SN",
      },
    },
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Sénégal",
    },
    directApply: true,
    identifier: {
      "@type": "PropertyValue",
      name: "Facilité",
      value: offer.id,
    },
    url: `${SITE_URL}/offres/${offer.id}`,
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
