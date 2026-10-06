import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import {
  chargerMonStatutLivreur,
  demanderDevenirLivreur,
  envoyerDocumentLivreur,
  LIBELLES_VEHICULE,
  type StatutLivreur,
  type TypeVehicule,
} from '@/lib/livraison';
import { chargerMesBoutiques } from '@/lib/vendeur';

// « Devenir livreur » : rubrique Service de la boutique. Réservé aux vendeurs
// (il faut une boutique). La demande est examinée par l'équipe Facilité ;
// tant qu'elle ne l'est pas, l'écran affiche l'attente, sans formulaire.
const VERT_PROFOND = '#0d3b34';
const VEHICULES: TypeVehicule[] = ['pied', 'velo', 'moto', 'voiture'];
const TYPES_DOCUMENT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

type DocumentChoisi = { uri: string; nom: string; type: string };

function FormulaireDemande({
  userId,
  nomInitial,
  telephoneInitial,
  motifRefus,
  onEnvoye,
}: {
  userId: string;
  nomInitial: string;
  telephoneInitial: string;
  motifRefus: string | null;
  onEnvoye: () => void;
}) {
  const [nom, setNom] = useState(nomInitial);
  const [telephone, setTelephone] = useState(telephoneInitial);
  const [zone, setZone] = useState<string | null>(null);
  const [vehicule, setVehicule] = useState<TypeVehicule | null>(null);
  const [pieceJointe, setPieceJointe] = useState<DocumentChoisi | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function choisirDocument() {
    const resultat = await DocumentPicker.getDocumentAsync({ type: TYPES_DOCUMENT, copyToCacheDirectory: true });
    const fichier = resultat.assets?.[0];
    if (!resultat.canceled && fichier) {
      setPieceJointe({ uri: fichier.uri, nom: fichier.name, type: fichier.mimeType || 'application/octet-stream' });
    }
  }

  async function envoyer() {
    if (!nom.trim() || !telephone.trim() || !zone || !vehicule) {
      Alert.alert('Informations manquantes', 'Nom, téléphone, zone et véhicule sont obligatoires.');
      return;
    }
    setEnCours(true);
    try {
      const documentUrls: string[] = [];
      if (pieceJointe) {
        const extension = (pieceJointe.nom.split('.').pop() || 'bin').toLowerCase();
        documentUrls.push(await envoyerDocumentLivreur(pieceJointe.uri, userId, extension, pieceJointe.type));
      }
      await demanderDevenirLivreur({ nomComplet: nom, telephone, villeZone: zone, typeVehicule: vehicule, documentUrls });
      onEnvoye();
    } catch (e) {
      Alert.alert('Demande impossible', e instanceof Error ? e.message : 'Votre demande n’a pas pu être envoyée.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <ScrollView contentContainerClassName="px-5 pt-2 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {motifRefus ? (
        <View className="rounded-2xl bg-red-50 border border-red-100 p-3.5 gap-1">
          <Text className="text-[12.5px] font-bold text-red-700">Votre précédente demande a été refusée</Text>
          <Text className="text-[12px] text-red-700">{motifRefus}</Text>
        </View>
      ) : null}

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Nom et prénom *</Text>
        <TextInput
          value={nom}
          onChangeText={setNom}
          placeholder="Ex. Moussa Diop"
          placeholderTextColor="#9CA3AF"
          className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Téléphone *</Text>
        <TextInput
          value={telephone}
          onChangeText={setTelephone}
          placeholder="77 123 45 67"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Ville ou zone de livraison *</Text>
        <SelecteurDepartement valeur={zone} onChoisir={setZone} />
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Véhicule *</Text>
        <View className="flex-row flex-wrap gap-2">
          {VEHICULES.map((v) => {
            const actif = vehicule === v;
            return (
              <Pressable
                key={v}
                onPress={() => setVehicule(v)}
                className={`rounded-xl border px-4 py-2.5 ${actif ? 'border-[#0d3b34] bg-[#0d3b34]' : 'border-gray-300 bg-white'}`}>
                <Text className={`text-[13px] font-bold ${actif ? 'text-white' : 'text-gray-700'}`}>{LIBELLES_VEHICULE[v]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-[12.5px] font-bold text-gray-700">Pièce d&apos;identité (facultatif)</Text>
        <Pressable
          onPress={choisirDocument}
          className="flex-row items-center gap-3 rounded-2xl border border-gray-300 px-3.5 py-3">
          <Ionicons name="document-attach-outline" size={20} color={VERT_PROFOND} />
          <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
            {pieceJointe ? pieceJointe.nom : 'Joindre un PDF ou une photo'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={envoyer}
        disabled={enCours}
        className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
        style={{ backgroundColor: VERT_PROFOND }}>
        {enCours ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-[14.5px] font-bold">Envoyer ma demande</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default function DevenirLivreurScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [aBoutique, setAboutique] = useState(false);
  const [statut, setStatut] = useState<StatutLivreur>({ livreur: null, demande: null });

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const [boutiques, etat] = await Promise.all([chargerMesBoutiques(userId), chargerMonStatutLivreur(userId)]);
      setAboutique(boutiques.length > 0);
      setStatut(etat);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace/vendre');
  }

  function contenu() {
    if (!userId) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour devenir livreur.</Text>
        </View>
      );
    }
    if (chargement) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10B981" />
        </View>
      );
    }
    if (!aBoutique) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Ionicons name="storefront-outline" size={40} color="#9CA3AF" />
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Créez d&apos;abord votre boutique</Text>
          <Text className="text-[12.5px] text-gray-500 text-center">
            Devenir livreur se fait depuis l&apos;espace Service de votre boutique.
          </Text>
          <Pressable onPress={() => router.replace('/marketplace/vendre')} className="rounded-2xl px-6 py-3" style={{ backgroundColor: VERT_PROFOND }}>
            <Text className="text-white text-[14px] font-bold">Devenir Vendeur</Text>
          </Pressable>
        </View>
      );
    }
    if (statut.livreur?.statut === 'actif') {
      return (
        <View className="px-5 pt-4 gap-4">
          <View className="rounded-2xl bg-[#F8F6F1] border border-black/[0.06] p-4 gap-1.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Vous êtes livreur</Text>
            </View>
            <Text className="text-[12.5px] text-gray-600">
              Véhicule : {LIBELLES_VEHICULE[statut.livreur.type_vehicule]}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/marketplace/livraisons')}
            className="rounded-2xl py-3.5 items-center"
            style={{ backgroundColor: VERT_PROFOND }}>
            <Text className="text-white text-[14.5px] font-bold">Ouvrir mes livraisons</Text>
          </Pressable>
        </View>
      );
    }
    if (statut.livreur?.statut === 'suspendu') {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Ionicons name="pause-circle-outline" size={40} color="#B45309" />
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Accès livreur suspendu</Text>
          {statut.livreur.motif_suspension ? (
            <Text className="text-[12.5px] text-gray-600 text-center">{statut.livreur.motif_suspension}</Text>
          ) : null}
        </View>
      );
    }
    if (statut.demande?.status === 'pending') {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Ionicons name="hourglass-outline" size={40} color="#B45309" />
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Votre demande est en cours de traitement</Text>
          <Text className="text-[12.5px] text-gray-500 text-center">Vous serez averti dès qu&apos;elle sera examinée.</Text>
        </View>
      );
    }
    return (
      <FormulaireDemande
        userId={userId}
        nomInitial={(profile?.full_name as string | undefined) ?? ''}
        telephoneInitial={(profile?.phone as string | undefined) ?? ''}
        motifRefus={statut.demande?.status === 'rejected' ? statut.demande.rejection_reason : null}
        onEnvoye={() => {
          setChargement(true);
          recharger();
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={retour}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <View>
            <Text className="text-[11px] font-bold tracking-wide text-gray-500">SERVICE</Text>
            <Text className="text-[18px] font-black text-[#1A1A1A] -mt-0.5">Devenir livreur</Text>
          </View>
        </View>
        {contenu()}
      </SafeAreaView>
    </View>
  );
}
