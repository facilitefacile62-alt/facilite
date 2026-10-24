import { formaterCompteARebours, phraseTempsEcoule, texteValidite } from "../lib/validiteQr";

/**
 * Écran d'ATTENTE d'un paiement Orange Money, commun aux jetons et à la formation CV.
 *
 * Tant que le paiement n'est ni confirmé ni expiré, le QR reste VISIBLE. Téléphone : « Ouvrir MAXIT » (compact), directement dessous le QR avec
 * « Un autre téléphone ? Scannez ce code avec Max it », puis « Ouvrir Orange Money » (discret), puis l'état d'attente. Ordinateur : le QR d'abord,
 * puis « Scannez ce QR code… » et les deux boutons. Le QR ne disparaît qu'au paiement confirmé (la page affiche
 * alors « Paiement confirmé » à la place de ce composant) ou à l'expiration des 5 minutes : il est alors masqué, avec la phrase « Le temps est
 * écoulé… » et le bouton pour recommencer.
 */
export default function AttentePaiementQr({ paiement, resume, estMobile, reste, qrExpire, libelleBoutonOrdinateur, boutonRecommencer, onNouveauCode }) {
  if (qrExpire) {
    return (
      <div className="text-center py-3" data-testid="paiement-expire">
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">{phraseTempsEcoule(estMobile, libelleBoutonOrdinateur)}</p>
        {boutonRecommencer}
      </div>
    );
  }

  // Téléphone : « Ouvrir MAXIT » (compact, au premier plan), puis DIRECTEMENT dessous le QR (un peu plus petit, il reste lisible) avec la phrase pour
  // un autre téléphone, puis « Ouvrir Orange Money » plus discret, puis l'état d'attente : bouton et QR tiennent ensemble sur un petit écran.
  if (estMobile) {
    return (
      <div className="text-center flex flex-col items-center" data-testid="paiement-en-attente">
        {paiement.deepLinkMaxit && (
          <a
            href={paiement.deepLinkMaxit}
            data-testid="ouvrir-maxit"
            className="w-full py-3 px-4 rounded-2xl text-white font-extrabold text-base bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            Ouvrir MAXIT
          </a>
        )}
        {paiement.qrCodeBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${paiement.qrCodeBase64}`}
            alt="QR code de paiement Orange Money"
            data-testid="qr-paiement"
            className="w-40 h-40 mx-auto mt-3 rounded-xl border border-gray-200 dark:border-gray-800"
          />
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" data-testid="phrase-autre-telephone">
          Un autre téléphone ? Scannez ce code avec Max it
        </p>
        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1" data-testid="validite-paiement">
          {resume} · Paiement {texteValidite(paiement.validForSeconds)}
          {reste !== null && reste !== undefined ? ` · il reste ${formaterCompteARebours(reste)}` : ""}
        </p>
        {paiement.deepLinkOm && (
          <a href={paiement.deepLinkOm} data-testid="ouvrir-orange-money" className="text-xs font-bold text-gray-600 dark:text-gray-300 underline mt-3">
            Ouvrir Orange Money
          </a>
        )}
        {paiement.deepLinkMaxit && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">MAXIT s&apos;ouvre tout seul. Sinon, touchez « Ouvrir MAXIT ».</p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-3 flex items-center justify-center gap-2">
          <span className="w-3 h-3 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin"></span>
          En attente de confirmation du paiement…
        </p>
        {onNouveauCode && (
          <button type="button" onClick={onNouveauCode} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-3">
            QR expiré ? Générer un nouveau code
          </button>
        )}
      </div>
    );
  }

  // Ordinateur : inchangé (QR en premier, à scanner avec le téléphone).
  return (
    <div className="text-center flex flex-col items-center" data-testid="paiement-en-attente">
      {paiement.qrCodeBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${paiement.qrCodeBase64}`}
          alt="QR code de paiement Orange Money"
          data-testid="qr-paiement"
          className="w-48 h-48 mx-auto rounded-xl border border-gray-200 dark:border-gray-800"
        />
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        {resume}
        <br />
        Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
      </p>
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1" data-testid="validite-paiement">
        Paiement {texteValidite(paiement.validForSeconds)}
        {reste !== null && reste !== undefined ? ` · il reste ${formaterCompteARebours(reste)}` : ""}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-3 w-full">
        {paiement.deepLinkOm && (
          <a
            href={paiement.deepLinkOm}
            className="flex-1 py-3 px-4 rounded-2xl text-white font-extrabold text-sm bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            Ouvrir Orange Money
          </a>
        )}
        {paiement.deepLinkMaxit && (
          <a
            href={paiement.deepLinkMaxit}
            className="flex-1 px-4 py-3 rounded-2xl text-white font-extrabold text-sm bg-gray-900 hover:bg-black transition-colors"
          >
            Ouvrir MAXIT
          </a>
        )}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-4 flex items-center justify-center gap-2">
        <span className="w-3 h-3 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin"></span>
        En attente de confirmation du paiement…
      </p>
      {onNouveauCode && (
        <button type="button" onClick={onNouveauCode} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-4">
          QR expiré ? Générer un nouveau code
        </button>
      )}
    </div>
  );
}
