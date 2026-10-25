import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import EnteteMarketplace from '@/components/EnteteMarketplace';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import type { Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import { chargerMesBoutiques, creerBoutique, enregistrerIdentiteVendeur } from '@/lib/vendeur';

// « Ma boutique » / « Devenir Vendeur ».
//
// Sans boutique : le parcours de création en deux étapes (ci-dessous).
// Avec une boutique : on ouvre la page complète de la boutique
// (marketplace/boutique/[id].tsx). L'ancien gabarit de cette page (bannière
// hachurée, onglets Article / Service / Établissement, grille d'articles) a
// été supprimé le 12/10/2026 à la demande du propriétaire, qui fournira le
// design validé avant toute nouvelle implémentation.
const VERT_PROFOND = '#0d3b34';

function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

function Champ({ libelle, ...props }: TextInputProps & { libelle: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">{libelle}</Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        className="bg-white text-[14.5px] text-[#1A1A1A]"
        style={{ height: 54, borderWidth: 1.5, borderColor: '#0B3D2A', borderRadius: 16, paddingHorizontal: 16 }}
        {...props}
      />
    </View>
  );
}

// « Devenir Vendeur » en deux étapes, comme sur le site : d'abord l'identité
// du compte (prénom, nom, téléphone, e-mail facultatif), puis la boutique.
// L'identité est enregistrée dès « Continuer » : une étape 2 abandonnée ne
// fait pas perdre les informations saisies.
function FormulaireCreationBoutique({
  userId,
  onCree,
  etape,
  setEtape,
}: {
  userId: string;
  onCree: () => void;
  etape: 'identite' | 'boutique';
  setEtape: (e: 'identite' | 'boutique') => void;
}) {
  const { user, profile } = useAuth();
  const { activer } = useLocalisation();
  const connu = decouperNom(profile?.full_name as string | undefined);
  const [prenom, setPrenom] = useState(connu.prenom);
  const [nomFamille, setNomFamille] = useState(connu.nom);
  // Deux cases séparées, remplies par la personne, sans confirmation : numéro d'appel (profiles.phone) et WhatsApp (boutique).
  const [telephone, setTelephone] = useState((profile?.phone as string | undefined) ?? '');
  const [whatsapp, setWhatsapp] = useState((profile?.phone as string | undefined) ?? '');
  const [email, setEmail] = useState((profile?.contact_email as string | undefined) || user?.email || '');
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [relevePosition, setRelevePosition] = useState<'aucun' | 'en_cours' | 'ok' | 'echec'>('aucun');
  const [enregistrement, setEnregistrement] = useState(false);

  async function continuerIdentite() {
    if (!prenom.trim() || !nomFamille.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    if (!whatsapp.trim()) {
      Alert.alert('WhatsApp manquant', 'Indiquez votre numéro WhatsApp pour que les acheteurs puissent vous joindre.');
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrerIdentiteVendeur(userId, { prenom, nom: nomFamille, telephone, email });
      setEtape('boutique');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer vos informations.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function releverPosition() {
    setRelevePosition('en_cours');
    const { position: releve } = await activer().catch(() => ({ position: null }));
    setPosition(releve);
    setRelevePosition(releve ? 'ok' : 'echec');
  }

  async function creer() {
    if (!nom.trim()) {
      Alert.alert('Nom manquant', 'Donnez un nom à votre boutique.');
      return;
    }
    setEnregistrement(true);
    try {
      await creerBoutique(userId, { nom, ville, quartier: null, telephoneWhatsapp: whatsapp, position });
      onCree();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer votre boutique.');
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <ScrollView contentContainerClassName="px-4 pt-3 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View className="flex-row gap-2">
        <View className="flex-1 h-1.5 rounded-full bg-[#10B981]" />
        <View className={`flex-1 h-1.5 rounded-full ${etape === 'boutique' ? 'bg-[#10B981]' : 'bg-black/10'}`} />
      </View>

      {etape === 'identite' ? (
        <>
          <Champ libelle="Prénom*" value={prenom} onChangeText={setPrenom} placeholder="Votre prénom" />
          <Champ libelle="Nom*" value={nomFamille} onChangeText={setNomFamille} placeholder="Votre nom" />
          <Champ
            libelle="Numéro d'appel (facultatif)"
            value={telephone}
            onChangeText={setTelephone}
            placeholder="+221 77 000 00 00"
            keyboardType="phone-pad"
          />
          <Champ
            libelle="Numéro WhatsApp*"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="+221 77 000 00 00"
            keyboardType="phone-pad"
          />
          <Champ
            libelle="E-mail (facultatif)"
            value={email}
            onChangeText={setEmail}
            placeholder="nom@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </>
      ) : (
        <>
          <Champ libelle="Nom de la boutique" value={nom} onChangeText={setNom} placeholder="Ex. Moïse Couture" />

          <View className="rounded-[18px] p-3.5 gap-3" style={{ borderWidth: 1.5, borderColor: '#34D399', borderStyle: 'dashed', backgroundColor: '#fff' }}>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-[11px] items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
                <Ionicons name="location" size={18} color="#EC4899" />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Positionner ma boutique</Text>
                <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Aidez les acheteurs proches à vous trouver</Text>
              </View>
            </View>
            <Pressable
              onPress={releverPosition}
              disabled={relevePosition === 'en_cours'}
              className="flex-row items-center justify-center gap-2 rounded-[12px] disabled:opacity-60"
              style={{ height: 50, backgroundColor: relevePosition === 'ok' ? '#047857' : '#2563EB' }}>
              {relevePosition === 'en_cours' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name={relevePosition === 'ok' ? 'checkmark-circle' : 'navigate'} size={15} color="#fff" />
              )}
              <Text className="text-white text-[14px] font-extrabold">
                {relevePosition === 'ok'
                  ? 'Position relevée'
                  : relevePosition === 'echec'
                    ? 'Position indisponible, réessayez'
                    : 'Démarrer le relevé'}
              </Text>
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">Ville</Text>
            <SelecteurDepartement valeur={ville} onChoisir={setVille} />
          </View>
        </>
      )}

      {etape === 'identite' ? (
        <Pressable
          onPress={continuerIdentite}
          disabled={enregistrement}
          className="rounded-[16px] items-center justify-center mt-2 disabled:opacity-60 bg-[#10B981]" style={{ height: 56 }}>
          {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Continuer →</Text>}
        </Pressable>
      ) : (
        <Pressable
          onPress={creer}
          disabled={enregistrement}
          className="rounded-[16px] items-center justify-center mt-2 disabled:opacity-60" style={{ height: 56, backgroundColor: '#0F172A' }}>
          {enregistrement ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-[14.5px] font-bold">Enregistrer les modifications</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

export default function MaBoutiqueScreen() {
  const router = useRouter();
  const { publier } = useLocalSearchParams<{ publier?: string }>();
  const { user } = useAuth();
  const [chargement, setChargement] = useState(true);
  const [aBoutique, setABoutique] = useState<boolean | undefined>(undefined); // undefined = chargement
  const [etapeCreation, setEtapeCreation] = useState<'identite' | 'boutique'>('identite');

  async function recharger() {
    if (!user?.id) return;
    try {
      const liste = await chargerMesBoutiques(user.id);
      const active = liste[0] ?? null;
      setABoutique(Boolean(active));
      // Une boutique existe : on ouvre « Ma boutique » (ARTICLE · SERVICE · ÉTABLISSEMENT).
      // Bouton « Publier » de la barre du bas (?publier=1) : directement « Comment voulez-vous vendre ? » (étape 1 de la
      // publication). Sans boutique, on reste sur « Devenir actif » ; les autres entrées ouvrent « Ma boutique ».
      if (active) router.replace((publier ? `/marketplace/vendre/publier?storeId=${active.id}` : '/marketplace/vendre/ma-boutique') as Href);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      recharger();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, publier])
  );

  function retour() {
    if (aBoutique === false && etapeCreation === 'boutique') {
      setEtapeCreation('identite');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace
          titre="Devenir actif"
          sousTitre={etapeCreation === 'identite' ? 'Étape 1 sur 2 · Identité' : 'Étape 2 sur 2 · Boutique'}
          onRetour={retour}
        />

        {chargement || aBoutique === undefined || aBoutique === true ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : !user?.id ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer votre boutique.</Text>
          </View>
        ) : (
          <FormulaireCreationBoutique userId={user.id} onCree={recharger} etape={etapeCreation} setEtape={setEtapeCreation} />
        )}
      </View>
    </View>
  );
}
