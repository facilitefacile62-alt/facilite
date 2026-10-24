import { formaterCompteARebours, texteValidite } from "../lib/validiteQr";

/**
 * Éléments du QR de la page de facturation (jetons Premium Locaux) — maquette du 24/10/2026, la même que dans l'application :
 *  - QrPaiementCarte : le QR dans son cadre blanc, « N jetons · PRIX FCFA » et la phrase de scan, DANS la carte ;
 *  - BarrePaiementFixe : barre fixe en bas de l'écran, seulement pendant le QR — « Paiement valable 5 minutes · il reste m:ss », les boutons
 *    « Ouvrir Orange Money » (orange) et « Ouvrir MAXIT » (noir) côte à côte, puis « En attente de confirmation du paiement… ».
 * Le QR ne reste affiché que tant que le paiement n'est ni confirmé ni expiré (la page retire ces deux éléments dans les deux cas).
 */
export function QrPaiementCarte({ paiement }) {
  return (
    <div className="flex flex-col items-center text-center" data-testid="paiement-en-attente">
      {paiement.qrCodeBase64 && (
        <div className="bg-white rounded-2xl border border-gray-200 dark:border-gray-300 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${paiement.qrCodeBase64}`}
            alt="QR code de paiement Orange Money"
            data-testid="qr-paiement"
            className="w-40 h-40 sm:w-48 sm:h-48"
          />
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3" data-testid="resume-paiement">
        {paiement.quantiteJetons} jeton{paiement.quantiteJetons > 1 ? "s" : ""} · {paiement.montantXof.toLocaleString("fr-FR")} FCFA
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs">
        Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
      </p>
    </div>
  );
}

export function BarrePaiementFixe({ paiement, reste }) {
  return (
    <div
      data-testid="barre-paiement-fixe"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D9D1C1] bg-[#e3dbcc] px-3 pt-2.5 pb-3 dark:bg-gray-900 dark:border-gray-800"
    >
      <div className="max-w-xl mx-auto">
        <p className="text-center text-xs font-bold text-gray-900 dark:text-white" data-testid="validite-paiement">
          Paiement {texteValidite(paiement.validForSeconds)}
          {reste !== null && reste !== undefined ? ` · il reste ${formaterCompteARebours(reste)}` : ""}
        </p>
        <div className="flex gap-2.5 mt-2">
          {paiement.deepLinkOm ? (
            <a
              href={paiement.deepLinkOm}
              data-testid="ouvrir-orange-money"
              className="flex-1 min-h-12 flex items-center justify-center rounded-2xl bg-[#FF6B00] hover:bg-[#e66000] px-3 text-sm font-extrabold text-white transition-colors"
            >
              Ouvrir Orange Money
            </a>
          ) : null}
          {paiement.deepLinkMaxit ? (
            <a
              href={paiement.deepLinkMaxit}
              data-testid="ouvrir-maxit"
              className="flex-1 min-h-12 flex items-center justify-center rounded-2xl bg-[#111827] hover:bg-black px-3 text-sm font-extrabold text-white transition-colors"
            >
              Ouvrir MAXIT
            </a>
          ) : null}
        </div>
        <p className="mt-2 flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
          En attente de confirmation du paiement…
        </p>
      </div>
    </div>
  );
}
