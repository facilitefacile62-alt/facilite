// Intelligence de la banque de CV : catégorisation à l'import, diagnostic à
// la recherche.
//
// Un seul modèle, gemini-3.6-flash, avec responseSchema plutôt que la chaîne
// de repli Groq/DeepSeek utilisée ailleurs (parse-document, rag-matching) :
// cette banque est un nouvel outil, sans historique de panne à couvrir, et
// responseSchema élimine la classe d'erreur la plus fréquente des autres
// routes — un JSON mal formé qu'il faut regex-parser en espérant qu'il soit
// valide. C'est le même modèle et le même mécanisme que la machine à états
// du tunnel CV (src/app/api/ai-chat/route.js, TUNNEL_RESPONSE_SCHEMA),
// éprouvé en production.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

const CATEGORIES = [
  "informatique_numerique",
  "comptabilite_finance",
  "commerce_vente",
  "marketing_communication",
  "rh_administration",
  "btp_ingenierie",
  "sante",
  "education_formation",
  "logistique_transport",
  "juridique",
  "hotellerie_restauration",
  "agriculture_environnement",
  "artisanat_metiers_manuels",
  "autre",
];

function cleGemini() {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle || cle.includes("[") || cle.trim() === "") {
    throw new Error("Clé API Gemini absente ou invalide.");
  }
  return cle;
}

/**
 * Catégorise un CV à partir de son texte extrait. Ancrée sur le texte réel,
 * jamais sur le seul intitulé de poste éventuellement présent en haut du
 * document — c'est la garantie demandée : une catégorie « prouvée » par
 * l'expérience professionnelle et le parcours d'étude décrits dans le CV.
 *
 * @param {string} texteExtrait texte brut du CV (déjà tronqué par l'appelant)
 * @param {string[]} codesNiveaux codes valides de niveaux_etudes, dans l'ordre du référentiel
 * @param {string=} nomIndique nom saisi par l'admin, prioritaire sur celui deviné par le modèle
 */
export async function categoriserCv(texteExtrait, codesNiveaux, nomIndique) {
  const cle = cleGemini();

  const schema = {
    type: "OBJECT",
    properties: {
      nom_complet: {
        type: "STRING",
        description: "Nom complet du candidat tel qu'il figure sur le CV. Chaîne vide si introuvable.",
      },
      categorie: {
        type: "STRING",
        enum: CATEGORIES,
        description:
          "Secteur d'activité dominant du parcours du candidat, déduit de ses expériences professionnelles réelles — jamais du seul titre du CV.",
      },
      niveau_etude_code: {
        type: "STRING",
        enum: codesNiveaux,
        description: "Diplôme le plus élevé obtenu, parmi les codes fournis. Le plus proche si aucun ne correspond exactement.",
      },
      annees_experience: {
        type: "NUMBER",
        description: "Nombre approximatif d'années d'expérience professionnelle, calculé à partir des dates d'emploi listées. 0 si le CV est celui d'un débutant sans expérience.",
      },
      competences: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "5 à 12 compétences concrètes et vérifiables mentionnées dans le CV (outils, langages, méthodes) — pas des qualités générales comme « sérieux » ou « motivé ».",
      },
      resume_profil: {
        type: "STRING",
        description:
          "Synthèse professionnelle du parcours en 3 à 5 phrases, qui s'appuie explicitement sur les expériences et diplômes listés dans le CV. C'est ce texte qui doit justifier la catégorie choisie, pas l'inverse.",
      },
      points_forts: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "2 à 4 points forts concrets, chacun rattaché à un fait précis du CV (ex. « A géré une équipe de 8 personnes chez X », pas « Bon leadership »).",
      },
    },
    required: ["categorie", "resume_profil", "competences"],
  };

  const instruction = `Tu es un consultant RH senior. Analyse ce CV avec rigueur : chaque champ que tu remplis doit pouvoir être justifié par une phrase précise du texte fourni. Si une information est absente, ne l'invente jamais — laisse le champ vide ou à sa valeur par défaut la plus prudente.${
    nomIndique ? `\n\nLe nom du candidat a été indiqué par la personne qui importe ce CV : "${nomIndique}". Utilise-le pour le champ nom_complet plutôt que d'essayer de le deviner.` : ""
  }

CV à analyser :
"""
${texteExtrait}
"""`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini a refusé la demande (HTTP ${res.status}) : ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const texte = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte) {
    throw new Error("Réponse vide du modèle — le CV n'a pas pu être catégorisé.");
  }

  const analyse = JSON.parse(texte);
  if (!CATEGORIES.includes(analyse.categorie)) {
    // responseSchema contraint déjà l'énumération côté modèle ; cette
    // vérification n'est là que pour ne jamais transmettre une valeur qui
    // ferait échouer le CHECK de la table si Gemini s'écartait malgré tout
    // du schéma demandé.
    analyse.categorie = "autre";
  }
  return analyse;
}

/**
 * Embarque un texte en vecteur 768 dimensions, via la même fonction Edge
 * (gemini-orchestrator, action "embed") que job_offers et resumes — pour
 * que la recherche par proximité compare des vecteurs produits de façon
 * identique dans tout le projet.
 */
export async function embarquerTexte(texte) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action: "embed", text: (texte || "").slice(0, 7000) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !Array.isArray(json.embedding)) {
    throw new Error("Génération de l'embedding impossible.");
  }
  return json.embedding;
}

/**
 * Diagnostic de correspondance entre un poste recherché et une liste de
 * candidats déjà présélectionnés par proximité sémantique. Un seul appel
 * pour tous les candidats du lot plutôt qu'un appel par candidat : le
 * modèle voit l'ensemble d'un coup, ce qui produit un classement relatif
 * cohérent (« le meilleur des cinq », pas cinq avis indépendants qui
 * pourraient tous se dire « excellent »).
 *
 * @param {string} poste intitulé ou description du poste tapé par l'admin
 * @param {Array<{id:string, nom_complet:string, categorie:string, niveau_etude_code:string, annees_experience:number, competences:string[], resume_profil:string, points_forts:string[]}>} candidats
 */
export async function diagnostiquerCandidats(poste, candidats) {
  const cle = cleGemini();

  const contexte = candidats
    .map(
      (c, i) => `--- CANDIDAT ${i + 1} (id: ${c.id}) ---
Nom : ${c.nom_complet || "Non renseigné"}
Catégorie : ${c.categorie || "Non catégorisé"}
Niveau d'étude : ${c.niveau_etude_code || "Non renseigné"}
Années d'expérience : ${c.annees_experience ?? "Non renseigné"}
Compétences : ${(c.competences || []).join(", ") || "Aucune listée"}
Points forts : ${(c.points_forts || []).join(" ; ") || "Aucun listé"}
Profil : ${c.resume_profil || "Aucune synthèse disponible."}`
    )
    .join("\n\n");

  const schema = {
    type: "OBJECT",
    properties: {
      evaluations: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            score: { type: "NUMBER", description: "Note de correspondance de 0 à 100." },
            verdict: {
              type: "STRING",
              enum: ["Excellente adéquation", "Forte adéquation", "Adéquation modérée", "Adéquation partielle"],
            },
            diagnostic: {
              type: "STRING",
              description: "2 à 4 phrases expliquant CONCRÈTEMENT pourquoi ce candidat correspond ou non, en citant son parcours réel — pas une phrase générique interchangeable d'un candidat à l'autre.",
            },
            points_a_verifier: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Ce qui manque ou reste à confirmer en entretien pour ce poste précis.",
            },
          },
          required: ["id", "score", "verdict", "diagnostic"],
        },
      },
    },
    required: ["evaluations"],
  };

  const instruction = `Tu es un consultant en recrutement. Un poste est recherché ; voici les candidats présélectionnés par un premier filtre automatique. Pour CHAQUE candidat, évalue rigoureusement sa correspondance avec CE poste précis — pas une évaluation générale de son profil. Base-toi uniquement sur les informations fournies, ne complète jamais avec des suppositions non écrites.

POSTE RECHERCHÉ :
${poste}

CANDIDATS PRÉSÉLECTIONNÉS :
${contexte}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini a refusé la demande (HTTP ${res.status}) : ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const texte = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte) throw new Error("Réponse vide du modèle — aucun diagnostic disponible.");

  const parsed = JSON.parse(texte);
  const map = new Map();
  for (const ev of parsed.evaluations || []) {
    if (ev.id) map.set(ev.id, ev);
  }
  return map;
}

export { CATEGORIES };
