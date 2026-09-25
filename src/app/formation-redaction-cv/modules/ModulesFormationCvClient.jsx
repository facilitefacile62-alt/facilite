"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { obtenirModulesFormationCv, obtenirMaProgressionFormationCv } from "@/lib/formationCvData";

// Accès temporairement ouvert à tout compte connecté (demande explicite de
// l'utilisateur, migration 20260925160000) : pas de vérification paye ici,
// ni côté page ni côté RLS pour l'instant — le champ reste prêt à être
// réactivé comme condition d'accès plus tard.
export default function ModulesFormationCvClient() {
  const { user } = useAuth();

  const [chargement, setChargement] = useState(true);
  const [modules, setModules] = useState([]);
  const [progression, setProgression] = useState([]);
  const [erreur, setErreur] = useState("");

  const chargerTout = useCallback(async () => {
    if (!user?.id) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur("");
    try {
      const [listeModules, maProgression] = await Promise.all([
        obtenirModulesFormationCv(),
        obtenirMaProgressionFormationCv(),
      ]);
      setModules(listeModules);
      setProgression(maProgression);
    } catch (err) {
      setErreur(err.message || "Impossible de charger les modules.");
    } finally {
      setChargement(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => chargerTout());
  }, [chargerTout]);

  const progressionParModule = new Map(progression.map((p) => [p.module_id, p]));
  const totalReussis = modules.filter((m) => progressionParModule.get(m.id)?.quiz_reussi).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/formation-redaction-cv"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-6"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>Formation Rédaction de CV</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Modules</h1>
          {modules.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {totalReussis} / {modules.length} module{modules.length > 1 ? "s" : ""} validé{totalReussis > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {!user ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Connectez-vous pour accéder aux modules.</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 rounded-2xl bg-[#085041] hover:bg-[#0a6252] text-white font-extrabold text-sm transition"
            >
              Se connecter
            </Link>
          </div>
        ) : chargement ? (
          <div className="text-center py-10">
            <span className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin inline-block"></span>
          </div>
        ) : erreur ? (
          <p className="text-xs text-red-600 dark:text-red-400 text-center py-4">{erreur}</p>
        ) : modules.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun module publié pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, index) => {
              const p = progressionParModule.get(module.id);
              const vu = p?.vu === true;
              const quizTente = p?.quiz_score_pourcent != null;

              return (
                <Link
                  key={module.id}
                  href={`/formation-redaction-cv/modules/${module.id}`}
                  className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-5 sm:p-6 flex items-start gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      p?.quiz_reussi
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {p?.quiz_reussi ? <i className="fa-solid fa-check"></i> : index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">{module.titre}</h2>
                    {module.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{module.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          vu
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {vu ? "Vu" : "Pas encore vu"}
                      </span>
                      {quizTente && (
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            p.quiz_reussi
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          Quiz {p.quiz_reussi ? "réussi" : "à refaire"} · {p.quiz_score_pourcent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <i className="fa-solid fa-chevron-right text-xs text-gray-300 dark:text-gray-600 shrink-0 mt-2"></i>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
