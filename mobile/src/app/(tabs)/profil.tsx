import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';
import LigneOutil from '@/components/LigneOutil';
import { useAuth } from '@/context/AuthContext';
import {
  ajouterDocument,
  badgeDocument,
  chargerMesDocuments,
  dateLisible,
  supprimerDocument,
  urlDocument,
  type DocumentProfil,
} from '@/lib/documents';
import { OUTILS } from '@/lib/outils';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// Profil Facilité — maquettes « Profil — Documents » (37) et
// « Profil — Fonctionnalités » (38).
//
// L'écran précédent était un menu à trois lignes (Informations
// personnelles / Mes CV et documents / Paramètres) avec un bouton
// Déconnexion : rien de commun avec les maquettes. Charte §4 : en-tête
// avec photo, nom de la boutique et sa description, boutons « Modifier
// infos » et « Paramètres », puis DEUX onglets — Documents et
// Fonctionnalités — et surtout PAS de déconnexion ici (elle vit dans les
// Réglages).
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const BLEU = '#2563EB';
const VERT = '#10B981';

type Onglet = 'documents' | 'fonctionnalites';

export default function ProfilScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const userId = user?.id;

  const [onglet, setOnglet] = useState<Onglet>('documents');
  const [documents, setDocuments] = useState<DocumentProfil[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let annule = false;
      chargerMesDocuments(userId)
        .then((d) => {
          if (annule) return;
          setDocuments(d);
          setErreur(false);
        })
        .catch(() => {
          if (!annule) setErreur(true);
        });
      chargerMesBoutiques(userId)
        .then((liste) => {
          if (!annule) setBoutique(liste[0] ?? null);
        })
        .catch(() => {});
      return () => {
        annule = true;
      };
    }, [userId])
  );

  const ouvrirDocument = async (d: DocumentProfil) => {
    const url = await urlDocument(d.chemin);
    if (!url) {
      Alert.alert('Document indisponible', "Ce document n'a pas pu être ouvert.");
      return;
    }
    router.push(`/document?url=${encodeURIComponent(url)}&titre=${encodeURIComponent(d.titre)}&image=${d.estImage ? '1' : '0'}`);
  };

  // « Télécharger » : on ouvre l'URL signée hors de l'app, c'est le
  // téléchargeur du téléphone qui prend le relais (aucun module de
  // téléchargement natif n'est installé, on ne simule rien).
  const telechargerDocument = async (d: DocumentProfil) => {
    const url = await urlDocument(d.chemin);
    if (!url) {
      Alert.alert('Document indisponible', "Ce document n'a pas pu être récupéré.");
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Téléchargement impossible', "Aucune application n'a pu ouvrir ce fichier."));
  };

  const confirmerSuppression = (d: DocumentProfil) => {
    Alert.alert('Supprimer ce document ?', d.titre, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          supprimerDocument(d.id)
            .then(() => setDocuments((liste) => (liste ?? []).filter((x) => x.id !== d.id)))
            .catch((e: Error) => Alert.alert('Suppression impossible', e.message));
        },
      },
    ]);
  };

  const importer = () => {
    if (!userId || envoiEnCours) return;
    setEnvoiEnCours(true);
    ajouterDocument(userId)
      .then((nouveau) => {
        if (nouveau) setDocuments((liste) => [nouveau, ...(liste ?? [])]);
      })
      .catch((e: Error) => Alert.alert('Ajout impossible', e.message))
      .finally(() => setEnvoiEnCours(false));
  };

  const nomAffiche = boutique?.nom || profile?.full_name || 'Mon profil';
  const sousTitre = boutique
    ? [boutique.quartier, boutique.ville].filter(Boolean).join(', ') || 'Boutique sur Facilité'
    : user?.email || '';

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* En-tête de profil : photo + « + », nom de la boutique, Modifier infos */}
          <View className="px-4 pt-4">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.push('/mon-profil/a-propos')}
                accessibilityLabel="Photo de profil"
                className="w-[72px] h-[72px] rounded-full bg-[#E8E4DA] items-center justify-center">
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    alt="Photo de profil"
                    style={{ width: 72, height: 72, borderRadius: 36 }}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="person" size={30} color="rgba(0,0,0,0.3)" />
                )}
                <View
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full items-center justify-center border-2 border-[#F2F0EA]"
                  style={{ backgroundColor: VERT }}>
                  <Ionicons name="add" size={14} color="#fff" />
                </View>
              </Pressable>

              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="storefront" size={15} color="#B45309" />
                  <Text className="text-[16px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>
                    {nomAffiche}
                  </Text>
                </View>
                <Text className="text-[12px] text-black/50 mt-1" numberOfLines={2}>
                  {sousTitre}
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/mon-profil/a-propos')}
                className="flex-row items-center gap-1.5 bg-white rounded-xl px-3 py-2.5"
                style={{ borderWidth: 1, borderColor: BORDURE }}>
                <Ionicons name="pencil" size={13} color="#1A1A1A" />
                <Text className="text-[12px] font-bold text-[#1A1A1A]">Modifier infos</Text>
              </Pressable>
            </View>
          </View>

          {/* Onglets Documents / Fonctionnalités (jamais « Publications ») */}
          <View className="flex-row gap-2.5 px-4 mt-4">
            {(
              [
                { id: 'documents' as const, label: 'Documents', icone: 'document-text-outline' as const },
                { id: 'fonctionnalites' as const, label: 'Fonctionnalités', icone: 'flash-outline' as const },
              ]
            ).map((o) => {
              const actif = onglet === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setOnglet(o.id)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3"
                  style={{
                    backgroundColor: CARTE,
                    borderWidth: actif ? 1.5 : 1,
                    borderColor: actif ? '#1A1A1A' : BORDURE,
                  }}>
                  <Ionicons name={o.icone} size={14} color="#1A1A1A" />
                  <Text className={`text-[13px] ${actif ? 'font-black' : 'font-semibold'} text-[#1A1A1A]`}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {onglet === 'documents' ? (
            <View className="px-4 mt-3">
              <Pressable
                onPress={importer}
                disabled={envoiEnCours}
                className="rounded-2xl py-3.5 items-center justify-center flex-row gap-2"
                style={{ backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE, opacity: envoiEnCours ? 0.6 : 1 }}>
                {envoiEnCours ? (
                  <ActivityIndicator color={BLEU} size="small" />
                ) : (
                  <Ionicons name="add" size={16} color={BLEU} />
                )}
                <Text className="text-[13.5px] font-bold" style={{ color: BLEU }}>
                  {envoiEnCours ? 'Envoi en cours…' : 'Ajouter mes documents'}
                </Text>
              </Pressable>

              {documents === null ? (
                erreur ? (
                  <View className="py-12 px-6 items-center">
                    <Ionicons name="cloud-offline-outline" size={32} color="rgba(0,0,0,0.25)" />
                    <Text className="text-[13px] text-black/50 text-center mt-2">
                      Impossible de charger vos documents pour le moment.
                    </Text>
                  </View>
                ) : (
                  <View className="py-12 items-center">
                    <ActivityIndicator color={BLEU} />
                  </View>
                )
              ) : documents.length === 0 ? (
                <View className="py-12 px-6 items-center">
                  <Ionicons name="document-outline" size={32} color="rgba(0,0,0,0.25)" />
                  <Text className="text-[13px] text-black/50 text-center mt-2">
                    Aucun document pour l&apos;instant. Ajoutez votre CV ou votre lettre de motivation.
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
                  {documents.map((d) => (
                    <CarteDocument
                      key={d.id}
                      document={d}
                      onOuvrir={() => ouvrirDocument(d)}
                      onTelecharger={() => telechargerDocument(d)}
                      onSupprimer={() => confirmerSuppression(d)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={OUTILS}
              keyExtractor={(item) => item.id}
              contentContainerClassName="px-4 py-3"
              ItemSeparatorComponent={() => <View className="h-2.5" />}
              renderItem={({ item }) => <LigneOutil outil={item} onPress={() => item.ouvrir(router)} />}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Carte d'un document : aperçu, pastille PDF/PHOTO, nom, date, actions. */
function CarteDocument({
  document,
  onOuvrir,
  onTelecharger,
  onSupprimer,
}: {
  document: DocumentProfil;
  onOuvrir: () => void;
  onTelecharger: () => void;
  onSupprimer: () => void;
}) {
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
      <Pressable onPress={onOuvrir} className="w-full aspect-[3/4] bg-[#E8E4DA] items-center justify-center">
        <Ionicons name={document.estImage ? 'image-outline' : 'document-text-outline'} size={30} color="rgba(0,0,0,0.3)" />
        <View className="absolute bottom-2 left-2 bg-black/70 rounded px-1.5 py-0.5">
          <Text className="text-white text-[9px] font-black">{badgeDocument(document)}</Text>
        </View>
      </Pressable>
      <View className="p-2.5">
        <Text className="text-[12px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {document.titre}
        </Text>
        <Text className="text-[10.5px] text-black/45 mt-0.5">{dateLisible(document.creeLe)}</Text>
        <View className="flex-row gap-2 mt-2">
          <Pressable
            onPress={onOuvrir}
            accessibilityLabel="Voir"
            className="w-8 h-8 rounded-lg bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="eye-outline" size={14} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={onTelecharger}
            accessibilityLabel="Télécharger"
            className="w-8 h-8 rounded-lg bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="download-outline" size={14} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={onSupprimer}
            accessibilityLabel="Supprimer"
            className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center">
            <Ionicons name="trash-outline" size={14} color="#dc2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
