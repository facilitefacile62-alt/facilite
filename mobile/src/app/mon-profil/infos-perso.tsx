import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Reproduction du contenu réel de 12b-profil-infos-perso.html. "Modifier
// mon profil" bascule en mode édition (bio/nom/titre/ville/pays/
// téléphone) et écrit sur profiles via update(), même table/colonnes que
// src/app/profil/page.js côté web. Le lien d'invitation reprend la
// résolution slug -> id de src/app/in/[username]/page.js (SITE_URL/in/…).
// Les deux lignes "Retour à l'accueil des offres" / "Déconnexion" du mock
// ne sont pas reproduites ici : redondantes avec le bouton retour de cet
// écran et avec la Déconnexion déjà fonctionnelle dans (tabs)/profil.tsx
// et le menu profil — dupliquer la logique de session dans un 3e endroit
// aurait plus de coût (divergence future) que de valeur.
const SITE_URL = 'https://ffacilite.com';

export default function ProfilInfosPersoScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [modeEdition, setModeEdition] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [bio, setBio] = useState((profile?.bio as string | undefined) || '');
  const [nomComplet, setNomComplet] = useState((profile?.full_name as string | undefined) || '');
  const [titre, setTitre] = useState((profile?.headline as string | undefined) || '');
  const [ville, setVille] = useState((profile?.city as string | undefined) || '');
  const [pays, setPays] = useState((profile?.country as string | undefined) || '');
  const [telephone, setTelephone] = useState((profile?.phone as string | undefined) || '');

  const email = (profile?.contact_email as string | undefined) || user?.email || '';
  const estPublic = profile?.is_public === true;
  const lienInvitation = `${SITE_URL}/in/${(profile?.slug as string | undefined) || user?.id || ''}`;

  function ouvrirEdition() {
    setBio((profile?.bio as string | undefined) || '');
    setNomComplet((profile?.full_name as string | undefined) || '');
    setTitre((profile?.headline as string | undefined) || '');
    setVille((profile?.city as string | undefined) || '');
    setPays((profile?.country as string | undefined) || '');
    setTelephone((profile?.phone as string | undefined) || '');
    setModeEdition(true);
  }

  async function enregistrer() {
    if (!user?.id) return;
    setEnregistrement(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim(),
        full_name: nomComplet.trim(),
        headline: titre.trim(),
        city: ville.trim(),
        country: pays.trim(),
        phone: telephone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    setEnregistrement(false);
    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer vos informations pour le moment.");
      return;
    }
    await refreshProfile();
    setModeEdition(false);
  }

  async function copierLien() {
    await Clipboard.setStringAsync(lienInvitation);
    Alert.alert('Lien copié', 'Le lien de votre profil public a été copié.');
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-5 py-4">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Informations personnelles</Text>
        </View>
        <View className="h-px bg-black/[0.08] mx-5 mb-3.5" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-[#eef3fd] rounded-2xl p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-[#2563EB]">PHRASE D&apos;ACCROCHE BIO</Text>
              <View className="bg-[#dbe8fc] rounded-full px-2 py-1">
                <Text className="text-[11px] font-semibold text-[#2563EB]">{estPublic ? '🌐 Public' : '🔒 Privé'}</Text>
              </View>
            </View>
            {modeEdition ? (
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                placeholder="Une phrase pour vous présenter"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="text-[13.5px] font-semibold text-[#1A1A1A] mt-2 bg-white rounded-xl px-3 py-2.5 min-h-[70px]"
                textAlignVertical="top"
              />
            ) : (
              <Text className="text-[13.5px] font-bold leading-5 text-[#1A1A1A] mt-2">
                {bio || 'Aucune biographie rédigée pour le moment.'}
              </Text>
            )}
          </View>

          <View className="bg-white border border-black/[0.06] rounded-2xl p-3.5 mt-4">
            <Text className="text-[11px] font-bold text-black/40 tracking-wide">INFORMATIONS PERSONNELLES &amp; CV</Text>
            <ChampInfo label="NOM COMPLET" valeur={nomComplet} editable={modeEdition} onChange={setNomComplet} />
            <ChampInfo label="TITRE PROFESSIONNEL" valeur={titre} editable={modeEdition} onChange={setTitre} />
            <ChampInfo label="VILLE ACTUELLE" valeur={ville} editable={modeEdition} onChange={setVille} couleur="#2563EB" />
            <ChampInfo label="PAYS / ORIGINE" valeur={pays} editable={modeEdition} onChange={setPays} couleur="#2563EB" />
          </View>

          <View className="bg-white border border-black/[0.06] rounded-2xl p-3.5 mt-4">
            <Text className="text-[11px] font-bold text-black/40 tracking-wide">COORDONNÉES DE CONTACT</Text>
            <ChampInfo label="TÉLÉPHONE" valeur={telephone} editable={modeEdition} onChange={setTelephone} />
            <View className="mt-2.5">
              <Text className="text-[10.5px] text-black/40">E-MAIL</Text>
              <Text className="text-[14px] font-bold text-[#1A1A1A] mt-0.5">{email}</Text>
            </View>
          </View>

          <View className="flex-row justify-end mt-4 gap-2.5">
            {modeEdition && (
              <Pressable onPress={() => setModeEdition(false)} className="rounded-full px-4.5 py-2.5 border border-black/10">
                <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
              </Pressable>
            )}
            <Pressable
              onPress={modeEdition ? enregistrer : ouvrirEdition}
              disabled={enregistrement}
              className="bg-[#2563EB] rounded-full px-4.5 py-2.5 flex-row items-center gap-1.5">
              <Text className="text-white text-[13px] font-bold">
                {modeEdition ? (enregistrement ? 'Enregistrement…' : '✓ Enregistrer') : '✎ Modifier mon profil'}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between mt-5">
            <View className="flex-1 mr-2.5">
              <Text className="text-[12px] text-black/45">Lien d&apos;invitation</Text>
              <Text className="text-[13px] font-bold text-[#2563EB]" numberOfLines={1}>
                {lienInvitation}
              </Text>
            </View>
            <Pressable onPress={copierLien} className="border border-black/10 rounded-full px-3.5 py-2 bg-white">
              <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">📋 Copier</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ChampInfo({
  label,
  valeur,
  editable,
  onChange,
  couleur,
}: {
  label: string;
  valeur: string;
  editable: boolean;
  onChange: (v: string) => void;
  couleur?: string;
}) {
  return (
    <View className="mt-2.5">
      <Text className="text-[10.5px] text-black/40">{label}</Text>
      {editable ? (
        <TextInput
          value={valeur}
          onChangeText={onChange}
          className="text-[14px] font-bold text-[#1A1A1A] mt-1 border-b border-black/10 pb-1"
          placeholder="—"
          placeholderTextColor="rgba(0,0,0,0.3)"
        />
      ) : (
        <Text style={couleur ? { color: couleur } : undefined} className="text-[14px] font-bold text-[#1A1A1A] mt-0.5">
          {valeur || '—'}
        </Text>
      )}
    </View>
  );
}
