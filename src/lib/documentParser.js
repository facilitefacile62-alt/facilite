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

// Modèles essayés dans l'ordre : gemini-1.5-flash en premier (rapide, léger,
// disponible sur v1beta/v1 pour tous les projets), les suivants en repli
// automatique si un modèle renvoie 404/NOT_FOUND (dépréciation, modèle non
// activé sur le projet...) ou échoue pour toute autre raison — l'API Gemini
// change régulièrement la disponibilité de ses modèles par projet/région, un
// seul nom de modèle codé en dur casse donc la fonctionnalité entière dès
// qu'il est retiré (c'est exactement ce qui est arrivé avec gemini-2.5-flash).
const CANDIDATE_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.5-flash"];

function extractGeminiErrorMessage(err) {
  return String(err?.message || err || "");
}

/**
 * Extraction et OCR d'image avec l'API Gemini via REST : détecte le
 * texte et extrait les informations d'annonces en JSON. 
 */
export async function extractJobAnnouncementWithGemini(buffer, mimeType = "image/jpeg") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") {
    return {
      errorKeyMissing: true,
      error: "Clé API Gemini introuvable. Veuillez configurer GEMINI_API_KEY dans Vercel/env.",
    };
  }

  const prompt = `Analyse cette affiche d'emploi/recrutement. Extrais l'adresse e-mail du recruteur, le titre du poste, le nom de l'entreprise et le type de contrat. Réponds STRICTEMENT en JSON sous la forme : { "email": "...", "job_title": "...", "company": "...", "contract_type": "...", "raw_text": "..." }.`;
  const base64Data = buffer.toString("base64");

  const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType || "image/jpeg",
                      data: base64Data,
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
        const errText = await response.text();
        console.warn(`[Gemini REST] Échec avec ${model} (${response.status}):`, errText.slice(0, 150));
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
        parsed = {
          email: emailMatch ? emailMatch[0].toLowerCase() : null,
          job_title: null,
          company: null,
          contract_type: null,
          raw_text: responseText,
        };
      }

      if (parsed) return parsed;
    } catch (err) {
      console.warn(`[Gemini REST] Erreur réseau/fetch avec ${model}:`, err.message);
    }
  }

  return {
    error: "Erreur lors de l'analyse avec Gemini. Veuillez vérifier votre photo ou réessayer.",
  };
}

async function runImageOcr(buffer) {
  try {
    const res = await extractJobAnnouncementWithGemini(buffer, "image/jpeg");
    return res?.raw_text || res?.email || "";
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
