"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/**
 * Lien de navigation conditionnel vers /admin ou /recruteur, affiché
 * uniquement si l'utilisateur connecté a le rôle correspondant. À utiliser
 * dans la navbar principale de chaque page (pas de Navbar partagée dans ce
 * projet — chaque page a son propre markup dupliqué).
 */
export default function RoleNavLink({ session, className, variant = "desktop" }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setRole(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role || null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (role !== "admin" && role !== "recruteur") return null;

  const href = role === "admin" ? "/admin" : "/recruteur";
  const label = role === "admin" ? "Admin" : "Recruteur";
  const icon = role === "admin" ? "fa-shield-halved" : "fa-briefcase";

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
