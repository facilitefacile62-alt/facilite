require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Offre BTP 30 Profils
  const btpSource = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787078892913.png';
  const btpDest = path.join(process.cwd(), 'public', 'recrutement_massif_btp_30_profils.png');
  let btpImageUrl = '/recrutement_massif_btp_30_profils.png';

  try {
    if (fs.existsSync(btpSource)) {
      fs.copyFileSync(btpSource, btpDest);
      const fileBody = fs.readFileSync(btpDest);
      const { data, error } = await supabase.storage
        .from('job-offers')
        .upload('recrutement_massif_btp_30_profils.png', fileBody, { contentType: 'image/png', upsert: true });
      if (!error) {
        const { data: pUrl } = supabase.storage.from('job-offers').getPublicUrl('recrutement_massif_btp_30_profils.png');
        if (pUrl?.publicUrl) btpImageUrl = pUrl.publicUrl;
      }
    }
  } catch (e) {
    console.warn('BTP image error:', e.message);
  }

  // 2. Offre Mobilité Sénégal Livreur / Coursier
  const livSource = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787075984188.jpg';
  const livDest = path.join(process.cwd(), 'public', 'mobilite_senegal_livreur_coursier.jpg');
  let livImageUrl = '/mobilite_senegal_livreur_coursier.jpg';

  try {
    if (fs.existsSync(livSource)) {
      fs.copyFileSync(livSource, livDest);
      const fileBody = fs.readFileSync(livDest);
      const { data, error } = await supabase.storage
        .from('job-offers')
        .upload('mobilite_senegal_livreur_coursier.jpg', fileBody, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        const { data: pUrl } = supabase.storage.from('job-offers').getPublicUrl('mobilite_senegal_livreur_coursier.jpg');
        if (pUrl?.publicUrl) livImageUrl = pUrl.publicUrl;
      }
    }
  } catch (e) {
    console.warn('Livreur image error:', e.message);
  }

  // Insertion BTP 30 Profils
  const btpPayload = {
    title: "Recrutement Massif BTP : 30 Profils Différents pour Un Grand Projet BTP",
    company: "ICS Industrial (Société de Placement & BTP)",
    location: "Sénégal (Chantier BTP)",
    contract_type: "CDD / Plein temps / Chantier",
    salary_range: "Selon grille BTP & expérience",
    min_education_level: "Tous niveaux (Ouvriers qualifiés, Techniciens, Ingénieurs)",
    deadline: "2026-09-30",
    image_url: btpImageUrl,
    contact_email: "crewcoordinator@icsindustrial.com",
    external_link: "mailto:crewcoordinator@icsindustrial.com?subject=Candidature%20%5BIndiquer%20le%20poste%20souhait%C3%A9%5D",
    description: `Une société de placement de personnel de la place recrute pour le compte d’un client, dans le cadre d’un projet d’envergure dans le secteur du Bâtiment et Travaux Publics (BTP), plusieurs profils qualifiés.

🏗️ 30 PROFILS RECHERCHÉS :

🏥 Santé, Sécurité & Administration :
• Infirmier(ère)s
• Agent douane / transit
• Assistant(e) de bureau
• Superviseur Sécurité (HSE)

📐 Encadrement, Supervision & Ingénierie :
• Géomètre
• Chefs d’Équipe & Chef d’Équipe Général
• Superviseur Génie Civil
• Superviseur Mécanique
• Superviseur Électrique
• Superviseur Soudage

🔧 Logistique, Maintenance & Flotte :
• Chef Mécanicien & Chef d’Atelier
• Mécanicien Engins Lourds
• Coordinateur Équipements
• Coordinateur Flotte

🚜 Conducteurs d’Engins & Chauffeurs :
• Chauffeur Camion & Chauffeur Porte-engins
• Conducteur Pelle, Bulldozer, Sideboom, Chargeuse, Pipe Layer
• Grutier & Cariste

⚙️ Métiers Techniques & Support Chantier :
• Tuyauteur, Électricien, Échafaudeur
• Signaleur (Banksman), Technicien Instrumentation

📩 COMMENT POSTULER :
Envoyez votre dossier de candidature par e-mail à : crewcoordinator@icsindustrial.com
📌 Objet du mail : Candidature [Indiquer le poste souhaité]`,
    status: "approved",
    is_active: true,
    is_test_account: false,
    recruiter_id: "00000000-0000-4000-a000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  const { data: btpOffer, error: btpErr } = await supabase.from('job_offers').insert(btpPayload).select().single();
  if (btpErr) console.error('Erreur BTP:', btpErr);
  else console.log('✅ Offre BTP publiée ! ID:', btpOffer.id);

  // Insertion Livreur
  const livPayload = {
    title: "Offre d'emploi : Agent Livreur / Coursier (H/F)",
    company: "Mobilité Sénégal (Solutions de mobilité)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Fixe attractif + Primes de livraison",
    min_education_level: "Permis 2 roues valide",
    deadline: "2026-09-15",
    image_url: livImageUrl,
    external_link: "https://lnkd.in/dtvb_nU9",
    description: `Entreprise spécialisée dans les solutions de mobilité au Sénégal recrute un(e) Agent Livreur / Coursier (H/F) pour ses opérations à Dakar.

🎯 MISSIONS & QUALIFICATIONS :
• Connaissance approfondie des quartiers et itinéraires de Dakar.
• Maîtrise de la conduite de deux-roues et permis de conduire valide obligatoire.
• Sens aigu de la ponctualité, rigueur et orientation client.
• Gestion des livraisons et tracking en temps réel sur smartphone.

🔗 COMMENT POSTULER :
Déposez votre candidature en ligne :
https://lnkd.in/dtvb_nU9`,
    status: "approved",
    is_active: true,
    is_test_account: false,
    recruiter_id: "00000000-0000-4000-a000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  const { data: livOffer, error: livErr } = await supabase.from('job_offers').insert(livPayload).select().single();
  if (livErr) console.error('Erreur Livreur:', livErr);
  else console.log('✅ Offre Livreur publiée ! ID:', livOffer.id);
}

main();
