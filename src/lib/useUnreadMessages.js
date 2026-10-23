"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, executeSupabaseWithRetry } from "./supabase";
import { playNotificationSound } from "./notificationSound";
import { useAuth } from "@/context/AuthContext";

/**
 * Compteur de messages non lus pour la barre de navigation (badge + alerte
 * sonore), partagé par toutes les pages qui affichent un lien Messagerie —
 * ce projet n'a pas de Navbar commune, chaque page duplique son propre
 * en-tête, d'où ce hook pour au moins garder la logique de comptage/Realtime
 * en un seul endroit.
 *
 * Plusieurs instances peuvent coexister sur une page (en-tête commun + en-tête propre à la page) : chacune a donc son canal
 * Realtime (nom unique), sinon la seconde ajoute des callbacks à un canal déjà abonné et Supabase lève une erreur.
 * `{ son: false }` : instance sans alerte sonore (l'en-tête commun), pour ne pas jouer le son deux fois.
 *
 * @param {string|null|undefined} userId
 * @param {{ son?: boolean }} [options]
 * @returns {number} unreadCount
 */
export function useUnreadMessagesBadge(userId, { son = true } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  // Compte administrateur : les candidatures reçues (type OFFRE) ne comptent pas — elles ne sont pas dans sa messagerie.
  const { isAdmin } = useAuth();
  const idInstance = useRef(Math.random().toString(36).slice(2, 8));
  // Évite de jouer le son sur la salve de messages déjà non lus chargée à
  // l'ouverture de la page : seuls les messages qui arrivent APRÈS le montage
  // du hook (donc réellement "nouveaux" pour cette session) déclenchent l'alerte.
  const readyForAlertsRef = useRef(false);

  useEffect(() => {
    readyForAlertsRef.current = false;

    if (!userId) {
      // Remise à zéro quand userId disparaît (déconnexion) ; le reste de
      // l'effet fait une requête Supabase asynchrone pour la remplir à
      // nouveau, donc unreadCount reste fondamentalement un état
      // asynchrone, pas une valeur dérivable au rendu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    async function loadInitialCount() {
      try {
        const { count, error } = await executeSupabaseWithRetry(() => {
          const requete = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", userId)
            .eq("is_read", false);
          return isAdmin ? requete.or("type_discussion.is.null,type_discussion.neq.OFFRE") : requete;
        });

        if (cancelled) return;
        if (error) {
          console.warn("Erreur silencieuse chargement du compteur de messages non lus:", error.message);
          setUnreadCount(0);
          return;
        }
        setUnreadCount(count || 0);
        readyForAlertsRef.current = true;
      } catch (err) {
        console.warn("Erreur silencieuse exception messages non lus:", err);
        setUnreadCount(0);
      }
    }

    loadInitialCount();

    const channel = supabase
      .channel(`unread-badge:${userId}:${idInstance.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (payload.new?.is_read) return;
          if (isAdmin && payload.new?.type_discussion === "OFFRE") return;
          setUnreadCount((prev) => prev + 1);
          if (son && readyForAlertsRef.current) {
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const wasUnread = payload.old?.is_read === false;
          const isNowRead = payload.new?.is_read === true;
          const wasRead = payload.old?.is_read === true;
          const isNowUnread = payload.new?.is_read === false;

          if (wasUnread && isNowRead) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } else if (wasRead && isNowUnread) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, son, isAdmin]);

  return unreadCount;
}
