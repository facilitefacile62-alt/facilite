"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { playNotificationSound } from "./notificationSound";

/**
 * Compteur de messages non lus pour la barre de navigation (badge + alerte
 * sonore), partagé par toutes les pages qui affichent un lien Messagerie —
 * ce projet n'a pas de Navbar commune, chaque page duplique son propre
 * en-tête, d'où ce hook pour au moins garder la logique de comptage/Realtime
 * en un seul endroit.
 *
 * @param {string|null|undefined} userId
 * @returns {number} unreadCount
 */
export function useUnreadMessagesBadge(userId) {
  const [unreadCount, setUnreadCount] = useState(0);
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
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("is_read", false);

      if (cancelled) return;
      if (error) {
        console.error("Erreur chargement du compteur de messages non lus:", error.message);
        return;
      }
      setUnreadCount(count || 0);
      readyForAlertsRef.current = true;
    }

    loadInitialCount();

    const channel = supabase
      .channel(`unread-badge:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (payload.new?.is_read) return;
          setUnreadCount((prev) => prev + 1);
          if (readyForAlertsRef.current) {
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
  }, [userId]);

  return unreadCount;
}
