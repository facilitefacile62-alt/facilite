import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Port de src/lib/useCandidateMatchScores.js (web) — même RPC
// (match_job_offers), mêmes paramètres par défaut, aucun nouvel algorithme.
// Reste `null` (aucun badge affiché) si le candidat n'est pas connecté ou
// n'a aucun CV avec embedding — jamais bloquant pour l'écran.
export function useCandidateMatchScores(
  userId: string | undefined,
  { matchThreshold = 0, matchCount = 200 }: { matchThreshold?: number; matchCount?: number } = {}
): Record<string, number> | null {
  const [scores, setScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let annule = false;

    async function charger() {
      if (!userId) {
        if (!annule) setScores(null);
        return;
      }
      try {
        const { data: resume } = await supabase
          .from('resumes')
          .select('embedding')
          .eq('user_id', userId)
          .not('embedding', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!resume?.embedding) {
          if (!annule) setScores(null);
          return;
        }

        const embeddingLiteral = Array.isArray(resume.embedding)
          ? `[${resume.embedding.join(',')}]`
          : resume.embedding;

        const { data: matches, error } = await supabase.rpc('match_job_offers', {
          query_embedding: embeddingLiteral,
          match_threshold: matchThreshold,
          match_count: matchCount,
        });

        if (error || !matches) {
          if (!annule) setScores(null);
          return;
        }

        const map: Record<string, number> = {};
        (matches as { id: string; similarity: number }[]).forEach((m) => {
          map[m.id] = m.similarity;
        });
        if (!annule) setScores(map);
      } catch (err) {
        console.error('Exception calcul scores de correspondance candidat:', err);
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
