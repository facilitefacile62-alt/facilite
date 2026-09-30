"use client";
/* eslint-disable @next/next/no-img-element -- aperçu local d'un fichier tout juste choisi (URL.createObjectURL), jamais un asset à optimiser par next/image */

// Étape 2/2 : l'action réelle de scan/import, selon le type choisi sur
// /bienvenue/document. Deux chemins RÉELLEMENT différents (pas une seule
// détection automatique comme /profil/page.js, l'utilisateur a déjà dit ce
// qu'il scanne) :
//   - cni / passeport -> /api/profil/scan-identity-document (100% éphémère,
//     jamais de fichier conservé, voir ce fichier) -> met à jour
//     profiles.full_name / profiles.quartier directement.
//   - cv -> upload réel dans le bucket "resumes" + /api/parse-document,
//     comme le fait déjà /profil/page.js, puis une ligne resumes (type
//     "imported") minimale — pas la modale de relecture complète de
//     /profil, volontairement plus léger pour un premier pas rapide.
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const LIBELLES = {
  cni: { titre: "Scanner votre CNI", accept: "image/*", capture: "environment", icone: "fa-id-card" },
  passeport: { titre: "Scanner votre passeport", accept: "image/*", capture: "environment", icone: "fa-passport" },
  cv: { titre: "Importer votre CV", accept: ".pdf,.doc,.docx,image/*", capture: undefined, icone: "fa-file-lines" },
};

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, user } = useAuth();

  const type = LIBELLES[searchParams.get("type")] ? searchParams.get("type") : "cv";
  const libelle = LIBELLES[type];
  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);

  const choisirFichier = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErreur("");
    setFichier(f);
    if (f.type.startsWith("image/")) setApercu(URL.createObjectURL(f));
    else setApercu(null);
  };

  const analyser = async () => {
    if (!fichier || !user?.id) return;
    setEnCours(true);
    setErreur("");

    try {
      if (type === "cni" || type === "passeport") {
        const form = new FormData();
        form.append("file", fichier);
        const res = await fetch("/api/profil/scan-identity-document", {
          method: "POST",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          body: form,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.isIdentityDocument) {
          setErreur(data.error || "Document non reconnu comme une pièce d'identité. Réessayez avec une photo plus nette.");
          setEnCours(false);
          return;
        }

        const fullName = [data.prenom, data.nom].filter(Boolean).join(" ").trim();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            ...(fullName ? { full_name: fullName } : {}),
            ...(data.quartier ? { quartier: data.quartier } : {}),
          })
          .eq("id", user.id);

        if (updateError) {
          setErreur("Document lu, mais l'enregistrement sur votre profil a échoué. Vous pourrez réessayer depuis votre profil.");
          setEnCours(false);
          return;
        }
      } else {
        const ext = fichier.name.split(".").pop().toLowerCase();
        const filePath = `${user.id}/documents/onboarding_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, fichier, { upsert: true });
        if (uploadError) {
          setErreur("Le dépôt du fichier a échoué. Réessayez.");
          setEnCours(false);
          return;
        }

        const parseForm = new FormData();
        parseForm.append("file", fichier);
        const parseRes = await fetch("/api/parse-document", {
          method: "POST",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          body: parseForm,
        });
        const parseData = await parseRes.json().catch(() => ({}));

        // Le fichier reste rattaché même si l'analyse échoue ou est
        // dégradée (repli regex, voir /api/parse-document) : mieux qu'un
        // CV perdu pour un premier pas d'inscription.
        const { error: insertError } = await supabase.from("resumes").insert({
          user_id: user.id,
          title: "CV importé à l'inscription",
          type: "imported",
          file_url: filePath,
          status: "completed",
          content: parseData?.success ? { extractedFields: parseData.fields || parseData.data || {}, analyzedAt: new Date().toISOString() } : {},
        });

        if (insertError) {
          setErreur("Fichier déposé, mais son enregistrement a échoué. Vous pourrez le réimporter depuis votre profil.");
          setEnCours(false);
          return;
        }
      }

      setSucces(true);
      setTimeout(() => router.replace(safeRedirect), 1400);
    } catch {
      setErreur("Une erreur est survenue. Réessayez, ou passez cette étape.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-4 py-8">
      <main className="w-full max-w-[440px] animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-5">
          {succes ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 text-2xl">
                <i className="fa-solid fa-check"></i>
              </div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white">C&apos;est enregistré !</h1>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Direction votre accueil…</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-[#E8FAF0] dark:bg-emerald-950/60 flex items-center justify-center text-[#10E688] text-2xl">
                <i className={`fa-solid ${libelle.icone}`}></i>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">{libelle.titre}</h1>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl py-8 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition">
                {apercu ? (
                  <img src={apercu} alt="Aperçu" className="max-h-40 rounded-xl object-contain" />
                ) : fichier ? (
                  <>
                    <i className="fa-solid fa-file-circle-check text-emerald-600 text-2xl"></i>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-[280px]">{fichier.name}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-camera text-gray-400 text-2xl"></i>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Cliquez ou glissez votre fichier ici</span>
                  </>
                )}
                <input
                  type="file"
                  accept={libelle.accept}
                  capture={libelle.capture}
                  onChange={choisirFichier}
                  className="hidden"
                />
              </label>

              {erreur && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                  {erreur}
                </p>
              )}

              <button
                type="button"
                onClick={analyser}
                disabled={!fichier || enCours}
                className="w-full px-5 py-3.5 bg-[#10E688] hover:bg-[#0fd67e] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] rounded-full shadow-md transition-all cursor-pointer font-black text-sm text-gray-950 flex items-center justify-center gap-2"
              >
                {enCours ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Analyse en cours…</span>
                  </>
                ) : (
                  <span>Valider</span>
                )}
              </button>

              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80">
                <Link
                  href={safeRedirect}
                  className="inline-block text-[12px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider transition-colors py-1"
                >
                  Passer cette étape ›
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950" />}>
      <ScannerContent />
    </Suspense>
  );
}
