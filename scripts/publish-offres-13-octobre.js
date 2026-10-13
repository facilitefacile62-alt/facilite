// Publication de 4 offres (13/10/2026) : Sen Interim, ADEPME, Tectra Sénégal, Top Work.
// Mêmes étapes que publish_auchan_*_offer.js : image dans le bucket public « job-offers »,
// insertion dans job_offers, approbation par la fonction de modération si un déclencheur
// a remis l'offre en attente. Seules les informations visibles sur les affiches sont
// utilisées : un champ absent de l'affiche reste vide.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const IMAGES = 'C:\\Users\\gta\\AppData\\Local\\Temp\\claude\\c--Users-gta-Downloads-monprojetfacilite\\1b135cee-5b7a-4b93-b5d3-904aef964f88\\images\\';
const RECRUTEUR = '00000000-0000-4000-a000-000000000001';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const OFFRES = [
  {
    fichier: '607.jpg',
    nomImage: 'sen_interim_appel_candidature.jpg',
    title: 'Sen Interim recrute — Assistante de direction, Caissiers, Agent de guichet, Superviseur des opérations de banque',
    company: 'Sen Interim',
    location: 'Dakar, Sénégal',
    contract_type: 'CDD',
    min_education_level: 'Bac à Bac+3/5 selon le poste',
    deadline: null,
    contact_email: 'recrutement@seninterim.sn',
    sujet: 'Candidature - Préciser le poste',
    description: `APPEL À CANDIDATURE — SEN INTERIM

Sen Interim recrute pour des postes basés à Dakar, en CDD.

ASSISTANTE DE DIRECTION
• Bac+ 2/3 en gestion, administration ou équivalent
• Expérience similaire souhaitée (ou moins 1 an)
• Bonne maîtrise des outils bureautiques (Word, Excel, PowerPoint)
• Excellent sens de l'organisation et de la communication
• Discrétion, rigueur et esprit d'initiative

CAISSIERS H/F
• Bac minimum (toutes séries)
• Expérience en caisse ou en banque souhaitée
• Bonne présentation et sens du contact
• Rigueur, honnêteté et discrétion
• Capacité à gérer le stress

AGENT DE GUICHET H/F
• Bac + 2 comptabilité Finance
• Expérience en banque ou en accueil client souhaitée
• Bonne présentation et sens du contact
• Rigueur, discrétion et honnêteté

SUPERVISEUR DES OPÉRATIONS DE BANQUE
• Bac+ 3/5 en banque, finance, gestion ou équivalent
• Expérience en supervision bancaire ou management d'équipe
• Maîtrise des opérations bancaires et procédures de contrôle
• Leadership, rigueur et esprit d'analyse

CONTRAT ET HORAIRES
• Poste basé à Dakar — Contrat : CDD
• Horaires : lundi au vendredi 8h00 – 17h00, samedi 8h00 – 13h00 (avec une permanence)

COMMENT POSTULER
Envoyez votre CV à recrutement@seninterim.sn — Objet : Candidature – Préciser le poste.
Site : www.seninterim.sn`,
  },
  {
    fichier: '608.jpg',
    nomImage: 'adepme_assistant_comptable_cdd.jpg',
    title: 'ADEPME recrute un(e) assistant(e) comptable chargé(e) de la comptabilité des matières — CDD',
    company: 'ADEPME',
    location: 'Sénégal',
    contract_type: 'CDD',
    min_education_level: 'Licence Finance/Comptabilité',
    deadline: '2026-10-16',
    contact_email: 'recrutement@adepme.sn',
    sujet: 'Candidature - Assistant(e) Comptable',
    description: `NOUS RECRUTONS — ADEPME (Agence de Développement et d'Encadrement des Petites et Moyennes Entreprises)

Un(e) assistant(e) Comptable chargé(e) de la comptabilité des matières — CDD.

Rejoignez l'ADEPME et contribuez à l'accompagnement des PME sénégalaises.

PROFIL RECHERCHÉ
• Licence Finance/Comptabilité
• Au moins un (01) an dans la comptabilité des matières du 1er et du 2ème groupe

CANDIDATURE
Envoyez votre candidature à recrutement@adepme.sn.
Date limite : 16 octobre 2026.`,
  },
  {
    fichier: '609.jpg',
    nomImage: 'tectra_senegal_peintre_dakar.jpg',
    title: 'Tectra Sénégal recrute un Peintre à Dakar',
    company: 'Tectra Sénégal',
    location: 'Dakar, Sénégal',
    contract_type: null,
    min_education_level: null,
    deadline: null,
    contact_email: 'recrutement@tectra.sn',
    sujet: 'Candidature - Peintre',
    description: `TECTRA SÉNÉGAL RECRUTE UN PEINTRE À DAKAR !

PROFIL RECHERCHÉ
• Expérience en peinture bâtiment/industrielle
• Maîtrise des techniques (ponçage, enduit, application)
• Rigueur, soin et sécurité

MODALITÉS DE CANDIDATURE
• Lieu : Dakar, Sénégal
• Comment postuler : envoyez votre CV en précisant en objet « Candidature – Peintre » à recrutement@tectra.sn
• Ou postulez via ffacilite.com`,
  },
  {
    fichier: '610.jpg',
    nomImage: 'top_work_hydrocarbures_fatick.jpg',
    title: 'Top Work recrute 12 postes dans les hydrocarbures à Fatick (Chef de dépôt, Responsables, Pompistes…)',
    company: 'Top Work',
    location: 'Fatick, Sénégal',
    contract_type: null,
    min_education_level: null,
    deadline: null,
    contact_email: 'v@topwork.sn',
    sujet: 'Candidature',
    description: `TOP WORK — NOUS RECRUTONS (Sénégal, Fatick)

Secteur : Hydrocarbures

POSTES À POURVOIR
• 01 Chef de Dépôt
• 01 Responsable Exploitation
• 01 Responsable Maintenance
• 01 Responsable QHSE
• 01 Responsable Section Transit
• 01 Responsable Section Stock et Chargement
• 01 Agent Stock
• 01 Chef de Quart
• 01 Chef de Piste
• 01 Électromécanicien
• 06 Pompistes
• 01 Agent d'Accueil

COMMENT POSTULER
Envoyez votre candidature à v@topwork.sn, ou postulez facilement sur ffacilite.com.`,
  },
];

async function publier(o) {
  const corps = fs.readFileSync(IMAGES + o.fichier);
  const { error: errUp } = await admin.storage.from('job-offers').upload(o.nomImage, corps, { contentType: 'image/jpeg', upsert: true });
  if (errUp) throw new Error('upload ' + o.nomImage + ' : ' + errUp.message);
  const imageUrl = admin.storage.from('job-offers').getPublicUrl(o.nomImage).data.publicUrl;

  const maintenant = new Date().toISOString();
  const ligne = {
    title: o.title,
    company: o.company,
    location: o.location,
    contract_type: o.contract_type,
    min_education_level: o.min_education_level,
    deadline: o.deadline,
    image_url: imageUrl,
    contact_email: o.contact_email,
    external_link: `mailto:${o.contact_email}?subject=${encodeURIComponent(o.sujet)}`,
    description: o.description,
    listing_type: 'offre_emploi',
    status: 'approved',
    is_active: true,
    is_test_account: false,
    recruiter_id: RECRUTEUR,
    created_at: maintenant,
    updated_at: maintenant,
    status_updated_at: maintenant,
  };
  const { data, error } = await admin.from('job_offers').insert(ligne).select('id, title, status, is_active').single();
  if (error) throw new Error('insertion ' + o.company + ' : ' + error.message);
  return data;
}

async function approuverSiBesoin(ids) {
  const { data: lien } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'facilitefacile62@gmail.com' });
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hash = lien?.properties?.hashed_token;
  if (!hash) return;
  const { data: v } = await anon.auth.verifyOtp({ token_hash: hash, type: 'magiclink' });
  if (!v?.session) return;
  for (const id of ids) {
    const { error } = await anon.rpc('moderate_job_offer', { offer_id: id, decision: 'approved' });
    if (error) console.warn('moderate_job_offer', id, error.message);
  }
}

(async () => {
  const crees = [];
  for (const o of OFFRES) {
    const r = await publier(o);
    console.log('inséré :', r.id, '|', r.company ?? o.company, '|', r.status, r.is_active);
    crees.push(r);
  }
  await approuverSiBesoin(crees.filter((r) => r.status !== 'approved').map((r) => r.id));
  const pub = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await pub.from('job_offers').select('id, company, status, is_active, image_url').in('id', crees.map((r) => r.id));
  console.log('Lecture publique (clé anonyme) :');
  for (const l of data ?? []) console.log(' ', l.company, '|', l.status, '| actif:', l.is_active, '|', l.image_url);
  console.log(`${data?.length ?? 0}/4 offres visibles publiquement`);
})().catch((e) => {
  console.error('ERREUR :', e.message);
  process.exit(1);
});
