import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteMenu, FOND_CARTES } from '@/components/CarteMenu';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  confirmerChangement,
  demanderChangement,
  dissocierMoyen,
  envoyerPreuve,
  lireActiviteCompte,
  lireEtatCompte,
  NOMS,
  SUPPORT_PERDU,
  verifierPreuve,
  type Canal,
  type EtatCompte,
  type ReponseCompte,
} from '@/lib/compteApi';
import { WHATSAPP_FACILITE } from '@/lib/configFacilite';

// Informations du compte — même écran dans Facilité et dans Locaux (même compte, mêmes routes serveur, mêmes phrases que le site). L'écran n'applique aucune
// règle : valeurs MASQUÉES renvoyées par le serveur, messages renvoyés par le serveur, gros boutons. Le téléphone reste fermé tant que le serveur ne l'ouvre pas.
type Etape = 'choix' | 'confirmer' | 'code_preuve' | 'nouvelle' | 'code_nouvelle' | 'dissocier';
type Fenetre = { canal: Canal; action?: 'changer' | 'dissocier'; etape: Etape; autorisation?: string; envoyeA?: string };

function GrosBouton({ texte, onPress, variante = 'plein', occupe, desactive }: { texte: string; onPress: () => void; variante?: 'plein' | 'danger' | 'blanc'; occupe?: boolean; desactive?: boolean }) {
  const fond = variante === 'plein' ? '#10B981' : variante === 'danger' ? '#DC2626' : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={occupe || desactive}
      accessibilityRole="button"
      className="items-center justify-center"
      style={{ minHeight: 60, borderRadius: 18, backgroundColor: fond, borderWidth: variante === 'blanc' ? 1.5 : 0, borderColor: 'rgba(0,0,0,0.15)', opacity: occupe || desactive ? 0.55 : 1, paddingHorizontal: 14 }}>
      {occupe ? <ActivityIndicator color={variante === 'blanc' ? '#1A1A1A' : '#fff'} /> : <Text className="text-[17px] font-black text-center" style={{ color: variante === 'blanc' ? '#1A1A1A' : '#fff' }}>{texte}</Text>}
    </Pressable>
  );
}

const ouvrirSupport = () => Linking.openURL(`https://wa.me/${WHATSAPP_FACILITE}`).catch(() => {});

export default function EcranInformationsCompte() {
  const { profile, refreshProfile } = useAuth();
  const [etat, setEtat] = useState<EtatCompte | null>(null);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState('');
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [valeur, setValeur] = useState('');
  const [code, setCode] = useState('');
  const [perdu, setPerdu] = useState(false);
  const [activite, setActivite] = useState<NonNullable<ReponseCompte['evenements']> | null>(null);

  const charger = useCallback(async () => {
    const r = await lireEtatCompte();
    if (r.ok && r.etat) {
      setEtat(r.etat);
      setErreur('');
    } else setErreur(r.message ?? 'Impossible pour le moment.');
  }, []);
  useEffect(() => {
    void charger();
  }, [charger]);

  const fermer = () => {
    setFenetre(null);
    setMessage('');
    setValeur('');
    setCode('');
    setOccupe(false);
  };
  const ouvrir = (canal: Canal) => {
    setFait('');
    setMessage('');
    setFenetre({ canal, etape: 'choix' });
  };
  const executer = async (appel: () => Promise<ReponseCompte>, suite: (r: ReponseCompte) => void) => {
    setOccupe(true);
    setMessage('');
    const r = await appel();
    setOccupe(false);
    if (!r.ok) setMessage(r.message ?? 'Impossible pour le moment.');
    else suite(r);
  };
  const terminer = (r: ReponseCompte) => {
    if (r.etat) setEtat(r.etat);
    setFait(r.message ?? "C'est fait.");
    // La session de cet appareil porte encore l'ancienne valeur : on la renouvelle (le serveur a déjà fermé les autres appareils).
    supabase.auth.refreshSession().then(() => refreshProfile()).catch(() => {});
    fermer();
  };

  const f = fenetre;
  const nom = f ? NOMS[f.canal] : null;
  const masque = f && etat ? (f.canal === 'email' ? etat.email : etat.telephone) : null;
  const naissance = typeof profile?.date_naissance === 'string' && profile.date_naissance ? profile.date_naissance : null;
  const naissanceLisible = naissance ? new Date(`${naissance}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non renseignée';

  const demanderPreuve = (canal: Canal, action: 'changer' | 'dissocier') =>
    executer(
      () => envoyerPreuve(canal),
      (r) => {
        if (r.dejaVerifie) setFenetre({ canal, action, etape: action === 'changer' ? 'nouvelle' : 'dissocier', autorisation: r.autorisation });
        else setFenetre({ canal, action, etape: 'code_preuve', envoyeA: r.envoyeA });
      }
    );

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Informations du compte" />
        <ScrollView contentContainerClassName="px-5 pb-8 gap-3" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!etat && !erreur ? <ActivityIndicator style={{ marginTop: 8 }} color="#047857" /> : null}
          {erreur ? (
            <Text accessibilityRole="alert" className="text-[14px] font-bold rounded-2xl p-3.5" style={{ color: '#991B1B', backgroundColor: '#FEE2E2' }}>
              {erreur}
            </Text>
          ) : null}
          {fait ? (
            <Text accessibilityRole="alert" className="text-[14.5px] font-bold rounded-2xl p-3.5" style={{ color: '#065F46', backgroundColor: '#D1FAE5' }}>
              {fait}
            </Text>
          ) : null}

          {etat ? (
            <>
              <CarteMenu
                icone="call-outline"
                titre="Téléphone"
                sous={etat.telephoneActif ? etat.telephone || 'Non renseigné' : `${etat.telephone || 'Non renseigné'} · changement bientôt`}
                onPress={etat.telephoneActif ? () => ouvrir('telephone') : () => {}}
                sansFleche={!etat.telephoneActif}
              />
              <CarteMenu icone="mail-outline" titre="Adresse e-mail" sous={etat.email || 'Non renseignée'} onPress={() => ouvrir('email')} />
              <View className="bg-white rounded-2xl p-3.5 gap-1.5">
                <Text className="text-[13px] font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>Date de naissance</Text>
                <Text className="text-[16px] font-black text-[#1A1A1A]">{naissanceLisible}</Text>
                <Text className="text-[13.5px]" style={{ color: 'rgba(0,0,0,0.65)' }}>Pour la corriger, contactez-nous.</Text>
                <Pressable onPress={ouvrirSupport} accessibilityRole="button" className="mt-1">
                  <Text className="text-[14px] font-black" style={{ color: '#047857' }}>Écrire au support sur WhatsApp</Text>
                </Pressable>
              </View>
              <GrosBouton texte="Je n'ai plus accès" variante="blanc" onPress={() => setPerdu(true)} />
              <GrosBouton
                texte="Activité du compte"
                variante="blanc"
                onPress={async () => {
                  const r = await lireActiviteCompte();
                  setActivite(r.ok ? (r.evenements ?? []) : []);
                }}
              />
              {activite ? (
                <View className="bg-white rounded-2xl p-3.5 gap-2">
                  <Text className="text-[15px] font-black text-[#1A1A1A]">Activité du compte</Text>
                  {activite.length === 0 ? <Text className="text-[13.5px]" style={{ color: 'rgba(0,0,0,0.65)' }}>Rien à signaler.</Text> : null}
                  {activite.map((e, i) => (
                    <View key={i} className="flex-row justify-between gap-3">
                      <Text className="flex-1 text-[13.5px] text-[#1A1A1A]">{e.libelle}{e.moyen ? ` · ${e.moyen}` : ''}</Text>
                      <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{new Date(e.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={perdu} transparent animationType="slide" onRequestClose={() => setPerdu(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <View className="bg-white p-5 gap-3" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text className="text-[22px] font-black text-[#1A1A1A]">{SUPPORT_PERDU.titre}</Text>
            <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>{SUPPORT_PERDU.phrase}</Text>
            <Text className="text-[14px] font-bold text-[#1A1A1A]">Préparez :</Text>
            {SUPPORT_PERDU.informations.map((i) => (
              <Text key={i} className="text-[14px]" style={{ color: 'rgba(0,0,0,0.7)' }}>• {i}</Text>
            ))}
            <GrosBouton texte="Écrire au support sur WhatsApp" onPress={ouvrirSupport} />
            <GrosBouton texte="Fermer" variante="blanc" onPress={() => setPerdu(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(f && nom)} transparent animationType="slide" onRequestClose={fermer}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          {f && nom ? (
            <ScrollView className="bg-white" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }} contentContainerClassName="p-5 gap-3" keyboardShouldPersistTaps="handled">
              <Text className="text-[22px] font-black text-[#1A1A1A]">
                {f.etape === 'choix' ? nom.titre : f.action === 'dissocier' ? `Retirer ${nom.le}` : `Changer ${nom.le}`}
              </Text>
              {message ? (
                <Text accessibilityRole="alert" className="text-[14px] font-bold rounded-2xl p-3" style={{ color: '#991B1B', backgroundColor: '#FEE2E2' }}>
                  {message}
                </Text>
              ) : null}

              {f.etape === 'choix' ? (
                <>
                  <Text className="text-[26px] font-black text-[#1A1A1A]">{masque || 'Non renseigné'}</Text>
                  <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>{nom.phrase}</Text>
                  <GrosBouton texte={nom.changer} onPress={() => setFenetre({ canal: f.canal, action: 'changer', etape: 'confirmer' })} />
                  <GrosBouton texte={nom.retirer} variante="blanc" onPress={() => setFenetre({ canal: f.canal, action: 'dissocier', etape: 'confirmer' })} />
                </>
              ) : null}

              {f.etape === 'confirmer' && f.action ? (
                <>
                  <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>
                    {f.action === 'changer' ? `Vous allez changer ${nom.le}. Nous vérifierons d'abord que c'est bien vous.` : `Vous allez retirer ${nom.le} de votre compte. Nous vérifierons d'abord que c'est bien vous.`}
                  </Text>
                  <GrosBouton texte="Oui, continuer" variante={f.action === 'dissocier' ? 'danger' : 'plein'} occupe={occupe} onPress={() => demanderPreuve(f.canal, f.action as 'changer' | 'dissocier')} />
                  <GrosBouton texte="Non, annuler" variante="blanc" onPress={fermer} />
                </>
              ) : null}

              {f.etape === 'code_preuve' || f.etape === 'code_nouvelle' ? (
                <>
                  <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>
                    Nous avons envoyé un code à {f.envoyeA}. Saisissez-le ici. Il est valable 10 minutes.
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    placeholder="______"
                    className="text-center text-[28px] font-black rounded-2xl"
                    style={{ minHeight: 60, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)', letterSpacing: 8 }}
                  />
                  <GrosBouton
                    texte="Valider le code"
                    occupe={occupe}
                    desactive={code.length !== 6}
                    onPress={() =>
                      f.etape === 'code_preuve'
                        ? executer(() => verifierPreuve(f.canal, code), (r) => {
                            setCode('');
                            setFenetre({ ...f, etape: f.action === 'changer' ? 'nouvelle' : 'dissocier', autorisation: r.autorisation });
                          })
                        : executer(() => confirmerChangement(f.canal, code, f.autorisation ?? ''), terminer)
                    }
                  />
                  <GrosBouton texte="Non, annuler" variante="blanc" onPress={fermer} />
                </>
              ) : null}

              {f.etape === 'nouvelle' ? (
                <>
                  <Text className="text-[14px] font-bold text-[#1A1A1A]">{nom.champ}</Text>
                  <TextInput
                    value={valeur}
                    onChangeText={setValeur}
                    keyboardType={f.canal === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={nom.saisie}
                    className="text-[18px] font-bold rounded-2xl px-4"
                    style={{ minHeight: 60, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)' }}
                  />
                  <Text className="text-[13.5px]" style={{ color: 'rgba(0,0,0,0.65)' }}>Nous enverrons un code à cette nouvelle valeur pour la confirmer. Rien ne change avant.</Text>
                  <GrosBouton
                    texte="Envoyer le code"
                    occupe={occupe}
                    desactive={valeur.trim().length < 5}
                    onPress={() =>
                      executer(() => demanderChangement(f.canal, valeur, f.autorisation ?? ''), (r) => {
                        setCode('');
                        setFenetre({ ...f, etape: 'code_nouvelle', envoyeA: r.envoyeA });
                      })
                    }
                  />
                  <GrosBouton texte="Non, annuler" variante="blanc" onPress={fermer} />
                </>
              ) : null}

              {f.etape === 'dissocier' ? (
                <>
                  <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>Dernière question : voulez-vous vraiment retirer {nom.le} ({masque}) ?</Text>
                  <GrosBouton texte="Oui, continuer" variante="danger" occupe={occupe} onPress={() => executer(() => dissocierMoyen(f.canal, f.autorisation ?? ''), terminer)} />
                  <GrosBouton texte="Non, annuler" variante="blanc" onPress={fermer} />
                </>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
