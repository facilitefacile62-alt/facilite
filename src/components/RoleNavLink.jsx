"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/**
 * Liens de navigation conditionnels vers /admin et /recruteur, affichés
 * uniquement si l'utilisateur connecté a le rôle ou le badge correspondant.
 *
 * - Admin : rôle 'admin' ou 'publisher' dans user_roles.
 * - Recruteur : badge 'verified_recruiter' dans profiles.badges,
 *   vérifié via supabase.rpc("has_badge") — même source de vérité que
 *   le middleware et les policies RLS.
 *
 * À utiliser dans la navbar principale de chaque page (pas de Navbar
 * partagée dans ce projet — chaque page a son propre markup dupliqué).
 */
export default function RoleNavLink({ session, className, variant = "desktop" }) {
  const [role, setRole] = useState(null);
  const [isVerifiedRecruiter, setIsVerifiedRecruiter] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVerifiedRecruiter(false);
      return;
    }
    let cancelled = false;

    // Requêtes parallèles : rôle + badge recruteur
    Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single(),
      supabase.rpc("has_badge", {
        check_user_id: session.user.id,
        badge_name: "verified_recruiter",
      }),
    ]).then(([roleResult, badgeResult]) => {
      if (cancelled) return;
      setRole(roleResult.data?.role || null);
      setIsVerifiedRecruiter(badgeResult.data === true);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const isAdmin = role === "admin" || role === "publisher";

  // Aucun lien à afficher
  if (!isAdmin && !isVerifiedRecruiter) return null;

  // Construit la liste des liens à rendre
  const links = [];

  if (isAdmin) {
    links.push({ href: "/admin", label: "Admin", icon: "fa-shield-halved", color: "text-orange-600 hover:text-orange-700", emoji: "🛡️" });
  }

  if (isVerifiedRecruiter) {
    links.push({ href: "/recruteur", label: "Recruteur", icon: "fa-briefcase", color: "text-emerald-600 hover:text-emerald-700", emoji: "💼" });
  }

  if (variant === "mobile") {
    return (
      <>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={className || `flex flex-col items-center justify-center ${link.color} space-y-1`}
          >
            <i className={`fa-solid ${link.icon} text-lg`}></i>
            <span className="text-[9px] font-bold tracking-tight">{link.label}</span>
          </Link>
        ))}
      </>
    );
  }

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            className ||
            `flex flex-col items-center justify-center text-center ${link.color} transition space-y-1 cursor-pointer w-16`
          }
        >
          <i className={`fa-solid ${link.icon} text-xl`}></i>
          <span className="text-[11px] font-bold tracking-tight">{link.emoji} {link.label}</span>
        </Link>
      ))}
    </>
  );
}
