"use client";

// Espace admin « Modèles de documents » : les modèles de CV et de lettres de motivation de l'onglet « Modèles de documents » du Profil de l'application.
// Aucun paiement : un modèle choisi ouvre WhatsApp vers Facilité. Tout passe par /api/admin/modeles-documents (contrôle admin côté serveur) ; cette page
// ne fait que l'interface. La case « Publier aussi en story » crée en même temps la story de la même affiche.

import { preparerImagePourEnvoi } from "@/lib/imageUpload";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];
const TAILLE_MAX = 5 * 1024 * 1024;
const LIBELLE_TYPE = { cv: "CV", lettre: "Lettre de motivation" };
// Prix indicatifs proposés au départ ; toujours modifiables.
const PRIX_PAR_DEFAUT = { cv: "1500", lettre: "1000" };
const VIDE = { type: "cv", nom: "", description: "", prix_xof: PRIX_PAR_DEFAUT.cv, message_whatsapp: "", publier_story: false };

const formaterPrix = (n) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

export default function AdminModelesDocumentsPage() {
  const [session, setSession] = useState(null);
  const [autorise, setAutorise] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [modeles, setModeles] = useState([]);
  const [form, setForm] = useState(null); // null = fermé
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const appeler = useCallback(
    async (methode, corps, jeton) => {
      const res = await fetch("/api/admin/modeles-documents", {
        method: methode,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton || session?.access_token}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Une erreur est survenue.");
      return json;
    },
    [session]
  );

  const recharger = useCallback(async () => {
    const json = await appeler("GET");
    setModeles(json.modeles || []);
  }, [appeler]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        if (!s) {
          window.location.replace("/login");
          return;
        }
        const { data: ligne } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id).single();
        if (ligne?.role !== "admin") {
          window.location.replace("/");
          return;
        }
        setSession(s);
        setAutorise(true);
        const res = await fetch("/api/admin/modeles-documents", { headers: { Authorization: `Bearer ${s.access_token}` } });
        const json = await res.json();
        if (res.ok) setModeles(json.modeles || []);
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  function choisirFichier(f) {
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(f);
    setApercu(f ? URL.createObjectURL(f) : null);
  }

  function ouvrirFormulaire() {
    setMessage(null);
    choisirFichier(null);
    setForm({ ...VIDE });
  }

  async function enregistrer() {
    setMessage(null);
    setEnCours(true);
    try {
      if (!form.nom.trim()) throw new Error("Donnez un nom au modèle.");
      if (!fichier) throw new Error("Choisissez l'affiche du modèle.");
      if (!TYPES_ACCEPTES.includes(fichier.type)) throw new Error("Format non accepté : JPEG, PNG ou WebP.");
      if (fichier.size > TAILLE_MAX) throw new Error("L'affiche doit faire 5 Mo au maximum.");
      const aEnvoyer = await preparerImagePourEnvoi(fichier);
      const signee = await appeler("POST", { action: "upload-url", contentType: aEnvoyer.type, taille: aEnvoyer.size });
      const { error } = await supabase.storage.from("modeles-documents").uploadToSignedUrl(signee.path, signee.token, aEnvoyer, { contentType: aEnvoyer.type });
      if (error) throw new Error("Le téléversement a échoué : " + error.message);
      await appeler("POST", {
        type: form.type,
        nom: form.nom,
        description: form.description,
        prix_xof: Number(form.prix_xof) || 0,
        message_whatsapp: form.message_whatsapp,
        path: signee.path,
        publier_story: form.publier_story,
      });
      await recharger();
      setForm(null);
      choisirFichier(null);
      setMessage({ ok: true, texte: form.publier_story ? "Modèle publié, avec sa story." : "Modèle publié." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function basculer(m) {
    setMessage(null);
    try {
      await appeler("PATCH", { id: m.id, actif: !m.actif });
      await recharger();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  async function changerPrix(m) {
    const saisie = window.prompt(`Nouveau prix de « ${m.nom} » en FCFA :`, String(m.prix_xof));
    if (saisie === null) return;
    setMessage(null);
    try {
      await appeler("PATCH", { id: m.id, prix_xof: Number(saisie) });
      await recharger();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  async function changerPhrase(m) {
    const saisie = window.prompt(
      `Phrase qui accompagne la demande WhatsApp de « ${m.nom} » (le lien de l'affiche est ajouté automatiquement après la phrase ; {nom} = nom du modèle ; vide = phrase par défaut) :`,
      m.message_whatsapp || ""
    );
    if (saisie === null) return;
    setMessage(null);
    try {
      await appeler("PATCH", { id: m.id, message_whatsapp: saisie });
      await recharger();
      setMessage({ ok: true, texte: "Phrase WhatsApp enregistrée." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  async function supprimer(m) {
    if (!window.confirm(`Supprimer le modèle « ${m.nom} » ${m.story_id ? "et sa story " : ""}? Cette action est définitive.`)) return;
    setMessage(null);
    try {
      await appeler("DELETE", { id: m.id });
      await recharger();
      setMessage({ ok: true, texte: "Modèle supprimé." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  if (chargement || !autorise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800">
          ← Administration
        </Link>
        <h1 className="text-xl font-black text-gray-900 mt-2">Modèles de documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les modèles de CV et de lettres de motivation de l&apos;onglet « Modèles de documents » du profil, dans l&apos;application. Aucun paiement :
          l&apos;utilisateur touche « Demander ce modèle » et WhatsApp s&apos;ouvre vers Facilité. Le prix ne sert qu&apos;à vous repérer.
        </p>
      </div>

      {message ? <p className={`text-sm font-bold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</p> : null}

      {!form ? (
        <button
          type="button"
          onClick={ouvrirFormulaire}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black cursor-pointer"
        >
          + Ajouter un modèle
        </button>
      ) : (
        <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900">Nouveau modèle</h2>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-700">Type de document</p>
            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Type de document">
              {Object.entries(LIBELLE_TYPE).map(([id, libelle]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={form.type === id}
                  onClick={() => setForm({ ...form, type: id, prix_xof: Object.values(PRIX_PAR_DEFAUT).includes(String(form.prix_xof)) ? PRIX_PAR_DEFAUT[id] : form.prix_xof })}
                  className={`text-left rounded-xl border px-3.5 py-3 cursor-pointer ${form.type === id ? "border-emerald-600 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <p className="text-sm font-extrabold text-gray-900">{libelle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-28 h-36 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs text-center">
              {apercu ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob)
                <img src={apercu} alt="Aperçu de l'affiche" className="w-full h-full object-cover" />
              ) : (
                "Aperçu"
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="modele-affiche" className="block text-xs font-bold text-gray-700">
                Affiche du modèle — JPEG, PNG ou WebP, 5 Mo maximum
              </label>
              <input
                id="modele-affiche"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => choisirFichier(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800 file:font-bold"
              />
              <p className="text-[11px] text-gray-500">Format conseillé : vertical (3:4), comme une page de document.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="modele-nom" className="block text-xs font-bold text-gray-700">
                Nom (60 caractères maximum)
              </label>
              <input
                id="modele-nom"
                type="text"
                value={form.nom}
                maxLength={60}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="CV Moderne"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="modele-prix" className="block text-xs font-bold text-gray-700">
                Prix indicatif (FCFA)
              </label>
              <input
                id="modele-prix"
                type="number"
                min="0"
                step="100"
                value={form.prix_xof}
                onChange={(e) => setForm({ ...form, prix_xof: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="modele-description" className="block text-xs font-bold text-gray-700">
              Description courte (facultative, 200 caractères maximum)
            </label>
            <input
              id="modele-description"
              type="text"
              value={form.description}
              maxLength={200}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="modele-phrase" className="block text-xs font-bold text-gray-700">
              Phrase qui accompagne la demande WhatsApp (facultative, 300 caractères maximum)
            </label>
            <textarea
              id="modele-phrase"
              rows={3}
              value={form.message_whatsapp}
              maxLength={300}
              placeholder="Bonjour, je souhaite le modèle {nom}."
              onChange={(e) => setForm({ ...form, message_whatsapp: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
            <p className="text-[11px] text-gray-500">
              Le lien de l&apos;affiche est ajouté automatiquement après la phrase. {"{nom}"} est remplacé par le nom du modèle. Laissez vide pour la phrase par défaut.
            </p>
          </div>

          <label htmlFor="modele-story" className="flex items-start gap-2.5 cursor-pointer">
            <input
              id="modele-story"
              type="checkbox"
              checked={form.publier_story}
              onChange={(e) => setForm({ ...form, publier_story: e.target.checked })}
              className="mt-0.5 w-4 h-4"
            />
            <span className="text-sm text-gray-800">
              <span className="font-bold">Publier aussi en story</span> — la même affiche apparaît dans les stories du fil, avec le bouton « Commander via WhatsApp ».
            </span>
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-black cursor-pointer"
            >
              {enCours ? "Publication…" : "Publier"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                choisirFichier(null);
              }}
              disabled={enCours}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      {modeles.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun modèle pour l&apos;instant.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {modeles.map((m) => (
            <li key={m.id} className={`bg-white rounded-2xl border border-gray-200 overflow-hidden ${m.actif ? "" : "opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- affiche publique Supabase */}
              <img src={m.image_url} alt={`Affiche ${m.nom}`} className="w-full aspect-[3/4] object-cover bg-gray-100" />
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-extrabold text-gray-900 truncate">{m.nom}</p>
                <p className="text-[11px] text-gray-500">
                  {LIBELLE_TYPE[m.type] || m.type} · {formaterPrix(m.prix_xof)}
                  {m.story_id ? " · en story" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onClick={() => basculer(m)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 cursor-pointer">
                    {m.actif ? "Masquer" : "Afficher"}
                  </button>
                  <button type="button" onClick={() => changerPrix(m)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 cursor-pointer">
                    Prix
                  </button>
                  <button type="button" onClick={() => changerPhrase(m)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 cursor-pointer">
                    Phrase WhatsApp
                  </button>
                  <button type="button" onClick={() => supprimer(m)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
