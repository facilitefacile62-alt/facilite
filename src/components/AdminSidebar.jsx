"use client";
/* eslint-disable @next/next/no-img-element -- même logo/pattern que admin/page.js (aussi désactivé en tête de ce fichier), pas un asset à optimiser par next/image */

// Barre latérale partagée par les 12 sous-pages admin autonomes
// (etablissements, banque-donnees, sessions, messages, offres, dashboard,
// signalements, support, assistant-faq, boutiques, scraping,
// commandes-agent) — voir src/app/admin/layout.js, qui l'affiche partout
// SAUF sur /admin lui-même (qui a déjà sa propre sidebar inline, plus
// complexe car couplée à son état d'onglet interne activeTab).
//
// NAV_SECTIONS est dupliqué depuis src/app/admin/page.js plutôt que
// partagé par import : ce fichier fait 2700+ lignes et est régulièrement
// modifié, le risque de casser son état d'onglet (activeTab/handleTabChange,
// persistant en localStorage + URL) pour un simple ajout de sidebar ailleurs
// n'en valait pas la peine — même choix déjà fait pour
// src/app/admin/etablissements/page.js (voir son commentaire d'en-tête).
// Les deux copies doivent être tenues à jour ensemble si un lien change.
//
// Les entrées de type "tab" (onglets internes à /admin) naviguent ici vers
// /admin?tab=<id> — une vraie navigation de page, pas un changement d'état
// local (cette sidebar n'est jamais montée en même temps que celle
// d'admin/page.js). Une fois arrivé sur /admin, son effet d'hydratation
// existant (lecture de ?tab= au montage) affiche directement le bon onglet.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { handleGlobalSignOut } from "@/lib/supabase";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

const NAV_SECTIONS = [
  {
    label: "Contenu",
    items: [
      { type: "link", href: "/admin/offres", icon: "⚡", label: "Publieur d'Offres IA & Affiches", accent: true },
      { type: "link", href: "/creer-cv", icon: "➕", label: "Créer un CV" },
    ],
  },
  {
    label: "Communication",
    items: [
      { type: "link", href: "/messagerie", icon: "💬", label: "Messagerie Échanges", unread: true },
      { type: "link", href: "/admin/messages", icon: "💬", label: "Messagerie Support Admin" },
      { type: "link", href: "/admin/support", icon: "🎧", label: "Support" },
      { type: "link", href: "/admin/assistant-faq", icon: "❓", label: "FAQ Assistant Vocal" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { type: "tab", id: "boutiques", icon: "🏪", label: "Boutiques Marketplace", badge: "Live" },
      { type: "tab", id: "fonctionnalites", icon: "✨", label: "Fonctionnalités" },
      { type: "tab", id: "ia_studio", icon: "🧠", label: "Entraînement IA", badge: "Studio" },
      { type: "tab", id: "securite", icon: "🛡️", label: "Sécurité & Failles", badge: "Live" },
      { type: "tab", id: "utilisateurs", icon: "👥", label: "Utilisateurs" },
      { type: "link", href: "/admin/banque-donnees", icon: "🗃️", label: "Banque d'information" },
      { type: "link", href: "/admin/signalements", icon: "🚩", label: "Signalements Marketplace" },
      { type: "tab", id: "tarification", icon: "💳", label: "Tarification" },
      { type: "link", href: "/admin/dashboard", icon: "💰", label: "Facturation & Transactions" },
      { type: "link", href: "/admin/commandes-agent", icon: "🧑‍💼", label: "Commandes Agent" },
    ],
  },
  {
    label: "Administration & Sécurité",
    items: [
      { type: "tab", id: "securite", icon: "🛡️", label: "Lab Sécurité & Failles", badge: "Audit" },
      { type: "tab", id: "badges", icon: "🎖️", label: "Demandes de badge" },
    ],
  },
  {
    label: "Données & Statistiques",
    items: [
      { type: "link", href: "/admin/scraping", icon: "🤖", label: "Agrégation & Scraping" },
      { type: "tab", id: "dashboard", icon: "📊", label: "Statistiques" },
      { type: "link", href: "/admin/sessions", icon: "🕒", label: "Fréquentation du site web" },
    ],
  },
];

function NavItem({ item, pathname, unreadMessagesCount, onNavigate }) {
  if (item.accent) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-bold text-orange-600 border border-orange-300 hover:bg-orange-50 transition"
      >
        <span>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  }

  const href = item.type === "link" ? item.href : `/admin?tab=${item.id}`;
  const isActive = item.type === "link" && pathname === item.href;
  const className = `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition relative ${
    isActive ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      <span>{item.icon}</span>
      <span className="truncate">{item.label}</span>
      {item.unread && <UnreadBadge count={unreadMessagesCount} />}
      {item.badge && (
        <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function NavSections({ pathname, unreadMessagesCount, onNavigate }) {
  return (
    <>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="pt-3 first:pt-0">
          <div className="px-3.5 pb-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
            {section.label}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => (
              <NavItem key={item.label} item={item} pathname={pathname} unreadMessagesCount={unreadMessagesCount} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function AccountFooter({ email }) {
  return (
    <div className="px-3 py-4 border-t border-gray-100 space-y-3">
      <div className="flex items-center gap-2 px-2">
        <div className="w-9 h-9 rounded-full bg-orange-600 text-white font-extrabold flex items-center justify-center text-xs shadow-inner flex-shrink-0">
          {(email || "A").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-gray-900 truncate">Administrateur</p>
          <p className="text-[10px] text-gray-500 truncate">{email}</p>
        </div>
      </div>
      <button
        onClick={handleGlobalSignOut}
        className="w-full text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
      >
        Déconnexion
      </button>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const unreadMessagesCount = useUnreadMessagesBadge(user?.id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <aside className="hidden md:flex w-72 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-screen sticky top-0">
        <div className="flex items-center space-x-2 px-5 py-5 border-b border-gray-100">
          <Link href="/" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition" title="Retour à l'accueil">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </Link>
          <Link href="/" className="flex items-center space-x-2 group cursor-pointer" title="Aller à l'accueil Facilité">
            <img src="/logo.jpeg" alt="Logo Facilité" className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:opacity-80 transition" />
            <span className="text-base font-extrabold text-gray-900 tracking-tight group-hover:text-orange-600 transition">Facilité</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <NavSections pathname={pathname} unreadMessagesCount={unreadMessagesCount} />
        </nav>
        <AccountFooter email={user?.email} />
      </aside>

      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-700 cursor-pointer"
      >
        <i className="fa-solid fa-bars"></i>
      </button>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
              <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 group cursor-pointer" title="Aller à l'accueil Facilité">
                <img src="/logo.jpeg" alt="Logo Facilité" className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:opacity-80 transition" />
                <span className="text-base font-extrabold text-gray-900 tracking-tight group-hover:text-orange-600 transition">Facilité</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Fermer le menu"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 overflow-y-auto">
              <NavSections pathname={pathname} unreadMessagesCount={unreadMessagesCount} onNavigate={() => setMobileNavOpen(false)} />
            </nav>
            <AccountFooter email={user?.email} />
          </div>
        </div>
      )}
    </>
  );
}
