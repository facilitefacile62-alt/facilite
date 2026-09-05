"use client";

// Extrait de HomeClient.jsx / OffresClient.jsx (candidat/page.js a un besoin
// différent — offres complètes triées, pas juste une carte de scores — et
// garde son propre chargement, voir loadRecommendedOffers). Avant ce
// fichier, le même bloc RPC était copié-collé dans les deux premiers,
// verbatim : toute correction future devait être répétée à la main aux deux
// endroits, avec le risque classique d'un correctif appliqué à un seul.
//
// Un seul CV avec embedding par candidat interrogé (le plus récent) : le
// score n'est jamais bloquant (retombe à `null`, donc aucun badge affiché)
// si le candidat n'est pas connecté ou n'a aucun CV avec embedding.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * @param {string|undefined} userId
 * @param {{ matchThreshold?: number, matchCount?: number }} [options]
 * @returns {Record<string, number>|null} similarité (0..1) indexée par job_offers.id
 */
export function useCandidateMatchScores(userId, { matchThreshold = 0, matchCount = 200 } = {}) {
  const [scores, setScores] = useState(null);

  useEffect(() => {
    let annule = false;

    async function charger() {
      if (!userId) {
        if (!annule) setScores(null);
        return;
      }
      try {
        const { data: resume } = await supabase
          .from("resumes")
          .select("embedding")
          .eq("user_id", userId)
          .not("embedding", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!resume?.embedding) {
          if (!annule) setScores(null);
          return;
        }

        const embeddingLiteral = Array.isArray(resume.embedding)
          ? `[${resume.embedding.join(",")}]`
          : resume.embedding;

        const { data: matches, error } = await supabase.rpc("match_job_offers", {
          query_embedding: embeddingLiteral,
          match_threshold: matchThreshold,
          match_count: matchCount,
        });

        if (error || !matches) {
          if (!annule) setScores(null);
          return;
        }

        const map = {};
        matches.forEach((m) => {
          map[m.id] = m.similarity;
        });
        if (!annule) setScores(map);
      } catch (err) {
        console.error("Exception calcul scores de correspondance candidat:", err);
        if (!annule) setScores(null);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [userId, matchThreshold, matchCount]);

  return scores;
}
