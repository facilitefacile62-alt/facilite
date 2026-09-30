"use client";

// Layout partagé de /admin/* — ajoute la barre latérale (AdminSidebar) sur
// les 12 sous-pages admin autonomes qui n'en avaient aucune (chacune avait
// au mieux un simple lien "← Administration", voir le diagnostic du point
// 1 avant ce chantier).
//
// Exception volontaire : /admin lui-même (page.js) est exclu — il a déjà sa
// propre sidebar inline, plus complexe (couplée à son état d'onglet interne
// activeTab, persistant en localStorage + URL). L'ajouter ici aurait affiché
// deux sidebars superposées. Non touché par ce chantier, par choix explicite
// de ne pas risquer une régression sur ses 2700+ lignes déjà en usage
// quotidien — voir le commentaire d'en-tête d'AdminSidebar.jsx.
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  if (pathname === "/admin") {
    return children;
  }

  return (
    <div className="font-sans flex min-h-screen bg-[#F7F7F8]">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
