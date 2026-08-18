import { getDocumentProxy, extractText, renderPageAsImage } from "unpdf";
import mammoth from "mammoth";

// Seuil en dessous duquel on considère qu'un PDF n'a pas de couche texte exploitable
// (cas des documents scannés/photographiés) et qu'il faut basculer en OCR.
const MIN_PDF_TEXT_LENGTH = 30;

// Timeout court pour l'appel à Google Vision (8 secondes maximum)
const VISION_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
      if (typeof timer.unref === "function") timer.unref();
    }),
  ]);
}

// Liste vérifiée en interrogeant directement l'API (GET /v1beta/models puis
// un vrai appel generateContent) avec la clé configurée dans ce projet :
//   - gemini-1.5-flash / gemini-1.5-pro : n'existent plus du tout (retirés
//     du catalogue Google, absents de ListModels).
//   - gemini-2.5-flash : listé mais bloqué ("no longer available to new
//     users") — 404 systématique malgré sa présence dans ListModels.
//   - gemini-2.0-flash / gemini-pro-latest : quota gratuit à 0 sur ce projet
//     (429 RESOURCE_EXHAUSTED, limit: 0) — probablement un projet sans accès
//     "Pro"/modèles datés sur le palier gratuit.
//   - gemini-flash-lite-latest / gemini-flash-latest : seuls modèles ayant
//     réellement répondu avec succès à un appel generateContent réel.
// Alias "-latest" plutôt que des noms de modèles datés : Google les repointe
// automatiquement vers la version courante, ce qui évite de revivre cette
// panne à chaque dépréciation. gemini-2.0-flash est gardé en dernier repli
// au cas où son quota serait réactivé sur ce projet.
const CANDIDATE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"];

/**
 * Extraction et OCR d'image avec l'API Gemini (appel REST direct, sans le
 * SDK @google/genai) : détecte le texte et extrait les informations
 * d'annonces en JSON. Essaie chaque modèle de CANDIDATE_MODELS dans l'ordre ;
 * si un modèle échoue (404 ou autre), passe immédiatement au suivant sans
 * faire planter la requête.
 */
export async function extractJobAnnouncementWithGemini(buffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") {
    return {
      errorKeyMissing: true,
      error: "Clé API Gemini introuvable. Veuillez configurer GEMINI_API_KEY dans Vercel/env.",
    };
  }

  const prompt = `Analyse cette affiche d'emploi, recrutement ou casting.
Extrais précisément les coordonnées et canaux pour postuler :
1. "email": l'adresse email de contact/recrutement (ou null si absente)
2. "phone": le numéro de téléphone ou WhatsApp pour postuler ou envoyer sa candidature (ex: "+221 77 717 73 73" ou "77 717 73 73", ou null)
3. "apply_url": lien de formulaire (Google Forms, Typeform, etc.) ou URL du site web pour postuler (ou null)
4. "job_title": titre du poste, du casting ou de l'opportunité
5. "company": nom de l'entreprise, agence ou organisateur
6. "contract_type": type de contrat ou mission (CDI, CDD, Stage, Freelance, Casting, etc.)
7. "instructions": consigne spécifique pour postuler (ex: "Envoyer vidéos par WhatsApp", "Envoyer CV par mail", "Remplir le formulaire")
8. "raw_text": tout le texte lisible sur l'affiche.

Réponds STRICTEMENT en JSON valide sous la forme :
{
  "email": "...",
  "phone": "...",
  "apply_url": "...",
  "job_title": "...",
  "company": "...",
  "contract_type": "...",
  "instructions": "...",
  "raw_text": "..."
}`;

  // buffer.toString("base64") ne contient normalement jamais de préfixe data
  // URI (ce n'est pas un data URI, juste du base64 brut) — retrait défensif
  // au cas où un appelant passerait un buffer dérivé d'un data URI complet.
  const cleanBase64 = buffer.toString("base64").replace(/^data:[^;]+;base64,/, "");

  let lastErrorDetail = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        }
      );

      if (!response.ok) {
        let errJson;
        try {
          errJson = await response.json();
        } catch {
          errJson = { raw: await response.text().catch(() => "Corps de réponse illisible.") };
        }
        console.error("[Gemini REST Error]", response.status, errJson);
        console.warn(`[Gemini Fallback] Model ${model} failed, trying next...`);
        lastErrorDetail = {
          model,
          status: response.status,
          message: errJson?.error?.message || JSON.stringify(errJson),
        };
        continue;
      }

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let cleanedJson = responseText.trim();
      if (cleanedJson.includes("```")) {
        cleanedJson = cleanedJson.replace(/```json/gi, "").replace(/```/g, "").trim();
      }

      let parsed = null;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch {
        const emailMatch = responseText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = responseText.match(/(?:\+?221|00221)?[\s.-]?(?:7[05678]|33)[\s.-]?[0-9]{2,3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/);
        const urlMatch = responseText.match(/https?:\/\/[^\s"'<>]+|forms\.gle\/[^\s"'<>]+/i);

        parsed = {
          email: emailMatch ? emailMatch[0].toLowerCase() : null,
          phone: phoneMatch ? phoneMatch[0] : null,
          apply_url: urlMatch ? urlMatch[0] : null,
          job_title: null,
          company: null,
          contract_type: null,
          instructions: null,
          raw_text: responseText,
        };
      }

      if (parsed) return parsed;
    } catch (err) {
      console.error(`[Gemini REST] Erreur réseau/fetch avec ${model}:`, err.message);
      console.warn(`[Gemini Fallback] Model ${model} failed, trying next...`);
      lastErrorDetail = { model, status: null, message: err.message };
    }
  }

  // Tous les modèles ont échoué : on renvoie le détail exact de la dernière
  // erreur Google (clé invalide, quota, modèle indisponible...) plutôt qu'un
  // message générique, pour permettre un diagnostic précis côté client.
  const lastErrorText = lastErrorDetail
    ? `${lastErrorDetail.message} (modèle : ${lastErrorDetail.model}${lastErrorDetail.status ? `, HTTP ${lastErrorDetail.status}` : ""})`
    : null;

  console.error("[Extract Email Error] Tous les modèles Gemini ont échoué. Dernier échec:", lastErrorText);
  return {
    error: lastErrorText ? `Erreur API Gemini : ${lastErrorText}` : "Impossible d'analyser l'image pour le moment. Réessayez dans quelques instants.",
  };
}

export async function extractFullJobOfferFromPosterWithGemini(buffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") {
    return {
      errorKeyMissing: true,
      error: "Clé API Gemini introuvable. Veuillez configurer GEMINI_API_KEY dans Vercel/env.",
    };
  }

  const prompt = `Tu es le moteur d'intelligence artificielle de la plateforme d'emploi 'Facilité' au Sénégal.
Ta mission est d'analyser cette affiche/image de recrutement pour en extraire TOUTES les informations clés nécessaires à sa publication directe sur le fil d'actualité.

Extrais méticuleusement :
1. Titre du poste (clair, sans abréviation obscure)
2. Nom de l'entreprise, agence ou organisation
3. Localisation (ex: Dakar, Thiès, Sénégal, etc.)
4. Type de contrat (ex: CDI, CDD, Stage, Casting / Tournage, Freelance, Intérim, Bourse d'études)
5. Numéro de téléphone ou WhatsApp pour postuler (très important : extraire avec l'indicatif ou au format standard ex: +221 77 717 73 73)
6. Adresse e-mail de contact (si mentionnée)
7. Lien externe / site officiel de postulation (si mentionné)
8. Date limite de candidature (au format AAAA-MM-JJ si mentionnée, sinon chaîne vide)
9. Niveau d'études requis (ex: BAC, Licence, Master, Doctorat, Aucun)
10. Description structurée, attractive et aérée avec des emojis adaptés (présentation du poste, missions, profil recherché, comment postuler).

Réponds STRICTEMENT en JSON valide sans aucun texte avant ou après sous le format :
{
  "title": "...",
  "company": "...",
  "location": "...",
  "contract_type": "...",
  "contact_phone": "...",
  "contact_email": "...",
  "external_link": "...",
  "deadline": "...",
  "min_education_level": "...",
  "salary_range": "...",
  "description": "..."
}`;

  const cleanBase64 = buffer.toString("base64").replace(/^data:[^;]+;base64,/, "");

  let lastErrorDetail = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        }
      );

      if (!response.ok) {
        let errJson;
        try {
          errJson = await response.json();
        } catch {
          errJson = { raw: await response.text().catch(() => "Corps de réponse illisible.") };
        }
        console.error("[Gemini Poster OCR Error]", response.status, errJson);
        lastErrorDetail = { model, status: response.status, message: errJson?.error?.message || JSON.stringify(errJson) };
        continue;
      }

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let cleanedJson = responseText.trim();
      if (cleanedJson.includes("```")) {
        cleanedJson = cleanedJson.replace(/```json/gi, "").replace(/```/g, "").trim();
      }

      try {
        const parsed = JSON.parse(cleanedJson);
        if (parsed && (parsed.title || parsed.company || parsed.description)) {
          return { success: true, ...parsed };
        }
      } catch (jsonErr) {
        console.warn("[Gemini Poster JSON Parse Fallback]", jsonErr);
      }
    } catch (err) {
      console.error(`[Gemini Poster REST] Erreur ${model}:`, err.message);
      lastErrorDetail = { model, status: null, message: err.message };
    }
  }

  return {
    error: lastErrorDetail?.message || "Impossible d'analyser l'affiche pour le moment. Réessayez avec une image plus nette.",
  };
}

export async function extractCvWithGeminiVision(buffer, mimeType = "image/jpeg", systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") {
    return { error: "Clé API Gemini introuvable." };
  }

  const cleanBase64 = buffer.toString("base64").replace(/^data:[^;]+;base64,/, "");

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: systemPrompt },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) {
        continue;
      }

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      let cleanedJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedJson = jsonMatch[0];
      }
      
      return JSON.parse(cleanedJson);
    } catch (err) {
      console.warn(`[Gemini CV Vision Fallback] Model ${model} failed`, err.message);
    }
  }

  return { error: "Impossible d'analyser l'image du CV pour le moment." };
}

export async function extractTextWithGemini(buffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return "";
  const cleanBase64 = buffer.toString("base64").replace(/^data:[^;]+;base64,/, "");
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "Extrais l'intégralité du texte présent sur cette image. Conserve l'ordre logique de lecture. Ne renvoie que le texte brut, sans commentaires ni balises markdown." },
                { inline_data: { mime_type: mimeType, data: cleanBase64 } },
              ],
            }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );
      if (response.ok) {
        const resJson = await response.json();
        return resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch (err) {}
  }
  return "";
}

async function runImageOcr(buffer) {
  try {
    const text = await extractTextWithGemini(buffer, "image/jpeg");
    return text || "";
  } catch (err) {
    console.error("Gemini Flash OCR Error:", err.message);
    return "";
  }
}

async function ocrPdfPages(pdf, numPages) {
  let combinedText = "";
  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    const imageBuffer = await renderPageAsImage(pdf, pageNumber, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    });
    const pageText = await runImageOcr(Buffer.from(imageBuffer));
    combinedText += `${pageText}\n`;
  }
  return combinedText;
}

const SECTION_HEADERS = {
  experiences: [
    "experience professionnelle", "experiences professionnelles", "experience",
    "parcours professionnel", "work experience", "professional experience",
  ],
  educations: [
    "formation", "formations", "education", "diplome", "diplomes",
    "parcours academique", "academic background",
  ],
  skills: [
    "competences", "competences cles", "skills", "compétences", "compétences clés",
    "informatique", "competences informatiques", "compétences informatiques",
  ],
  languages: [
    "langues", "languages",
  ],
  summary: [
    "profil", "resume", "a propos", "à propos", "summary", "objectif", "presentation",
  ],
  interests: [
    "centres d'interet", "centre d'interet", "centres d'intérêt", "centre d'intérêt",
    "loisirs", "hobbies", "interests",
  ],
};

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function isHeaderLine(line, keywords) {
  const norm = normalize(line).replace(/[^a-z ]/g, "").trim();
  if (!norm || norm.length > 40) return false;
  return keywords.some((kw) => norm === normalize(kw) || norm.startsWith(normalize(kw)));
}

function detectAnySectionHeader(line) {
  for (const [section, keywords] of Object.entries(SECTION_HEADERS)) {
    if (isHeaderLine(line, keywords)) return section;
  }
  return null;
}

/**
 * Extrait le texte brut d'un fichier (PDF, DOCX, image) selon son type MIME/extension.
 * Les images passent par l'OCR (Google Vision, repli automatique sur
 * tesseract.js), les PDF/DOCX par une extraction textuelle native.
 */
export async function extractTextFromFile(buffer, filename, mimeType) {
  const ext = (filename || "").split(".").pop().toLowerCase();

  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    // Document scanné/photographié : pas de couche texte, on bascule en OCR page par page.
    if (!text || text.trim().length < MIN_PDF_TEXT_LENGTH) {
      const ocrText = await ocrPdfPages(pdf, totalPages || 1);
      return ocrText || text || "";
    }

    return text || "";
  }

  if (ext === "docx" || mimeType?.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext) || mimeType?.startsWith("image/")) {
    return runImageOcr(buffer);
  }

  // Texte brut / formats non gérés : tentative de lecture directe
  return buffer.toString("utf-8");
}

/**
 * Analyse le texte brut extrait d'un document et mappe intelligemment les informations
 * détectées vers les champs du profil. N'utilise JAMAIS le nom de fichier comme donnée.
 */
export function mapTextToProfileFields(rawText) {
  const text = (rawText || "").replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fields = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    city: "",
    country: "",
    summary: "",
    skills: [],
    languages: [],
    educations: [],
    experiences: [],
    interests: [],
  };

  // --- Email ---
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) fields.email = emailMatch[0];

  // --- Téléphone ---
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  if (phoneMatch) fields.phone = phoneMatch[0].trim();

  // --- Nom complet : ligne en Titre-Casse au tout début du document ---
  const nameLineIdx = lines.findIndex((line, idx) => {
    if (idx > 6) return false;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    const looksLikeName = words.every((w) => /^[A-ZÀ-Ý][a-zà-ÿ'-]+$/.test(w));
    const isSectionHeader = detectAnySectionHeader(line);
    return looksLikeName && !isSectionHeader && !/\d/.test(line);
  });

  if (nameLineIdx !== -1) {
    const words = lines[nameLineIdx].split(/\s+/);
    fields.firstName = words[0];
    fields.lastName = words.slice(1).join(" ");
  }

  // --- Titre du profil : ligne suivant le nom, courte, sans email/téléphone ---
  if (nameLineIdx !== -1) {
    for (let i = nameLineIdx + 1; i < Math.min(nameLineIdx + 4, lines.length); i++) {
      const candidate = lines[i];
      if (
        candidate.length < 70 &&
        !candidate.includes("@") &&
        !/\d{3,}/.test(candidate) &&
        !detectAnySectionHeader(candidate)
      ) {
        fields.title = candidate;
        break;
      }
    }
  }

  // --- Ville / Pays : ligne "Ville, Pays" ---
  const cityCountryMatch = text.match(/([A-ZÀ-Ý][a-zà-ÿ]+)\s*,\s*([A-ZÀ-Ý][a-zà-ÿ]+)/);
  if (cityCountryMatch) {
    fields.city = cityCountryMatch[1];
    fields.country = cityCountryMatch[2];
  }

  // --- Découpage en sections ---
  const sections = {};
  let currentSection = null;
  for (const line of lines) {
    const header = detectAnySectionHeader(line);
    if (header) {
      currentSection = header;
      sections[currentSection] = sections[currentSection] || [];
      continue;
    }
    if (currentSection) {
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(line);
    }
  }

  // --- Résumé / profil ---
  if (sections.summary && sections.summary.length) {
    fields.summary = sections.summary.slice(0, 5).join(" ");
  }

  // --- Compétences ---
  if (sections.skills && sections.skills.length) {
    fields.skills = sections.skills
      .join(",")
      .split(/[,•|•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40)
      .slice(0, 20);
  }

  // --- Langues ---
  if (sections.languages && sections.languages.length) {
    fields.languages = sections.languages
      .join(",")
      .split(/[,•|•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40)
      .slice(0, 10);
  }

  // --- Centres d'intérêt ---
  if (sections.interests && sections.interests.length) {
    fields.interests = sections.interests
      .join(",")
      .split(/[,•|•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 60)
      .slice(0, 10);
  }

  // --- Formations ---
  if (sections.educations && sections.educations.length) {
    let block = [];
    const flushBlock = () => {
      if (block.length) {
        const dateMatch = block.join(" ").match(/(\d{4})\s*-\s*(\d{4}|present|présent|actuel)/i);
        fields.educations.push({
          id: Date.now() + fields.educations.length,
          degree: block[0] || "",
          school: block[1] || "",
          startYear: dateMatch ? dateMatch[1] : "",
          endYear: dateMatch ? dateMatch[2] : "",
        });
        block = [];
      }
    };
    for (const line of sections.educations) {
      if (/^\d{4}/.test(line) || /(\d{4})\s*-\s*(\d{4}|present|présent|actuel)/i.test(line)) {
        block.push(line);
        flushBlock();
      } else {
        block.push(line);
      }
    }
    flushBlock();
  }

  // --- Expériences professionnelles ---
  if (sections.experiences && sections.experiences.length) {
    let block = [];
    let expId = 1;
    const flushExpBlock = () => {
      if (block.length) {
        const joined = block.join(" ");
        const dateMatch = joined.match(/(\d{4}-\d{2}|\d{4})\s*-\s*(\d{4}-\d{2}|\d{4}|present|présent|actuel)/i);
        fields.experiences.push({
          id: expId++,
          title: block[0] || "",
          employer: block[1] || "",
          city: "",
          startDate: dateMatch ? dateMatch[1] : "",
          endDate: dateMatch && !/present|présent|actuel/i.test(dateMatch[2]) ? dateMatch[2] : "",
          current: dateMatch ? /present|présent|actuel/i.test(dateMatch[2]) : false,
          description: block.slice(2).join(" "),
        });
        block = [];
      }
    };
    for (const line of sections.experiences) {
      const startsNewEntry = /(\d{4})\s*-\s*(\d{4}|present|présent|actuel)/i.test(line) && block.length > 1;
      if (startsNewEntry) flushExpBlock();
      block.push(line);
    }
    flushExpBlock();
  }

  return fields;
}
