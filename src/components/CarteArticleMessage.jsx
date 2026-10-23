"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obtenirArticleParId } from "@/lib/marketplaceData";

// Carte d'article dans une bulle de message : la PHOTO, le nom et le prix de l'article qui intéresse la personne, touchable pour
// rouvrir l'article. Elle remplace le texte « intéressé(e) par votre article… Lien : … » : beaucoup de commerçants ne lisent pas, ils
// reconnaissent leur article en le voyant.
const ID_ARTICLE = /marketplace\?article=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Identifiant de l'article cité dans le message de prise de contact, ou null. */
export function articleDuMessage(texte) {
  if (typeof texte !== "string" || !/intéressé\(e\) par votre article/i.test(texte)) return null;
  return texte.match(ID_ARTICLE)?.[1] ?? null;
}

function formaterPrix(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function CarteArticleMessage({ articleId }) {
  const [article, setArticle] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    let annule = false;
    obtenirArticleParId(articleId).then((a) => {
      if (annule) return;
      if (a) setArticle(a);
      else setIntrouvable(true);
    });
    return () => {
      annule = true;
    };
  }, [articleId]);

  const photo = article?.photos?.[0] || null;
  return (
    <Link
      href={`/marketplace?article=${articleId}`}
      className="block w-[220px] sm:w-[260px] rounded-xl overflow-hidden border border-black/10 bg-white shadow-sm hover:shadow-md transition"
      aria-label={article ? `Voir l'article ${article.titre}` : "Voir l'article"}
    >
      <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={article?.titre || "Article"} className="w-full h-full object-cover" />
        ) : (
          <i className={`fa-solid ${introuvable ? "fa-circle-question" : "fa-spinner fa-spin"} text-2xl text-gray-300`}></i>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold text-gray-900 truncate">{article?.titre || (introuvable ? "Article" : "…")}</p>
          {article?.prix_xof > 0 && <p className="text-[13px] font-black text-emerald-600">{formaterPrix(article.prix_xof)} FCFA</p>}
        </div>
        <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </span>
      </div>
    </Link>
  );
}
