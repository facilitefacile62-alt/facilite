"use client";

// Espace admin « Vidéo d'aide » : la vidéo « comment postuler » affichée sous
// toutes les publications (site et application). L'administrateur téléverse un
// fichier ou colle un lien YouTube ; tout passe par /api/admin/aide-video
// (contrôle admin côté serveur) — cette page ne fait que l'interface.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TYPES_ACCEPTES = ["video/mp4", "video/quicktime", "video/webm"];
const TAILLE_MAX = 100 * 1024 * 1024;

export default function AdminAideVideoPage() {
  const [session, setSession] = useState(null);
  const [autorise, setAutorise] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [video, setVideo] = useState(null);

  const [mode, setMode] = useState("fichier");
  const [fichier, setFichier] = useState(null);
  const [lienYoutube, setLienYoutube] = useState("");
  const [duree, setDuree] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const appeler = useCallback(
    async (methode, corps, jeton) => {
      const res = await fetch("/api/admin/aide-video", {
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
        const res = await fetch("/api/admin/aide-video", { headers: { Authorization: `Bearer ${s.access_token}` } });
        const json = await res.json();
        if (res.ok) {
          setVideo(json.video);
          setDuree(json.video?.duree || "");
          if (json.video?.type === "youtube") setMode("youtube");
        }
      } finally {
        setChargement(false);
      }
    })();
  }, []);

  // Interrupteur « numéro WhatsApp visible » : enregistré dès le clic.
  async function basculerWhatsapp() {
    const suivant = video?.whatsapp_visible === false;
    setEnCours(true);
    setMessage(null);
    try {
      const json = await appeler("PATCH", { whatsapp_visible: suivant });
      setVideo(json.video);
      setMessage({ ok: true, texte: suivant ? "Le numéro WhatsApp est visible." : "Le numéro WhatsApp est caché." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function enregistrer() {
    setMessage(null);
    setEnCours(true);
    try {
      let corps;
      if (mode === "fichier") {
        if (!fichier) throw new Error("Choisissez d'abord un fichier vidéo.");
        if (!TYPES_ACCEPTES.includes(fichier.type)) throw new Error("Format non accepté : MP4, MOV ou WebM.");
        if (fichier.size > TAILLE_MAX) throw new Error("La vidéo doit faire 100 Mo au maximum.");
        const { path, token } = await appeler("POST", { contentType: fichier.type, taille: fichier.size });
        const { error } = await supabase.storage.from("aide-videos").uploadToSignedUrl(path, token, fichier, { contentType: fichier.type });
        if (error) throw new Error("Le téléversement a échoué : " + error.message);
        corps = { type: "fichier", path, duree };
      } else {
        if (!lienYoutube.trim()) throw new Error("Collez le lien de la vidéo YouTube.");
        corps = { type: "youtube", youtube: lienYoutube, duree };
      }
      const { video: v } = await appeler("PUT", corps);
      setVideo(v);
      setFichier(null);
      setLienYoutube("");
      setMessage({ ok: true, texte: "Vidéo d'aide enregistrée : elle s'affiche déjà sous les publications." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    if (!window.confirm("Retirer la vidéo d'aide ? Les visiteurs verront « La vidéo d'aide arrive bientôt ».")) return;
    setMessage(null);
    setEnCours(true);
    try {
      const { video: v } = await appeler("PUT", { type: "aucune" });
      setVideo(v);
      setDuree("");
      setMessage({ ok: true, texte: "Vidéo d'aide retirée." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  if (chargement || !autorise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  const actuelle = video?.type && video.type !== "aucune";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800">
          ← Administration
        </Link>
        <h1 className="text-xl font-black text-gray-900 mt-2">Vidéo d&apos;aide</h1>
        <p className="text-sm text-gray-500 mt-1">
          La vidéo « comment postuler » : la même s&apos;ouvre sous toutes les publications, sur le site et dans l&apos;application, quand on
          appuie sur le bouton <strong>Aide</strong>.
        </p>
      </div>

      {/* Numéro WhatsApp visible ou caché sur la page d'aide */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-gray-900">Numéro WhatsApp visible</h2>
          <p className="text-xs text-gray-500 mt-1">
            {video?.whatsapp_visible === false
              ? "Caché : la page d'aide n'affiche plus le numéro ni le lien « Nous contacter », sur le site et dans l'application. Personne ne peut vous écrire depuis cette page."
              : "Visible : la page d'aide propose le numéro +221 77 140 08 32 et le lien « Nous contacter », sur le site et dans l'application."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={video?.whatsapp_visible !== false}
          aria-label="Numéro WhatsApp visible"
          disabled={enCours || !video}
          onClick={basculerWhatsapp}
          className={`relative w-12 h-7 rounded-full transition flex-shrink-0 cursor-pointer disabled:opacity-60 ${video?.whatsapp_visible !== false ? "bg-emerald-500" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${video?.whatsapp_visible !== false ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </section>

      {/* Vidéo actuelle */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-extrabold text-gray-900">Vidéo actuelle</h2>
        {!actuelle ? (
          <p className="text-sm text-gray-500">Aucune vidéo pour le moment : les visiteurs voient « La vidéo d&apos;aide arrive bientôt ».</p>
        ) : (
          <>
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              {video.type === "fichier" ? (
                <video className="w-full h-full" src={video.url} controls playsInline preload="metadata" />
              ) : (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}`}
                  title="Vidéo d'aide"
                  allow="encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>
                {video.type === "fichier" ? "Fichier vidéo" : "Lien YouTube"}
                {video.duree ? ` · ${video.duree}` : ""}
                {video.updated_at ? ` · modifiée le ${new Date(video.updated_at).toLocaleDateString("fr-FR")}` : ""}
              </span>
              <button
                type="button"
                onClick={retirer}
                disabled={enCours}
                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              >
                Retirer la vidéo
              </button>
            </div>
          </>
        )}
      </section>

      {/* Changer la vidéo */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-gray-900">{actuelle ? "Remplacer la vidéo" : "Ajouter la vidéo"}</h2>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit">
          {[
            ["fichier", "Téléverser un fichier"],
            ["youtube", "Lien YouTube"],
          ].map(([id, libelle]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                mode === id ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>

        {mode === "fichier" ? (
          <div className="space-y-2">
            <label htmlFor="aide-fichier" className="block text-xs font-bold text-gray-700">
              Fichier vidéo (MP4, MOV ou WebM — 100 Mo maximum)
            </label>
            <input
              id="aide-fichier"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFichier(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800 file:font-bold"
            />
            {fichier ? <p className="text-xs text-gray-500">{fichier.name} · {(fichier.size / 1048576).toFixed(1)} Mo</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="aide-youtube" className="block text-xs font-bold text-gray-700">
              Lien de la vidéo YouTube
            </label>
            <input
              id="aide-youtube"
              type="url"
              value={lienYoutube}
              onChange={(e) => setLienYoutube(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="aide-duree" className="block text-xs font-bold text-gray-700">
            Durée affichée (facultatif)
          </label>
          <input
            id="aide-duree"
            type="text"
            value={duree}
            onChange={(e) => setDuree(e.target.value)}
            placeholder="2 min"
            maxLength={20}
            className="w-40 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>

        {message ? (
          <p className={`text-sm font-bold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</p>
        ) : null}

        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer"
        >
          {enCours ? "Envoi en cours…" : "Enregistrer la vidéo"}
        </button>
      </section>
    </div>
  );
}
