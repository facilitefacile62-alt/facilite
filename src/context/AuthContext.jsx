"use strict";
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, getSignedAvatarUrl, getSignedCoverUrl } from "@/lib/supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  role: "visitor",
  isAdmin: false,
  isRecruiter: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

/**
 * Provider Centralisé d'Authentification (AuthContext)
 * - Charge la session, le rôle et le profil UNE SEULE FOIS au montage racine.
 * - Écoute onAuthStateChange et synchronise le profil en temps réel (Realtime).
 * - Élimine les requêtes redondantes dans les 21 pages de l'application.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState("visitor");
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (currentSession) => {
    if (!currentSession?.user) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole("visitor");
      setLoading(false);
      return;
    }

    const currentUser = currentSession.user;
    setSession(currentSession);
    setUser(currentUser);

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", currentUser.id)
          .maybeSingle(),
      ]);

      const profileData = profileRes.data;
      const roleData = roleRes.data;

      // Détermination sécurisée du rôle avec invariant admin
      let userRole = roleData?.role || "user";
      if (currentUser.email === "facilitefacile62@gmail.com") {
        userRole = "admin";
      }
      setRole(userRole);

      if (profileData) {
        const [avatarUrl, coverUrl] = await Promise.all([
          getSignedAvatarUrl(profileData.avatar_url),
          getSignedCoverUrl(profileData.cover_url),
        ]);

        setProfile({
          ...profileData,
          avatar_url: avatarUrl || profileData.avatar_url || "/logo.jpeg",
          cover_url: coverUrl || profileData.cover_url || null,
        });
      } else {
        setProfile({
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Utilisateur",
          avatar_url: currentUser.user_metadata?.avatar_url || "/logo.jpeg",
          bio: "",
          badges: [],
        });
      }
    } catch (err) {
      console.error("Erreur AuthContext fetchUserData:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Chargement initial unique au démarrage
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) {
        fetchUserData(initialSession);
      }
    });

    // 2. Écoute unique des changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        fetchUserData(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Synchronisation Realtime sur les changements de `profiles` et `user_roles`
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`auth-context-sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => {
          if (session) fetchUserData(session);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => {
          if (session) fetchUserData(session);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, session, fetchUserData]);

  const refreshProfile = useCallback(async () => {
    if (session) {
      await fetchUserData(session);
    }
  }, [session, fetchUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erreur déconnexion:", e);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("/login");
      }
    }
  }, []);

  const isAdmin = role === "admin" || user?.email === "facilitefacile62@gmail.com";
  const isRecruiter =
    role === "recruiter" ||
    (Array.isArray(profile?.badges) && profile.badges.includes("verified_recruiter"));

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        isAdmin,
        isRecruiter,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé au sein d'un AuthProvider");
  }
  return context;
}
