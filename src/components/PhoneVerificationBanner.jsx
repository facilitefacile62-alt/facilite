'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Étend la proposition de vérification téléphone (jusqu'ici uniquement sur
// l'écran de succès de /register, donc invisible pour les comptes créés via
// Google) à TOUT utilisateur sans numéro, peu importe la méthode
// d'inscription — sans toucher /auth/callback ni la logique de redirection
// (voir diagnostic) : montée globalement via GlobalModals.jsx, comme
// VoiceAssistant, condition purement côté client sur profile.phone.
export default function PhoneVerificationBanner() {
  const pathname = usePathname();
  const { session, profile, loading } = useAuth();
  const [dismissed, setDismissed] = useState(true); // true par défaut : jamais de flash avant vérification

  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const key = `FACILITE_PHONE_BANNER_DISMISSED_${session.user.id}`;
      setDismissed(localStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [session?.user?.id]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (session?.user?.id) {
        localStorage.setItem(`FACILITE_PHONE_BANNER_DISMISSED_${session.user.id}`, '1');
      }
    } catch {}
  };

  // Jamais avant que le profil soit résolu (évite un flash pour un compte
  // qui a bien un numéro), jamais sur /login ou /register (contexte non
  // authentifié ou déjà en train de s'inscrire).
  if (loading || dismissed || !session || !profile || profile.phone) return null;
  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[900] bg-white rounded-2xl shadow-2xl border border-emerald-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
        <i className="fa-solid fa-mobile-screen text-sm"></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-gray-900">Vérifiez votre numéro</p>
        <p className="text-xs text-gray-600 font-medium mt-0.5">
          Une fois vérifié, il devient une méthode de connexion à part entière — depuis Sécurité &amp; Connexion de
          votre profil.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/profil"
            onClick={handleDismiss}
            className="text-xs font-extrabold text-emerald-700 hover:underline"
          >
            Vérifier maintenant
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer"
        className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 cursor-pointer"
      >
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>
    </div>
  );
}
