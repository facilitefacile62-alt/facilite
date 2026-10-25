import * as codes from "../../src/lib/compte/codes.js";
import { compterEnMemoire } from "../../src/lib/limiteur.js";

// Doublure en mémoire de la base, de l'e-mail et du SMS pour tester src/lib/compte/service.js sans réseau. Le comportement de l'authentification est
// reproduit fidèlement, y compris le déclencheur qui recopie e-mail/téléphone dans profiles — et les pannes (« accepté sans effet »).

export function creerMonde({ utilisateur, options = {} } = {}) {
  const monde = {
    horloge: Date.parse("2026-10-25T12:00:00Z"),
    utilisateur: { id: "u1", email: "marie@gmail.com", email_confirmed_at: "2026-01-01", phone: "221771234632", phone_confirmed_at: "2026-01-01", identities: [], last_sign_in_at: "2026-10-25T09:00:00Z", ...utilisateur },
    profil: { email: null, phone: null },
    tables: { compte_verifications: [], compte_journal_securite: [] },
    envois: [],
    alertes: [],
    sessionsFermees: 0,
    autresComptes: { email: new Set(["pris@gmail.com"]), phone: new Set(["221781112233"]) },
    options: { sansEffetAuth: false, sansSyncProfil: false, telephoneActif: true, refuseDissociation: false, ...options },
    appelsAuth: [],
    seq: 0,
  };
  // profiles.phone = numéro de CONTACT (vendeur…), distinct du numéro de connexion : il ne bouge jamais avec le compte.
  monde.profil = { email: monde.utilisateur.email, phone: "221700000001" };
  const maintenant = () => monde.horloge;
  const iso = (ms) => new Date(ms).toISOString();

  const builder = (nom) => {
    const t = monde.tables[nom];
    const q = { op: "select", filtres: [], donnees: null, tete: false, limite: null, tri: null };
    const ok = (l) => q.filtres.every((f) => f(l));
    const api = {
      select: (_c, o) => { if (q.op === "select") q.tete = Boolean(o?.head); return api; },
      insert: (d) => { q.op = "insert"; q.donnees = d; return api; },
      update: (d) => { q.op = "update"; q.donnees = d; return api; },
      delete: () => { q.op = "delete"; return api; },
      eq: (c, v) => { q.filtres.push((l) => l[c] === v); return api; },
      is: (c, v) => { q.filtres.push((l) => (l[c] ?? null) === v); return api; },
      in: (c, vs) => { q.filtres.push((l) => vs.includes(l[c])); return api; },
      gte: (c, v) => { q.filtres.push((l) => Date.parse(l[c]) >= Date.parse(v)); return api; },
      order: (c, o) => { q.tri = [c, o?.ascending !== false]; return api; },
      limit: (n) => { q.limite = n; return api; },
      async exec() {
        if (q.op === "insert") {
          const l = { id: `id${++monde.seq}`, essais: 0, utilise_le: null, autorisation_id: null, nouvelle_valeur: null, cree_le: iso(maintenant()), ...q.donnees };
          t.push(l);
          return { data: [l], error: null, count: null };
        }
        if (q.op === "update") {
          const touchees = t.filter(ok);
          touchees.forEach((l) => Object.assign(l, q.donnees));
          return { data: touchees, error: null };
        }
        if (q.op === "delete") {
          for (let i = t.length - 1; i >= 0; i--) if (ok(t[i])) t.splice(i, 1);
          return { data: null, error: null };
        }
        let lignes = t.filter(ok);
        if (q.tri) lignes = [...lignes].sort((a, b) => (Date.parse(a[q.tri[0]]) - Date.parse(b[q.tri[0]])) * (q.tri[1] ? 1 : -1) || (q.tri[1] ? 1 : -1) * 0);
        if (q.limite) lignes = lignes.slice(0, q.limite);
        return { data: q.tete ? null : lignes, count: lignes.length, error: null };
      },
      maybeSingle: async () => { const r = await api.exec(); return { data: r.data?.[0] ?? null, error: null }; },
      single: async () => { const r = await api.exec(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: "aucune ligne" } }; },
      then: (res, rej) => api.exec().then(res, rej),
    };
    return api;
  };

  const profilBuilder = () => {
    let majs = null;
    const api = {
      select: () => api,
      update: (d) => { majs = d; return api; },
      eq: () => api,
      maybeSingle: async () => ({ data: { ...monde.profil }, error: null }),
      then: (res, rej) => { if (majs) Object.assign(monde.profil, majs); return Promise.resolve({ data: null, error: null }).then(res, rej); },
    };
    return api;
  };

  const admin = {
    from: (nom) => (nom === "profiles" ? profilBuilder() : builder(nom)),
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { ...monde.utilisateur } }, error: null }),
        updateUserById: async (_id, champs) => {
          monde.appelsAuth.push(champs);
          if (!monde.options.sansEffetAuth) {
            if (champs.email) { monde.utilisateur.email = champs.email; monde.utilisateur.email_confirmed_at = "2026-10-25"; }
            if (champs.phone) { monde.utilisateur.phone = champs.phone.replace(/\D/g, ""); monde.utilisateur.phone_confirmed_at = "2026-10-25"; }
            if (!monde.options.sansSyncProfil && champs.email) monde.profil.email = monde.utilisateur.email || null;
          }
          return { data: {}, error: null };
        },
      },
    },
  };

  const compteurs = new Map();
  const deps = {
    admin,
    codes,
    maintenant,
    limiter: async (cle, max, fenetre) => compterEnMemoire(cle, fenetre, maintenant(), compteurs) <= max,
    telephoneActif: async () => monde.options.telephoneActif,
    valeurPrise: async (canal, valeur) => (canal === "email" ? monde.autresComptes.email.has(valeur) : monde.autresComptes.phone.has(valeur.replace(/\D/g, ""))),
    dissocierServeur: async (_id, canal) => {
      if (monde.options.refuseDissociation) return { error: { message: "Manual linking is disabled" } };
      if (monde.options.dissociationSansEffet) return { error: null };
      const champ = canal === "email" ? "email" : "phone";
      monde.utilisateur[champ] = null;
      monde.utilisateur[`${champ}_confirmed_at`] = null;
      if (!monde.options.sansSyncProfil && champ === "email") monde.profil.email = null;
      return { error: null };
    },
    fermerAutresSessions: async () => { monde.sessionsFermees++; return { ok: true }; },
    envoyerCode: async (e) => { monde.envois.push(e); return { ok: !monde.options.envoiEnPanne }; },
    envoyerAlerte: async (a) => { monde.alertes.push(a); return { ok: true }; },
  };
  const ctx = { userId: "u1", accessToken: "jeton", ip: "1.2.3.4", appareil: "Test" };
  const dernierCode = (but) => monde.envois.filter((e) => e.but === but).at(-1)?.code;
  return { monde, deps, ctx, dernierCode, avancer: (ms) => { monde.horloge += ms; } };
}
