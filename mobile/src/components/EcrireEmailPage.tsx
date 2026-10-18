import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import type { FichierLocal } from '@/lib/candidature';
import { chargerMesDocuments, type DocumentProfil } from '@/lib/documents';
import { MAX_PIECES, choisirPieceJointe, envoyerEmail } from '@/lib/envoiEmail';

// « Écrire un e-mail » (maquette 18), ouverte À L'INTÉRIEUR de la messagerie par le bouton « Écrire » : la barre du
// bas reste visible. En-tête #e3dbcc (retour ‹, titre, « Fermer »), carte blanche : À (une seule adresse), Objet,
// ligne « Joindre : Mon CV · Lettre » (deux pastilles qui joignent d'un toucher le CV et la lettre de motivation
// du profil), message, « Joindre un fichier » et bouton bleu « Envoyer ». Retour, Fermer et Envoyer ramènent à la
// liste des discussions. Envoi réel côté serveur (domaine Facilité, Reply-To = adresse de l'utilisateur, 10 par 24 h).
const FOND_ENTETE = '#e3dbcc';
const BLEU = '#2563EB';
const REGEX_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

const estLettre = (d: DocumentProfil) => /lettre|motivation/i.test(`${d.titre} ${d.categorie ?? ''}`);
const estCv = (d: DocumentProfil) => !estLettre(d) && !d.estImage && /cv|curriculum|resume|résumé|professionnel|moderne|classique|minimal/i.test(`${d.titre} ${d.categorie ?? ''}`);

export default function EcrireEmailPage({ onFermer }: { onFermer: () => void }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [a, setA] = useState('');
  const [objet, setObjet] = useState('');
  const [message, setMessage] = useState('');
  const [pieces, setPieces] = useState<FichierLocal[]>([]);
  const [documents, setDocuments] = useState<DocumentProfil[] | null>(null);
  // Documents du profil joints (identifiants) : Mon CV, Lettre, ou n'importe quel autre document choisi dans la liste.
  const [idsDocs, setIdsDocs] = useState<string[]>([]);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    chargerMesDocuments(userId)
      .then((d) => {
        if (!annule) setDocuments(d);
      })
      .catch(() => {
        if (!annule) setDocuments([]);
      });
    return () => {
      annule = true;
    };
  }, [userId]);

  // Le plus récent de chaque sorte (la liste arrive triée du plus récent au plus ancien).
  const cv = documents?.find(estCv) ?? documents?.find((d) => !estLettre(d) && !d.estImage) ?? null;
  const lettre = documents?.find(estLettre) ?? null;
  const idsJoints = idsDocs;
  const docsJoints = (documents ?? []).filter((d) => idsDocs.includes(d.id));
  const nbPieces = pieces.length + idsJoints.length;

  const adresseValide = REGEX_EMAIL.test(a.trim());
  const pret = adresseValide && objet.trim().length > 0 && (message.trim().length > 0 || nbPieces > 0);

  function basculer(sorte: 'cv' | 'lettre') {
    const doc = sorte === 'cv' ? cv : lettre;
    if (!doc) {
      Alert.alert(sorte === 'cv' ? 'Mon CV' : 'Lettre', `Aucun ${sorte === 'cv' ? 'CV' : 'document de lettre de motivation'} dans votre profil. Ajoutez-le d'abord dans l'onglet Documents du profil.`);
      return;
    }
    basculerDocument(doc.id);
  }

  function basculerDocument(id: string) {
    if (!idsDocs.includes(id) && nbPieces >= MAX_PIECES) {
      Alert.alert('Pièces jointes', `${MAX_PIECES} pièces jointes au maximum.`);
      return;
    }
    setIdsDocs((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  async function ajouterFichier() {
    if (nbPieces >= MAX_PIECES) {
      Alert.alert('Pièces jointes', `${MAX_PIECES} pièces jointes au maximum.`);
      return;
    }
    try {
      const f = await choisirPieceJointe();
      if (f) setPieces((l) => [...l, f]);
    } catch (e) {
      Alert.alert('Fichier refusé', e instanceof Error ? e.message : 'Ce fichier ne peut pas être ajouté.');
    }
  }

  async function envoyer() {
    if (!pret || envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      await envoyerEmail({ to: a, subject: objet, message, pieces, resumeIds: idsJoints });
      Alert.alert('Message envoyé', `Votre e-mail est parti vers ${a.trim()}.`, [{ text: 'OK', onPress: onFermer }]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'e-mail n'a pas pu être envoyé.");
    } finally {
      setEnvoi(false);
    }
  }

  const ligne = { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' } as const;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* En-tête : retour · Écrire un e-mail · Fermer */}
        <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: FOND_ENTETE }}>
          <Pressable onPress={onFermer} accessibilityLabel="Retour" className="items-center justify-center rounded-full bg-white" style={{ width: 46, height: 46 }}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </Pressable>
          <Text className="flex-1 text-[19px] font-black text-[#111]">Écrire un e-mail</Text>
          <Pressable onPress={onFermer} accessibilityRole="button" hitSlop={10}>
            <Text className="text-[14px] font-bold" style={{ color: '#4B5563' }}>Fermer</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            <View className="bg-white rounded-[24px] px-5 pt-1 pb-5">
              <TextInput
                value={a}
                onChangeText={(t) => {
                  setA(t);
                  if (erreur) setErreur('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="À (une seule adresse)"
                placeholderTextColor="rgba(0,0,0,0.4)"
                accessibilityLabel="Destinataire"
                className="text-[16px] text-[#1A1A1A]"
                style={[{ paddingVertical: 16, ...ligne }, { outlineStyle: 'none' } as object]}
              />
              <TextInput
                value={objet}
                onChangeText={setObjet}
                maxLength={150}
                placeholder="Objet"
                placeholderTextColor="rgba(0,0,0,0.4)"
                accessibilityLabel="Objet"
                className="text-[16px] text-[#1A1A1A]"
                style={[{ paddingVertical: 16, ...ligne }, { outlineStyle: 'none' } as object]}
              />

              {/* Joindre : Mon CV · Lettre — d'un toucher, depuis le profil */}
              <View className="flex-row items-center gap-2 py-3" style={ligne}>
                <Ionicons name="pin" size={13} color="#F472B6" />
                <Text className="text-[13px] font-bold" style={{ color: '#6B7280' }}>Joindre :</Text>
                {([
                  { id: 'cv' as const, libelle: 'Mon CV', icone: 'document-text' as const, couleur: '#7C6BCF' },
                  { id: 'lettre' as const, libelle: 'Lettre', icone: 'mail-open' as const, couleur: '#C084FC' },
                ]).map((p) => {
                  const doc = p.id === 'cv' ? cv : lettre;
                  const actif = Boolean(doc && idsDocs.includes(doc.id));
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => basculer(p.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                      className="flex-row items-center gap-2 rounded-full"
                      style={{ paddingHorizontal: 14, height: 40, borderWidth: 1.5, borderColor: actif ? '#10B981' : '#E5E7EB', backgroundColor: actif ? '#ECFDF5' : '#fff' }}>
                      <Ionicons name={actif ? 'checkmark-circle' : p.icone} size={16} color={actif ? '#10B981' : p.couleur} />
                      <Text className="text-[14px] font-black text-[#111]">{p.libelle}</Text>
                    </Pressable>
                  );
                })}
                {documents === null ? <ActivityIndicator size="small" color="#9CA3AF" /> : null}
              </View>

              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={5000}
                textAlignVertical="top"
                placeholder="Écrivez votre message"
                placeholderTextColor="rgba(0,0,0,0.4)"
                accessibilityLabel="Message"
                className="text-[16px] text-[#1A1A1A]"
                style={[{ minHeight: 230, paddingTop: 16 }, { outlineStyle: 'none' } as object]}
              />

              {docsJoints.length > 0 || pieces.length > 0 ? (
                <View className="gap-2 mb-3">
                  {docsJoints.map((d) => (
                    <View key={d.id} className="flex-row items-center gap-2.5 rounded-[12px] px-3 py-3" style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }}>
                      <Ionicons name={estLettre(d) ? 'mail-open-outline' : 'document-text-outline'} size={18} color="#047857" />
                      <View className="flex-1 min-w-0">
                        <Text className="text-[13px] font-bold text-[#1A1A1A]" numberOfLines={1}>{d.titre}</Text>
                        <Text className="text-[11px]" style={{ color: '#047857' }}>{estLettre(d) ? 'Lettre de motivation' : d.estImage ? 'Photo' : 'CV / document'} · de votre profil</Text>
                      </View>
                      <Pressable onPress={() => basculerDocument(d.id)} accessibilityLabel="Retirer le document" hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color="rgba(0,0,0,0.4)" />
                      </Pressable>
                    </View>
                  ))}
                  {pieces.map((f, i) => (
                    <View key={`${f.uri}-${i}`} className="flex-row items-center gap-2.5 rounded-[12px] px-3 py-3" style={{ backgroundColor: '#F3F4F6' }}>
                      <Ionicons name="document-attach-outline" size={18} color="#4B5563" />
                      <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]" numberOfLines={1}>{f.nom}</Text>
                      <Pressable onPress={() => setPieces((l) => l.filter((_, j) => j !== i))} accessibilityLabel="Retirer la pièce jointe" hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color="rgba(0,0,0,0.4)" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {erreur ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                  <Text className="text-[12.5px] font-bold text-red-600">{erreur}</Text>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between">
                <View className="gap-3">
                  <Pressable onPress={ajouterFichier} accessibilityRole="button" className="flex-row items-center gap-2" hitSlop={8}>
                    <Ionicons name="attach" size={20} color="#374151" />
                    <Text className="text-[14px] font-black" style={{ color: '#374151' }}>Joindre un fichier</Text>
                  </Pressable>
                  <Pressable onPress={() => setListeOuverte(true)} accessibilityRole="button" className="flex-row items-center gap-2" hitSlop={8}>
                    <Ionicons name="folder-open-outline" size={19} color="#374151" />
                    <Text className="text-[14px] font-black" style={{ color: '#374151' }}>Mes documents</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={envoyer}
                  disabled={!pret || envoi}
                  accessibilityRole="button"
                  className="items-center justify-center rounded-full"
                  style={{ height: 50, paddingHorizontal: 30, backgroundColor: BLEU, opacity: pret ? 1 : 0.45 }}>
                  {envoi ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[16px] font-black">Envoyer</Text>}
                </Pressable>
              </View>
            </View>

            <Text className="px-1 mt-4 text-[13px] leading-[19px]" style={{ color: '#6B7280' }}>
              10 e-mails par 24 heures, 3 pièces jointes au plus (10 Mo en tout). Le message part du domaine Facilité ; les réponses arrivent à votre adresse.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Mes documents : tous les documents du profil, à cocher pour les joindre */}
      <Modal visible={listeOuverte} transparent animationType="slide" onRequestClose={() => setListeOuverte(false)}>
        <Pressable onPress={() => setListeOuverte(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable onPress={() => {}} style={{ maxHeight: '75%', backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 20 }}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-2">
              <View>
                <Text className="text-[17px] font-black text-[#111]">Mes documents</Text>
                <Text className="text-[12px]" style={{ color: '#6B7280' }}>{nbPieces} / {MAX_PIECES} pièces jointes</Text>
              </View>
              <Pressable onPress={() => setListeOuverte(false)} accessibilityRole="button" hitSlop={10}>
                <Text className="text-[14px] font-black" style={{ color: '#2563EB' }}>OK</Text>
              </Pressable>
            </View>
            {documents === null ? (
              <View className="py-10"><ActivityIndicator color="#10B981" /></View>
            ) : documents.length === 0 ? (
              <Text className="text-center text-[13px] px-8 py-10" style={{ color: '#6B7280' }}>Aucun document dans votre profil. Ajoutez-en dans l’onglet Documents du profil.</Text>
            ) : (
              <FlatList
                data={documents}
                keyExtractor={(d) => d.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
                renderItem={({ item }) => {
                  const coche = idsDocs.includes(item.id);
                  return (
                    <Pressable
                      onPress={() => basculerDocument(item.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: coche }}
                      className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
                      style={{ borderWidth: 1.5, borderColor: coche ? '#10B981' : '#E5E7EB', backgroundColor: coche ? '#ECFDF5' : '#fff' }}>
                      <Ionicons name={coche ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={coche ? '#10B981' : '#9CA3AF'} />
                      <View className="flex-1 min-w-0">
                        <Text className="text-[14px] font-bold text-[#111]" numberOfLines={1}>{item.titre}</Text>
                        <Text className="text-[11.5px]" style={{ color: '#6B7280' }}>{estLettre(item) ? 'Lettre de motivation' : item.estImage ? 'Photo' : 'CV / document'}</Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
