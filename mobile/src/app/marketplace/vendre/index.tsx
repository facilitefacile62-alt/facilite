import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
// accessible depuis ici. Aucune fonctionnalité inventée : les horaires
// d'ouverture ne sont pas encore modifiables depuis l'app (BIENTOT).
const VERT_PROFOND = '#0d3b34';

function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

function Champ({ libelle, ...props }: TextInputProps & { libelle: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[12.5px] font-bold text-gray-700">{libelle}</Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
        {...props}
      />
    </View>
  );
}

// « Devenir Vendeur » en deux étapes, comme sur le site : d'abord l'identité
// du compte (prénom, nom, téléphone, e-mail facultatif), puis la boutique.
// L'identité est enregistrée dès « Continuer » : une étape 2 abandonnée ne
// fait pas perdre les informations saisies.
function FormulaireCreationBoutique({ userId, onCree }: { userId: string; onCree: () => void }) {
  const { user, profile } = useAuth();
  const { activer } = useLocalisation();
  const [etape, setEtape] = useState<'identite' | 'boutique'>('identite');
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
      <View className="gap-1.5">
        <View className="flex-row gap-2">
          <View className="flex-1 h-1.5 rounded-full bg-[#10B981]" />
          <View className={`flex-1 h-1.5 rounded-full ${etape === 'boutique' ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
        </View>
        <Text className="text-[12px] font-bold text-[#047857]">
          {etape === 'identite' ? 'Étape 1 sur 2 · Identité' : 'Étape 2 sur 2 · Boutique'}
        </Text>
      </View>

      {etape === 'identite' ? (
        <>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Champ libelle="Prénom *" value={prenom} onChangeText={setPrenom} placeholder="Ex. Moussa" />
            </View>
            <View className="flex-1">
              <Champ libelle="Nom *" value={nomFamille} onChangeText={setNomFamille} placeholder="Ex. Diop" />
            </View>
          </View>
          <Champ
            libelle="Téléphone (WhatsApp) *"
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
          <Pressable onPress={() => setEtape('identite')} className="flex-row items-center gap-1 self-start" hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color="#6B7280" />
            <Text className="text-[12.5px] font-semibold text-gray-500">Modifier mes informations</Text>
          </Pressable>

          <Champ libelle="Nom de la boutique *" value={nom} onChangeText={setNom} placeholder="Ex. Boutique Awa" />

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Position de la boutique</Text>
            <Pressable
              onPress={releverPosition}
              disabled={relevePosition === 'en_cours'}
              className="flex-row items-center gap-3 rounded-2xl border border-gray-300 px-3.5 py-3 disabled:opacity-60">
              {relevePosition === 'en_cours' ? (
                <ActivityIndicator color="#0d3b34" />
              ) : (
                <Ionicons name="location-outline" size={20} color="#0d3b34" />
              )}
              <Text className="flex-1 text-[13.5px] font-semibold text-[#1A1A1A]">
                {relevePosition === 'ok'
                  ? 'Position relevée'
                  : relevePosition === 'echec'
                    ? 'Position indisponible, réessayez'
                    : 'Positionner ma boutique · Démarrer le relevé'}
              </Text>
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Ville</Text>
            <SelecteurDepartement valeur={ville} onChoisir={setVille} />
          </View>
        </>
      )}

      {etape === 'identite' ? (
        <Pressable
          onPress={continuerIdentite}
          disabled={enregistrement}
          className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60 bg-[#10B981]">
          {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Continuer →</Text>}
        </Pressable>
      ) : (
        <Pressable
          onPress={creer}
          disabled={enregistrement}
          className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60 bg-black">
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

const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

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

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  function blocDisponibilite() {
    if (!boutique) return null;
    return (
      <View className="flex-row items-center gap-2 mb-3">
        <Pressable
          onPress={() => basculerDisponibilite(true)}
          disabled={disponibiliteEnCours}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 border ${
            boutique.disponible_manuel ? 'border-transparent bg-[#10B981]' : 'border-gray-300 bg-white'
          }`}>
          <Ionicons name="flash" size={13} color={boutique.disponible_manuel ? '#fff' : '#9CA3AF'} />
          <Text className={`text-[12px] font-bold ${boutique.disponible_manuel ? 'text-white' : 'text-gray-600'}`}>
            Disponible maintenant
          </Text>
        </Pressable>
        <Pressable
          onPress={() => basculerDisponibilite(false)}
          disabled={disponibiliteEnCours}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 border ${
            !boutique.disponible_manuel ? 'border-transparent bg-gray-700' : 'border-gray-300 bg-white'
          }`}>
          <Ionicons name="pause" size={13} color={!boutique.disponible_manuel ? '#fff' : '#9CA3AF'} />
          <Text className={`text-[12px] font-bold ${!boutique.disponible_manuel ? 'text-white' : 'text-gray-600'}`}>Indisponible</Text>
        </Pressable>
      </View>
    );
  }

  function contenuService() {
    if (!boutique) return null;
    return (
      <View className="px-4 gap-3">
        <View className="flex-row items-center justify-between bg-white rounded-2xl border border-black/[0.06] p-3.5">
          <View>
            <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Rendre mon service visible</Text>
            <Text className="text-[11.5px] text-gray-500 mt-0.5">{boutique.actif ? 'Visible par les utilisateurs' : 'Masqué aux utilisateurs'}</Text>
          </View>
          <Switch value={boutique.actif} onValueChange={basculerVisibilite} disabled={bascule} trackColor={{ true: VERT_PROFOND }} />
        </View>

        <View className="bg-[#EFF6FF] rounded-2xl p-3.5 gap-2">
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
          onPress={() => BIENTOT('Programmer des horaires')}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 py-3">
          <Ionicons name="calendar-outline" size={16} color="#2563EB" />
          <Text className="text-[13px] font-bold text-[#2563EB]">Programmer des horaires</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/marketplace/vendre/livreur')}
          className="flex-row items-center gap-3 rounded-2xl border border-gray-300 px-3.5 py-3">
          <Ionicons name="bicycle-outline" size={20} color={VERT_PROFOND} />
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-[#1A1A1A]">Devenir livreur</Text>
            <Text className="text-[11.5px] text-gray-500">Livrer les commandes du Marketplace</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
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

        <Pressable
          onPress={() => BIENTOT('Horaires d’ouverture')}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 py-3">
          <Ionicons name="time-outline" size={16} color="#2563EB" />
          <Text className="text-[13px] font-bold text-[#2563EB]">Horaires d&apos;ouverture</Text>
        </Pressable>
      </View>
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
          <Text className="text-[18px] font-black text-[#1A1A1A]">{boutique === null ? 'Devenir Vendeur' : 'Ma boutique'}</Text>
        </View>

        {chargement || boutique === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : !user?.id ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer votre boutique.</Text>
          </View>
        ) : boutique === null ? (
          <FormulaireCreationBoutique userId={user.id} onCree={recharger} />
        ) : onglet === 'article' ? (
          <FlatList
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View className="mb-4">
                <View className="h-[90px] rounded-2xl bg-[#E6DFD0]" />
                <View className="-mt-8 px-1 gap-1">
                  <View className="w-[66px] h-[66px] rounded-full bg-[#D9D2C3] border-4 border-white items-center justify-center">
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

                <View className="flex-row gap-1.5 mt-4">
                  {(['article', 'service', 'etablissement'] as const).map((o) => {
                    const actif = onglet === o;
                    const libelle = o === 'article' ? 'ARTICLE' : o === 'service' ? 'SERVICE' : 'ÉTABLISSEMENT';
                    return (
                      <Pressable
                        key={o}
                        onPress={() => setOnglet(o)}
                        className={`flex-1 rounded-full py-2 items-center ${actif ? 'bg-black' : 'bg-[#F2F0EA]'}`}>
                        <Text className={`text-[11px] font-black tracking-wide ${actif ? 'text-white' : 'text-gray-500'}`}>{libelle}</Text>
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
            <View className="h-[90px] bg-[#E6DFD0]" />
            <View className="px-4 -mt-8 gap-1 mb-4">
              <View className="w-[66px] h-[66px] rounded-full bg-[#D9D2C3] border-4 border-white items-center justify-center">
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

              <View className="flex-row gap-1.5 mt-4">
                {(['article', 'service', 'etablissement'] as const).map((o) => {
                  const actif = onglet === o;
                  const libelle = o === 'article' ? 'ARTICLE' : o === 'service' ? 'SERVICE' : 'ÉTABLISSEMENT';
                  return (
                    <Pressable
                      key={o}
                      onPress={() => setOnglet(o)}
                      className={`flex-1 rounded-full py-2 items-center ${actif ? 'bg-black' : 'bg-[#F2F0EA]'}`}>
                      <Text className={`text-[11px] font-black tracking-wide ${actif ? 'text-white' : 'text-gray-500'}`}>{libelle}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {onglet === 'service' ? contenuService() : contenuEtablissement()}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
