require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\483c8269-7e67-4432-b341-a4fc630ec28c\\.user_uploaded\\media_1787569677812.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'ucad_ebad_recrutement.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/ucad_ebad_recrutement.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/ucad_ebad_recrutement.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('ucad_ebad_recrutement.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('ucad_ebad_recrutement.jpg');
        if (publicUrlData?.publicUrl) {
          imageUrl = publicUrlData.publicUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Erreur upload storage:', err.message);
  }

  console.log('Image URL retenue:', imageUrl);

  // 3. Insertion de l'offre dans job_offers
  const offerPayload = {
    title: "Appel à candidatures : Enseignants-chercheurs à l'EBAD (UCAD)",
    company: "Université Cheikh Anta Diop de Dakar (UCAD) / EBAD",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Fonction Publique Universitaire",
    salary_range: "Grille indiciaire Enseignement Supérieur (UCAD)",
    min_education_level: "Master / Doctorat (Bac+5 à Bac+8)",
    deadline: "2026-09-21",
    listing_type: "concours",
    image_url: imageUrl,
    external_link: "https://recrutement.ucad.sn",
    description: `L’Université Cheikh Anta Diop de Dakar (UCAD) recrute, pour le compte de l’École de Bibliothécaires, Archivistes et Documentalistes (EBAD), des enseignants-chercheurs.

📌 POSTES À POURVOIR :
• Deux (02) enseignants-chercheurs en Archivistique ;
• Un (01) enseignant-chercheur en Bibliothéconomie ;
• Un (01) enseignant-chercheur en Documentation ;
• Un (01) enseignant-chercheur en Archives et Documentation audiovisuelle.

🎯 DIPLÔMES ET QUALIFICATIONS REQUIS :
• Doctorat ou Master en Archivistique, Bibliothéconomie, Documentation, Sciences de l'information et de la communication (avec spécialisation en archivage et documentation audiovisuelle), ou tout autre diplôme admis en équivalence dans la même spécialité.

📍 LIEU : Dakar, Sénégal (EBAD / UCAD)
⏰ DATE LIMITE : 21 septembre 2026 à 12h00

📝 DÉPÔT DES CANDIDATURES :
Les dossiers complets doivent être déposés exclusivement en ligne sur la plateforme officielle de recrutement de l'UCAD :
👉 https://recrutement.ucad.sn

📄 INFORMATIONS COMPLÉMENTAIRES & DÉTAILS :
Consultez l'avis complet et les pièces jointes :
https://ucadedu-my.sharepoint.com/my?id=%2Fpersonal%2Fmatar2%5Fnguer%5Fucad%5Fedu%5Fsn%2FDocuments%2FPi%C3%A8ces%20jointes%2FRelance%20EBAD%2Epdf&parent=%2Fpersonal%2Fmatar2%5Fnguer%5Fucad%5Fedu%5Fsn%2FDocuments%2FPi%C3%A8ces%20jointes`,
    status: "approved",
    is_active: true,
    is_test_account: false,
    recruiter_id: "00000000-0000-4000-a000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  const { data: insertedOffer, error: insertError } = await supabase
    .from('job_offers')
    .insert(offerPayload)
    .select()
    .single();

  if (insertError) {
    console.error('Erreur insertion offre:', insertError);
    process.exit(1);
  }

  console.log('✅ Offre UCAD / EBAD publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
