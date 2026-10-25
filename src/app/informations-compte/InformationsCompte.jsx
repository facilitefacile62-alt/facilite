"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { MESSAGE_SUPPORT_PERDU } from "@/lib/compte/messages";

// « Informations du compte » — l'écran n'applique AUCUNE règle : il affiche ce que le serveur renvoie (valeurs masquées, messages) et lui transmet les
// gestes. Rien n'est écrit dans une table depuis ici : changer ou retirer un téléphone ou une adresse passe uniquement par /api/compte/*.
// Même parcours, mêmes phrases dans Facilité et Locaux (qui appellent les mêmes routes).

const SUPPORT_WHATSAPP = "https://wa.me/221771400832";
const NOMS = {
  email: { le: "l'adresse e-mail", cette: "cette adresse e-mail", titre: "Adresse e-mail", phrase: "Cette adresse sert à vous connecter et à protéger votre compte. Personne d'autre ne la voit.", changer: "Changer d'adresse e-mail", retirer: "Dissocier l'e-mail", champ: "Nouvelle adresse e-mail", saisie: "exemple@gmail.com" },
  telephone: { le: "le numéro", cette: "ce numéro", titre: "Téléphone", phrase: "Ce numéro sert à vous connecter et à protéger votre compte. Personne d'autre ne le voit.", changer: "Changer de téléphone", retirer: "Dissocier le téléphone", champ: "Nouveau numéro", saisie: "77 123 45 67" },
};

const GrosBouton = ({ children, onClick, variante = "plein", disabled, type = "button", id }) => (
  <button
    id={id}
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-14 rounded-2xl px-5 text-base font-black transition disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
      variante === "plein"
        ? "bg-emerald-600 text-white hover:bg-emerald-700"
        : variante === "danger"
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
    }`}
  >
    {children}
  </button>
);

const Ligne = ({ canal, valeurMasquee, ouvert = true, onOuvrir }) => (
  <button
    type="button"
    id={`ligne-${canal}`}
    onClick={() => (ouvert ? onOuvrir(canal) : undefined)}
    disabled={!ouvert}
    className="w-full text-left flex items-center justify-between gap-3 min-h-16 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-60"
  >
    <span>
      <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{NOMS[canal].titre}</span>
      <span className="block text-base font-black">{valeurMasquee || "Non renseigné"}</span>
      {!ouvert && <span className="block text-xs text-gray-500 dark:text-gray-400">Le changement de téléphone arrive bientôt.</span>}
    </span>
    {ouvert && <span className="text-sm font-black text-emerald-700 dark:text-[#10E688]">Modifier</span>}
  </button>
);

function Fenetre({ titre, children, onFermer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titre}>
      <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black leading-tight">{titre}</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="w-10 h-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 font-black">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function InformationsCompte() {
  const { session, loading: authLoading } = useAuth();
  const [etat, setEtat] = useState(null);
  const [naissance, setNaissance] = useState(null);
  const [erreurChargement, setErreurChargement] = useState("");
  const [fenetre, setFenetre] = useState(null); // { canal, action, etape, autorisation, envoyeA, dejaVerifie }
  const [message, setMessage] = useState(""); // erreur ou information dans la fenêtre
  const [fait, setFait] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [valeur, setValeur] = useState("");
  const [code, setCode] = useState("");
  const [activite, setActivite] = useState(null);
  const [perdu, setPerdu] = useState(false);

  const appeler = useCallback(
    async (chemin, corps) => {
      const res = await fetch(`/api/compte/${chemin}`, {
        method: corps ? "POST" : "GET",
        headers: { Authorization: `Bearer ${session?.access_token}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
        ...(corps ? { body: JSON.stringify(corps) } : {}),
      });
      const donnees = await res.json().catch(() => ({}));
      return { ...donnees, ok: res.ok && donnees.ok !== false };
    },
    [session?.access_token]
  );

  const charger = useCallback(async () => {
    if (!session) return;
    const r = await appeler("etat");
    if (r.ok) {
      setEtat(r.etat);
      setErreurChargement("");
    } else setErreurChargement(r.message || "Impossible pour le moment. Réessayez plus tard.");
  }, [session, appeler]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("date_naissance")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setNaissance(data?.date_naissance ?? null));
  }, [session?.user?.id]);

  const fermer = () => {
    setFenetre(null);
    setMessage("");
    setValeur("");
    setCode("");
    setEnCours(false);
  };
  const ouvrir = (canal) => {
    setFait("");
    setMessage("");
    setFenetre({ canal, etape: "choix" });
  };

  const demanderPreuve = async (canal, action) => {
    setEnCours(true);
    setMessage("");
    const r = await appeler("preuve/envoyer", { canal });
    setEnCours(false);
    if (!r.ok) return setMessage(r.message);
    if (r.dejaVerifie) setFenetre({ canal, action, etape: action === "changer" ? "nouvelle" : "dissocier", autorisation: r.autorisation });
    else setFenetre({ canal, action, etape: "code_preuve", envoyeA: r.envoyeA });
  };
  const verifierPreuve = async () => {
    setEnCours(true);
    setMessage("");
    const r = await appeler("preuve/verifier", { canal: fenetre.canal, code });
    setEnCours(false);
    if (!r.ok) return setMessage(r.message);
    setCode("");
    setFenetre({ ...fenetre, etape: fenetre.action === "changer" ? "nouvelle" : "dissocier", autorisation: r.autorisation });
  };
  const envoyerNouvelle = async () => {
    setEnCours(true);
    setMessage("");
    const r = await appeler("changer/demander", { canal: fenetre.canal, valeur, autorisation: fenetre.autorisation });
    setEnCours(false);
    if (!r.ok) return setMessage(r.message);
    setCode("");
    setFenetre({ ...fenetre, etape: "code_nouvelle", envoyeA: r.envoyeA });
  };
  const confirmerNouvelle = async () => {
    setEnCours(true);
    setMessage("");
    const r = await appeler("changer/confirmer", { canal: fenetre.canal, code, autorisation: fenetre.autorisation });
    setEnCours(false);
    if (!r.ok) return setMessage(r.message);
    setEtat(r.etat);
    setFait(r.message);
    renouvelerSession();
    fermer();
  };
  const dissocier = async () => {
    setEnCours(true);
    setMessage("");
    const r = await appeler("dissocier", { canal: fenetre.canal, autorisation: fenetre.autorisation });
    setEnCours(false);
    if (!r.ok) return setMessage(r.message);
    setEtat(r.etat);
    setFait(r.message);
    renouvelerSession();
    fermer();
  };
  // Après un changement fait par le serveur, la session de cet appareil porte encore l'ancienne valeur : on la renouvelle pour que tout le site la voie.
  const renouvelerSession = () => supabase.auth.refreshSession().catch(() => {});
  const voirActivite = async () => {
    const r = await appeler("activite");
    setActivite(r.ok ? r.evenements : []);
  };

  const f = fenetre;
  const nom = f ? NOMS[f.canal] : null;
  const masque = f && etat ? (f.canal === "email" ? etat.email : etat.telephone) : null;
  const telephoneOuvert = etat?.telephoneActif === true;

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <main className="max-w-xl mx-auto px-4 py-8 space-y-5">
        <Link href="/profil" className="text-sm font-bold text-emerald-700 dark:text-[#10E688]">
          ← Retour au profil
        </Link>
        <h1 className="text-3xl font-black tracking-tight">Informations du compte</h1>

        {authLoading || (!etat && !erreurChargement) ? (
          <p className="text-gray-600 dark:text-gray-300">Chargement…</p>
        ) : erreurChargement ? (
          <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 p-4 font-semibold">
            {erreurChargement}
          </p>
        ) : (
          <>
            {fait && (
              <p role="status" className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 p-4 font-bold">
                {fait}
              </p>
            )}
            <div className="space-y-3">
              <Ligne canal="telephone" valeurMasquee={etat.telephone} ouvert={telephoneOuvert} onOuvrir={ouvrir} />
              <Ligne canal="email" valeurMasquee={etat.email} onOuvrir={ouvrir} />
              <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date de naissance</span>
                <span className="block text-base font-black">{naissance ? new Date(`${naissance}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Non renseignée"}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-300 mt-1">Pour la corriger, contactez-nous.</span>
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm font-black text-emerald-700 dark:text-[#10E688]">
                  Écrire au support sur WhatsApp
                </a>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <GrosBouton variante="secondaire" onClick={() => setPerdu(true)}>
                Je n&apos;ai plus accès
              </GrosBouton>
              <GrosBouton variante="secondaire" onClick={voirActivite}>
                Activité du compte
              </GrosBouton>
            </div>

            {activite && (
              <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
                <h2 className="font-black mb-2">Activité du compte</h2>
                {activite.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">Rien à signaler.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {activite.map((e, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {e.libelle}
                          {e.moyen ? ` · ${e.moyen}` : ""}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 shrink-0">{new Date(e.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {perdu && (
        <Fenetre titre={MESSAGE_SUPPORT_PERDU.titre} onFermer={() => setPerdu(false)}>
          <p className="text-base leading-relaxed">{MESSAGE_SUPPORT_PERDU.phrase}</p>
          <p className="text-sm font-bold">Préparez :</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {MESSAGE_SUPPORT_PERDU.informations.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 text-white text-base font-black">
            Écrire au support sur WhatsApp
          </a>
        </Fenetre>
      )}

      {f && nom && (
        <Fenetre titre={f.etape === "choix" ? nom.titre : f.action === "dissocier" ? `Retirer ${nom.le}` : `Changer ${nom.le}`} onFermer={fermer}>
          {message && (
            <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 p-3 text-sm font-semibold">
              {message}
            </p>
          )}

          {f.etape === "choix" && (
            <>
              <p className="text-2xl font-black">{masque || "Non renseigné"}</p>
              <p className="text-base leading-relaxed">{nom.phrase}</p>
              <GrosBouton onClick={() => setFenetre({ canal: f.canal, action: "changer", etape: "confirmer" })}>{nom.changer}</GrosBouton>
              <GrosBouton variante="secondaire" onClick={() => setFenetre({ canal: f.canal, action: "dissocier", etape: "confirmer" })}>
                {nom.retirer}
              </GrosBouton>
            </>
          )}

          {f.etape === "confirmer" && (
            <>
              <p className="text-base leading-relaxed">
                {f.action === "changer" ? `Vous allez changer ${nom.le}. Nous vérifierons d'abord que c'est bien vous.` : `Vous allez retirer ${nom.le} de votre compte. Nous vérifierons d'abord que c'est bien vous.`}
              </p>
              <GrosBouton variante={f.action === "dissocier" ? "danger" : "plein"} disabled={enCours} onClick={() => demanderPreuve(f.canal, f.action)}>
                {enCours ? "Un instant…" : "Oui, continuer"}
              </GrosBouton>
              <GrosBouton variante="secondaire" onClick={fermer}>
                Non, annuler
              </GrosBouton>
            </>
          )}

          {(f.etape === "code_preuve" || f.etape === "code_nouvelle") && (
            <>
              <p className="text-base leading-relaxed">
                Nous avons envoyé un code à <strong>{f.envoyeA}</strong>. Saisissez-le ici. Il est valable 10 minutes.
              </p>
              <input
                id="champ-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full min-h-14 rounded-2xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 text-center text-2xl font-black tracking-[0.4em]"
                placeholder="______"
              />
              <GrosBouton disabled={enCours || code.length !== 6} onClick={f.etape === "code_preuve" ? verifierPreuve : confirmerNouvelle}>
                {enCours ? "Un instant…" : "Valider le code"}
              </GrosBouton>
              <GrosBouton variante="secondaire" onClick={fermer}>
                Non, annuler
              </GrosBouton>
            </>
          )}

          {f.etape === "nouvelle" && (
            <>
              <label htmlFor="champ-valeur" className="block text-sm font-bold">
                {nom.champ}
              </label>
              <input
                id="champ-valeur"
                type={f.canal === "email" ? "email" : "tel"}
                autoComplete={f.canal === "email" ? "email" : "tel"}
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                className="w-full min-h-14 rounded-2xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 text-lg font-bold"
                placeholder={nom.saisie}
              />
              <p className="text-sm text-gray-600 dark:text-gray-300">Nous enverrons un code à cette nouvelle valeur pour la confirmer. Rien ne change avant.</p>
              <GrosBouton disabled={enCours || valeur.trim().length < 5} onClick={envoyerNouvelle}>
                {enCours ? "Un instant…" : "Envoyer le code"}
              </GrosBouton>
              <GrosBouton variante="secondaire" onClick={fermer}>
                Non, annuler
              </GrosBouton>
            </>
          )}

          {f.etape === "dissocier" && (
            <>
              <p className="text-base leading-relaxed">Dernière question : voulez-vous vraiment retirer {nom.le} ({masque}) ?</p>
              <GrosBouton variante="danger" disabled={enCours} onClick={dissocier}>
                {enCours ? "Un instant…" : "Oui, continuer"}
              </GrosBouton>
              <GrosBouton variante="secondaire" onClick={fermer}>
                Non, annuler
              </GrosBouton>
            </>
          )}
        </Fenetre>
      )}
    </div>
  );
}
