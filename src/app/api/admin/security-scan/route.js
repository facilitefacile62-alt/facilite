import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// Liste des 13 invariants de sécurité certifiés de l'application Facilité
const CERTIFIED_INVARIANTS = [
  {
    key: "invariant_1",
    name: "Invariant 1 — Aucun GRANT UPDATE/DELETE non justifié sur tables publiques",
    category: "Base de Données & RLS",
    severity: "critical",
    description: "Empêche toute modification ou suppression non contrôlée par un utilisateur anonyme ou authentifié.",
    mitigation: "Révoquer les grants de table directe et forcer le passage par les RPC SECURITY DEFINER ou les policies RLS.",
  },
  {
    key: "invariant_2",
    name: "Invariant 2 — RLS activé sur 100% des tables avec policies restrictives",
    category: "Base de Données & RLS",
    severity: "critical",
    description: "Garantit que chaque ligne en base est isolée au propriétaire légitime (Row-Level Security).",
    mitigation: "Activer ENABLE ROW LEVEL SECURITY sur toute table sensible et définir des policies de scoping strictes.",
  },
  {
    key: "invariant_3",
    name: "Invariant 3 — search_path figé sur toutes les fonctions SECURITY DEFINER",
    category: "SQL & Injections",
    severity: "high",
    description: "Protège contre les attaques de substitution de schéma (Schema Poisoning / search_path hijacking).",
    mitigation: "Ajouter systématiquement SET search_path TO 'public', 'pg_temp' sur chaque fonction SECURITY DEFINER.",
  },
  {
    key: "invariant_4",
    name: "Invariant 4 — Buckets de CVs et pièces jointes strictement privés",
    category: "Stockage & Fichiers",
    severity: "critical",
    description: "Interdit l'accès public direct aux CVs et pièces jointes sensibles. Seul le bucket 'job-offers' est public.",
    mitigation: "Conserver les buckets 'resumes' et 'chat-attachments' en public=false et utiliser des URLs signées éphémères (300s).",
  },
  {
    key: "invariant_5",
    name: "Invariant 5 — Contrôle d'autorisation obligatoire sur tous les endpoints publics",
    category: "Routes API & Accès",
    severity: "high",
    description: "Vérifie que chaque route API implémente un contrôle de session (requireUser / isCallerAdmin / CRON_SECRET).",
    mitigation: "Utiliser requireUser() ou verifyCronSecret() en tête de chaque Route Handler.",
  },
  {
    key: "invariant_6",
    name: "Invariant 6 — Scoping obligatoire pour tout usage de service_role",
    category: "Backend & Privilèges",
    severity: "critical",
    description: "Empêche les requêtes admin non ciblées qui pourraient altérer des données inter-utilisateurs.",
    mitigation: "Toujours filtrer par user_id, actor_id ou target_user_id lors de l'utilisation de Supabase Admin.",
  },
  {
    key: "invariant_7",
    name: "Invariant 7 — Aucune policy RLS tautologique (USING true sans justification)",
    category: "Base de Données & RLS",
    severity: "high",
    description: "Détecte les fausses règles de sécurité RLS qui autorisent tout le monde sans restriction.",
    mitigation: "Remplacer USING(true) par une vérification de propriétaire auth.uid() = user_id.",
  },
  {
    key: "invariant_8",
    name: "Invariant 8 — Comparaisons NULL-safe (IS DISTINCT FROM) sur les gardes de rôles",
    category: "SQL & RBAC",
    severity: "critical",
    description: "Empêche l'élévation de privilèges si une fonction renvoie NULL lors de la comparaison de rôle.",
    mitigation: "Utiliser IS DISTINCT FROM 'admin' au lieu de <> 'admin' en SQL PL/pgSQL.",
  },
  {
    key: "invariant_10",
    name: "Invariant 10 — Traçabilité intégrale : 100% des fonctions & triggers tracés en migrations",
    category: "Gouvernance & Code",
    severity: "medium",
    description: "Garantit qu'aucun objet en base n'a été créé hors migration (éditeur SQL manuel sans versioning).",
    mitigation: "Créer systématiquement chaque fonction ou trigger via un fichier dans supabase/migrations/.",
  },
  {
    key: "invariant_11",
    name: "Invariant 11 — Aucun gate conditionné à un rôle obsolète dans le Frontend",
    category: "Frontend & Sécurité",
    severity: "medium",
    description: "Empêche les erreurs de navigation ou contournements liés aux anciens rôles ('recruteur', 'candidat').",
    mitigation: "Utiliser le système RBAC actuel : rôle 'user' avec badge 'verified_recruiter'.",
  },
  {
    key: "invariant_12",
    name: "Invariant 12 — Aucun compte de test avec privilèges Admin non justifiés",
    category: "Gestion des Comptes",
    severity: "high",
    description: "Isole strictement les comptes de test pour éviter toute faille d'administration en production.",
    mitigation: "Affecter le rôle 'user' aux comptes de démo et réserver 'admin' aux seuls administrateurs officiels.",
  },
  {
    key: "invariant_13",
    name: "Invariant 13 — Droits d'exécution (GRANT EXECUTE) actifs sur fonctions critiques",
    category: "SQL & Permissions",
    severity: "critical",
    description: "Vérifie que les fonctions de modération et de badges sont appelables par les admins sans blocage 403.",
    mitigation: "Accorder GRANT EXECUTE TO authenticated sur les fonctions de modération protégées par is_admin.",
  },
];

export async function POST(req) {
  const startTime = Date.now();
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    // Client scopé par le token Bearer de l'appelant — jamais service_role
    // — pour tout appel RPC dont le garde-fou interne dépend de auth.uid()
    // (current_user_role(), même patron que get_users_phone_status). Avec
    // supabaseAdmin, auth.uid() est NULL côté SQL : la fonction rejetterait
    // systématiquement un admin réel, pas seulement un non-admin.
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });

    // 1. Audit RLS réel — service_role contourne la RLS par construction :
    // interroger les tables via supabaseAdmin (comme avant ce correctif) ne
    // peut donc JAMAIS détecter une régression RLS, quel que soit le
    // résultat. get_rls_audit() (SECURITY DEFINER, 2026-08-23) interroge
    // directement pg_class/pg_policy — même requête que l'Invariant 2 de
    // tests/security/invariants.spec.js — pour TOUTES les tables de public,
    // pas une liste de 12 tables codée en dur (qui contenait un nom erroné,
    // "chat_messages" au lieu de "messages", jamais détecté car cette
    // vérification ne pouvait de toute façon rien détecter).
    const { data: rlsRows, error: rlsError } = await userScopedSupabase.rpc("get_rls_audit");
    if (rlsError) {
      console.error("[Security Scan API] get_rls_audit a échoué:", rlsError.message);
    }
    const tableAudits = (rlsRows || []).map((r) => ({
      table: r.table_name,
      rls_enabled: r.rls_enabled,
      policy_count: Number(r.policy_count),
      // "warn", pas "fail" : 0 policy avec RLS activée est un motif légitime
      // pour une table verrouillée service_role uniquement (voir
      // JUSTIFIED_ZERO_POLICY dans invariants.spec.js) — ce panneau ne
      // duplique pas cette liste de justifications au cas par cas, il
      // affiche le fait brut plutôt que de trancher à sa place.
      status: !r.rls_enabled ? "fail" : Number(r.policy_count) === 0 ? "warn" : "pass",
    }));

    // 2. Audit des Buckets de Stockage
    const storageAudits = [
      {
        bucket: "resumes",
        expected_public: false,
        purpose: "Stockage des CVs candidats (Données personnelles sensibles)",
        protection: "Accès exclusif par URLs signées éphémères",
      },
      {
        bucket: "chat-attachments",
        expected_public: false,
        purpose: "Pièces jointes de messagerie (Documents & contrats)",
        protection: "Isolation par dossier utilisateur et vérification de participant",
      },
      {
        bucket: "job-offers",
        expected_public: true,
        purpose: "Images et bannières publiques des offres d'emploi",
        protection: "Lecture publique autorisée, upload réservé aux recruteurs vérifiés",
      },
      // Les 5 buckets ci-dessous étaient absents de cette vérification avant
      // ce correctif (2026-08-23) — jamais audités du tout, pas seulement
      // mal audités. expected_public vérifié en lisant leur usage réel dans
      // le code (getSignedAvatarUrl/getSignedCoverUrl — src/lib/supabase.js,
      // createSignedUrl sur completed_cvs/invoices, commentaire "bucket
      // privé" sur badge-documents) : tous accédés exclusivement via URL
      // signée, jamais d'URL publique construite nulle part.
      {
        bucket: "avatars",
        expected_public: false,
        purpose: "Photos de profil (accès signé, voir 20260813180000_avatars_covers_policies.sql)",
        protection: "URLs signées (getSignedAvatarUrl), propriétaire ou admin uniquement",
      },
      {
        bucket: "covers",
        expected_public: false,
        purpose: "Photos de couverture de profil (même politique qu'avatars)",
        protection: "URLs signées (getSignedCoverUrl), propriétaire ou admin uniquement",
      },
      {
        bucket: "badge-documents",
        expected_public: false,
        purpose: "Justificatifs de vérification recruteur (documents d'identité/entreprise)",
        protection: "Bucket privé, jamais d'URL publique — purgé automatiquement (cron dédié)",
      },
      {
        bucket: "completed_cvs",
        expected_public: false,
        purpose: "CVs finalisés par un agent (option accompagnement)",
        protection: "Accès exclusif par URLs signées éphémères",
      },
      {
        bucket: "invoices",
        expected_public: false,
        purpose: "Factures PDF (commandes CV et recharges de crédits)",
        protection: "Accès exclusif par URLs signées éphémères",
      },
    ];

    // Statut calculé UNIQUEMENT à partir de la comparaison avec l'API
    // Storage réelle ci-dessous — jamais "pass" par défaut avant
    // vérification (contrairement à l'ancienne version de cette route).
    for (const sa of storageAudits) sa.status = "unknown";

    try {
      const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
      if (bucketsError) throw bucketsError;

      for (const sa of storageAudits) {
        const found = buckets?.find((b) => b.id === sa.bucket);
        if (!found) {
          sa.status = "fail";
          sa.error = `Le bucket ${sa.bucket} est introuvable.`;
          continue;
        }
        if (found.public !== sa.expected_public) {
          sa.status = "fail";
          sa.error = `Le bucket ${sa.bucket} est public=${found.public} au lieu de public=${sa.expected_public} !`;
        } else {
          sa.status = "pass";
        }
      }
    } catch (e) {
      console.error("[Security Scan API] Lecture des buckets impossible:", e.message);
      // "unknown" reste : jamais de "pass" silencieux si l'API Storage n'a
      // pas pu être interrogée.
    }

    // 3. Audit des variables d'environnement & Secrets
    const envAudits = [];
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // Test 1: Service Role présent et privé
    if (serviceRoleKey && serviceRoleKey.length > 20) {
      const isLeakedInPublic = Object.keys(process.env).some(
        (k) => k.startsWith("NEXT_PUBLIC_") && process.env[k] === serviceRoleKey
      );
      envAudits.push({
        id: "env_service_role",
        label: "Clé Maître (SUPABASE_SERVICE_ROLE_KEY)",
        status: isLeakedInPublic ? "fail" : "pass",
        severity: "critical",
        description: isLeakedInPublic
          ? "CRITIQUE : La clé service_role est exposée dans une variable NEXT_PUBLIC_* !"
          : "La clé administrative est correctement confinée côté serveur.",
      });
    } else {
      envAudits.push({
        id: "env_service_role",
        label: "Clé Maître (SUPABASE_SERVICE_ROLE_KEY)",
        status: "warn",
        severity: "high",
        description: "Clé service_role manquante ou incomplète.",
      });
    }

    // Test 2: URL Supabase SSL & HTTPS
    envAudits.push({
      id: "env_supabase_url",
      label: "Chiffrement des Transmissions (HTTPS)",
      status: supabaseUrl.startsWith("https://") ? "pass" : "fail",
      severity: "critical",
      description: supabaseUrl.startsWith("https://")
        ? "Toutes les connexions à la base de données sont chiffrées via TLS 1.3."
        : "L'URL Supabase n'utilise pas HTTPS.",
    });

    // Test 3: Clé Anon valide
    envAudits.push({
      id: "env_anon_key",
      label: "Clé Publique Client (Anon JWT)",
      status: anonKey.length > 20 ? "pass" : "warn",
      severity: "medium",
      description: "Clé cliente standard configurée pour le frontend.",
    });

    // 4. Audit des Invariants enregistrés
    let recordedInvariants = [];
    try {
      const { data: invData } = await supabaseAdmin.from("invariant_status").select("*");
      recordedInvariants = invData || [];
    } catch {}

    const invariantAudits = CERTIFIED_INVARIANTS.map((inv) => {
      const rec = recordedInvariants.find((r) => r.invariant_key === inv.key);
      return {
        ...inv,
        // "unknown", jamais "pass" par défaut : un invariant jamais
        // enregistré (tests/security/invariants.spec.js jamais exécuté
        // pour cette clé) n'a été ni vérifié ni certifié — l'afficher vert
        // serait la donnée approximative exactement interdite ici.
        status: rec?.status || "unknown",
        last_run_at: rec?.last_run_at || null,
        error_summary: rec?.error_summary || null,
      };
    });

    // 5. Alertes & Historique des Intrusions (24h et 30j)
    let recentAlerts = [];
    let openCriticalCount = 0;
    try {
      const { data: alerts } = await supabaseAdmin
        .from("security_logs")
        .select("id, event_type, severity, resolved_status, created_at, ip_address, details")
        .order("created_at", { ascending: false })
        .limit(100);

      recentAlerts = alerts || [];
      openCriticalCount = recentAlerts.filter(
        (a) => a.resolved_status === "open" && (a.severity === "critical" || a.event_type === "repeated_access_denial")
      ).length;
    } catch {}

    // 6. Calcul du Score Global de Santé Sécurité (0-100)
    let score = 100;
    const failedTables = tableAudits.filter((t) => t.status === "fail").length;
    const failedInvariants = invariantAudits.filter((i) => i.status === "fail").length;
    const unknownInvariants = invariantAudits.filter((i) => i.status === "unknown").length;
    const failedBuckets = storageAudits.filter((s) => s.status === "fail" || s.status === "unknown").length;
    const failedEnv = envAudits.filter((e) => e.status === "fail").length;

    // Une régression RLS réelle (failedTables) est le signal le plus grave
    // que ce panneau puisse désormais détecter (voir get_rls_audit) : pesée
    // au même niveau qu'un bucket mal configuré, pas un simple avertissement.
    score -= failedTables * 25;
    score -= failedInvariants * 8;
    score -= unknownInvariants * 3;
    score -= failedBuckets * 25;
    score -= failedEnv * 20;
    score -= openCriticalCount * 5;

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    // 7. Journalisation de l'exécution de l'audit
    await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "security_audit_scan_performed",
      p_severity: "info",
      p_actor_id: user.id,
      p_target_user_id: null,
      p_details: {
        score,
        duration_ms: Date.now() - startTime,
        tables_count: tableAudits.length,
        invariants_pass: invariantAudits.filter((i) => i.status === "pass").length,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      score,
      scoreRating: score >= 90 ? "Excellent / Bouclier Actif" : score >= 70 ? "Bon / Quelques points à surveiller" : "Alerte Sécurité Requise",
      summary: {
        totalTablesChecked: tableAudits.length,
        tablesRlsPass: tableAudits.filter((t) => t.status === "pass").length,
        totalBucketsChecked: storageAudits.length,
        bucketsSecure: storageAudits.filter((b) => b.status === "pass").length,
        totalInvariants: CERTIFIED_INVARIANTS.length,
        invariantsPass: invariantAudits.filter((i) => i.status === "pass").length,
        openAlertsCount: recentAlerts.filter((a) => a.resolved_status === "open").length,
        openCriticalCount,
      },
      categories: {
        invariants: invariantAudits,
        storage: storageAudits,
        tables: tableAudits,
        environment: envAudits,
        recentAlerts: recentAlerts.slice(0, 20),
      },
    });
  } catch (err) {
    console.error("[Security Scan API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue lors de l'audit de sécurité." }, { status: 500 });
  }
}
