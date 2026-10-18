"use client";

// Espace admin « Stories » : les pastilles rondes en tête du fil d'actualité
// (site et application). L'administrateur ajoute, modifie, réordonne, masque ou
// supprime ses stories ; tout passe par /api/admin/stories (contrôle admin côté
// serveur) — cette page ne fait que l'interface. Tant qu'aucune story n'est
// active, le fil garde son carrousel de modèles de CV.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];
const TAILLE_MAX = 5 * 1024 * 1024;
// Type « cv » : modèle de CV, bouton « Commander via WhatsApp ». Type « offre » : offre d'emploi, bouton « Postuler » avec le lien
// de l'offre (obligatoire) — une offre n'est jamais publiée sans ce bouton.
const LIBELLE_PAR_TYPE = { cv: "Commander via WhatsApp", offre: "Postuler" };
const VIDE = { id: null, type: "cv", titre: "", libelle_bouton: "Commander via WhatsApp", lien: "", bouton_visible: true, actif: true };

export default function AdminStoriesPage() {
  const [session, setSession] = useState(null);
  const [autorise, setAutorise] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [stories, setStories] = useState([]);

  const [form, setForm] = useState(null); // null = fermé
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const appeler = useCallback(
    async (methode, corps, jeton) => {
      const res = await fetch("/api/admin/stories", {
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

  const recharger = useCallback(
    async (jeton) => {
      const json = await appeler("GET", null, jeton);
      setStories(json.stories || []);
    },
    [appeler]
  );

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
        // ?nouvelle=1 (bouton « Ajouter une story » du tableau de bord) : ouvre directement le formulaire.
        if (new URLSearchParams(window.location.search).get("nouvelle") === "1") setForm({ ...VIDE });
        const res = await fetch("/api/admin/stories", { headers: { Authorization: `Bearer ${s.access_token}` } });
        const json = await res.json();
        if (res.ok) setStories(json.stories || []);
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  // Aperçu local du visuel choisi (l'URL est créée au choix du fichier, pas dans un effet).
  function choisirFichier(f) {
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(f);
    setApercu(f ? URL.createObjectURL(f) : null);
  }

  function ouvrirFormulaire(story) {
    setMessage(null);
    choisirFichier(null);
    setForm(story ? { id: story.id, type: story.type || "cv", titre: story.titre, libelle_bouton: story.libelle_bouton, lien: story.lien || "", bouton_visible: story.bouton_visible !== false, actif: story.actif, image_url: story.image_url } : { ...VIDE });
  }

  async function enregistrer() {
    setMessage(null);
    setEnCours(true);
    try {
      let path = null;
      if (fichier) {
        if (!TYPES_ACCEPTES.includes(fichier.type)) throw new Error("Format non accepté : JPEG, PNG ou WebP.");
        if (fichier.size > TAILLE_MAX) throw new Error("Le visuel doit faire 5 Mo au maximum.");
        const signee = await appeler("POST", { action: "upload-url", contentType: fichier.type, taille: fichier.size });
        const { error } = await supabase.storage.from("stories-media").uploadToSignedUrl(signee.path, signee.token, fichier, { contentType: fichier.type });
        if (error) throw new Error("Le téléversement a échoué : " + error.message);
        path = signee.path;
      }
      if (!form.titre.trim()) throw new Error("Donnez un titre à la story.");
      if (!form.id && !path) throw new Error("Choisissez le visuel de la story.");

      if (form.type === "offre" && !/^https?:\/\//i.test(form.lien.trim())) throw new Error("Une offre d'emploi doit avoir un bouton « Postuler » : indiquez le lien de l'offre (http:// ou https://).");
      const corps = { type: form.type, titre: form.titre, libelle_bouton: form.libelle_bouton, lien: form.lien, bouton_visible: form.bouton_visible, actif: form.actif, ...(path ? { path } : {}) };
      if (form.id) await appeler("PATCH", { ...corps, id: form.id });
      else await appeler("POST", corps);
      await recharger();
      setForm(null);
      setMessage({ ok: true, texte: form.id ? "Story modifiée." : "Story ajoutée : elle s'affiche en tête du fil." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function basculer(story) {
    setMessage(null);
    try {
      await appeler("PATCH", { id: story.id, actif: !story.actif });
      await recharger();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  async function deplacer(index, sens) {
    const autre = stories[index + sens];
    const courante = stories[index];
    if (!autre || !courante) return;
    setMessage(null);
    try {
      // On échange les rangs ; si deux stories ont le même rang, on les renumérote d'abord.
      const rangCourant = courante.ordre === autre.ordre ? index + 1 : courante.ordre;
      const rangAutre = courante.ordre === autre.ordre ? index + 1 + sens : autre.ordre;
      await appeler("PATCH", { id: courante.id, ordre: rangAutre });
      await appeler("PATCH", { id: autre.id, ordre: rangCourant });
      await recharger();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }

  async function supprimer(story) {
    if (!window.confirm(`Supprimer la story « ${story.titre} » ? Cette action est définitive.`)) return;
    setMessage(null);
    try {
      await appeler("DELETE", { id: story.id });
      await recharger();
      setMessage({ ok: true, texte: "Story supprimée." });
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

  async function importerModeles() {
    setEnCours(true);
    setMessage(null);
    try {
      await appeler("POST", { action: "importer-modeles" });
      await recharger();
      setMessage({ ok: true, texte: "Les 3 stories sont maintenant modifiables ci-dessous." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  const nbActives = stories.filter((s) => s.actif).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800">
          ← Administration
        </Link>
        <h1 className="text-xl font-black text-gray-900 mt-2">Stories</h1>
        <p className="text-sm text-gray-500 mt-1">
          Les pastilles rondes en tête du fil d&apos;actualité, sur le site et dans l&apos;application. Chaque story ouvre un visuel plein
          écran avec un bouton d&apos;action (par exemple « Commander via WhatsApp »).
        </p>
        {nbActives === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Aucune story active : le fil montre pour l&apos;instant les modèles de CV. Dès qu&apos;une story est active, elle les remplace.
          </p>
        ) : null}
      </div>

      {message ? <p className={`text-sm font-bold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</p> : null}

      {!form ? (
        <button
          type="button"
          onClick={() => ouvrirFormulaire(null)}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black cursor-pointer"
        >
          + Ajouter une story
        </button>
      ) : (
        <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-gray-900">{form.id ? "Modifier la story" : "Nouvelle story"}</h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-28 flex-shrink-0 space-y-2">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs text-center">
                {apercu || form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) ou visuel public Supabase
                  <img src={apercu || form.image_url} alt="Aperçu de la story" className="w-full h-full object-cover" />
                ) : (
                  "Aperçu"
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="story-visuel" className="block text-xs font-bold text-gray-700">
                Visuel {form.id ? "(laisser vide pour garder l'actuel)" : ""} — JPEG, PNG ou WebP, 5 Mo maximum
              </label>
              <input
                id="story-visuel"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => choisirFichier(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800 file:font-bold"
              />
              <p className="text-[11px] text-gray-500">Format conseillé : vertical (9:16), comme une story.</p>
            </div>
          </div>

          {/* Type : modèle de CV (WhatsApp) ou offre d'emploi (Postuler) */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-700">Type de story</p>
            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Type de story">
              {[
                { id: "cv", titre: "Modèle de CV", detail: "Bouton « Commander via WhatsApp » (numéro de Facilité)" },
                { id: "offre", titre: "Offre d'emploi", detail: "Bouton « Postuler » obligatoire, avec le lien de l'offre" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.id}
                  onClick={() =>
                    setForm({
                      ...form,
                      type: t.id,
                      libelle_bouton: Object.values(LIBELLE_PAR_TYPE).includes(form.libelle_bouton) ? LIBELLE_PAR_TYPE[t.id] : form.libelle_bouton,
                      bouton_visible: t.id === "offre" ? true : form.bouton_visible,
                    })
                  }
                  className={`text-left rounded-xl border px-3.5 py-3 cursor-pointer ${form.type === t.id ? "border-emerald-600 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <p className="text-sm font-extrabold text-gray-900">{t.titre}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="story-titre" className="block text-xs font-bold text-gray-700">
              Titre (40 caractères maximum)
            </label>
            <input
              id="story-titre"
              type="text"
              value={form.titre}
              maxLength={40}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="CV Moderne"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="story-bouton" className="block text-xs font-bold text-gray-700">
                Texte du bouton
              </label>
              <input
                id="story-bouton"
                type="text"
                value={form.libelle_bouton}
                maxLength={40}
                onChange={(e) => setForm({ ...form, libelle_bouton: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="story-lien" className="block text-xs font-bold text-gray-700">
                {form.type === "offre" ? "Lien de l'offre (obligatoire)" : "Lien du bouton (ou numéro WhatsApp)"}
              </label>
              <input
                id="story-lien"
                type="text"
                value={form.lien}
                onChange={(e) => setForm({ ...form, lien: e.target.value })}
                placeholder={form.type === "offre" ? "https://ffacilite.com/offres/…" : "+221 77 140 08 32  ou  https://…"}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 -mt-2">
            {form.type === "offre"
              ? "Une offre d'emploi est toujours accompagnée de son bouton « Postuler » : le lien de l'offre est obligatoire."
              : "Un numéro de téléphone devient automatiquement un lien WhatsApp. Sans lien, l'application ouvre le WhatsApp de Facilité."}
          </p>

          {/* Interrupteur : bouton (et numéro / lien) visible ou caché dans la story — jamais caché pour une offre */}
          <div className={`flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3 ${form.type === "offre" ? "hidden" : ""}`}>
            <div>
              <p className="text-sm font-extrabold text-gray-900">Bouton et numéro visibles</p>
              <p className="text-[11px] text-gray-500">
                {form.bouton_visible ? "Le bouton s'affiche en bas de la story." : "Le bouton est caché : la story s'affiche sans bouton ni numéro."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.bouton_visible}
              aria-label="Bouton et numéro visibles"
              onClick={() => setForm({ ...form, bouton_visible: !form.bouton_visible })}
              className={`relative w-12 h-7 rounded-full transition flex-shrink-0 cursor-pointer ${form.bouton_visible ? "bg-emerald-500" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${form.bouton_visible ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer w-fit">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} className="w-4 h-4" />
            Story visible
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer"
            >
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              disabled={enCours}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      {stories.length === 0 && !form ? (
        <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-extrabold text-gray-900">Stories affichées en ce moment</h2>
          <p className="text-xs text-gray-500">
            Le fil montre aujourd&apos;hui les 3 modèles de CV ci-dessous. Ils sont intégrés au site : on ne peut ni les modifier, ni les masquer, ni
            les supprimer tant qu&apos;ils ne sont pas transformés en stories.
          </p>
          <div className="flex items-center gap-4">
            {["Moderne", "Minimaliste", "Classique"].map((nom) => (
              <div key={nom} className="flex flex-col items-center gap-1 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element -- visuel du site */}
                <img src="/affiche_cv_pro.jpg" alt={`Modèle ${nom}`} className="w-14 h-14 rounded-full object-cover object-top border border-gray-200" />
                <span className="text-[10px] font-bold text-gray-700">{nom}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={importerModeles}
            disabled={enCours}
            className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-black disabled:opacity-60 cursor-pointer"
          >
            {enCours ? "Transformation…" : "Les rendre modifiables"}
          </button>
        </section>
      ) : null}

      {/* Liste */}
      <section className="space-y-2">
        {stories.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-5">Aucune story pour le moment.</p>
        ) : (
          stories.map((s, i) => (
            <div key={s.id} className={`bg-white rounded-2xl border p-3 flex items-center gap-3 ${s.actif ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- visuel public Supabase */}
                <img src={s.image_url} alt={s.titre} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-gray-900 truncate">
                  {s.titre}
                  <span className={`ml-2 align-middle text-[10px] font-black px-1.5 py-0.5 rounded-full ${s.type === "offre" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {s.type === "offre" ? "Offre" : "Modèle de CV"}
                  </span>
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {s.bouton_visible === false ? "Bouton caché" : s.libelle_bouton}
                  {s.bouton_visible !== false ? (s.lien ? ` → ${s.lien}` : " · sans lien") : ""}
                </p>
                <p className="text-[11px] mt-0.5">
                  <span className={s.actif ? "text-emerald-700 font-bold" : "text-gray-500 font-bold"}>{s.actif ? "Visible" : "Masquée"}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter" className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30 cursor-pointer">
                  ↑
                </button>
                <button type="button" onClick={() => deplacer(i, 1)} disabled={i === stories.length - 1} aria-label="Descendre" className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30 cursor-pointer">
                  ↓
                </button>
                <button type="button" onClick={() => basculer(s)} className="px-2.5 h-8 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  {s.actif ? "Masquer" : "Afficher"}
                </button>
                <button type="button" onClick={() => ouvrirFormulaire(s)} className="px-2.5 h-8 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Modifier
                </button>
                <button type="button" onClick={() => supprimer(s)} className="px-2.5 h-8 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer">
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
