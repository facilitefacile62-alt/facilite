import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';
import { urlPhoto } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';
import RemplissageRapide, { type InfosScannees } from '@/components/RemplissageRapide';
import SelecteurDateNaissance, { dateValide } from '@/components/SelecteurDateNaissance';
import { departementLePlusProche } from '@/lib/departements';
import { VILLES } from '@/lib/offresParVille';
import {
  chargerMesBoutiques,
  choisirEtEnvoyerPhotoBoutique,
  definirCouvertureBoutique,
  definirLogoBoutique,
  modifierBoutique,
  type MaBoutique,
} from '@/lib/vendeur';

// « Boutique — Modifier le profil » — maquette 32 : logo, Prénom/Nom avec
// compteur, WhatsApp, ville avec GPS verrouillé, relevé de position, date
// de naissance et sexe, bouton « ✓ Enregistrer » dans l'en-tête.
//
// Deux contraintes du modèle de données, visibles dans l'écran :
// - La position d'une boutique est posée UNE SEULE FOIS, à la création
//   (creer_ma_boutique l'exige), et plus aucune fonction ne la déplace
//   ensuite : enregistrer_ma_boutique a été supprimée le 02/09/2026
//   (20260902240000_boutiques_multiples.sql) et modifier_ma_boutique ne
//   porte ni latitude ni longitude. Le verrou est délibéré — c'est lui qui
//   rend la distance affichée croyable (20260902220000). L'écran l'affiche
//   donc comme un état, sans bouton de relevé : un bouton appellerait une
//   fonction qui n'existe plus.
// - Le logo est un `avatar_config` (modifier_mon_avatar_boutique), pas une
//   photo téléversée : aucun éditeur mobile n'existe encore, le crayon le
//   dit au lieu d'ouvrir un sélecteur qui n'enregistrerait rien.
const BLEU = '#2563EB';
const VERT = '#10B981';
const MAX_NOM = 20;

function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

export default function ModifierBoutiqueScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id;

  const connu = decouperNom(profile?.full_name as string | undefined);
  const [prenom, setPrenom] = useState(connu.prenom);
  const [nom, setNom] = useState(connu.nom);
  const [whatsapp, setWhatsapp] = useState('');
  const [ville, setVille] = useState('');
  const dateFixee = typeof profile?.date_naissance === 'string' && profile.date_naissance.length > 0;
  const [naissance, setNaissance] = useState(typeof profile?.date_naissance === 'string' ? profile.date_naissance : '');
  const [sexe, setSexe] = useState(typeof profile?.gender === 'string' ? profile.gender : '');
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiLogo, setEnvoiLogo] = useState(false);
  // Clavier : hauteur suivie pour laisser assez de place sous le dernier champ, et chaque champ touché REMONTE au-dessus du clavier.
  const defilement = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const [clavier, setClavier] = useState(0);
  useEffect(() => {
    const ouvre = Keyboard.addListener('keyboardDidShow', (e) => setClavier(e.endCoordinates.height));
    const ferme = Keyboard.addListener('keyboardDidHide', () => setClavier(0));
    return () => {
      ouvre.remove();
      ferme.remove();
    };
  }, []);
  const suivre = (nom: string) => (e: LayoutChangeEvent) => {
    positions.current[nom] = e.nativeEvent.layout.y;
  };
  const faireVoir = (nom: string) => () =>
    setTimeout(() => defilement.current?.scrollTo({ y: Math.max(0, (positions.current[nom] ?? 0) - 90), animated: true }), 280);
  const [envoiCouverture, setEnvoiCouverture] = useState(false);

  // Logo (rond) et photo de couverture (bannière) : enregistrés tout de suite, visibles par les visiteurs de la boutique.
  async function changerImage(type: 'logo' | 'couverture') {
    if (!boutique || !userId || envoiLogo || envoiCouverture) return;
    const setEnvoi = type === 'logo' ? setEnvoiLogo : setEnvoiCouverture;
    setEnvoi(true);
    try {
      const chemin = await choisirEtEnvoyerPhotoBoutique(userId, type === 'logo' ? [1, 1] : [16, 7]);
      if (!chemin) return;
      if (type === 'logo') {
        await definirLogoBoutique(boutique.id, chemin);
        setBoutique({ ...boutique, logo_photo: chemin });
      } else {
        await definirCouvertureBoutique(boutique.id, chemin);
        setBoutique({ ...boutique, cover_photo: chemin });
      }
    } catch (e) {
      Alert.alert(type === 'logo' ? 'Logo impossible' : 'Couverture impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  const charger = useCallback(() => {
    if (!userId) return;
    chargerMesBoutiques(userId)
      .then((liste) => {
        const b = liste[0] ?? null;
        setBoutique(b);
        if (b) {
          setWhatsapp(b.telephone_whatsapp ?? '');
          setVille(b.ville ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, [userId]);

  useFocusEffect(charger);

  const positionConnue = boutique?.latitude != null && boutique?.longitude != null;
  // Département de la position verrouillée (centre de département le plus proche, même calcul que le site).
  const departement = positionConnue && boutique ? departementLePlusProche(boutique.latitude, boutique.longitude) : null;
  // Ville de la position verrouillée quand aucune ville n'est enregistrée : la plus proche parmi les villes connues de l'application.
  const villeGps =
    positionConnue && boutique
      ? VILLES.reduce((meilleure, v) => {
          const d = (v.lat - (boutique.latitude as number)) ** 2 + (v.lng - (boutique.longitude as number)) ** 2;
          return d < meilleure.d ? { d, nom: v.nom } : meilleure;
        }, { d: Infinity, nom: '' }).nom
      : '';

  // Scan d'un document : les informations lues remplissent le formulaire (rien n'est enregistré avant « Enregistrer »).
  function remplirDepuisScan(infos: InfosScannees) {
    const lu = infos.nomComplet ? decouperNom(infos.nomComplet) : { prenom: infos.prenom ?? '', nom: infos.nom ?? '' };
    if (lu.prenom) setPrenom(lu.prenom);
    if (lu.nom) setNom(lu.nom);
    if (infos.ville && !ville.trim()) setVille(infos.ville);
    if (infos.telephone && !whatsapp.trim()) setWhatsapp(infos.telephone.replace(/[^\d+]/g, ''));
  }

  async function enregistrer() {
    if (!userId || enregistrement) return;
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    if (naissance && !dateValide(naissance)) {
      Alert.alert('Date de naissance', 'Choisis le jour, le mois et l’année, ou laisse les trois listes vides.');
      return;
    }
    // Un numéro n'appartient qu'à un seul utilisateur : on prévient AVANT d'enregistrer quoi que ce soit.
    if (whatsapp.trim()) {
      const { data: pris, error: erreurNumero } = await supabase.rpc('numero_deja_utilise', { p_numero: whatsapp.trim() });
      if (!erreurNumero && pris === true) {
        Alert.alert('Numéro déjà utilisé', 'Ce numéro WhatsApp est déjà utilisé par un autre compte. Un numéro ne peut appartenir qu’à un seul utilisateur.');
        return;
      }
    }
    setEnregistrement(true);
    try {
      await enregistrerChampsProfil(userId, {
        full_name: `${prenom.trim()} ${nom.trim()}`.trim(),
        // La colonne s'appelle date_naissance (« birth_date » n'existe pas dans profiles : l'enregistrement échouait). Une date déjà
        // renseignée ne change jamais (la base la verrouille) : on ne la renvoie pas.
        ...(dateFixee ? {} : { date_naissance: naissance.trim() || null }),
        gender: sexe.trim() || null,
      });
      if (boutique) {
        await modifierBoutique(boutique.id, {
          nom: boutique.nom,
          quartier: boutique.quartier,
          ville: (ville.trim() || villeGps) || null,
          telephoneWhatsapp: whatsapp.trim() || null,
        });
      }
      await refreshProfile();
      Alert.alert('Profil enregistré');
      if (router.canGoBack()) router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <MarketplaceHeader />

        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06]">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            className="flex-row items-center gap-1.5 bg-[#EEF2FF] rounded-full px-3 py-2">
            <Ionicons name="arrow-back" size={14} color={BLEU} />
            <Text className="text-[12.5px] font-bold" style={{ color: BLEU }}>
              Retour
            </Text>
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Modifier le profil</Text>
            <Text className="text-[11px] font-bold" style={{ color: VERT }}>
              Informations &amp; Localisation
            </Text>
          </View>
          <Pressable
            onPress={enregistrer}
            disabled={enregistrement}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ borderWidth: 1.5, borderColor: '#34D399', backgroundColor: '#F3FBF7', opacity: enregistrement ? 0.6 : 1 }}>
            {enregistrement ? (
              <ActivityIndicator color="#047857" size="small" />
            ) : (
              <Ionicons name="checkmark" size={14} color="#047857" />
            )}
            <Text className="text-[12.5px] font-bold text-[#047857]">Enregistrer</Text>
          </Pressable>
        </View>

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={VERT} />
          </View>
        ) : (
          <ScrollView
            ref={defilement}
            contentContainerClassName="px-4 pt-5 gap-3"
            contentContainerStyle={{ paddingBottom: clavier + 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {boutique ? (
              <Pressable
                onPress={() => changerImage('couverture')}
                disabled={envoiCouverture}
                accessibilityLabel="Changer la photo de couverture de la boutique"
                className="w-full rounded-[18px] items-center justify-center overflow-hidden"
                style={{ height: 130, borderWidth: 2, borderColor: '#A7E8D2', borderStyle: 'dashed', backgroundColor: '#E8E4DA' }}>
                {boutique.cover_photo ? (
                  <Image source={{ uri: (boutique.cover_photo ? urlPhoto(boutique.cover_photo) : undefined) ?? undefined }} alt="Couverture de la boutique" style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={26} color="rgba(0,0,0,0.3)" />
                    <Text className="text-[11px] text-black/40 mt-1">Photo de couverture</Text>
                  </>
                )}
                <View className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white items-center justify-center">
                  {envoiCouverture ? <ActivityIndicator size="small" color={VERT} /> : <Ionicons name="pencil" size={13} color="#1A1A1A" />}
                </View>
              </Pressable>
            ) : null}

            <View className="items-center mb-1">
              <Pressable
                onPress={() => changerImage('logo')}
                disabled={envoiLogo || !boutique}
                accessibilityLabel="Changer le logo de la boutique"
                className="w-[110px] h-[110px] rounded-full items-center justify-center overflow-hidden"
                style={{ borderWidth: 2, borderColor: '#A7E8D2', borderStyle: 'dashed', backgroundColor: '#E8E4DA' }}>
                {boutique?.logo_photo ? (
                  <Image source={{ uri: urlPhoto(boutique.logo_photo) ?? undefined }} alt="Logo de la boutique" style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={26} color="rgba(0,0,0,0.3)" />
                    <Text className="text-[11px] text-black/40 mt-1">Logo</Text>
                  </>
                )}
              </Pressable>
              <View className="absolute w-7 h-7 rounded-full bg-white items-center justify-center" style={{ bottom: 4, right: '50%', marginRight: -50 }}>
                {envoiLogo ? <ActivityIndicator size="small" color={VERT} /> : <Ionicons name="pencil" size={12} color="#1A1A1A" />}
              </View>
            </View>

            <RemplissageRapide onRempli={remplirDepuisScan} />

            {/* Prénom et nom côte à côte */}
            <View className="flex-row gap-2.5" onLayout={suivre('prenom')}>
              <View style={{ flex: 1 }}>
                <ChampEncadre libelle="Prénom*" valeur={prenom} onChange={setPrenom} max={MAX_NOM} onFocus={faireVoir('prenom')} />
              </View>
              <View style={{ flex: 1 }}>
                <ChampEncadre libelle="Nom*" valeur={nom} onChange={setNom} max={MAX_NOM} onFocus={faireVoir('prenom')} />
              </View>
            </View>
            <ChampEncadre
              libelle="Numéro WhatsApp*"
              valeur={whatsapp}
              onChange={setWhatsapp}
              indication="Contact direct"
              clavier="phone-pad"
              onLayout={suivre('whatsapp')}
              onFocus={faireVoir('whatsapp')}
            />

            <View className="bg-white rounded-[14px] px-3.5 py-3.5 flex-row items-center gap-2" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }} onLayout={suivre('ville')}>
              <Ionicons name="location" size={14} color="#EF4444" />
              <TextInput
                value={ville || villeGps}
                onChangeText={setVille}
                onFocus={faireVoir('ville')}
                editable={!positionConnue}
                placeholder="Ville"
                placeholderTextColor="rgba(0,0,0,0.3)"
                className="flex-1 text-[14.5px] font-bold text-[#1A1A1A]"
              />
              {positionConnue ? (
                <View className="bg-[#D1FAE5] rounded-full px-2.5 py-1">
                  <Text className="text-[10.5px] font-bold text-[#047857]">GPS Verrouillé</Text>
                </View>
              ) : null}
            </View>

            {/* Département de la position verrouillée, affiché comme la ville */}
            <View className="bg-white rounded-[14px] px-3.5 py-3 flex-row items-center gap-2" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
              <Ionicons name="map-outline" size={14} color="#047857" />
              <View className="flex-1">
                <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>Département</Text>
                <Text className="text-[14.5px] font-bold text-[#1A1A1A] mt-0.5">{departement || '—'}</Text>
              </View>
              {departement ? (
                <View className="bg-[#D1FAE5] rounded-full px-2.5 py-1">
                  <Text className="text-[10.5px] font-bold text-[#047857]">GPS Verrouillé</Text>
                </View>
              ) : null}
            </View>

            <View className="bg-white rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="navigate-outline" size={15} color="#1A1A1A" />
                  <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Positionner ma boutique</Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-black/45 mt-1.5">
                {positionConnue
                  ? 'Position relevée à la création de la boutique. Elle est figée : c’est ce qui rend la distance affichée aux acheteurs crédible.'
                  : 'Aucune position enregistrée pour cette boutique.'}
              </Text>
              <View
                className="rounded-xl py-3 items-center justify-center flex-row gap-2 mt-3"
                style={{ backgroundColor: '#EEF2FF' }}>
                <Ionicons name={positionConnue ? 'lock-closed' : 'alert-circle-outline'} size={14} color={BLEU} />
                <Text className="text-[13px] font-bold" style={{ color: BLEU }}>
                  {positionConnue ? 'Position verrouillée' : 'Position non définie'}
                </Text>
              </View>
            </View>

            {dateFixee ? (
              <View className="bg-white rounded-[14px] px-3.5 py-3 flex-row items-center gap-2" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
                <Ionicons name="gift-outline" size={15} color="#047857" />
                <View className="flex-1">
                  <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>Date de naissance</Text>
                  <Text className="text-[14.5px] font-bold text-[#1A1A1A] mt-0.5">{(() => { const [a, m, j] = naissance.slice(0, 10).split('-'); return `${Number(j)} ${['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][Number(m) - 1]} ${a}`; })()}</Text>
                </View>
                <View className="bg-[#E5E7EB] rounded-full px-2.5 py-1 flex-row items-center gap-1">
                  <Ionicons name="lock-closed" size={11} color="#4B5563" />
                  <Text className="text-[10.5px] font-bold" style={{ color: '#4B5563' }}>Non modifiable</Text>
                </View>
              </View>
            ) : (
              <SelecteurDateNaissance valeur={naissance} onChange={setNaissance} onLayout={suivre('naissance')} onFocus={faireVoir('naissance')} />
            )}

            <View className="bg-white rounded-[14px] px-3.5 pt-2.5 pb-3" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
              <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>Sexe</Text>
              <View className="flex-row gap-2.5 mt-2">
                {(['Femme', 'Homme'] as const).map((choix) => {
                  const actif = sexe === choix;
                  return (
                    <Pressable
                      key={choix}
                      onPress={() => setSexe(actif ? '' : choix)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: actif }}
                      className="flex-1 items-center justify-center rounded-xl"
                      style={{ height: 46, backgroundColor: actif ? VERT : '#F3F4F6', borderWidth: 1, borderColor: actif ? VERT : 'rgba(0,0,0,0.08)' }}>
                      <Text className="text-[15px] font-black" style={{ color: actif ? '#fff' : '#1A1A1A' }}>{choix}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Champ de la maquette : libellé vert posé sur la bordure, compteur à droite. */
function ChampEncadre({
  libelle,
  valeur,
  onChange,
  max,
  indication,
  clavier,
  onFocus,
  onLayout,
}: {
  onFocus?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  max?: number;
  indication?: string;
  clavier?: 'phone-pad' | 'default';
}) {
  return (
    <View className="bg-white rounded-[14px] px-3.5 pt-2.5 pb-3" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }} onLayout={onLayout}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>
          {libelle}
        </Text>
        {max ? (
          <Text className="text-[11px] text-black/35">
            {valeur.length} / {max}
          </Text>
        ) : indication ? (
          <Text className="text-[11px] text-black/35">{indication}</Text>
        ) : null}
      </View>
      <TextInput
        value={valeur}
        onChangeText={(v) => onChange(max ? v.slice(0, max) : v)}
        keyboardType={clavier ?? 'default'}
        onFocus={onFocus}
        className="text-[14.5px] text-[#1A1A1A] mt-1 p-0"
      />
    </View>
  );
}
