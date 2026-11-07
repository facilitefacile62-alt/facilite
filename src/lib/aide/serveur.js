// Colle serveur de l'aide : branche l'orchestrateur sur Supabase (client service_role, côté serveur seulement).
// Aucune clé ici : les fournisseurs lisent leurs variables d'environnement au moment de l'appel.
import { isCallerAdmin } from "../rbac.js";
import { cleMemoire } from "./memoire.js";
import { lireTarifs } from "./tarifs.js";
import { choisirFournisseur } from "./fournisseurs/index.js";
import { lireReglages } from "./reglages.js";

export const ID_INTERRUPTEUR = "feat_aide_unifiee";
export const BUCKET_VOCAUX = "aide-vocaux";

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * AIDE_IDS_AUTORISES : identifiants (UUID) séparés par des virgules, espaces ou retours à la ligne, qui voient
 * l'aide EN PLUS des admins pendant les tests. Vide ou absente = admins seulement. Une valeur qui n'est pas un
 * UUID est ignorée (jamais de correspondance approximative).
 */
export function idsAutorises(env = process.env) {
  return new Set(
    String(env?.AIDE_IDS_AUTORISES || "")
      .split(/[\s,;]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => MOTIF_UUID.test(v))
  );
}

/**
 * L'aide est-elle ouverte à cette personne ? Fail-closed : au moindre doute, non.
 * Ordre : un admin y a toujours accès ; une personne de AIDE_IDS_AUTORISES aussi ; sinon l'interrupteur
 * feat_aide_unifiee doit être activé ET laisser son rôle passer.
 */
export async function aideOuverte(admin, userId, { env = process.env } = {}) {
  try {
    if (idsAutorises(env).has(String(userId || "").toLowerCase())) return true;
    if (await isCallerAdmin(admin, userId)) return true;
    const { data, error } = await admin.from("feature_flags").select("enabled, roles").eq("id", ID_INTERRUPTEUR).maybeSingle();
    if (error || !data || data.enabled !== true) return false;
    // Une personne connectée est « user » ou « recruiter » ; le visiteur n'a pas accès (il faut un compte).
    return data.roles?.user !== false || data.roles?.recruiter !== false;
  } catch {
    return false;
  }
}

/** Dépendances réelles de l'orchestrateur. `env` et `fournisseur` sont injectables pour les essais. */
export async function construireDeps(admin, { env = process.env, fournisseur } = {}) {
  let faqBase = [];
  try {
    const { data } = await admin.from("assistant_faq").select("question, reponse").eq("actif", true).limit(100);
    faqBase = data || [];
  } catch {
    faqBase = [];
  }
  return {
    env,
    faqBase,
    tarifs: lireTarifs(env),
    fournisseur: fournisseur ?? choisirFournisseur(env),
    memoire: {
      async lire(cle) {
        const { data } = await admin.from("aide_reponses_cache").select("reponse, utilisations, expire_le").eq("cle", cle).maybeSingle();
        if (!data || new Date(data.expire_le).getTime() < Date.now()) return null;
        await admin.from("aide_reponses_cache").update({ utilisations: (data.utilisations || 0) + 1 }).eq("cle", cle);
        return data.reponse;
      },
      async ecrire(cle, reponse) {
        await admin
          .from("aide_reponses_cache")
          .upsert({ cle, reponse, utilisations: 1, expire_le: new Date(Date.now() + 30 * 864e5).toISOString() }, { onConflict: "cle" });
      },
    },
    usage: {
      async reserverIa(userId, limite) {
        const { data, error } = await admin.rpc("aide_reserver_ia", { p_user_id: userId, p_limite: limite });
        if (error) throw error;
        return data === true;
      },
      async coutActuel() {
        const { data, error } = await admin.rpc("aide_cout_actuel");
        if (error) throw error;
        const ligne = Array.isArray(data) ? data[0] : data;
        return { cout_jour: Number(ligne?.cout_jour), cout_mois: Number(ligne?.cout_mois) };
      },
    },
  };
}

/** Journal d'usage : source + jetons + coût, JAMAIS le contenu du message. */
export async function enregistrerUsage(admin, resultat) {
  try {
    const u = resultat.usage || {};
    await admin.rpc("aide_enregistrer_usage", {
      // 'ia' garde son coût même quand l'IA renvoie vers l'équipe ; les autres sources inconnues du SQL ne comptent que dans « demandes ».
      p_source: resultat.source === "ia" ? "ia" : resultat.passerEquipe ? "escalade" : resultat.source,
      p_entree: u.entree || 0,
      p_sortie: u.sortie || 0,
      p_cache: u.cache || 0,
      p_cout_micro: u.coutMicro || 0,
    });
  } catch (e) {
    console.warn("[aide] journal d'usage non écrit :", e?.message);
  }
}

export { lireReglages, cleMemoire };
