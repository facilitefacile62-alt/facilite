'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
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
  // Composant chargé sans rendu serveur (voir GlobalModals) : l'ancre du layout existe déjà au premier rendu.
  const cible = typeof document === 'undefined' ? null : document.getElementById('bandeau-global');

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
  // Pas encore de point d'ancrage (rendu serveur) : rien n'est affiché plutôt qu'un bandeau flottant.
  if (!cible) return null;

  // Bandeau EN HAUT de page, dans le flux (ancre #bandeau-global de layout.js) : il défile avec la page et ne recouvre
  // jamais un bouton. Il était auparavant une carte fixe en bas d'écran, qui cachait « Discuter », « WhatsApp » et le bas
  // des formulaires sur mobile. La fermeture est mémorisée par compte : il ne revient pas à la session suivante.
  return createPortal(
    <div role="status" className="w-full bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center gap-2">
      <i className="fa-solid fa-mobile-screen text-xs text-emerald-700 flex-shrink-0" aria-hidden="true"></i>
      <p className="min-w-0 flex-1 text-xs text-gray-700 font-medium leading-snug">
        <span className="font-extrabold text-gray-900">Vérifiez votre numéro</span>
        <span className="hidden sm:inline"> — il devient une méthode de connexion à part entière.</span>{' '}
        <Link href="/profil" onClick={handleDismiss} className="font-extrabold text-emerald-700 underline whitespace-nowrap">
          Vérifier
        </Link>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer le bandeau"
        className="w-8 h-8 -mr-1 rounded-full hover:bg-emerald-100 flex items-center justify-center text-gray-500 flex-shrink-0 cursor-pointer"
      >
        <i className="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
      </button>
    </div>,
    cible
  );
}
