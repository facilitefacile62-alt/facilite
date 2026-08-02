"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/**
 * Lien de navigation conditionnel vers /admin, affiché uniquement si
 * l'utilisateur connecté a le rôle correspondant. À utiliser dans la navbar
 * principale de chaque page (pas de Navbar partagée dans ce projet — chaque
 * page a son propre markup dupliqué).
 *
 * Le raccourci "Recruteur" a disparu avec le chantier RBAC : candidat et
 * recruteur ont fusionné dans le rôle unique 'user', /recruteur est
 * désormais ouvert à tout compte 'user' (voir middleware.js) — ce n'est
 * plus un privilège distinctif à signaler ici.
 */
export default function RoleNavLink({ session, className, variant = "desktop" }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) {
      // Remise à zéro quand la session disparaît (déconnexion) ; le reste de
      // l'effet fait une requête Supabase asynchrone pour la remplir à
      // nouveau, donc role reste fondamentalement un état asynchrone, pas
      // une valeur dérivable au rendu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role || null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (role !== "admin" && role !== "publisher") return null;

  const href = "/admin";
  const label = "Admin";
  const icon = "fa-shield-halved";

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        className={className || "flex flex-col items-center justify-center text-orange-600 space-y-1"}
      >
        <i className={`fa-solid ${icon} text-lg`}></i>
        <span className="text-[9px] font-bold tracking-tight">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={
        className ||
        "flex flex-col items-center justify-center text-center text-orange-600 hover:text-orange-700 transition space-y-1 cursor-pointer w-16"
      }
    >
      <i className={`fa-solid ${icon} text-xl`}></i>
      <span className="text-[11px] font-bold tracking-tight">🛡️ {label}</span>
    </Link>
  );
}
