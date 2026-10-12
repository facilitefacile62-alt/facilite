import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import EnteteMarketplace from '@/components/EnteteMarketplace';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES_ETABLISSEMENT, METIERS_SERVICE, libelleCategorieEtablissement } from '@/lib/boutiqueCategories';
import { enStock, prixLisible, urlPhoto, type Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import {
  chargerMesArticles,
  chargerMesBoutiques,
  creerBoutique,
  definirDisponibiliteBoutique,
  definirVisibiliteBoutique,
  enregistrerIdentiteVendeur,
  majStock,
  modifierBoutique,
  retirerArticle,
  type MaBoutique,
  type MonArticle,
} from '@/lib/vendeur';

// "Ma boutique" (espace vendeur natif) : aperçu public avec les onglets
// ARTICLE · SERVICE · ÉTABLISSEMENT (maquette « Marketplace — Ma boutique »).
// La gestion (annonces, commandes, réglages…) vit dans Tableau de bord,
// accessible depuis ici. Les horaires d'ouverture ouvrent désormais
// l'éditeur des sept jours (vendre/horaires.tsx), adossé à la table
// marketplace_horaires — ils affichaient « Bientôt disponible » alors que
// la table et sa fonction d'écriture existaient déjà.
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
  const [telephone, setTelephone] = useState((profile?.phone as string | undefined) ?? '');
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
    if (!telephone.trim()) {
      Alert.alert('Téléphone manquant', 'Indiquez votre numéro WhatsApp pour que les acheteurs puissent vous joindre.');
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
      await creerBoutique(userId, { nom, ville, quartier: null, telephoneWhatsapp: telephone, position });
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
            libelle="Téléphone (WhatsApp)"
            value={telephone}
            onChangeText={setTelephone}
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

function LigneArticle({ article, onChanger }: { article: MonArticle; onChanger: () => void }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const photo = article.photos[0] ? urlPhoto(article.photos[0]) : null;

  async function ajusterStock(delta: number) {
    if (enCours) return;
    const nouvelle = Math.max(0, article.quantite + delta);
    setEnCours(true);
    try {
      await majStock(article.id, nouvelle);
      onChanger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour du stock impossible.');
    } finally {
      setEnCours(false);
    }
  }

  function ouvrirModification() {
    const params = new URLSearchParams({
      id: article.id,
      titre: article.titre,
      categorie: article.categorie,
      prix: String(article.prix_xof),
      quantite: String(article.quantite),
      description: article.description || '',
      photos: JSON.stringify(article.photos),
    });
    router.push(`/marketplace/vendre/modifier-article?${params.toString()}` as Href);
  }

  return (
    <View className="flex-row gap-3 bg-white rounded-2xl border border-black/[0.06] p-2.5">
      <Pressable onPress={ouvrirModification} className="w-16 h-16 rounded-xl bg-[#F2F0EA] items-center justify-center overflow-hidden">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={22} color="#9CA3AF" />
        )}
      </Pressable>
      <View className="flex-1 gap-1">
        <Pressable onPress={ouvrirModification}>
          <Text className="text-[13px] font-bold text-[#1A1A1A]" numberOfLines={1}>
            {article.titre}
          </Text>
          <Text className="text-[13px] font-extrabold" style={{ color: VERT_PROFOND }}>
            {prixLisible(article.prix_xof)} FCFA
          </Text>
        </Pressable>
        <View className="flex-row items-center justify-between mt-0.5">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => ajusterStock(-1)}
              disabled={enCours || article.quantite === 0}
              className="w-6 h-6 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
              <Ionicons name="remove" size={14} color="#1A1A1A" />
            </Pressable>
            <Text className={`text-[12px] font-bold w-14 text-center ${enStock(article) ? 'text-gray-700' : 'text-amber-600'}`}>
              {article.quantite} en stock
            </Text>
            <Pressable
              onPress={() => ajusterStock(1)}
              disabled={enCours}
              className="w-6 h-6 rounded-full bg-[#F2F0EA] items-center justify-center disabled:opacity-40">
              <Ionicons name="add" size={14} color="#1A1A1A" />
            </Pressable>
          </View>
          <Pressable onPress={ouvrirModification} hitSlop={8} accessibilityLabel="Modifier l'article">
            <Ionicons name="create-outline" size={17} color="#1A1A1A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function MaBoutiqueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null | undefined>(undefined); // undefined = chargement, null = aucune
  const [articles, setArticles] = useState<MonArticle[]>([]);
  const [onglet, setOnglet] = useState<'article' | 'service' | 'etablissement'>('article');
  const [bascule, setBascule] = useState(false);
  const [disponibiliteEnCours, setDisponibiliteEnCours] = useState(false);

  // Édition Métier / Prestation (onglet SERVICE).
  const [editionMetier, setEditionMetier] = useState(false);
  const [metierSaisi, setMetierSaisi] = useState('');
  const [descriptionSaisie, setDescriptionSaisie] = useState('');

  // Édition Catégorie d'établissement (onglet ÉTABLISSEMENT).
  const [editionEtablissement, setEditionEtablissement] = useState(false);
  const [categorieSaisie, setCategorieSaisie] = useState<string | null>(null);

  const [enregistrementRubrique, setEnregistrementRubrique] = useState(false);

  async function recharger() {
    if (!user?.id) return;
    try {
      const liste = await chargerMesBoutiques(user.id);
      const active = liste[0] ?? null;
      setBoutique(active);
      setArticles(active ? await chargerMesArticles(active.id) : []);
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
    }, [user?.id])
  );

  async function basculerVisibilite(valeur: boolean) {
    if (!boutique || bascule) return;
    setBascule(true);
    try {
      await definirVisibiliteBoutique(boutique.id, valeur);
      setBoutique({ ...boutique, actif: valeur });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de changer la visibilité.');
    } finally {
      setBascule(false);
    }
  }

  async function basculerDisponibilite(valeur: boolean) {
    if (!boutique || disponibiliteEnCours) return;
    setDisponibiliteEnCours(true);
    try {
      await definirDisponibiliteBoutique(boutique.id, valeur);
      setBoutique({ ...boutique, disponible_manuel: valeur });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de changer la disponibilité.');
    } finally {
      setDisponibiliteEnCours(false);
    }
  }

  function ouvrirEditionMetier() {
    setMetierSaisi(boutique?.metier ?? '');
    setDescriptionSaisie(boutique?.description_prestation ?? '');
    setEditionMetier(true);
  }

  async function enregistrerMetier() {
    if (!boutique) return;
    setEnregistrementRubrique(true);
    try {
      await modifierBoutique(boutique.id, {
        nom: boutique.nom,
        quartier: boutique.quartier,
        ville: boutique.ville,
        telephoneWhatsapp: boutique.telephone_whatsapp,
        metier: metierSaisi,
        descriptionPrestation: descriptionSaisie,
        typeBoutique: 'service',
      });
      setEditionMetier(false);
      await recharger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrementRubrique(false);
    }
  }

  function ouvrirEditionEtablissement() {
    setCategorieSaisie(boutique?.categorie_etablissement ?? null);
    setEditionEtablissement(true);
  }

  async function enregistrerEtablissement() {
    if (!boutique || !categorieSaisie) return;
    setEnregistrementRubrique(true);
    try {
      await modifierBoutique(boutique.id, {
        nom: boutique.nom,
        quartier: boutique.quartier,
        ville: boutique.ville,
        telephoneWhatsapp: boutique.telephone_whatsapp,
        categorieEtablissement: categorieSaisie,
        typeBoutique: 'etablissement',
      });
      setEditionEtablissement(false);
      await recharger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrementRubrique(false);
    }
  }

  // Création de boutique en deux étapes : le retour de l'étape 2 revient à l'étape 1.
  const [etapeCreation, setEtapeCreation] = useState<'identite' | 'boutique'>('identite');

  function retour() {
    if (boutique === null && etapeCreation === 'boutique') {
      setEtapeCreation('identite');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  function blocDisponibilite() {
    if (!boutique) return null;
    const dispo = boutique.disponible_manuel;
    return (
      <View className="bg-white gap-3" style={{ borderRadius: 18, padding: 14 }}>
        <View className="flex-row items-center gap-2.5">
          <View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 3, borderColor: '#10B981' }} />
          <Text className="text-[15px] font-black text-[#1A1A1A]">Disponibilité</Text>
        </View>
        <View className="flex-row items-center gap-2.5">
          <Pressable
            onPress={() => basculerDisponibilite(true)}
            disabled={disponibiliteEnCours}
            className="flex-1 flex-row items-center justify-center gap-1.5"
            style={{ height: 46, borderRadius: 12, backgroundColor: dispo ? '#10B981' : '#F0F1F3' }}>
            <Ionicons name="flash" size={13} color={dispo ? '#fff' : '#F97316'} />
            <Text className="text-[12.5px] font-black" style={{ color: dispo ? '#fff' : '#374151' }}>Disponible maintenant</Text>
          </Pressable>
          <Pressable
            onPress={() => basculerDisponibilite(false)}
            disabled={disponibiliteEnCours}
            className="flex-1 flex-row items-center justify-center gap-1.5"
            style={{ height: 46, borderRadius: 12, backgroundColor: !dispo ? '#374151' : '#F0F1F3' }}>
            <Ionicons name="pause" size={13} color={!dispo ? '#fff' : '#374151'} />
            <Text className="text-[12.5px] font-black" style={{ color: !dispo ? '#fff' : '#374151' }}>Indisponible</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push('/marketplace/vendre/horaires' as Href)}
          className="flex-row items-center justify-center gap-2"
          style={{ height: 50, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB' }}>
          <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
          <Text className="text-[13.5px] font-black" style={{ color: '#7C3AED' }}>Programmer des horaires</Text>
        </Pressable>
      </View>
    );
  }

  function contenuService() {
    if (!boutique) return null;
    return (
      <View className="px-4 gap-3">
        <View className="bg-[#EFF6FF] gap-2" style={{ borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#BFD4F6' }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="construct-outline" size={16} color="#1A1A1A" />
              <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Métier / Prestation</Text>
            </View>
            {!editionMetier && (
              <Pressable onPress={ouvrirEditionMetier} hitSlop={6}>
                <Text className="text-[12px] font-bold text-[#2563EB]">✎ Modifier</Text>
              </Pressable>
            )}
          </View>
          {editionMetier ? (
            <View className="gap-2.5">
              <View className="flex-row flex-wrap gap-1.5">
                {METIERS_SERVICE.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetierSaisi(m)}
                    className={`rounded-full px-2.5 py-1.5 border ${metierSaisi === m ? 'border-transparent bg-[#2563EB]' : 'border-gray-300 bg-white'}`}>
                    <Text className={`text-[11px] font-semibold ${metierSaisi === m ? 'text-white' : 'text-gray-700'}`}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={metierSaisi}
                onChangeText={setMetierSaisi}
                placeholder="Votre métier (ou précisez)"
                placeholderTextColor="#9CA3AF"
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] bg-white"
              />
              <TextInput
                value={descriptionSaisie}
                onChangeText={setDescriptionSaisie}
                placeholder="Spécialités, zone d'intervention…"
                placeholderTextColor="#9CA3AF"
                multiline
                style={{ minHeight: 60, textAlignVertical: 'top' }}
                className="border border-gray-300 rounded-xl px-3 py-2.5 text-[13px] text-[#1A1A1A] bg-white"
              />
              <View className="flex-row gap-2">
                <Pressable onPress={() => setEditionMetier(false)} className="flex-1 items-center rounded-xl py-2.5 border border-gray-300">
                  <Text className="text-[12.5px] font-bold text-gray-600">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={enregistrerMetier}
                  disabled={enregistrementRubrique}
                  className="flex-1 items-center rounded-xl py-2.5 bg-[#2563EB] disabled:opacity-60">
                  {enregistrementRubrique ? <ActivityIndicator color="#fff" /> : <Text className="text-[12.5px] font-bold text-white">Enregistrer</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text className="text-[14px] font-extrabold text-[#2563EB]">{boutique.metier || 'Non renseigné'}</Text>
              <Text className="text-[12px] text-gray-500">{boutique.description_prestation || 'Prestation de service sur mesure.'}</Text>
            </>
          )}
        </View>

        {blocDisponibilite()}

        <Pressable
          onPress={() => router.push('/marketplace/vendre/livreur')}
          className="flex-row items-center gap-3"
          style={{ backgroundColor: '#F3FBF7', borderRadius: 14, borderWidth: 1.5, borderColor: '#34D399', padding: 12 }}>
          <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#D7F2EA' }}>
            <Ionicons name="bicycle-outline" size={22} color="#047857" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-black text-[#1A1A1A]">Devenir livreur</Text>
            <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Livrez les commandes autour de vous</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.35)" />
        </Pressable>
      </View>
    );
  }

  function contenuEtablissement() {
    if (!boutique) return null;
    return (
      <View className="px-4 gap-3">
        <View className="bg-white rounded-2xl border border-black/[0.06] p-3.5 gap-2">
          <Text className="text-[11px] font-extrabold tracking-wide text-gray-500">À PROPOS DE {boutique.nom.toUpperCase()}</Text>
          <Text className="text-[12.5px] text-gray-600">Boutique officielle partenaire sur Facilité Sénégal.</Text>
          <View className="border-t border-black/[0.05] pt-2 flex-row items-center justify-between">
            <Text className="text-[12.5px] font-bold text-gray-700">Catégorie de l&apos;établissement</Text>
            {!editionEtablissement && (
              <Pressable onPress={ouvrirEditionEtablissement} hitSlop={6}>
                <Ionicons name="create-outline" size={16} color="#2563EB" />
              </Pressable>
            )}
          </View>
          {editionEtablissement ? (
            <View className="gap-2.5">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {CATEGORIES_ETABLISSEMENT.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategorieSaisie(c.id)}
                    className={`rounded-full px-3 py-1.5 border ${categorieSaisie === c.id ? 'border-transparent bg-[#2563EB]' : 'border-gray-300 bg-white'}`}>
                    <Text className={`text-[11px] font-semibold ${categorieSaisie === c.id ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setEditionEtablissement(false)} className="flex-1 items-center rounded-xl py-2.5 border border-gray-300">
                  <Text className="text-[12.5px] font-bold text-gray-600">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={enregistrerEtablissement}
                  disabled={enregistrementRubrique || !categorieSaisie}
                  className="flex-1 items-center rounded-xl py-2.5 bg-[#2563EB] disabled:opacity-60">
                  {enregistrementRubrique ? <ActivityIndicator color="#fff" /> : <Text className="text-[12.5px] font-bold text-white">Enregistrer</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="self-start rounded-full px-2.5 py-1 bg-[#D1FAE5]">
              <Text className="text-[11px] font-black tracking-wide text-[#047857]">
                {libelleCategorieEtablissement(boutique.categorie_etablissement).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {blocDisponibilite()}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace
          titre={boutique === null ? 'Devenir Vendeur' : 'Ma boutique'}
          sousTitre={
            boutique === null
              ? etapeCreation === 'identite'
                ? 'Étape 1 sur 2 · Identité'
                : 'Étape 2 sur 2 · Boutique'
              : undefined
          }
          onRetour={retour}
        />

        {chargement || boutique === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : !user?.id ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer votre boutique.</Text>
          </View>
        ) : boutique === null ? (
          <FormulaireCreationBoutique userId={user.id} onCree={recharger} etape={etapeCreation} setEtape={setEtapeCreation} />
        ) : onglet === 'article' ? (
          <FlatList
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="mb-4">
                <View style={{ height: 120, borderRadius: 16, backgroundColor: '#E9E4D8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
                {Array.from({ length: 30 }, (_, i) => (
                  <Line key={i} x1={i * 26 - 130} y1={120} x2={i * 26} y2={0} stroke="#DDD6C6" strokeWidth={9} />
                ))}
              </Svg>
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: '#8A8272' }}>bannière de la boutique</Text>
            </View>
                <View className="-mt-10 px-1 gap-1">
                  <View className="w-[78px] h-[78px] rounded-full bg-[#D9D2C3] border-4 border-white items-center justify-center">
                    <Ionicons name="storefront" size={26} color={VERT_PROFOND} />
                  </View>
                  <View className="flex-row items-center gap-2 flex-wrap mt-1">
                    <Text className="text-[16px] font-black text-[#1A1A1A]">{boutique.nom}</Text>
                    <View className="rounded-full px-2 py-0.5 bg-[#D1FAE5]">
                      <Text className="text-[10px] font-black tracking-wide text-[#047857]">BOUTIQUE</Text>
                    </View>
                  </View>
                  <Text className="text-[12px] text-gray-500">
                    {[boutique.quartier, boutique.ville].filter(Boolean).join(' · ') || 'Sénégal'}
                  </Text>
                </View>

                {/* « Modifier infos » de la maquette 28 : ouvre l'écran
                    « Modifier le profil » de la boutique (maquette 32). */}
                <Pressable
                  onPress={() => router.push('/marketplace/vendre/modifier-boutique' as Href)}
                  className="flex-row items-center justify-center gap-2 rounded-2xl bg-white border border-black/[0.08] py-3 mt-3">
                  <Ionicons name="pencil" size={14} color="#1A1A1A" />
                  <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Modifier infos</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/marketplace/vendre/tableau-de-bord' as Href)}
                  className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#10B981] py-3 mt-2.5">
                  <Ionicons name="bar-chart-outline" size={16} color={VERT_PROFOND} />
                  <Text className="text-[13.5px] font-bold" style={{ color: VERT_PROFOND }}>
                    Tableau de bord
                  </Text>
                </Pressable>

                <View className="flex-row gap-1 mt-4 bg-white rounded-[20px] p-1.5">
                  {(['article', 'service', 'etablissement'] as const).map((o) => {
                    const actif = onglet === o;
                    const libelle = o === 'article' ? 'ARTICLE' : o === 'service' ? 'SERVICE' : 'ÉTABLISSEMENT';
                    return (
                      <Pressable
                        key={o}
                        onPress={() => setOnglet(o)}
                        className={`flex-1 rounded-full py-2.5 items-center ${actif ? 'bg-[#111]' : ''}`}>
                        <Text className={`text-[11.5px] font-black tracking-wide ${actif ? 'text-white' : 'text-[#374151]'}`}>{libelle}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center pt-6 pb-10 gap-2">
                <Ionicons name="pricetags-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] text-gray-500 text-center px-6">Aucun article publié pour l&apos;instant.</Text>
              </View>
            }
            renderItem={({ item }) => <LigneArticle article={item} onChanger={recharger} />}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
            <View style={{ height: 120, backgroundColor: '#E9E4D8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
                {Array.from({ length: 30 }, (_, i) => (
                  <Line key={i} x1={i * 26 - 130} y1={120} x2={i * 26} y2={0} stroke="#DDD6C6" strokeWidth={9} />
                ))}
              </Svg>
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: '#8A8272' }}>bannière de la boutique</Text>
            </View>
            <View className="px-4 -mt-10 gap-1 mb-4">
              <View className="w-[78px] h-[78px] rounded-full bg-[#D9D2C3] border-4 border-white items-center justify-center">
                <Ionicons name="storefront" size={26} color={VERT_PROFOND} />
              </View>
              <View className="flex-row items-center gap-2 flex-wrap mt-1">
                <Text className="text-[16px] font-black text-[#1A1A1A]">{boutique.nom}</Text>
                <View className="rounded-full px-2 py-0.5 bg-[#D1FAE5]">
                  <Text className="text-[10px] font-black tracking-wide text-[#047857]">BOUTIQUE</Text>
                </View>
              </View>
              <Text className="text-[12px] text-gray-500">{[boutique.quartier, boutique.ville].filter(Boolean).join(' · ') || 'Sénégal'}</Text>

              <Pressable
                onPress={() => router.push('/marketplace/vendre/tableau-de-bord' as Href)}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#10B981] py-3 mt-3">
                <Ionicons name="bar-chart-outline" size={16} color={VERT_PROFOND} />
                <Text className="text-[13.5px] font-bold" style={{ color: VERT_PROFOND }}>
                  Tableau de bord
                </Text>
              </Pressable>

              <View className="flex-row gap-1 mt-4 bg-white rounded-[20px] p-1.5">
                {(['article', 'service', 'etablissement'] as const).map((o) => {
                  const actif = onglet === o;
                  const libelle = o === 'article' ? 'ARTICLE' : o === 'service' ? 'SERVICE' : 'ÉTABLISSEMENT';
                  return (
                    <Pressable
                      key={o}
                      onPress={() => setOnglet(o)}
                      className={`flex-1 rounded-full py-2.5 items-center ${actif ? 'bg-[#111]' : ''}`}>
                      <Text className={`text-[11.5px] font-black tracking-wide ${actif ? 'text-white' : 'text-[#374151]'}`}>{libelle}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {onglet === 'service' ? contenuService() : contenuEtablissement()}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
