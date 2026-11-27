import Link from "next/link";
import { MESSAGE_CONTACT_EXTERNE } from "@/lib/contactExterne";

// Affiché à la place du formulaire quand Facilité ne peut pas transmettre la candidature (offre sans adresse e-mail d'employeur).
const ICONES = { lien: "fa-solid fa-arrow-up-right-from-square", whatsapp: "fa-brands fa-whatsapp", telephone: "fa-solid fa-phone", email: "fa-solid fa-envelope" };

export default function CandidatureDirecte({ titre, societe, moyens = [], offreId = null, onFermer = null }) {
  return (
    <div className="text-center py-4 space-y-4" data-testid="candidature-directe">
      <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-xl border border-amber-100">
        <i className="fa-solid fa-building"></i>
      </div>
      <h3 className="text-lg font-black text-gray-900 dark:text-white">Postulez directement chez l&apos;employeur</h3>
      <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm mx-auto leading-relaxed">
        L&apos;offre{titre ? <strong className="text-gray-900 dark:text-white"> {titre}</strong> : ""}
        {societe ? ` (${societe})` : ""} n&apos;a pas d&apos;adresse e-mail de candidature : <strong>Facilité ne peut pas transmettre votre dossier.</strong>
      </p>

      {moyens.length > 0 ? (
        <>
          <div className="space-y-2 max-w-sm mx-auto">
            {moyens.map((m) => (
              <a
                key={m.url}
                href={m.url}
                target={m.type === "lien" || m.type === "whatsapp" ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`w-full py-3.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 break-all ${
                  m.type === "whatsapp" ? "bg-[#25D366] text-white" : "bg-emerald-600 text-white"
                }`}
              >
                <i className={ICONES[m.type]}></i>
                <span>{m.libelle}</span>
              </a>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">{MESSAGE_CONTACT_EXTERNE}</p>
        </>
      ) : (
        <p className="text-xs font-bold text-gray-700 dark:text-gray-200 max-w-sm mx-auto leading-relaxed">
          Cette offre n&apos;indique aucun moyen de candidature. Regardez son affiche et sa description.
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        {offreId && (
          <Link href={`/offres/${offreId}`} className="text-xs font-extrabold text-emerald-700 underline">
            Voir l&apos;offre complète
          </Link>
        )}
        {onFermer && (
          <button type="button" onClick={onFermer} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-extrabold cursor-pointer">
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
