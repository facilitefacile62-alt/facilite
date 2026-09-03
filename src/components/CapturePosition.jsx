"use client";

// Relevé de position en dix secondes.
//
// POURQUOI DIX SECONDES ET NON UN CLIC
//
// La position d'une boutique est fixée une seule fois : le premier
// emplacement est offert, le déplacer est payant. Une position fausse coûte
// donc cher au commerçant — et pire, elle coûte à l'acheteur qui se déplace
// pour rien.
//
// Or `getCurrentPosition` renvoie souvent, dans la seconde, une position
// dérivée du réseau : plusieurs centaines de mètres d'erreur, parfois le
// central de l'opérateur. Le vrai relevé GPS arrive après quelques secondes,
// et se précise à mesure que l'appareil accroche des satellites.
//
// On écoute donc pendant dix secondes avec `watchPosition` et on garde la
// meilleure lecture. L'attente n'est pas décorative : elle divise
// couramment l'erreur par dix. Le décompte affiché sert à la rendre
// acceptable — sans lui, la personne croit que ça a planté.
//
// Le relevé s'arrête plus tôt si l'appareil annonce mieux que 15 m : à ce
// niveau, attendre n'apporte plus rien.

import { useEffect, useRef, useState } from "react";

const DUREE_S = 10;
const PRECISION_SUFFISANTE_M = 15;

/** Qualité lisible d'un relevé, pour que la personne sache s'il faut recommencer. */
function qualite(precisionM) {
  if (precisionM == null) return { texte: "inconnue", couleur: "text-gray-500", bonne: false };
  if (precisionM <= 20) return { texte: "excellente", couleur: "text-emerald-600 dark:text-emerald-400", bonne: true };
  if (precisionM <= 60) return { texte: "correcte", couleur: "text-emerald-600 dark:text-emerald-400", bonne: true };
  if (precisionM <= 150) return { texte: "moyenne", couleur: "text-amber-600 dark:text-amber-400", bonne: false };
  return { texte: "insuffisante", couleur: "text-red-600 dark:text-red-400", bonne: false };
}

/**
 * Générique par construction : la Marketplace et Mon activité partagent le
 * même relevé, mais pas le même vocabulaire ni la même règle commerciale —
 * une boutique a un déplacement payant, une activité (Point Wave, pharmacie)
 * n'en a aucun. Réutiliser le composant sans ces deux props affichait
 * « Boutique positionnée » et « déplacement de boutique payant » sur l'écran
 * Point Wave, où il n'existe ni boutique ni option payante.
 *
 * @param {(p:{latitude:number,longitude:number,precisionM:number}) => void} onReleve
 * @param {boolean} verrouillee  position déjà fixée : on n'en reprend pas
 * @param {string=} definieLe    date ISO du relevé existant
 * @param {string=} entite       ce qui est positionné, au féminin ("boutique", "activité")
 * @param {boolean=} optionPayante  existe-t-il un moyen payant de redéplacer ? (faux pour une activité)
 */
export default function CapturePosition({
  onReleve,
  verrouillee = false,
  definieLe = null,
  entite = "boutique",
  optionPayante = true,
}) {
  // État de l'autorisation, quand le navigateur sait le dire. Il permet de
  // parler juste : proposer « Autoriser » à quelqu'un qui a déjà refusé ne
  // sert à rien — la boîte de dialogue ne réapparaîtra pas, il faut passer
  // par les réglages du navigateur.
  const [autorisation, setAutorisation] = useState("inconnu");
  const [enCours, setEnCours] = useState(false);
  const [restant, setRestant] = useState(DUREE_S);
  const [meilleur, setMeilleur] = useState(null);
  const [erreur, setErreur] = useState("");
  const veille = useRef(null);
  const minuteur = useRef(null);
  const compte = useRef(null);

  const arreter = () => {
    if (veille.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(veille.current);
      veille.current = null;
    }
    clearTimeout(minuteur.current);
    clearInterval(compte.current);
  };

  // Un relevé en cours doit s'arrêter si la personne quitte la page : sinon le
  // GPS reste allumé et vide la batterie sans que rien ne l'utilise.
  useEffect(() => arreter, []);

  // L'API Permissions n'existe pas partout (Safari iOS notamment). Son absence
  // n'est pas une erreur : on reste sur « inconnu » et on explique quand même
  // ce qui va se passer.
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const p = await navigator.permissions.query({ name: "geolocation" });
        if (!vivant) return;
        setAutorisation(p.state);
        p.onchange = () => setAutorisation(p.state);
      } catch {
        // Navigateur sans API Permissions : rien à faire.
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const lancer = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErreur("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setErreur("");
    setMeilleur(null);
    setRestant(DUREE_S);
    setEnCours(true);

    let record = null;

    const conclure = () => {
      arreter();
      setEnCours(false);
      if (!record) {
        setErreur("Aucune position n'a pu être relevée. Sortez à l'air libre et réessayez.");
        return;
      }
      onReleve?.(record);
    };

    veille.current = navigator.geolocation.watchPosition(
      (p) => {
        const lu = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precisionM: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
        };
        // On ne garde que si c'est mieux. Une lecture plus récente mais moins
        // précise ne doit pas écraser un bon relevé.
        if (!record || (lu.precisionM != null && (record.precisionM == null || lu.precisionM < record.precisionM))) {
          record = lu;
          setMeilleur(lu);
        }
        if (lu.precisionM != null && lu.precisionM <= PRECISION_SUFFISANTE_M) conclure();
      },
      (err) => {
        arreter();
        setEnCours(false);
        setErreur(
          err.code === 1
            ? `Vous avez refusé la localisation. Autorisez-la pour positionner votre ${entite}.`
            : "Position indisponible. Vérifiez que le GPS est activé."
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: DUREE_S * 1000 }
    );

    compte.current = setInterval(() => setRestant((r) => Math.max(0, r - 1)), 1000);
    minuteur.current = setTimeout(conclure, DUREE_S * 1000);
  };

  if (verrouillee) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3">
        <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
          <i className="fa-solid fa-location-dot mr-2"></i>
          {entite.charAt(0).toUpperCase() + entite.slice(1)} positionnée
          {definieLe ? ` le ${new Date(definieLe).toLocaleDateString("fr-FR")}` : ""}
        </p>
        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
          {optionPayante
            ? "L'emplacement est fixé. Vous pouvez toujours corriger le nom, le quartier ou le numéro WhatsApp — seul un déplacement nécessite l'option payante."
            : "L'emplacement est fixé et ne peut plus être déplacé. Vous pouvez toujours changer de métier ou de statut."}
        </p>
      </div>
    );
  }

  const q = qualite(meilleur?.precisionM);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
      <p className="text-xs font-black text-gray-900 dark:text-white">
        <i className="fa-solid fa-location-crosshairs mr-2"></i>
        Positionner {entite === "boutique" ? "ma boutique" : `mon ${entite}`}
      </p>
      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
        Faites-le <strong>sur place</strong>, avec un <strong>téléphone</strong> : un ordinateur
        n&apos;a pas de GPS et devine sa position par le réseau, souvent à plusieurs centaines de
        mètres près. Le relevé dure dix secondes, et l&apos;emplacement ne pourra plus être changé
        {optionPayante ? " gratuitement" : ""}.
      </p>

      {/* Dire AVANT ce que le navigateur va demander.
          Une boîte de dialogue système qui surgit sans prévenir est le
          premier motif de refus : la personne ne comprend pas pourquoi une
          application d'emploi veut sa position, et elle refuse par réflexe.
          Annoncer la demande et sa raison change complètement le taux
          d'acceptation. */}
      {!enCours && (
        <div className="mt-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
          {autorisation === "granted" ? (
            <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
              <i className="fa-solid fa-circle-check mr-1.5"></i>
              Localisation déjà autorisée pour ce site — le relevé démarrera sans rien demander.
            </p>
          ) : autorisation === "denied" ? (
            <>
              <p className="text-[11px] font-black text-red-600 dark:text-red-400">
                <i className="fa-solid fa-ban mr-1.5"></i>
                La localisation est bloquée pour ce site
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Votre navigateur ne redemandera plus. Touchez le cadenas (ou l&apos;icône ⓘ) à côté
                de l&apos;adresse du site, puis autorisez la position, et revenez ici.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black text-gray-900 dark:text-white">
                <i className="fa-solid fa-shield-halved mr-1.5"></i>
                Votre téléphone va vous demander l&apos;autorisation
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Répondez <strong>Autoriser</strong>. La position sert uniquement à placer votre
                {" "}{entite} sur la carte, une seule fois. Nous ne suivons pas vos déplacements et
                elle n&apos;est jamais partagée en clair — les personnes qui vous cherchent voient
                seulement la distance qui les sépare de vous.
              </p>
            </>
          )}
        </div>
      )}

      {enCours ? (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-[#1877F2] tabular-nums">{restant}s</span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-[#1877F2] transition-all duration-1000 ease-linear"
                style={{ width: `${((DUREE_S - restant) / DUREE_S) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
            Restez immobile, à l&apos;air libre si possible.
            {meilleur?.precisionM != null && (
              <>
                {" "}
                Précision : <span className={`font-bold ${q.couleur}`}>{meilleur.precisionM} m</span>
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          {meilleur && (
            <div className="mt-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
              <p className="text-[11px] font-black text-gray-900 dark:text-white">
                <i className="fa-solid fa-location-dot mr-1.5"></i>
                Coordonnées relevées
              </p>
              {/* Les chiffres sont affichés parce qu'ils sont vérifiables : la
                  personne peut les coller dans une carte et voir si le point
                  tombe au bon endroit. Cinq décimales valent environ un
                  mètre — au-delà, ce serait du bruit. */}
              <p className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 mt-1 tabular-nums">
                {meilleur.latitude.toFixed(5)}, {meilleur.longitude.toFixed(5)}
              </p>
              <p className="text-[11px] mt-1.5">
                Précision <span className={`font-black ${q.couleur}`}>{q.texte}</span>
                {meilleur.precisionM != null ? ` — environ ${meilleur.precisionM} m` : ""}.
              </p>
              {!q.bonne && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5 leading-relaxed">
                  <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                  {meilleur.precisionM != null && meilleur.precisionM > 150
                    ? `Cette position ne vient pas du GPS mais du réseau — c'est ce qui arrive sur un ordinateur, ou à l'intérieur d'un bâtiment. Refaites le relevé depuis un téléphone, dehors, sur place.`
                    : `Sortez à l'air libre et refaites le relevé pour gagner en précision.`}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={lancer}
            className="mt-3 w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#1877F2] text-white text-xs font-black cursor-pointer"
          >
            <i className="fa-solid fa-satellite-dish mr-2"></i>
            {meilleur
              ? "Refaire le relevé"
              : autorisation === "granted"
                ? "Démarrer le relevé (10 s)"
                : "Autoriser et démarrer le relevé (10 s)"}
          </button>
        </>
      )}

      {erreur && <p className="text-[11px] font-bold text-red-600 mt-2">{erreur}</p>}
    </div>
  );
}
