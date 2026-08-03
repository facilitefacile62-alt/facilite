const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Exécute du SQL via une connexion CLI privilégiée (`supabase db query`),
 * hors authenticated/anon — seule façon honnête de tester ce que ni RLS ni
 * un client anon ne permettent (introspection pg_catalog, fixtures de test,
 * nettoyage).
 *
 * Historique : la première version de ce helper (dupliquée dans ~18
 * fichiers) utilisait execSync, un appel SYNCHRONE ET BLOQUANT — si le CLI
 * Supabase se figeait côté réseau (déjà observé : "Initialising login
 * role..." qui ne revient jamais), il gelait tout le process Node,
 * boucle d'événements comprise. Le timeout de Playwright ne pouvait pas
 * intervenir : son propre mécanisme dépend de cette même boucle
 * d'événements, qui était gelée. Résultat vécu : un run complet bloqué
 * plus de 20 minutes sans un seul caractère de sortie, aucune erreur,
 * aucun moyen de savoir si c'était lent ou mort sans tuer le process à la
 * main. Voir docs/diagnostic-tests-bloquants.md pour le détail complet.
 *
 * Cette version utilise exec() (asynchrone) avec un timeout dur : au-delà
 * de `timeoutMs`, le process CLI est tué (SIGTERM) et la promesse est
 * rejetée avec un message explicite — le run échoue proprement au lieu de
 * geler.
 *
 * @param {string} sql
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>} les lignes renvoyées
 */
function runPrivilegedSql(sql, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const tmpFile = path.join(os.tmpdir(), `privileged-sql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);

  return new Promise((resolve, reject) => {
    exec(
      `npx supabase db query --linked --yes -f "${tmpFile}"`,
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
                `runPrivilegedSql: le CLI Supabase ne répond plus après ${timeoutMs}ms (tué avant qu'il ne gèle tout le process — voir docs/diagnostic-tests-bloquants.md). SQL tronqué : ${sql.slice(0, 200)}`
              )
            );
            return;
          }
          reject(new Error(`runPrivilegedSql: échec CLI Supabase — ${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.slice(stdout.indexOf("{"))).rows || []);
        } catch (parseErr) {
          reject(new Error(`runPrivilegedSql: réponse CLI non-JSON — ${stdout.slice(0, 300)}`));
        }
      }
    );
  });
}

/**
 * Même mécanique que runPrivilegedSql, mais bascule sur --db-url quand
 * SUPABASE_DB_URL est présent (CI, voir .github/workflows/ci.yml) plutôt
 * que --linked (état local uniquement).
 */
function runIntrospectionSql(sql, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const tmpFile = path.join(os.tmpdir(), `introspection-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  const connFlag = process.env.SUPABASE_DB_URL ? `--db-url "${process.env.SUPABASE_DB_URL}"` : "--linked";

  return new Promise((resolve, reject) => {
    exec(
      `npx supabase db query ${connFlag} --yes -f "${tmpFile}"`,
      { cwd: REPO_ROOT, encoding: "utf-8", timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // best-effort
        }

        if (error) {
          if (error.killed || error.signal) {
            reject(
              new Error(
                `runIntrospectionSql: le CLI Supabase ne répond plus après ${timeoutMs}ms — voir docs/diagnostic-tests-bloquants.md. SQL tronqué : ${sql.slice(0, 200)}`
              )
            );
            return;
          }
          reject(new Error(`runIntrospectionSql: échec CLI Supabase — ${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.slice(stdout.indexOf("{"))).rows || []);
        } catch (parseErr) {
          reject(new Error(`runIntrospectionSql: réponse CLI non-JSON — ${stdout.slice(0, 300)}`));
        }
      }
    );
  });
}

module.exports = { runPrivilegedSql, runIntrospectionSql };
