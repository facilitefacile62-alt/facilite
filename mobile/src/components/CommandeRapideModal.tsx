import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { creerCommandeMarketplace, LIBELLES_PAIEMENT, type MoyenPaiement } from '@/lib/commandes';
import { prixLisible, type ArticleMarketplace } from '@/lib/marketplace';

const VERT_PROFOND = '#0d3b34';
const MOYENS: MoyenPaiement[] = ['wave', 'om', 'livraison'];

// « Commander » : enregistre la commande en base (la coordination vendeur /
// livreur / acheteur passe ensuite par « Mes commandes »), puis ouvre la
// conversation WhatsApp du vendeur, comme sur le site. L'argent n'est jamais
// géré par Facilité.
export default function CommandeRapideModal({
  visible,
  article,
  lienWhatsapp,
  onFermer,
}: {
  visible: boolean;
  article: ArticleMarketplace;
  lienWhatsapp: string | null;
  onFermer: () => void;
}) {
  const { profile } = useAuth();
  const quantiteMax = article.quantite > 0 ? article.quantite : 99;
  const [quantite, setQuantite] = useState(1);
  const [nom, setNom] = useState((profile?.full_name as string | undefined) ?? '');
  const [telephone, setTelephone] = useState((profile?.phone as string | undefined) ?? '');
  const [adresse, setAdresse] = useState('');
  const [moyen, setMoyen] = useState<MoyenPaiement>('livraison');
  const [enCours, setEnCours] = useState(false);

  async function envoyer() {
    if (!nom.trim() || !telephone.trim() || !adresse.trim()) {
      Alert.alert('Informations manquantes', 'Nom, téléphone et adresse de livraison sont obligatoires.');
      return;
    }
    setEnCours(true);
    try {
      await creerCommandeMarketplace({
        itemId: article.id,
        quantite,
        livraisonNom: nom,
        livraisonTelephone: telephone,
        livraisonAdresse: adresse,
        moyenPaiement: moyen,
      });
      onFermer();
      if (lienWhatsapp) {
        const texte = encodeURIComponent(
          `Bonjour, je viens de commander (${quantite} x ${article.titre}) sur Facilité. Êtes-vous disponible ?`
        );
        const url = lienWhatsapp.includes('?') ? `${lienWhatsapp}&text=${texte}` : `${lienWhatsapp}?text=${texte}`;
        Linking.openURL(url).catch(() => {});
      }
      Alert.alert('Commande envoyée', 'Le vendeur est prévenu. Suivez la livraison dans Mes commandes.');
    } catch (e) {
      Alert.alert('Commande impossible', e instanceof Error ? e.message : "Votre commande n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-4 pt-2 pb-3 border-b border-gray-100">
          <Text className="text-[17px] font-black text-[#1A1A1A]">Commander</Text>
          <Pressable onPress={onFermer} accessibilityLabel="Fermer" hitSlop={10}>
            <Ionicons name="close" size={24} color="#1A1A1A" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="px-4 py-4 gap-4 pb-10" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center gap-3 rounded-2xl bg-[#F8F6F1] p-3">
            <View className="flex-1">
              <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={2}>
                {article.titre}
              </Text>
              <Text className="text-[12.5px] text-gray-500 mt-0.5">
                {prixLisible(article.prixXof)} FCFA l&apos;unité
              </Text>
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Quantité</Text>
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => setQuantite((q) => Math.max(1, q - 1))}
                disabled={quantite <= 1}
                className="w-10 h-10 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
                <Ionicons name="remove" size={18} color="#1A1A1A" />
              </Pressable>
              <Text className="text-[16px] font-extrabold text-[#1A1A1A] w-8 text-center">{quantite}</Text>
              <Pressable
                onPress={() => setQuantite((q) => Math.min(quantiteMax, q + 1))}
                disabled={quantite >= quantiteMax}
                className="w-10 h-10 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
                <Ionicons name="add" size={18} color="#1A1A1A" />
              </Pressable>
              <Text className="text-[13px] font-bold ml-auto" style={{ color: VERT_PROFOND }}>
                Total : {prixLisible(article.prixXof * quantite)} FCFA
              </Text>
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom complet *</Text>
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
            <Text className="text-[12.5px] font-bold text-gray-700">Adresse de livraison *</Text>
            <TextInput
              value={adresse}
              onChangeText={setAdresse}
              placeholder="Quartier, repère, rue"
              placeholderTextColor="#9CA3AF"
              multiline
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A] min-h-[64px]"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Moyen de paiement</Text>
            <View className="flex-row gap-2">
              {MOYENS.map((m) => {
                const actif = moyen === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMoyen(m)}
                    className={`flex-1 rounded-xl border py-2.5 items-center ${actif ? 'border-[#0d3b34] bg-[#0d3b34]' : 'border-gray-300 bg-white'}`}>
                    <Text className={`text-[12px] font-bold ${actif ? 'text-white' : 'text-gray-700'}`}>{LIBELLES_PAIEMENT[m]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-[11.5px] text-gray-500 mt-1">
              Facilité ne gère aucun paiement : l&apos;article et la livraison se règlent directement avec le vendeur ou le livreur.
            </Text>
          </View>

          <Pressable
            onPress={envoyer}
            disabled={enCours}
            className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
            style={{ backgroundColor: VERT_PROFOND }}>
            {enCours ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-[14.5px] font-bold">Envoyer ma commande</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
