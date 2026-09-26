"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  obtenirModuleEtQuizFormationCv,
  obtenirMaProgressionModuleFormationCv,
  marquerModuleVuFormationCv,
  soumettreQuizFormationCv,
} from "@/lib/formationCvData";

// Accès temporairement ouvert à tout compte connecté (migration
// 20260925160000) — pas de vérification paye ici.
export default function ModuleFormationCvClient({ moduleId }) {
  const { user } = useAuth();

  const [chargement, setChargement] = useState(true);
  const [module, setModule] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [progression, setProgression] = useState(null);
  const [erreur, setErreur] = useState("");

  const [videoEnCours, setVideoEnCours] = useState(false);
  const [erreurVideo, setErreurVideo] = useState("");

  const [reponses, setReponses] = useState({}); // { [question_id]: choix_index }
  const [quizEnCours, setQuizEnCours] = useState(false);
  const [erreurQuiz, setErreurQuiz] = useState("");
  const [resultatQuiz, setResultatQuiz] = useState(null); // { score_pourcent, reussi, certifie }

  const chargerTout = useCallback(async () => {
    if (!user?.id) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur("");
    try {
      const [{ module: monModule, questions: mesQuestions }, maProgression] = await Promise.all([
        obtenirModuleEtQuizFormationCv(moduleId),
        obtenirMaProgressionModuleFormationCv(moduleId),
      ]);
      setModule(monModule);
      setQuestions(mesQuestions);
      setProgression(maProgression);
    } catch (err) {
      setErreur(err.message || "Impossible de charger ce module.");
    } finally {
      setChargement(false);
    }
  }, [user, moduleId]);

  useEffect(() => {
    queueMicrotask(() => chargerTout());
  }, [chargerTout]);

  const marquerVu = async () => {
    setErreurVideo("");
    setVideoEnCours(true);
    try {
      await marquerModuleVuFormationCv(moduleId);
      setProgression((p) => ({ ...(p || {}), vu: true, vu_le: new Date().toISOString() }));
    } catch (err) {
      setErreurVideo(err.message || "Impossible d'enregistrer votre progression.");
    } finally {
      setVideoEnCours(false);
    }
  };

  const choisirReponse = (questionId, choixIndex) => {
    setReponses((r) => ({ ...r, [questionId]: choixIndex }));
  };

  const toutesLesQuestionsRepondues = questions.length > 0 && questions.every((q) => reponses[q.id] !== undefined);

  const validerQuiz = async () => {
    setErreurQuiz("");
    setQuizEnCours(true);
    try {
      const payload = questions.map((q) => ({ question_id: q.id, choix_index: reponses[q.id] }));
      const resultat = await soumettreQuizFormationCv(moduleId, payload);
      setResultatQuiz(resultat);
      setProgression((p) => ({
        ...(p || {}),
        vu: true,
        quiz_score_pourcent: resultat.score_pourcent,
        quiz_reussi: resultat.reussi,
        quiz_tente_le: new Date().toISOString(),
      }));
    } catch (err) {
      setErreurQuiz(err.message || "Impossible de soumettre le quiz.");
    } finally {
      setQuizEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/formation-redaction-cv/modules"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-6"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>Modules</span>
        </Link>

        {!user ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Connectez-vous pour accéder à ce module.</p>
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
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{module.titre}</h1>
              {module.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{module.description}</p>
              )}
            </div>

            {/* Leçon — vraie vidéo (pas encore de module qui en a une),
                sinon texte de leçon en attendant (contenu_texte), sinon
                simple placeholder "à venir". */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
              {module.contenu_texte ? (
                <div className="p-4 sm:p-5 flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
                  <i className="fa-solid fa-clapperboard text-amber-600 dark:text-amber-400 text-sm"></i>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Vidéo à venir — en attendant, lisez la leçon ci-dessous.
                  </p>
                </div>
              ) : (
                <div className="aspect-video bg-gray-900 dark:bg-black flex flex-col items-center justify-center gap-2 text-gray-400">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                    <i className="fa-solid fa-play text-xl text-white ml-1"></i>
                  </div>
                  <p className="text-xs font-bold text-gray-300">Vidéo à venir</p>
                </div>
              )}

              {module.contenu_texte && (
                <p className="p-4 sm:p-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {module.contenu_texte}
                </p>
              )}

              <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {module.contenu_texte
                    ? "Le contenu vidéo de ce module n'est pas encore en ligne."
                    : "Aucun contenu n'est encore disponible pour ce module."}
                </p>
                {progression?.vu ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shrink-0">
                    <i className="fa-solid fa-circle-check"></i>
                    {module.contenu_texte ? "Leçon lue" : "Vu"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={marquerVu}
                    disabled={videoEnCours}
                    className="shrink-0 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold hover:bg-black dark:hover:bg-gray-200 disabled:opacity-60 transition"
                  >
                    {videoEnCours ? "…" : module.contenu_texte ? "J'ai terminé cette leçon" : "J'ai visionné cette vidéo"}
                  </button>
                )}
              </div>
              {erreurVideo && (
                <p className="text-xs text-red-600 dark:text-red-400 px-4 sm:px-5 pb-4">{erreurVideo}</p>
              )}
            </div>

            {/* Quiz */}
            {questions.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-5 sm:p-6 space-y-6">
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">Quiz</h2>

                {(resultatQuiz || progression?.quiz_score_pourcent != null) && (
                  <div
                    className={`rounded-2xl p-4 border ${
                      (resultatQuiz?.reussi ?? progression?.quiz_reussi)
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50"
                    }`}
                  >
                    <p
                      className={`text-sm font-black ${
                        (resultatQuiz?.reussi ?? progression?.quiz_reussi)
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      Score : {resultatQuiz?.score_pourcent ?? progression?.quiz_score_pourcent}% —{" "}
                      {(resultatQuiz?.reussi ?? progression?.quiz_reussi) ? "Quiz réussi" : "Quiz à refaire (seuil 70%)"}
                    </p>
                    {resultatQuiz?.certifie && (
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-award"></i>
                        Félicitations, vous êtes certifié « Rédacteur CV » !
                      </p>
                    )}
                  </div>
                )}

                {questions.map((q, index) => (
                  <div key={q.id} className="space-y-2.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {index + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {(q.choix || []).map((choix, choixIndex) => (
                        <label
                          key={choixIndex}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer text-sm transition ${
                            reponses[q.id] === choixIndex
                              ? "border-[#085041] bg-emerald-50 dark:bg-emerald-950/30 text-gray-900 dark:text-white"
                              : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={reponses[q.id] === choixIndex}
                            onChange={() => choisirReponse(q.id, choixIndex)}
                            className="accent-[#085041]"
                          />
                          <span>{choix}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={validerQuiz}
                  disabled={!toutesLesQuestionsRepondues || quizEnCours}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#085041] hover:bg-[#0a6252] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm transition"
                >
                  {quizEnCours ? "Envoi…" : "Valider le quiz"}
                </button>
                {erreurQuiz && <p className="text-xs text-red-600 dark:text-red-400 text-center">{erreurQuiz}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
