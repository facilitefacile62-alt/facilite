import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteMenu, FOND_CARTES } from '@/components/CarteMenu';
import EnteteRubrique from '@/components/EnteteRubrique';
import SelecteurPays from '@/components/SelecteurPays';
import { useAuth } from '@/context/AuthContext';
import { VILLES } from '@/lib/offresParVille';
import { enregistrerChampsProfil } from '@/lib/profilChamps';
import { chargerMesBoutiques } from '@/lib/vendeur';

// Coordonnées — mêmes cartes que les autres réglages. Deux variantes : « compte » (Paramètres de Facilité) = téléphone et e-mail SEULEMENT, les deux
// moyens de récupérer le compte ; « locaux » (Réglages de Locaux) = en plus le WhatsApp de la boutique, la ville verrouillée et le pays. Téléphone, e-mail et WhatsApp affichent ce qui a été CONFIRMÉ (numéro vérifié par SMS,
// adresse confirmée par e-mail, WhatsApp de la boutique) et ne se modifient pas ici ; chacun porte sa pastille « Confirmé » ou « À confirmer » (aucune confirmation n'est demandée pour le WhatsApp de la boutique : décision du propriétaire). La ville est celle VERROUILLÉE de la boutique (position
// relevée une seule fois à la création) ; sans boutique, celle du profil. Seul le pays se choisit, en menu déroulant (profiles.country).
function Pastille({ texte, vert, attente }: { texte: string; vert?: boolean; attente?: boolean }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full px-2 py-1" style={{ backgroundColor: vert ? '#D1FAE5' : attente ? '#FEF3C7' : '#F0EEE8' }}>
      <Ionicons name={vert ? 'checkmark-circle' : attente ? 'alert-circle' : 'lock-closed'} size={12} color={vert ? '#047857' : attente ? '#B45309' : 'rgba(0,0,0,0.45)'} />
      <Text className="text-[10.5px] font-bold" style={{ color: vert ? '#047857' : attente ? '#B45309' : 'rgba(0,0,0,0.5)' }}>{texte}</Text>
    </View>
  );
}

export default function EcranCoordonnees({ variante }: { variante: 'compte' | 'locaux' }) {
  const complet = variante === 'locaux';
  const { user, profile, refreshProfile } = useAuth();
  const [whatsappBoutique, setWhatsappBoutique] = useState('');
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [villeBoutique, setVilleBoutique] = useState('');
  const [chargement, setChargement] = useState(true);
  const [editionPays, setEditionPays] = useState(false);
  const [pays, setPays] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    chargerMesBoutiques(user.id)
      .then((liste) => {
        const b = liste[0];
        if (!b) return;
        setBoutiqueId(b.id);
        setWhatsappBoutique(b.telephone_whatsapp ?? '');
        if (b.ville) setVilleBoutique(b.ville);
        else if (b.latitude != null && b.longitude != null) {
          // Ville de la position verrouillée : la plus proche parmi les villes connues de l'application.
          const proche = VILLES.reduce((m, v) => {
            const d = (v.lat - (b.latitude as number)) ** 2 + (v.lng - (b.longitude as number)) ** 2;
            return d < m.d ? { d, nom: v.nom } : m;
          }, { d: Infinity, nom: '' });
          setVilleBoutique(proche.nom);
        }
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, [user?.id]);

  const texte = (cle: string) => {
    const v = profile?.[cle];
    return typeof v === 'string' ? v.trim() : '';
  };
  const telephone = user?.phone || texte('phone');
  const email = user?.email || texte('contact_email');
  const whatsapp = whatsappBoutique || texte('contact_whatsapp');
  const ville = villeBoutique || texte('city');
  const paysEnregistre = texte('country');

  async function enregistrerPays() {
    if (!user?.id || enCours) return;
    setEnCours(true);
    try {
      await enregistrerChampsProfil(user.id, { country: pays.trim() || null });
      await refreshProfile();
      setEditionPays(false);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le pays pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Coordonnées" />

        <ScrollView contentContainerClassName="px-5 pb-8 gap-3" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {chargement ? <ActivityIndicator style={{ marginTop: 8 }} color="#047857" /> : null}

          <CarteMenu
            icone="call-outline"
            titre="Téléphone"
            sous={telephone || 'Aucun numéro confirmé'}
            sansFleche
            droite={telephone ? (user?.phone && user?.phone_confirmed_at ? <Pastille texte="Confirmé" vert /> : <Pastille texte="À confirmer" attente />) : undefined}
            onPress={() => {}}
          />
          {complet ? (
          <CarteMenu
            icone="logo-whatsapp"
            titre="WhatsApp"
            sous={whatsapp || 'Aucun numéro WhatsApp'}
            sansFleche
            onPress={() => {}}
          />
          ) : null}
          <CarteMenu
            icone="mail-outline"
            titre="E-mail"
            sous={email || 'Aucune adresse'}
            sansFleche
            droite={email ? (user?.email_confirmed_at ? <Pastille texte="Confirmé" vert /> : <Pastille texte="À confirmer" attente />) : undefined}
            onPress={() => {}}
          />
          {complet ? (
          <>
          <CarteMenu
            icone="location-outline"
            titre="Ville"
            sous={ville || 'Non renseignée'}
            sansFleche
            droite={ville ? <Pastille texte="Verrouillée" /> : undefined}
            onPress={() => {}}
          />

          <CarteMenu
            icone="earth-outline"
            titre="Pays"
            sous={paysEnregistre || 'Choisir un pays'}
            droite={<Ionicons name={editionPays ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(0,0,0,0.45)" />}
            onPress={() => {
              setPays(paysEnregistre);
              setEditionPays((v) => !v);
            }}
          />
          {editionPays ? (
            <View className="bg-white rounded-2xl p-3.5 gap-3">
              <SelecteurPays valeur={pays} onChange={setPays} />
              <Pressable
                onPress={enregistrerPays}
                disabled={enCours}
                className="self-start rounded-full px-5 py-2.5"
                style={{ backgroundColor: '#047857', opacity: enCours ? 0.5 : 1 }}>
                <Text className="text-[13px] font-bold text-white">{enCours ? 'Enregistrement…' : 'Enregistrer'}</Text>
              </Pressable>
            </View>
          ) : null}
          </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
