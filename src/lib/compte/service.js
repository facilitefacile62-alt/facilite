import {
  AUTORISATION_DUREE_MS,
  CHANGEMENTS_PAR_24H,
  CODE_DUREE_MS,
  ENVOIS_PAR_HEURE_IP,
  ENVOIS_PAR_HEURE_UTILISATEUR,
  ESSAIS_MAX,
  VERIFICATIONS_PAR_HEURE_UTILISATEUR,
  CANAUX,
  chiffresTelephone,
  connexionRecente,
  masquerEmail,
  masquerTelephone,
  methodesDeConnexion,
  normaliserEmail,
  normaliserTelephone,
  peutDissocier,
  valeurActuelle,
} from "./regles.js";
import { messagePour, messageReussite } from "./messages.js";

// « Informations du compte » — LA logique, une seule fois, pour le site, Facilité et Locaux (les routes /api/compte/* l'appellent, les trois écrans affichent ce
// qu'elle renvoie). Source de vérité : l'authentification Supabase (auth.users) ; profiles n'en est qu'une copie, mise à jour par la base (déclencheur
// synchroniser_contact_profil) et RELUE ici.
//
// RÈGLE D'OR : on ne dit « changé » ou « retiré » qu'après avoir RELU le compte et constaté que la valeur a vraiment changé, côté authentification ET côté profil.
// Si l'API accepte sans effet, ou refuse : « Impossible pour le moment », sans rien faire croire, et l'échec est écrit au journal de sécurité.
//
// Toutes les dépendances (base, e-mail, SMS, limites, horloge) sont passées en paramètre : le même code tourne en production et dans les tests.
//   ctx  = { userId, accessToken, ip, appareil }
//   deps = { admin, maintenant, limiter, envoyerCode, envoyerAlerte, telephoneActif, valeurPrise, dissocierServeur, fermerAutresSessions, codes }

const echec = (code, canal, statut = 400, extra = {}) => ({ ok: false, code, message: messagePour(code, canal), statut, ...extra });
const iso = (ms) => new Date(ms).toISOString();
const auteurValide = (canal) => CANAUX.includes(canal);

async function journaliser(ctx, deps, { type, canal = null, resultat, detail = null }) {
  try {
    await deps.admin.from("compte_journal_securite").insert({
      user_id: ctx.userId,
      type,
      canal,
      resultat,
      detail: detail ? String(detail).slice(0, 120) : null,
      ip_hash: deps.codes.empreinteIp(ctx.ip),
      appareil: ctx.appareil ? String(ctx.appareil).slice(0, 200) : null,
    });
  } catch (erreur) {
    console.error("[Compte] Journal de sécurité impossible :", erreur?.message);
  }
}

async function lireUtilisateur(ctx, deps) {
  const { data, error } = await deps.admin.auth.admin.getUserById(ctx.userId);
  if (error || !data?.user) return null;
  return data.user;
}

async function lireCopieProfil(ctx, deps) {
  const { data } = await deps.admin.from("profiles").select("email, phone").eq("id", ctx.userId).maybeSingle();
  return data ?? null;
}

/** Nombre de changements ou dissociations RÉUSSIS dans les dernières 24 heures (lu dans le journal : durable, partagé entre instances). */
async function changementsRecents(ctx, deps) {
  const { count } = await deps.admin
    .from("compte_journal_securite")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("resultat", "ok")
    .in("type", ["changement_ok", "dissociation_ok"])
    .gte("cree_le", iso(deps.maintenant() - 24 * 3600 * 1000));
  return count ?? 0;
}

async function limiteEnvoiAtteinte(ctx, deps) {
  const parPersonne = await deps.limiter(`compte:envoi:u:${ctx.userId}`, ENVOIS_PAR_HEURE_UTILISATEUR, 3600);
  const ipHash = deps.codes.empreinteIp(ctx.ip);
  const parIp = ipHash ? await deps.limiter(`compte:envoi:ip:${ipHash}`, ENVOIS_PAR_HEURE_IP, 3600) : true;
  return !(parPersonne && parIp);
}

async function telephoneBloque(canal, deps) {
  return canal === "telephone" && !(await deps.telephoneActif());
}

/** État affichable : valeurs MASQUÉES uniquement (la valeur complète ne sort jamais d'ici sans nouvelle vérification). */
export async function etatAffichable(utilisateur, deps) {
  const m = methodesDeConnexion(utilisateur);
  const telephoneActif = await deps.telephoneActif();
  return {
    email: utilisateur.email ? masquerEmail(utilisateur.email) : null,
    emailVerifie: m.email,
    telephone: utilisateur.phone ? masquerTelephone(utilisateur.phone) : null,
    telephoneVerifie: m.telephone,
    peutDissocierEmail: peutDissocier(utilisateur, "email").ok,
    peutDissocierTelephone: peutDissocier(utilisateur, "telephone").ok,
    telephoneActif,
  };
}

export async function lireEtat(ctx, deps) {
  const utilisateur = await lireUtilisateur(ctx, deps);
  if (!utilisateur) return echec("impossible_pour_le_moment", null, 503);
  return { ok: true, etat: await etatAffichable(utilisateur, deps) };
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------
// 1) Preuve : prouver qu'on est bien le propriétaire (code envoyé à la méthode ACTUELLE, ou connexion de moins de 5 minutes)
// ----------------------------------------------------------------------------------------------------------------------------------------------------

async function creerAutorisation(ctx, deps, canal) {
  const jeton = deps.codes.genererJeton();
  await deps.admin.from("compte_verifications").delete().eq("user_id", ctx.userId).eq("but", "autorisation");
  const { error } = await deps.admin.from("compte_verifications").insert({
    user_id: ctx.userId,
    canal,
    but: "autorisation",
    code_hash: deps.codes.hacher(jeton, ctx.userId),
    expire_le: iso(deps.maintenant() + AUTORISATION_DUREE_MS),
  });
  if (error) return null;
  return jeton;
}

/** Où envoyer le code de preuve : le moyen lui-même s'il est vérifié, sinon l'autre moyen vérifié (le SMS seulement si le téléphone est ouvert). */
function destinationPreuve(utilisateur, canal, telephoneActif) {
  const m = methodesDeConnexion(utilisateur);
  const ordre = canal === "email" ? ["email", "telephone"] : ["telephone", "email"];
  for (const c of ordre) {
    if (c === "email" && m.email) return { canal: "email", valeur: utilisateur.email };
    if (c === "telephone" && m.telephone && telephoneActif) return { canal: "telephone", valeur: utilisateur.phone };
  }
  return null;
}

export async function envoyerPreuve(ctx, { canal }, deps) {
  if (!auteurValide(canal)) return echec("demande_invalide", canal);
  if (await telephoneBloque(canal, deps)) return echec("telephone_indisponible", canal, 403);
  const utilisateur = await lireUtilisateur(ctx, deps);
  if (!utilisateur) return echec("impossible_pour_le_moment", canal, 503);

  // Connexion de moins de 5 minutes : elle tient lieu de preuve, aucun code n'est envoyé.
  if (connexionRecente(utilisateur, deps.maintenant())) {
    const jeton = await creerAutorisation(ctx, deps, canal);
    if (!jeton) return echec("impossible_pour_le_moment", canal, 503);
    await journaliser(ctx, deps, { type: "preuve_connexion_recente", canal, resultat: "ok" });
    return { ok: true, dejaVerifie: true, autorisation: jeton, expireDansSecondes: AUTORISATION_DUREE_MS / 1000 };
  }

  const destination = destinationPreuve(utilisateur, canal, await deps.telephoneActif());
  if (!destination) {
    await journaliser(ctx, deps, { type: "preuve_impossible", canal, resultat: "refuse", detail: "aucune_methode" });
    return echec("aucune_methode_preuve", canal, 409);
  }
  if (await limiteEnvoiAtteinte(ctx, deps)) {
    await journaliser(ctx, deps, { type: "limite_atteinte", canal, resultat: "refuse", detail: "envoi_preuve" });
    return echec("trop_de_demandes", canal, 429);
  }

  const code = deps.codes.genererCode();
  await deps.admin.from("compte_verifications").delete().eq("user_id", ctx.userId).eq("canal", canal).eq("but", "preuve");
  const { data: ligne, error } = await deps.admin
    .from("compte_verifications")
    .insert({ user_id: ctx.userId, canal, but: "preuve", code_hash: deps.codes.hacher(code, ctx.userId), expire_le: iso(deps.maintenant() + CODE_DUREE_MS) })
    .select("id")
    .single();
  if (error || !ligne) return echec("impossible_pour_le_moment", canal, 503);

  const envoi = await deps.envoyerCode({ canal: destination.canal, destination: destination.valeur, code, but: "preuve" });
  if (!envoi?.ok) {
    await deps.admin.from("compte_verifications").delete().eq("id", ligne.id);
    await journaliser(ctx, deps, { type: "preuve_envoyee", canal, resultat: "echec", detail: "envoi" });
    return echec("envoi_impossible", canal, 503);
  }
  await journaliser(ctx, deps, { type: "preuve_envoyee", canal, resultat: "ok", detail: destination.canal });
  return { ok: true, dejaVerifie: false, envoyeA: destination.canal === "email" ? masquerEmail(destination.valeur) : masquerTelephone(destination.valeur), canalPreuve: destination.canal };
}

/**
 * Contrôle d'un code sur une ligne de compte_verifications : durée, nombre d'essais, comparaison. Compte l'essai AVANT de comparer (de façon atomique)
 * pour que des essais en parallèle ne dépassent jamais la limite.
 */
async function controlerCode(ctx, deps, ligne, code, canal, typeEchec) {
  if (!ligne) return echec("code_expire", canal, 410);
  if (Date.parse(ligne.expire_le) <= deps.maintenant()) return echec("code_expire", canal, 410);
  if (ligne.essais >= ESSAIS_MAX) return echec("trop_d_essais", canal, 429);
  const { data: majs } = await deps.admin
    .from("compte_verifications")
    .update({ essais: ligne.essais + 1 })
    .eq("id", ligne.id)
    .eq("essais", ligne.essais)
    .is("utilise_le", null)
    .select("id");
  if (!majs || majs.length !== 1) return echec("code_invalide", canal, 400);
  if (!deps.codes.correspond(String(code ?? "").trim(), ligne.code_hash, ctx.userId)) {
    await journaliser(ctx, deps, { type: typeEchec, canal, resultat: "refuse", detail: `essai_${ligne.essais + 1}` });
    return echec("code_invalide", canal, 400, { essaisRestants: Math.max(0, ESSAIS_MAX - (ligne.essais + 1)) });
  }
  return null;
}

async function verificationsLimitees(ctx, deps) {
  return !(await deps.limiter(`compte:verif:u:${ctx.userId}`, VERIFICATIONS_PAR_HEURE_UTILISATEUR, 3600));
}

export async function verifierPreuve(ctx, { canal, code }, deps) {
  if (!auteurValide(canal)) return echec("demande_invalide", canal);
  if (await telephoneBloque(canal, deps)) return echec("telephone_indisponible", canal, 403);
  if (await verificationsLimitees(ctx, deps)) return echec("trop_de_demandes", canal, 429);
  const { data: ligne } = await deps.admin
    .from("compte_verifications")
    .select("id, code_hash, expire_le, essais")
    .eq("user_id", ctx.userId)
    .eq("canal", canal)
    .eq("but", "preuve")
    .is("utilise_le", null)
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  const refus = await controlerCode(ctx, deps, ligne, code, canal, "preuve_echec");
  if (refus) return refus;
  await deps.admin.from("compte_verifications").update({ utilise_le: iso(deps.maintenant()) }).eq("id", ligne.id);
  const jeton = await creerAutorisation(ctx, deps, canal);
  if (!jeton) return echec("impossible_pour_le_moment", canal, 503);
  await journaliser(ctx, deps, { type: "preuve_ok", canal, resultat: "ok" });
  return { ok: true, autorisation: jeton, expireDansSecondes: AUTORISATION_DUREE_MS / 1000 };
}

async function lireAutorisation(ctx, deps, canal, jeton) {
  if (typeof jeton !== "string" || jeton.length < 20 || jeton.length > 100) return null;
  const { data } = await deps.admin
    .from("compte_verifications")
    .select("id, expire_le")
    .eq("user_id", ctx.userId)
    .eq("canal", canal)
    .eq("but", "autorisation")
    .eq("code_hash", deps.codes.hacher(jeton, ctx.userId))
    .is("utilise_le", null)
    .maybeSingle();
  if (!data || Date.parse(data.expire_le) <= deps.maintenant()) return null;
  return data;
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------
// 2) Changer : la nouvelle valeur reçoit un code ; RIEN n'est changé avant sa confirmation
// ----------------------------------------------------------------------------------------------------------------------------------------------------

function normaliserValeur(canal, valeur) {
  return canal === "email" ? normaliserEmail(valeur) : normaliserTelephone(valeur);
}

export async function demanderChangement(ctx, { canal, valeur, autorisation }, deps) {
  if (!auteurValide(canal)) return echec("demande_invalide", canal);
  if (await telephoneBloque(canal, deps)) return echec("telephone_indisponible", canal, 403);
  const aut = await lireAutorisation(ctx, deps, canal, autorisation);
  if (!aut) return echec("autorisation_invalide", canal, 403);
  const nouvelle = normaliserValeur(canal, valeur);
  if (!nouvelle) return echec("valeur_invalide", canal, 400);
  const utilisateur = await lireUtilisateur(ctx, deps);
  if (!utilisateur) return echec("impossible_pour_le_moment", canal, 503);
  const comparable = canal === "email" ? nouvelle : chiffresTelephone(nouvelle);
  if (comparable === valeurActuelle(utilisateur, canal)) return echec("identique", canal, 409);
  if ((await changementsRecents(ctx, deps)) >= CHANGEMENTS_PAR_24H) {
    await journaliser(ctx, deps, { type: "limite_atteinte", canal, resultat: "refuse", detail: "changements_24h" });
    return echec("limite_changements", canal, 429);
  }
  if (await limiteEnvoiAtteinte(ctx, deps)) {
    await journaliser(ctx, deps, { type: "limite_atteinte", canal, resultat: "refuse", detail: "envoi_nouvelle_valeur" });
    return echec("trop_de_demandes", canal, 429);
  }
  // Message NEUTRE : on ne dit jamais à qui appartient la valeur.
  if (await deps.valeurPrise(canal, nouvelle, ctx.userId)) {
    await journaliser(ctx, deps, { type: "valeur_refusee", canal, resultat: "refuse", detail: "deja_utilisee" });
    return echec("valeur_prise", canal, 409);
  }

  const code = deps.codes.genererCode();
  await deps.admin.from("compte_verifications").delete().eq("user_id", ctx.userId).eq("canal", canal).eq("but", "nouvelle_valeur");
  const { data: ligne, error } = await deps.admin
    .from("compte_verifications")
    .insert({
      user_id: ctx.userId,
      canal,
      but: "nouvelle_valeur",
      nouvelle_valeur: nouvelle,
      code_hash: deps.codes.hacher(code, ctx.userId),
      autorisation_id: aut.id,
      expire_le: iso(deps.maintenant() + CODE_DUREE_MS),
    })
    .select("id")
    .single();
  if (error || !ligne) return echec("impossible_pour_le_moment", canal, 503);
  const envoi = await deps.envoyerCode({ canal, destination: nouvelle, code, but: "nouvelle_valeur" });
  if (!envoi?.ok) {
    await deps.admin.from("compte_verifications").delete().eq("id", ligne.id);
    await journaliser(ctx, deps, { type: "nouvelle_valeur_envoyee", canal, resultat: "echec", detail: "envoi" });
    return echec("envoi_impossible", canal, 503);
  }
  await journaliser(ctx, deps, { type: "nouvelle_valeur_envoyee", canal, resultat: "ok" });
  return { ok: true, envoyeA: canal === "email" ? masquerEmail(nouvelle) : masquerTelephone(nouvelle) };
}

/** Après l'action : alerte, fermeture des autres sessions, journal — jamais bloquants, mais toujours tentés et journalisés. */
async function suites(ctx, deps, { action, canal, emailAlerte }) {
  if (emailAlerte) {
    const r = await deps.envoyerAlerte({ destination: emailAlerte, action, canal }).catch(() => ({ ok: false }));
    await journaliser(ctx, deps, { type: "alerte_envoyee", canal, resultat: r?.ok ? "ok" : "echec" });
  } else {
    await journaliser(ctx, deps, { type: "alerte_envoyee", canal, resultat: "echec", detail: "aucune_adresse_email" });
  }
  const f = await deps.fermerAutresSessions(ctx.accessToken).catch(() => ({ ok: false }));
  await journaliser(ctx, deps, { type: "autres_sessions_fermees", canal, resultat: f?.ok ? "ok" : "echec" });
}

/** Marque l'autorisation et les codes liés comme utilisés : un seul changement par vérification. */
async function consommer(ctx, deps, autorisationId) {
  const maintenant = iso(deps.maintenant());
  await deps.admin.from("compte_verifications").update({ utilise_le: maintenant }).eq("user_id", ctx.userId).eq("id", autorisationId);
  await deps.admin.from("compte_verifications").update({ utilise_le: maintenant }).eq("user_id", ctx.userId).eq("autorisation_id", autorisationId);
}

/** Relit le compte ET sa copie dans profiles ; true seulement si les deux montrent la valeur attendue (ou l'absence de valeur). */
async function constaterEtat(ctx, deps, canal, attendue /* null = retiré */) {
  const relu = await lireUtilisateur(ctx, deps);
  if (!relu) return { ok: false, relu: null, detail: "relecture_impossible" };
  const dansAuth = valeurActuelle(relu, canal);
  const authOk = attendue === null ? dansAuth === "" : dansAuth === attendue;
  if (!authOk) return { ok: false, relu, detail: "sans_effet_auth" };
  let copie = await lireCopieProfil(ctx, deps);
  const copieValeur = (c) => (canal === "email" ? String(c?.email ?? "").toLowerCase() : chiffresTelephone(c?.phone));
  const copieOk = (c) => (attendue === null ? copieValeur(c) === "" : copieValeur(c) === attendue);
  if (!copieOk(copie)) {
    // Le déclencheur aurait dû recopier la valeur : on tente une réparation explicite, puis on relit encore.
    await deps.admin.from("profiles").update(canal === "email" ? { email: attendue } : { phone: attendue }).eq("id", ctx.userId);
    copie = await lireCopieProfil(ctx, deps);
    if (!copieOk(copie)) return { ok: false, relu, detail: "profil_non_synchronise" };
  }
  return { ok: true, relu };
}

export async function confirmerChangement(ctx, { canal, code, autorisation }, deps) {
  if (!auteurValide(canal)) return echec("demande_invalide", canal);
  if (await telephoneBloque(canal, deps)) return echec("telephone_indisponible", canal, 403);
  const aut = await lireAutorisation(ctx, deps, canal, autorisation);
  if (!aut) return echec("autorisation_invalide", canal, 403);
  if (await verificationsLimitees(ctx, deps)) return echec("trop_de_demandes", canal, 429);
  const { data: ligne } = await deps.admin
    .from("compte_verifications")
    .select("id, code_hash, expire_le, essais, nouvelle_valeur")
    .eq("user_id", ctx.userId)
    .eq("canal", canal)
    .eq("but", "nouvelle_valeur")
    .eq("autorisation_id", aut.id)
    .is("utilise_le", null)
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  const refus = await controlerCode(ctx, deps, ligne, code, canal, "nouvelle_valeur_echec");
  if (refus) return refus;

  // Dernier contrôle juste avant d'agir (la situation a pu changer pendant les 10 minutes).
  if ((await changementsRecents(ctx, deps)) >= CHANGEMENTS_PAR_24H) return echec("limite_changements", canal, 429);
  if (await deps.valeurPrise(canal, ligne.nouvelle_valeur, ctx.userId)) {
    await journaliser(ctx, deps, { type: "changement_echec", canal, resultat: "refuse", detail: "deja_utilisee" });
    return echec("valeur_prise", canal, 409);
  }
  const avant = await lireUtilisateur(ctx, deps);
  if (!avant) return echec("impossible_pour_le_moment", canal, 503);
  const ancienEmail = avant.email || null;
  const attendue = canal === "email" ? ligne.nouvelle_valeur : chiffresTelephone(ligne.nouvelle_valeur);

  const { error } = await deps.admin.auth.admin.updateUserById(
    ctx.userId,
    canal === "email" ? { email: ligne.nouvelle_valeur, email_confirm: true } : { phone: ligne.nouvelle_valeur, phone_confirm: true }
  );
  if (error) {
    await journaliser(ctx, deps, { type: "changement_echec", canal, resultat: "echec", detail: "api_refus" });
    return echec("impossible_pour_le_moment", canal, 503);
  }
  const constat = await constaterEtat(ctx, deps, canal, attendue);
  if (!constat.ok) {
    await journaliser(ctx, deps, { type: "changement_echec", canal, resultat: "echec", detail: constat.detail });
    console.error(`[Compte] Changement ${canal} non constaté (${constat.detail}) pour ${ctx.userId}`);
    return echec("impossible_pour_le_moment", canal, 503);
  }

  await consommer(ctx, deps, aut.id);
  await journaliser(ctx, deps, { type: "changement_ok", canal, resultat: "ok" });
  // Alerte : à l'ANCIENNE adresse e-mail ; pour un changement de téléphone, à l'adresse e-mail du compte.
  await suites(ctx, deps, { action: "changer", canal, emailAlerte: ancienEmail });
  return { ok: true, message: messageReussite("changer", canal), etat: await etatAffichable(constat.relu, deps) };
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------
// 3) Dissocier : jamais la dernière méthode ; fait par le SERVEUR, puis RELU
// ----------------------------------------------------------------------------------------------------------------------------------------------------

export async function dissocier(ctx, { canal, autorisation }, deps) {
  if (!auteurValide(canal)) return echec("demande_invalide", canal);
  if (await telephoneBloque(canal, deps)) return echec("telephone_indisponible", canal, 403);
  const aut = await lireAutorisation(ctx, deps, canal, autorisation);
  if (!aut) return echec("autorisation_invalide", canal, 403);
  const avant = await lireUtilisateur(ctx, deps);
  if (!avant) return echec("impossible_pour_le_moment", canal, 503);

  const regle = peutDissocier(avant, canal);
  if (!regle.ok) {
    await journaliser(ctx, deps, { type: "dissociation_refusee", canal, resultat: "refuse", detail: regle.raison });
    return echec(regle.raison, canal, 409);
  }
  if ((await changementsRecents(ctx, deps)) >= CHANGEMENTS_PAR_24H) {
    await journaliser(ctx, deps, { type: "limite_atteinte", canal, resultat: "refuse", detail: "changements_24h" });
    return echec("limite_changements", canal, 429);
  }
  const ancienEmail = avant.email || null;

  const { error } = await deps.dissocierServeur(ctx.userId, canal);
  if (error) {
    const refusRegle = /derniere_methode/.test(error.message ?? "");
    await journaliser(ctx, deps, { type: "dissociation_echec", canal, resultat: refusRegle ? "refuse" : "echec", detail: refusRegle ? "derniere_methode" : "api_erreur" });
    return refusRegle ? echec("derniere_methode", canal, 409) : echec("impossible_pour_le_moment", canal, 503);
  }
  const constat = await constaterEtat(ctx, deps, canal, null);
  if (!constat.ok) {
    await journaliser(ctx, deps, { type: "dissociation_echec", canal, resultat: "echec", detail: constat.detail });
    console.error(`[Compte] Dissociation ${canal} non constatée (${constat.detail}) pour ${ctx.userId}`);
    return echec("impossible_pour_le_moment", canal, 503);
  }

  await consommer(ctx, deps, aut.id);
  await journaliser(ctx, deps, { type: "dissociation_ok", canal, resultat: "ok" });
  // Alerte : à l'adresse e-mail retirée (si c'est elle), sinon à l'adresse e-mail du compte.
  await suites(ctx, deps, { action: "dissocier", canal, emailAlerte: ancienEmail });
  return { ok: true, message: messageReussite("dissocier", canal), etat: await etatAffichable(constat.relu, deps) };
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------
// 4) Activité du compte (lecture de ses propres événements)
// ----------------------------------------------------------------------------------------------------------------------------------------------------

const LIBELLES_ACTIVITE = {
  preuve_envoyee: "Code de vérification envoyé",
  preuve_connexion_recente: "Vérification par votre connexion récente",
  preuve_ok: "Vérification réussie",
  preuve_echec: "Mauvais code de vérification",
  nouvelle_valeur_envoyee: "Code envoyé à la nouvelle valeur",
  nouvelle_valeur_echec: "Mauvais code pour la nouvelle valeur",
  changement_ok: "Changement fait",
  changement_echec: "Changement impossible",
  dissociation_ok: "Retrait fait",
  dissociation_echec: "Retrait impossible",
  dissociation_refusee: "Retrait refusé",
  limite_atteinte: "Trop de demandes",
  valeur_refusee: "Valeur refusée",
  alerte_envoyee: "Alerte envoyée",
  autres_sessions_fermees: "Autres appareils déconnectés",
};

export async function lireActivite(ctx, deps) {
  const { data, error } = await deps.admin
    .from("compte_journal_securite")
    .select("type, canal, resultat, cree_le")
    .eq("user_id", ctx.userId)
    .order("cree_le", { ascending: false })
    .limit(20);
  if (error) return echec("impossible_pour_le_moment", null, 503);
  return {
    ok: true,
    evenements: (data ?? []).map((e) => ({
      libelle: LIBELLES_ACTIVITE[e.type] ?? "Activité",
      moyen: e.canal === "email" ? "E-mail" : e.canal === "telephone" ? "Téléphone" : null,
      reussi: e.resultat === "ok",
      date: e.cree_le,
    })),
  };
}
