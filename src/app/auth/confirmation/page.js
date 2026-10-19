"use client";

// Arrivée après le clic sur le lien de confirmation d'e-mail (inscription).
//
// L'inscription passe par /api/auth/register (anti-robot) : Supabase y crée le compte CÔTÉ SERVEUR, donc le lien de
// l'e-mail est de type « implicite » — il revient avec les jetons dans le FRAGMENT de l'adresse (#access_token=…),
// jamais avec ?code=…. Le fragment n'est lisible que dans le navigateur : /auth/callback (route serveur) y renvoie donc
// ici, et cette page ouvre la session puis envoie la personne vers sa destination (/bienvenue, avec son ?redirect=).
// Avant cette page, /auth/callback renvoyait vers /login, qui ignorait les jetons : confirmée mais jamais connectée.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { destinationSure } from "@/lib/destinationSure";

function lireFragment() {
  const brut = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(brut);
  const requete = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    erreur: params.get("error") || requete.get("error"),
    codeErreur: params.get("error_code") || requete.get("error_code"),
    suivant: requete.get("next"),
  };
}

export default function ConfirmationEmailPage() {
  const [etat, setEtat] = useState("verification"); // verification | expire | echec

  useEffect(() => {
    let annule = false;
    const { accessToken, refreshToken, erreur, codeErreur, suivant } = lireFragment();
    const destination = destinationSure(suivant, "/bienvenue");

    async function ouvrirSession() {
      if (erreur) {
        if (!annule) setEtat(codeErreur === "otp_expired" ? "expire" : "echec");
        return;
      }
      if (!accessToken || !refreshToken) {
        // Ni jeton ni erreur : page ouverte à la main. On ne reste pas bloqué ici.
        window.location.replace("/login");
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (annule) return;
      if (error) {
        setEtat("echec");
        return;
      }
      // Navigation complète (et non router.push) : la destination est servie avec les cookies de session déjà posés.
      window.location.replace(destination);
    }

    ouvrirSession();
    return () => {
      annule = true;
    };
  }, []);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center space-y-4">
        {etat === "verification" ? (
          <>
            <div className="mx-auto w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" aria-hidden="true" />
            <h1 className="text-lg font-black text-gray-900">Confirmation de votre adresse…</h1>
            <p className="text-sm text-gray-500">Un instant, nous vous connectons.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black text-gray-900">
              {etat === "expire" ? "Ce lien a expiré" : "Le lien n’a pas pu être validé"}
            </h1>
            <p className="text-sm text-gray-600">
              {etat === "expire"
                ? "Pour votre sécurité, ce lien n’est valable que quelques heures. Demandez-en un nouveau depuis la page de connexion."
                : "Il a peut-être déjà été utilisé. Si votre adresse est confirmée, connectez-vous simplement avec votre e-mail et votre mot de passe."}
            </p>
            <Link href="/login" className="inline-block px-5 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl">
              Aller à la connexion
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
