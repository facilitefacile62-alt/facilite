"use client";
/* eslint-disable @next/next/no-img-element */

// Page dédiée affichée juste après l'inscription (voir register/page.js).
// Avant, un succès d'inscription affichait un message disant « vous pouvez
// vous connecter » avec un lien vers /login — mais la connexion exige un
// e-mail confirmé (voir "Email not confirmed" dans login/page.js), donc la
// personne atterrissait sur le formulaire de connexion pour se faire
// rejeter, sans comprendre pourquoi. Cette page dit la vérité tout de
// suite : il faut d'abord confirmer l'adresse, avant même de retenter une
// connexion.
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function VerifiezVotreEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const redirectUrl = searchParams.get("redirect") || "/";

  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    setResendMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.toLowerCase(),
      });
      setResendMessage(
        error ? error.message || "Impossible de renvoyer l'email de confirmation." : "Un nouvel email a été envoyé."
      );
    } catch {
      setResendMessage("Erreur lors du renvoi.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between items-center relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-[#0000000a] 1px, transparent 1px), linear-gradient(to right, #00000008 1px, transparent 1px), linear-gradient(to bottom, #00000008 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      ></div>

      <header className="w-full max-w-[1180px] px-6 py-5 flex items-center z-10">
        <Link href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
          <img src="/logo.jpeg" alt="Logo Facilité" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
          <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilité</span>
        </Link>
      </header>

      <main className="w-full max-w-md px-4 py-8 z-10">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">
            <i className="fa-solid fa-envelope-open-text"></i>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
            Vérifiez votre boîte de réception
          </h1>
          <p className="text-sm text-gray-600 mb-1">
            Nous avons envoyé un lien de confirmation à
          </p>
          {email && <p className="text-sm font-black text-gray-900 mb-4 break-all">{email}</p>}

          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            Ouvrez cet e-mail et cliquez sur le lien qu&apos;il contient pour activer votre compte.
            Sans cette étape, la connexion restera refusée — pensez à vérifier vos courriers
            indésirables si rien n&apos;arrive.
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || !email}
            className="w-full py-3 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 text-gray-800 font-bold text-sm rounded-2xl transition cursor-pointer mb-3"
          >
            {isResending ? "Envoi en cours…" : "Renvoyer l'email de confirmation"}
          </button>

          {resendMessage && <p className="text-xs font-semibold text-gray-600 mb-4">{resendMessage}</p>}

          <Link
            href={`/login${redirectUrl && redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="inline-block w-full py-3.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md transition-all duration-200 mt-2"
          >
            J&apos;ai confirmé mon adresse — Me connecter
          </Link>
        </div>
      </main>

      <footer className="w-full text-center py-4 text-xs font-semibold text-gray-400 z-10">
        © 2026 Facilité. All rights reserved.
      </footer>
    </div>
  );
}

export default function VerifiezVotreEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <VerifiezVotreEmailContent />
    </Suspense>
  );
}
