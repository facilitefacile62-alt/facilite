import { getDocumentProxy, extractText } from "unpdf";
import mammoth from "mammoth";

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
  ],
  languages: [
    "langues", "languages",
  ],
  summary: [
    "profil", "resume", "a propos", "à propos", "summary", "objectif", "presentation",
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
 * Les images passent par l'OCR (tesseract.js), les PDF/DOCX par une extraction textuelle native.
 */
export async function extractTextFromFile(buffer, filename, mimeType) {
  const ext = (filename || "").split(".").pop().toLowerCase();

  if (ext === "pdf" || mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text || "";
  }

  if (ext === "docx" || mimeType?.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext) || mimeType?.startsWith("image/")) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("fra+eng");
    try {
      const { data } = await worker.recognize(buffer);
      return data.text || "";
    } finally {
      await worker.terminate();
    }
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
