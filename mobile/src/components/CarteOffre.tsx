import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import CandidatureRapide from '@/components/CandidatureRapide';
import OfferMediaView from '@/components/OfferMediaView';
import { resoudreActionOffre } from '@/lib/actionOffre';
import type { OffreReelle } from '@/lib/useOffresReelles';

// Carte d'offre du fil (maquettes 01 « Accueil » et 03 « Offres »), sur fond
// blanc, nom d'entreprise en bleu, bouton bleu « Postuler via Facilité ».
// Partagée par l'Accueil et l'onglet Offres : elle existait en deux copies
// quasi identiques, dont une encore en thème sombre.
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const BLEU = '#2563EB';
const TEXTE = '#1A1A1A';
const TEXTE_DOUX = 'rgba(0,0,0,0.5)';

export default function CarteOffre({
  offre,
  matchScore,
  expiree = false,
}: {
  offre: OffreReelle;
  matchScore: number | null;
  /** Offre dont la date limite est passée : on ne peut plus postuler. */
  expiree?: boolean;
}) {
  const router = useRouter();
  const [aime, setAime] = useState(false);
  const [descriptionEtendue, setDescriptionEtendue] = useState(false);
  const [logoErreur, setLogoErreur] = useState(false);
  // Candidature rapide (maquettes 08/09) : feuille ouverte par le bouton bleu,
  // et état « postulée » une fois la confirmation fermée.
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [postulee, setPostulee] = useState(false);

  const partager = async () => {
    try {
      const url = `https://ffacilite.com/offres/${offre.id}`;
      await Share.share({
        title: offre.titre,
        message: `Découvrez cette opportunité sur Facilité :\n${offre.titre} chez ${offre.entreprise} (${offre.localisation})\n\nPostulez ici : ${url}`,
        url,
      });
    } catch {}
  };

  // Même décision que le site (resolveOfferAction, portée dans
  // lib/actionOffre.ts) : feuille Candidature Rapide, site officiel du
  // recruteur ou WhatsApp, selon ce que l'annonce désigne elle-même.
  const action = resoudreActionOffre({
    titre: offre.titre,
    entreprise: offre.entreprise,
    description: offre.description,
    externalLink: offre.externalLink,
    applicationUrl: offre.applicationUrl,
    applicationEmail: offre.applicationEmail,
    contactEmail: offre.contactEmail,
    contactWhatsapp: offre.contactWhatsapp,
  });

  const ouvrirPostuler = () => {
    if (action.type === 'facilite') setFeuilleOuverte(true);
    else Linking.openURL(action.url).catch(() => router.push(`/offre/${offre.id}`));
  };

  return (
    <Pressable
      onPress={() => router.push(`/offre/${offre.id}`)}
      style={{
        backgroundColor: CARTE,
        marginHorizontal: 12,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDURE,
      }}>
      {/* 1. EN-TÊTE DE LA CARTE : logo entreprise + nom (bleu) + date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {offre.posterUri && !logoErreur ? (
          <Image
            source={{ uri: offre.posterUri }}
            alt={offre.entreprise}
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#E8E4DA' }}
            contentFit="cover"
            transition={150}
            onError={() => setLogoErreur(true)}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#E8E4DA',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: 'rgba(0,0,0,0.55)', fontWeight: '800', fontSize: 14 }}>{offre.logoInitiales}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: BLEU }} numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ fontSize: 11.5, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.dateFormatee || offre.date}</Text>
            <Text style={{ color: 'rgba(0,0,0,0.3)', fontSize: 10 }}>·</Text>
            <Ionicons name="globe-outline" size={11} color="rgba(0,0,0,0.4)" />
          </View>
        </View>
      </View>

      {/* 2. MATCHING IA */}
      {matchScore !== null && (
        <View style={{ marginTop: 10 }}>
          <BadgeMatchingOffre score={matchScore} />
        </View>
      )}

      {/* 3. TITRE DU POSTE */}
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: TEXTE, lineHeight: 22, marginTop: 10 }}>{offre.titre}</Text>

      {/* 4. LOCALISATION, SECTEUR, CONTRAT & DATE LIMITE */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <Ionicons name="briefcase-outline" size={12} color="rgba(0,0,0,0.45)" />
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.localisation}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.sector || 'Opportunité'}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.contrat}</Text>
        {offre.deadline && (
          <>
            <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
            <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '800' }}>
              Limite : {new Date(offre.deadline).toLocaleDateString('fr-FR')}
            </Text>
          </>
        )}
      </View>

      {/* 5. DESCRIPTION AVEC VOIR PLUS */}
      {offre.description && (
        <View style={{ marginTop: 8 }}>
          <Text numberOfLines={descriptionEtendue ? undefined : 3} style={{ fontSize: 13, color: 'rgba(0,0,0,0.78)', lineHeight: 19 }}>
            {offre.description}
          </Text>
          {offre.description.length > 120 && (
            <Pressable onPress={() => setDescriptionEtendue(!descriptionEtendue)} style={{ marginTop: 4 }}>
              <Text style={{ color: BLEU, fontSize: 12, fontWeight: '700' }}>
                {descriptionEtendue ? 'Voir moins' : '...Voir plus'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 6. AFFICHE RÉELLE DE L'OFFRE */}
      <OfferMediaView media={offre.rawImage || offre.posterUri} dark={false} onPress={() => router.push(`/offre/${offre.id}`)} />

      {/* 7. PIED : candidats */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 2 }}>
        <Ionicons name="people-outline" size={14} color="rgba(0,0,0,0.4)" />
        <Text style={{ color: TEXTE_DOUX, fontSize: 12, fontWeight: '600' }}>
          {offre.viewCount && offre.viewCount > 0 ? `${offre.viewCount} personnes intéressées` : '0 personne a postulé'}
        </Text>
      </View>

      {/* 8. ACTIONS — maquette 01 : J'aime, partager, puis le bouton bleu.
          Le signet n'y figure pas (il est sur la fiche offre, maquette 07). */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <Pressable
          onPress={() => setAime(!aime)}
          accessibilityLabel="J'aime"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: aime ? '#EF4444' : 'rgba(0,0,0,0.08)',
            backgroundColor: aime ? 'rgba(239,68,68,0.1)' : '#F5F3EE',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={aime ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={aime ? '#EF4444' : 'rgba(0,0,0,0.55)'} />
        </Pressable>

        <Pressable
          onPress={partager}
          accessibilityLabel="Partager"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.08)',
            backgroundColor: '#F5F3EE',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="share-social-outline" size={18} color="rgba(0,0,0,0.55)" />
        </Pressable>

        <Pressable
          onPress={ouvrirPostuler}
          disabled={expiree || postulee}
          accessibilityState={{ disabled: expiree || postulee }}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            // Expirée : même gabarit, grisé, comme sur le site (le bouton
            // « Postuler » y est remplacé par un état fermé).
            backgroundColor: expiree ? '#D4D0C4' : postulee ? '#D5F5E6' : action.type === 'whatsapp' ? '#25D366' : BLEU,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: 12,
          }}>
          <Ionicons
            name={expiree ? 'lock-closed' : postulee ? 'checkmark-circle' : action.type === 'whatsapp' ? 'logo-whatsapp' : action.type === 'externe' ? 'open-outline' : 'paper-plane'}
            size={16}
            color={expiree ? 'rgba(0,0,0,0.45)' : postulee ? '#047857' : '#FFFFFF'}
          />
          <Text style={{ color: expiree ? 'rgba(0,0,0,0.5)' : postulee ? '#047857' : '#FFFFFF', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
            {expiree ? 'Offre expirée' : postulee ? 'Candidature envoyée' : action.libelle}
          </Text>
        </Pressable>
      </View>

      <CandidatureRapide
        visible={feuilleOuverte}
        offre={{ id: offre.id, titre: offre.titre, entreprise: offre.entreprise, contactEmail: action.type === 'facilite' ? (action.email ?? undefined) : undefined }}
        onFermer={() => setFeuilleOuverte(false)}
        onEnvoyee={() => setPostulee(true)}
      />
    </Pressable>
  );
}
