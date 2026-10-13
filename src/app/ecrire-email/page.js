"use client";

// « Écrire un e-mail » : composer un message à n'importe quelle adresse, comme
// dans Gmail. L'envoi passe par /api/envoyer-email (session obligatoire,
// 10 envois par 24 h, 3 pièces jointes, un seul destinataire). Page protégée
// par le proxy comme toute route non listée dans les routes publiques.
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const MAX_PIECES = 3;

export default function EcrireEmailPage() {
  const { session } = useAuth();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pieces, setPieces] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState(null); // { ok, texte }

  const ajouterPieces = (liste) => {
    const suite = [...pieces, ...Array.from(liste || [])].slice(0, MAX_PIECES);
    setPieces(suite);
  };

  const envoyer = async (e) => {
    e.preventDefault();
    setRetour(null);
    setEnvoi(true);
    try {
      const { data } = await supabase.auth.getSession();
      const jeton = data?.session?.access_token || session?.access_token;
      if (!jeton) {
        setRetour({ ok: false, texte: "Connectez-vous pour envoyer un e-mail." });
        return;
      }
      const fd = new FormData();
      fd.append("to", to.trim());
      fd.append("subject", subject.trim());
      fd.append("message", message);
      pieces.forEach((f) => fd.append("pieces", f, f.name));
      const res = await fetch("/api/envoyer-email", { method: "POST", headers: { Authorization: `Bearer ${jeton}` }, body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setRetour({ ok: true, texte: "E-mail envoyé." });
        setTo("");
        setSubject("");
        setMessage("");
        setPieces([]);
      } else {
        setRetour({ ok: false, texte: json.error || "L'e-mail n'a pas pu être envoyé." });
      }
    } catch {
      setRetour({ ok: false, texte: "Connexion impossible. Réessayez dans un instant." });
    } finally {
      setEnvoi(false);
    }
  };

  const champ = "w-full bg-transparent border-b border-gray-200 dark:border-gray-700 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-blue-500";

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pt-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Écrire un e-mail</h1>
        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white">Fermer</Link>
      </div>

      <form onSubmit={envoyer} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
        <label htmlFor="mail-a" className="sr-only">À</label>
        <input id="mail-a" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="À (une seule adresse)" required className={champ} />
        <label htmlFor="mail-objet" className="sr-only">Objet</label>
        <input id="mail-objet" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" maxLength={150} required className={champ} />
        <label htmlFor="mail-message" className="sr-only">Message</label>
        <textarea id="mail-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrivez votre message" rows={10} maxLength={5000} className={`${champ} resize-y border-b-0 mt-1`} />

        {pieces.length > 0 ? (
          <ul className="flex flex-wrap gap-2 mb-3">
            {pieces.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-200">
                <i className="fa-solid fa-paperclip"></i>
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setPieces(pieces.filter((_, k) => k !== i))}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {retour ? (
          <p role="status" className={`text-sm font-bold mb-3 ${retour.ok ? "text-emerald-600" : "text-red-600"}`}>{retour.texte}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="mail-pieces" className={`text-xs font-bold flex items-center gap-2 cursor-pointer ${pieces.length >= MAX_PIECES ? "opacity-40 pointer-events-none" : "text-gray-600 dark:text-gray-300"}`}>
            <i className="fa-solid fa-paperclip"></i> Joindre un fichier
            <input
              id="mail-pieces"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="sr-only"
              onChange={(e) => {
                ajouterPieces(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button type="submit" disabled={envoi} className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-extrabold">
            {envoi ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
        10 e-mails par 24 heures, 3 pièces jointes au plus (10 Mo en tout). Le message part du domaine de Facilité ; les réponses arrivent à votre adresse.
      </p>
    </main>
  );
}
