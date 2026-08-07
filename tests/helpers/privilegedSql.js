const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("pg");
const { loadTestEnv, PROD_REF } = require("./testEnv");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Chaîne de connexion Postgres directe au projet de TEST — jamais la
 * production. Lue depuis TEST_SUPABASE_DB_URL (variable d'environnement,
 * prioritaire, utile en CI) ou .env.test.local. Refuse bruyamment si
 * absente ou si elle pointe vers la production, avant même la première
 * requête.
 */
function getTestDbUrl() {
  loadTestEnv(); // déclenche le garde-fou anti-prod même si TEST_SUPABASE_DB_URL est fournie séparément
  const envPath = path.resolve(__dirname, "../../.env.test.local");
  let fromFile;
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^TEST_SUPABASE_DB_URL=(.*)$/m);
    if (match) fromFile = match[1].trim();
  }
  const dbUrl = process.env.TEST_SUPABASE_DB_URL || fromFile;
  if (!dbUrl) {
    throw new Error("REFUS : TEST_SUPABASE_DB_URL absente (ni variable d'environnement, ni .env.test.local).");
  }
  if (dbUrl.includes(PROD_REF)) {
    throw new Error(`REFUS : TEST_SUPABASE_DB_URL pointe vers la production (${PROD_REF}). Arrêt immédiat.`);
  }
  return dbUrl;
}

function runSupabaseCliQuery(sql, connFlag, timeoutMs) {
  const tmpFile = path.join(os.tmpdir(), `privileged-sql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);

  return new Promise((resolve, reject) => {
    exec(
      `npx supabase db query ${connFlag} --yes -f "${tmpFile}"`,
      { cwd: REPO_ROOT, encoding: "utf-8", timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // best-effort — un fichier temporaire orphelin n'est jamais bloquant
        }

        if (error) {
          if (error.killed || error.signal) {
            reject(
              new Error(
                `runPrivilegedSql/runIntrospectionSql: le CLI Supabase ne répond plus après ${timeoutMs}ms (tué avant qu'il ne gèle tout le process — voir docs/diagnostic-tests-bloquants.md). SQL tronqué : ${sql.slice(0, 200)}`
              )
            );
            return;
          }
          reject(new Error(`échec CLI Supabase — ${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.slice(stdout.indexOf("{"))).rows || []);
        } catch {
          reject(new Error(`réponse CLI non-JSON — ${stdout.slice(0, 300)}`));
        }
      }
    );
  });
}

/**
 * Exécute du SQL contre le projet Supabase de TEST — fixtures, nettoyage,
 * et introspection utilisés par les tests e2e "fonctionnels" (parcours
 * candidat/recruteur/admin, RBAC, RLS applicative...). Jamais la
 * production : voir getTestDbUrl().
 *
 * Passe par `pg` directement (protocole simple query — aucune valeur
 * paramétrée passée à client.query()), pas par la CLI Supabase comme
 * runIntrospectionSql : `supabase db query --db-url` échoue sur tout
 * fichier à plusieurs commandes ("cannot insert multiple commands into a
 * prepared statement", protocole étendu) — ~18 fichiers de fixtures
 * envoient plusieurs INSERT/UPDATE/DELETE en un seul appel. `--linked`
 * n'a pas ce problème (d'où runIntrospectionSql inchangé), mais on ne
 * peut pas s'en servir ici : ça basculerait le contexte "lié" de la CLI,
 * qui doit rester pointé sur la production pour le reste du dépôt.
 *
 * Historique : la première version de ce helper (dupliquée dans ~18
 * fichiers) utilisait execSync, un appel SYNCHRONE ET BLOQUANT — si le CLI
 * Supabase se figeait côté réseau, il gelait tout le process Node, boucle
 * d'événements comprise. Cette version garde la même protection : un
 * timeout dur qui ferme la connexion et rejette proprement plutôt que de
 * geler. Voir docs/diagnostic-tests-bloquants.md.
 *
 * @param {string} sql
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>} les lignes de la dernière commande
 */
async function runPrivilegedSql(sql, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const dbUrl = getTestDbUrl();
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    client.end().catch(() => {});
  }, timeoutMs);

  try {
    await client.connect();
    const result = await client.query(sql);
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    return last?.rows || [];
  } catch (err) {
    if (timedOut) {
      throw new Error(
        `runPrivilegedSql: pas de réponse après ${timeoutMs}ms (connexion fermée avant qu'elle ne gèle tout le process). SQL tronqué : ${sql.slice(0, 200)}`
      );
    }
    throw new Error(`runPrivilegedSql: ${err.message}`);
  } finally {
    clearTimeout(timer);
    await client.end().catch(() => {});
  }
}

/**
 * Exécute du SQL d'introspection contre la PRODUCTION, en lecture (quasi-)
 * exclusive — utilisé uniquement par tests/security/invariants.spec.js
 * pour vérifier la posture de sécurité RÉELLE (GRANTs, RLS, search_path,
 * DEFAULT PRIVILEGES...), pas une copie. Volontairement distinct de
 * runPrivilegedSql (projet de test) : les invariants perdraient tout leur
 * sens s'ils vérifiaient autre chose que la production elle-même — c'est
 * le garde-fou CI qui bloque un déploiement défaillant, pas un test
 * fonctionnel comme les autres. Bascule --db-url $SUPABASE_DB_URL en CI
 * (secret GitHub Actions) ou --linked en local, comme avant ce chantier.
 */
function runIntrospectionSql(sql, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const connFlag = process.env.SUPABASE_DB_URL ? `--db-url "${process.env.SUPABASE_DB_URL}"` : "--linked";
  return runSupabaseCliQuery(sql, connFlag, timeoutMs);
}

module.exports = { runPrivilegedSql, runIntrospectionSql };
