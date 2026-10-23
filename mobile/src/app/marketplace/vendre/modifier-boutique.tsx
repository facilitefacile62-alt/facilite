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
    setEnregistrement(true);
    try {
      await enregistrerChampsProfil(userId, {
        full_name: `${prenom.trim()} ${nom.trim()}`.trim(),
        // La colonne s'appelle date_naissance (« birth_date » n'existe pas dans profiles : l'enregistrement échouait).
        date_naissance: naissance.trim() || null,
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

            <ChampDateNaissance valeur={naissance} onChange={setNaissance} onLayout={suivre('naissance')} onFocus={faireVoir('naissance')} />

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
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « AAAA-MM-JJ » valide (mois 1-12, jour existant dans ce mois, année plausible). */
function dateValide(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (annee < 1900 || annee > new Date().getFullYear() || mois < 1 || mois > 12 || jour < 1) return false;
  return jour <= new Date(annee, mois, 0).getDate();
}

/** Date de naissance en trois listes déroulantes (Jour, Mois, Année), comme sur Facebook ; enregistrée sous la forme « AAAA-MM-JJ ». */
function ChampDateNaissance({ valeur, onChange, onFocus, onLayout }: { valeur: string; onChange: (v: string) => void; onFocus: () => void; onLayout?: (e: LayoutChangeEvent) => void }) {
  const [a0, m0, j0] = valeur ? valeur.split('-') : ['', '', ''];
  const [jour, setJour] = useState(j0 ? String(Number(j0)) : '');
  const [mois, setMois] = useState(m0 ? String(Number(m0)) : '');
  const [annee, setAnnee] = useState(a0 && Number(a0) > 0 ? a0 : '');
  const [ouvert, setOuvert] = useState<'jour' | 'mois' | 'annee' | null>(null);

  function maj(j: string, m: string, a: string) {
    setJour(j);
    setMois(m);
    setAnnee(a);
    // Rien de choisi : valeur vide. Sinon la valeur composée (même incomplète : la validation à l'enregistrement la refuse).
    onChange(!j && !m && !a ? '' : `${(a || '0').padStart(4, '0')}-${(m || '0').padStart(2, '0')}-${(j || '0').padStart(2, '0')}`);
  }

  const anneeCourante = new Date().getFullYear();
  const choix: { cle: 'jour' | 'mois' | 'annee'; libelle: string; texte: string; flex: number; options: { valeur: string; texte: string }[] }[] = [
    { cle: 'jour', libelle: 'Jour', texte: jour, flex: 2, options: Array.from({ length: 31 }, (_, i) => ({ valeur: String(i + 1), texte: String(i + 1) })) },
    { cle: 'mois', libelle: 'Mois', texte: mois ? MOIS[Number(mois) - 1] : '', flex: 3, options: MOIS.map((nom, i) => ({ valeur: String(i + 1), texte: nom })) },
    { cle: 'annee', libelle: 'Année', texte: annee, flex: 2.4, options: Array.from({ length: anneeCourante - 1899 }, (_, i) => ({ valeur: String(anneeCourante - i), texte: String(anneeCourante - i) })) },
  ];
  const liste = choix.find((c) => c.cle === ouvert);

  return (
    <View className="bg-white rounded-[14px] px-3.5 pt-2.5 pb-3" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }} onLayout={onLayout}>
      <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>Date de naissance</Text>
      <View className="flex-row gap-2.5 mt-2">
        {choix.map((c) => (
          <Pressable
            key={c.cle}
            onPress={() => {
              setOuvert((o) => (o === c.cle ? null : c.cle));
              onFocus();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${c.libelle} de naissance`}
            className="flex-row items-center justify-between rounded-xl px-3"
            style={{ flex: c.flex, height: 50, borderWidth: 1, borderColor: ouvert === c.cle ? '#1A1A1A' : 'rgba(0,0,0,0.15)', backgroundColor: '#fff' }}>
            <Text numberOfLines={1} className="flex-1 text-[14.5px]" style={{ color: c.texte ? '#1A1A1A' : 'rgba(0,0,0,0.45)', fontWeight: c.texte ? '700' : '600' }}>
              {c.texte || c.libelle}
            </Text>
            <Ionicons name={ouvert === c.cle ? 'chevron-up' : 'chevron-down'} size={18} color="#1A1A1A" />
          </Pressable>
        ))}
      </View>
      {liste ? (
        <View className="mt-2 rounded-xl overflow-hidden" style={{ maxHeight: 230, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#fff' }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {liste.options.map((o) => {
              const actif = o.valeur === (liste.cle === 'jour' ? jour : liste.cle === 'mois' ? mois : annee);
              return (
                <Pressable
                  key={o.valeur}
                  onPress={() => {
                    maj(liste.cle === 'jour' ? o.valeur : jour, liste.cle === 'mois' ? o.valeur : mois, liste.cle === 'annee' ? o.valeur : annee);
                    setOuvert(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  className="px-4 justify-center"
                  style={{ height: 46, backgroundColor: actif ? '#ECFDF5' : '#fff' }}>
                  <Text className="text-[15px]" style={{ color: '#1A1A1A', fontWeight: actif ? '800' : '500' }}>{o.texte}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

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
