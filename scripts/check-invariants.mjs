import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../src");

let errorCount = 0;

function logError(file, message) {
  console.error(`❌ [VIOLATION D'INVARIANT] ${path.relative(path.join(__dirname, ".."), file)}:`);
  console.error(`    -> ${message}\n`);
  errorCount++;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relPath = path.relative(path.join(__dirname, ".."), filePath).replace(/\\/g, "/");

  // 1. Vérification des requêtes sur les colonnes supprimées de profils (role, headline, user_type)
  // Recherche spécifique de requêtes rattachées à .from("profiles").select(...)
  const profilesQueryRegex = /from\(['"]profiles['"]\)(?:[\s\S]{0,100}?)\.\s*select\(\s*['"]([^'"]+)['"]/g;
  let profileMatch;
  while ((profileMatch = profilesQueryRegex.exec(content)) !== null) {
    const selectedCols = profileMatch[1];
    const obsoleteProfileCols = ["role", "headline", "user_type"];
    obsoleteProfileCols.forEach((col) => {
      const colRegex = new RegExp(`\\b${col}\\b`);
      if (colRegex.test(selectedCols)) {
        logError(filePath, `Requête Supabase sur 'profiles' sollicitant la colonne obsolète '${col}': select('${selectedCols}')`);
      }
    });
  }

  // 2. Vérification des conditions RBAC obsolètes (vérifier role === 'recruteur' au lieu du badge)
  // Exclure register/page.js qui gère le formulaire initial d'inscription et les routes LLM/AI où role = role du message (user/assistant)
  if (!relPath.includes("register/page.js") && !relPath.includes("api/ai") && !relPath.includes("AIAssistant")) {
    const obsoleteRolesRegex = /(?:role|userRole|effectiveRole)\s*(?:===|==|!==|!=)\s*["'](recruteur|candidat)["']/g;
    let match;
    while ((match = obsoleteRolesRegex.exec(content)) !== null) {
      // Exclure la détection dans les commentaires
      const line = content.substring(0, match.index).split("\n").pop();
      if (!line.trim().startsWith("//") && !line.trim().startsWith("/*")) {
        // Exception permise pour la calculatrice de badge dans admin/messages/page.js
        if (!relPath.includes("admin/messages/page.js") || match[0].includes("===")) {
          logError(
            filePath,
            `Condition illégale '${match[0]}'. Les rôles 'recruteur' et 'candidat' ont été fusionnés. Utilisez rpc('has_badge', { badge_name: 'verified_recruiter' }).`
          );
        }
      }
    }
  }

  // 3. Vérification architecturale : Header.jsx DOIT obligatoirement inclure RoleNavLink pour l'intégrité de la navbar
  if (relPath.endsWith("components/Header.jsx")) {
    if (!content.includes("RoleNavLink")) {
      logError(
        filePath,
        `Le composant principal Header.jsx n'intègre pas <RoleNavLink /> ! Risque de régression pour les liens Admin et Recruteur.`
      );
    }
    if (!content.includes("notificationsModalOpen") && !content.includes("Notifications")) {
      logError(
        filePath,
        `Le composant principal Header.jsx n'intègre plus le système de Notifications.`
      );
    }
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (fullPath.endsWith(".js") || fullPath.endsWith(".jsx") || fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
      checkFile(fullPath);
    }
  }
}

console.log("🛡️  [Vérification des Invariants du Modèle & RBAC] Analyse en cours...");
scanDir(rootDir);

if (errorCount > 0) {
  console.error(`🛑 Échec : ${errorCount} violation(s) d'invariants détectée(s). Le build a été stoppé.`);
  process.exit(1);
} else {
  console.log("✅ Tous les invariants architecturaux et RBAC sont validés et conformes !\n");
  process.exit(0);
}
