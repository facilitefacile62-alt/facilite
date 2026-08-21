require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function update() {
  const finalLink = "https://jobs.foundever.com/";
  const updatedDesc = `À propos de Foundever™ :
Foundever™ est un leader mondial de l'expérience client (CX). Avec 170 000 collaborateurs dans le monde, nous sommes l’équipe derrière les meilleures expériences des 750 plus grandes marques internationales et digitales. Nos solutions CX innovantes, notre technologie et notre expertise sont conçues pour répondre aux besoins opérationnels de nos clients et leur offrir une expérience sans couture, partout et à tout moment. Prenant en charge 9 millions d’expériences chaque jour dans plus de 60 langues et 45 pays, Foundever combine la force d’une présence mondiale à une approche entrepreneuriale, permettant aux entreprises de toutes tailles et de tous secteurs de transformer leur CX.

🎯 Résumé du poste :
Nous recrutons des conseillers clients en réception d’appels qui auront pour missions d’assurer l’assistance de la clientèle en difficulté dans un esprit de fidélisation et de satisfaction en apportant une réponse complète et fiable à leur demande.

📋 Dans ce contexte, vous serez chargé(e) de :
• Accueillir les appels des clients
• Écouter et diagnostiquer leurs besoins afin de leur apporter la solution adaptée
• Appliquer les process définis et maîtriser l’utilisation des outils
• Remonter toute information permettant d’identifier un dysfonctionnement ou d’améliorer une procédure
• Contribuer à la bonne marche du service
• Veiller à atteindre les objectifs qualitatifs et quantitatifs fixés par la direction

👤 Profil recherché :
• Une parfaite maîtrise de la langue française (à l’oral comme à l’écrit)
• Le sens de l’écoute et du service
• Une bonne connaissance de l’outil informatique
• Assidu, impliqué, ponctuel

🎁 Nous offrons :
• Rémunération attractive (fixe + prime)
• Formation rémunérée à 100%
• Avantages sociaux attrayants

🌐 Pour postuler et visiter le site officiel :
https://jobs.foundever.com/`;

  const { data, error } = await supabase
    .from('job_offers')
    .update({
      external_link: finalLink,
      description: updatedDesc,
      updated_at: new Date().toISOString()
    })
    .eq('company', 'Foundever')
    .select();

  if (error) {
    console.error('Erreur update:', error);
  } else {
    console.log('✅ Offre Foundever mise à jour avec le lien unique https://jobs.foundever.com/ dans Supabase !', data);
  }
}

update();
