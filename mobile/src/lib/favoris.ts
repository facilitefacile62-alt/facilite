import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

// Favoris Marketplace (table marketplace_favoris, écriture par la fonction
// basculer_favori_marketplace). Le cœur de la fiche article (16) et du chat
// vendeur (36) passent par ce hook.
export function useFavori(itemId: string | undefined, userId: string | undefined) {
  const [favori, setFavori] = useState(false);

  useEffect(() => {
    if (!itemId || !userId) return;
    let annule = false;
    supabase
      .from('marketplace_favoris')
      .select('product_id')
      .eq('user_id', userId)
      .eq('product_id', itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (!annule) setFavori(Boolean(data));
      });
    return () => {
      annule = true;
    };
  }, [itemId, userId]);

  const basculer = useCallback(async () => {
    if (!itemId) return;
    const avant = favori;
    setFavori(!avant);
    const { data, error } = await supabase.rpc('basculer_favori_marketplace', { p_item_id: itemId });
    if (error) {
      setFavori(avant);
      Alert.alert('Favoris', "Impossible de modifier vos favoris pour le moment.");
      return;
    }
    setFavori(Boolean(data));
  }, [itemId, favori]);

  return { favori, basculer };
}
