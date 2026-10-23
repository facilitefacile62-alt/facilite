import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { CarteMenu, GroupeCartes } from '@/components/CarteMenu';
import { useAuth } from '@/context/AuthContext';
import { libelleLangue, lireLangue, type CodeLangue } from '@/lib/preferencesConnexion';

// Page « Réglages » UNIQUE (décision du 23/10/2026) : la même liste de cartes sur Locaux et sur Facilité (maquette « Réglages » de Locaux).
// Les rubriques réservées au vendeur (Boost, Abonnés, Avis, Contact & Livraison) ne s'affichent que pour un compte avec boutique ; la
// dernière ligne ramène à la plateforme d'où l'on vient. Sur Facilité, les rubriques « Bientôt disponible » préviennent par un message
// (leurs pages vivent dans Locaux et en afficheraient la barre du bas).
export default function ReglagesCartes({ plateforme, estVendeur, deconnexion }: { plateforme: 'facilite' | 'locaux'; estVendeur: boolean; deconnexion: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [langue, setLangue] = useState<CodeLangue>('fr');
  useFocusEffect(
    useCallback(() => {
      lireLangue().then(setLangue);
    }, [])
  );

  const rubrique = (cle: string, titre: string) => {
    if (plateforme === 'locaux') router.push(`/marketplace/rubrique/${cle}` as Href);
    else Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');
  };
  const ouvrirLangue = () => router.push((plateforme === 'locaux' ? '/marketplace/langue' : '/mon-profil/langue') as Href);

  if (!user) return null;
  return (
    <View className="px-4">
      {estVendeur ? (
        <GroupeCartes>
          <CarteMenu icone="rocket-outline" titre="Faire profit & Boost" sous="Mettre vos articles en avant" onPress={() => rubrique('boost', 'Faire profit & Boost')} />
          <CarteMenu icone="people-outline" titre="Abonnés" sous="Les personnes qui suivent votre boutique" onPress={() => rubrique('abonnes', 'Abonnés')} />
          <CarteMenu icone="star-outline" titre="Avis clients" sous="Ce que disent vos clients" onPress={() => rubrique('avis', 'Avis clients')} />
        </GroupeCartes>
      ) : null}
      <GroupeCartes>
        <CarteMenu icone="id-card-outline" titre="Coordonnées" sous="Téléphone, e-mail et adresse" onPress={() => router.push('/mon-profil/coordonnees')} />
        {estVendeur ? (
          <CarteMenu icone="bicycle-outline" titre="Contact & Livraison" sous="Comment les clients vous joignent" onPress={() => rubrique('livraison', 'Contact & Livraison')} />
        ) : null}
        <CarteMenu icone="help-circle-outline" titre="Foire aux questions" sous="Les réponses à vos questions" onPress={() => router.push('/web/faq')} />
        <CarteMenu icone="language-outline" titre="Changer la langue" sous={libelleLangue(langue)} onPress={ouvrirLangue} />
      </GroupeCartes>
      <GroupeCartes>
        <CarteMenu icone="shield-checkmark-outline" titre="Confidentialité" sous="Vos données et votre visibilité" onPress={() => router.push('/mon-profil/confidentialite')} />
        <CarteMenu icone="chatbubble-outline" titre="Désactiver le chat" sous="Bientôt disponible" pastille={{ texte: 'Actif', actif: true }} onPress={() => rubrique('chat', 'Désactiver le chat')} />
        <CarteMenu icone="chatbubbles-outline" titre="Désactiver les commentaires" sous="Bientôt disponible" pastille={{ texte: 'Actifs', actif: true }} onPress={() => rubrique('commentaires', 'Désactiver les commentaires')} />
        <CarteMenu icone="notifications-outline" titre="Gérer les notifications" sous="Choisir ce que vous recevez" onPress={() => rubrique('notifications', 'Gérer les notifications')} />
      </GroupeCartes>
      <GroupeCartes>
        <CarteMenu icone="lock-closed-outline" titre="Sécurité & Connexion" sous="Mot de passe et appareils" onPress={() => router.push('/mon-profil/securite')} />
        <CarteMenu icone="log-out-outline" titre="Se déconnecter" rouge onPress={deconnexion} />
        {plateforme === 'locaux' ? (
          <CarteMenu icone="arrow-undo-outline" titre="Retour au Marketplace" sous="Revenir à Locaux" sansFleche onPress={() => router.replace('/marketplace' as Href)} />
        ) : (
          <CarteMenu icone="arrow-undo-outline" titre="Retour à l'accueil" sous="Revenir à Facilité" sansFleche onPress={() => router.replace('/' as Href)} />
        )}
      </GroupeCartes>
    </View>
  );
}
