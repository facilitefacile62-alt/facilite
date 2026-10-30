import { Ionicons } from '@expo/vector-icons';
import ImagePublique from '@/components/ImagePublique';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { obtenirArticle, prixLisible, type ArticleMarketplace } from '@/lib/marketplace';

// Carte d'article dans une bulle de discussion : la PHOTO, le nom et le prix de l'article qui intéresse la personne, touchables pour
// rouvrir l'article. Elle remplace le texte « intéressé(e) par votre article… Lien : … » : beaucoup de commerçants ne lisent pas, ils
// reconnaissent leur article en le voyant.
const ID_ARTICLE = /marketplace\?article=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Identifiant de l'article cité dans le message de prise de contact, ou null. */
export function articleDuMessage(texte: string | null | undefined): string | null {
  if (typeof texte !== 'string' || !/intéressé\(e\) par votre article/i.test(texte)) return null;
  return texte.match(ID_ARTICLE)?.[1] ?? null;
}

export default function CarteArticleMessage({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleMarketplace | null>(null);

  useEffect(() => {
    let annule = false;
    obtenirArticle(articleId)
      .then((a) => {
        if (!annule) setArticle(a);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [articleId]);

  const photo = article?.photos?.[0] ?? null;
  return (
    <Pressable
      onPress={() => router.push(`/marketplace/${articleId}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={article ? `Voir l'article ${article.titre}` : "Voir l'article"}
      style={{ width: 230, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
      <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
        {photo ? (
          <ImagePublique source={{ uri: photo }} alt={article?.titre ?? 'Article'} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="pricetag-outline" size={30} color="rgba(0,0,0,0.25)" />
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>{article?.titre ?? 'Article'}</Text>
          {article && article.prixXof > 0 ? (
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#059669' }}>{prixLisible(article.prixXof)} FCFA</Text>
          ) : null}
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={17} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}
