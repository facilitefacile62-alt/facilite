// Pages de conseils (/conseils/<slug>) : textes, titres et descriptions. Contenu rédigé pour ce site, sans chiffre, salaire, statistique ni témoignage, sans promesse de résultat.
//
// Structure d'une page : { slug, court, titre, description, h1, intro, sections: [{ h2, paragraphes?, liste?, ordonnee?, exempleDepuis? }], liensPage }.
// Dans un texte, [[/chemin|texte du lien]] devient un lien interne (voir ConseilTexte). `titre` ne contient pas la marque : le modèle de titre du site
// (« %s | Facilite ») l'ajoute, d'où 49 caractères au plus pour 60 en tout.

export const DATE_PUBLICATION = "2026-10-31";
export const DATE_MODIFICATION = "2026-10-31";

export const PAGES_CONSEILS = [
  {
    slug: "modele-cv-senegal",
    court: "Modèle de CV",
    titre: "Modèle de CV au Sénégal : rubriques et ordre",
    description: "Quelles rubriques mettre dans un CV, dans quel ordre, et comment les écrire simplement : coordonnées, expériences, formation, compétences et langues.",
    h1: "Modèle de CV au Sénégal : les rubriques et leur ordre",
    intro:
      "Un recruteur qui reçoit beaucoup de candidatures ne lit pas chaque CV en entier. Il cherche vite qui vous êtes, ce que vous savez faire et comment vous joindre. Un bon modèle de CV répond à ces trois questions dès les premières lignes. Voici les rubriques à prévoir, l'ordre le plus clair et la manière de les écrire, que vous cherchiez un premier emploi à Dakar ou un nouveau poste après plusieurs années de travail.",
    sections: [
      {
        h2: "À quoi sert un CV, au fond ?",
        paragraphes: [
          "Le CV ne raconte pas toute votre vie. Il a un seul but : donner envie au recruteur de vous appeler pour un entretien. Chaque ligne doit donc servir cet objectif. Si une information n'aide pas à comprendre pourquoi vous convenez au poste, vous pouvez la retirer.",
          "Gardez aussi en tête que votre CV sera souvent ouvert sur un téléphone, parfois depuis WhatsApp, avant d'être lu sur un ordinateur. Une présentation simple, avec peu de couleurs et de grands titres, se lit bien partout.",
        ],
      },
      {
        h2: "L'ordre des rubriques, de haut en bas",
        paragraphes: ["Voici l'ordre que nous conseillons pour la plupart des candidatures. Il place en haut ce que le recruteur veut voir en premier."],
        ordonnee: true,
        liste: [
          "L'en-tête : votre nom en grand, le métier visé en dessous, puis vos coordonnées.",
          "Une courte accroche de deux ou trois lignes qui dit qui vous êtes et ce que vous cherchez.",
          "Les expériences professionnelles, de la plus récente à la plus ancienne.",
          "La formation : vos diplômes et formations, avec l'établissement et la ville.",
          "Les compétences : ce que vous savez faire concrètement, en quelques mots chacune.",
          "Les langues : français, wolof, anglais ou autres, avec votre niveau expliqué simplement.",
          "Les centres d'intérêt, seulement s'ils disent quelque chose d'utile sur vous.",
        ],
      },
      {
        h2: "Les coordonnées : ce qu'il faut mettre et ce qu'il faut éviter",
        paragraphes: [
          "Indiquez votre prénom et votre nom, un numéro de téléphone sur lequel vous répondez vraiment, de préférence le même que votre WhatsApp, et une adresse e-mail sérieuse. Écrivez le numéro avec l'indicatif +221 si l'entreprise peut être jointe depuis l'étranger. Ajoutez votre quartier et votre ville, par exemple Dakar ou Thiès : cela suffit, il n'est pas utile de donner votre adresse complète.",
          "Évitez les adresses e-mail qui ressemblent à un surnom ou à une blague. Évitez aussi d'écrire votre numéro de carte d'identité ou toute information que vous ne donneriez pas à un inconnu. La photo est facultative : si vous en mettez une, choisissez une image nette, sur fond simple, où vous êtes seul et bien visible.",
        ],
      },
      {
        h2: "Décrire une expérience professionnelle",
        paragraphes: [
          "Pour chaque expérience, écrivez le poste, le nom de la structure, la ville et la période. Ajoutez ensuite deux ou trois phrases courtes qui commencent par un verbe d'action : accueillir, vendre, livrer, organiser, réparer, enseigner, encaisser, former. Dites ce que vous avez fait, pas seulement le nom de votre poste.",
          "Si vous n'avez pas encore d'emploi, ne laissez pas la rubrique vide. Un stage, un apprentissage chez un artisan, de l'aide dans la boutique de la famille, un engagement dans une association ou un projet de quartier montrent déjà que vous savez travailler. Présentez-les de la même manière, honnêtement, sans exagérer.",
        ],
      },
      {
        h2: "Une page, lisible sur un téléphone",
        paragraphes: [
          "Pour un début de carrière ou une carrière courte, une seule page suffit largement. Même avec beaucoup d'expérience, deux pages sont un maximum. Choisissez une police lisible, des titres de rubriques bien visibles et assez d'espace entre les blocs.",
          "Enregistrez votre CV en fichier PDF : la mise en page ne bouge pas, quel que soit le téléphone ou l'ordinateur du recruteur. Donnez au fichier un nom clair, par exemple « CV-Prenom-Nom », pour qu'il se retrouve facilement parmi les autres.",
        ],
      },
      {
        h2: "Adapter son CV à chaque offre",
        paragraphes: [
          "Lisez l'offre avant d'envoyer votre CV. Repérez les mots importants : le poste, les tâches, les qualités demandées. Si vous possédez ces compétences, faites-les apparaître clairement dans l'accroche et dans les expériences. Vous pouvez parcourir [[/offres|les offres d'emploi du moment]] pour voir comment les entreprises décrivent les postes qu'elles recrutent.",
          "Ne copiez jamais une compétence que vous n'avez pas. Un entretien révèle vite ce qui est vrai, et l'honnêteté inspire plus confiance qu'une liste trop belle.",
        ],
      },
      {
        h2: "Relire avant d'envoyer",
        paragraphes: [
          "Relisez votre CV à voix haute, puis demandez à une personne de confiance de le relire à son tour. Vérifiez surtout les fautes dans votre nom, votre numéro de téléphone et votre adresse e-mail : une seule erreur dans un numéro et le recruteur ne pourra pas vous joindre.",
          "Quand tout est prêt, vous pouvez [[/creer-cv|créer votre CV sur Facilité]] avec un modèle déjà organisé dans l'ordre décrit ici. Pour rédiger le message qui accompagne votre CV, lisez notre guide sur [[/conseils/lettre-de-motivation|la lettre de motivation]].",
        ],
      },
    ],
    liensPage: ["lettre-de-motivation", "creer-cv-telephone", "postuler-whatsapp-email"],
  },
  {
    slug: "lettre-de-motivation",
    court: "Lettre de motivation",
    titre: "Lettre de motivation : exemple et plan simple",
    description: "Un plan en quatre parties pour écrire une lettre de motivation claire, les erreurs à éviter et un exemple à adapter à votre candidature.",
    h1: "Lettre de motivation : un plan simple et un exemple",
    intro:
      "Beaucoup de candidats hésitent devant la lettre de motivation : que dire, comment commencer, quelle longueur ? La bonne nouvelle, c'est qu'elle n'a pas besoin d'être littéraire. Elle doit être claire, honnête et adaptée à l'offre. Voici un plan en quatre parties, les erreurs à éviter et un exemple que vous pouvez reprendre en l'adaptant à votre situation.",
    sections: [
      {
        h2: "À quoi sert la lettre, si le CV existe déjà ?",
        paragraphes: [
          "Le CV liste des faits : où vous avez travaillé, ce que vous avez étudié. La lettre explique pourquoi vous voulez ce poste précis et pourquoi vous pouvez le tenir. Elle montre votre manière de vous exprimer, votre sérieux et votre intérêt pour l'entreprise.",
          "Une lettre qui pourrait être envoyée à n'importe quelle entreprise sans rien changer ne convainc personne. Celle qui parle du poste et de la structure donne le sentiment que vous avez pris le temps de lire l'offre.",
        ],
      },
      {
        h2: "Le plan en quatre parties",
        paragraphes: ["Quatre paragraphes courts suffisent. Chacun a un rôle précis."],
        ordonnee: true,
        liste: [
          "L'accroche : dites quel poste vous visez et où vous avez vu l'offre.",
          "Ce que vous apportez : deux ou trois points de votre parcours qui répondent à ce que l'offre demande.",
          "Pourquoi cette entreprise : une ou deux phrases qui montrent que vous savez ce qu'elle fait.",
          "La conclusion : dites que vous restez disponible pour un entretien et remerciez le lecteur.",
        ],
      },
      {
        h2: "Les erreurs que l'on voit souvent",
        paragraphes: [
          "La première erreur est de recopier son CV en phrases. Le recruteur le lit déjà à côté : choisissez plutôt un ou deux éléments et expliquez-les. La deuxième est d'écrire une lettre trop longue. Une page au maximum, de préférence moins, se lit jusqu'au bout.",
          "Autre erreur fréquente : les formules très compliquées ou apprises par cœur. Écrivez comme vous parleriez à une personne que vous respectez, avec des phrases simples. Enfin, relisez toujours le nom de l'entreprise et le titre du poste : se tromper dessus donne une très mauvaise impression.",
        ],
      },
      {
        h2: "Un exemple à adapter",
        exempleDepuis: 1, // à partir du deuxième paragraphe, le texte est la lettre d'exemple (affichée dans un cadre)
        paragraphes: [
          "Voici un modèle volontairement simple. Remplacez ce qui est entre parenthèses par vos propres informations et supprimez ce qui ne vous correspond pas.",
          "Madame, Monsieur,",
          "Je me permets de vous adresser ma candidature pour le poste de (intitulé du poste), proposé par (nom de l'entreprise) et publié sur (lieu où vous avez vu l'offre).",
          "Pendant (durée ou période), j'ai travaillé comme (poste) à (ville). J'y ai appris à (première tâche concrète) et à (deuxième tâche concrète). Ces expériences m'ont donné le sens du service et l'habitude de travailler en équipe, qualités que votre offre met en avant.",
          "Votre entreprise (une phrase sur ce qu'elle fait) m'intéresse particulièrement, car (raison sincère). Je serais heureux de mettre mon sérieux et ma motivation à son service.",
          "Je reste disponible pour un entretien à votre convenance, et je vous remercie de l'attention portée à ma candidature. Vous pouvez me joindre au (numéro de téléphone) ou par e-mail à (adresse e-mail).",
          "Cordialement,",
          "(Prénom et nom)",
        ],
      },
      {
        h2: "Dans un e-mail ou en fichier joint ?",
        paragraphes: [
          "Quand vous postulez par e-mail, vous avez deux possibilités. Soit vous collez la lettre directement dans le corps du message, soit vous l'envoyez en pièce jointe PDF avec votre CV. Dans le doute, copiez un court message dans le corps de l'e-mail et joignez la lettre complète : le recruteur voit tout de suite qui vous êtes, sans avoir à ouvrir un fichier.",
          "Si l'offre demande une lettre manuscrite ou un format précis, suivez exactement la consigne. Ne pas respecter ce que l'entreprise demande est souvent la première raison pour laquelle une candidature est mise de côté.",
        ],
      },
      {
        h2: "Pour aller plus loin",
        paragraphes: [
          "Une lettre fonctionne avec un CV clair. Si le vôtre n'est pas encore prêt, commencez par notre guide sur [[/conseils/modele-cv-senegal|les rubriques et l'ordre d'un CV]]. Pour savoir comment envoyer l'ensemble, lisez [[/conseils/postuler-whatsapp-email|comment postuler par WhatsApp ou par e-mail]].",
          "Quand votre lettre est écrite, [[/creer-cv|créez votre CV sur Facilité]], puis choisissez une offre parmi [[/offres|les offres disponibles]] et envoyez votre candidature.",
        ],
      },
    ],
    liensPage: ["modele-cv-senegal", "postuler-whatsapp-email", "entretien-embauche"],
  },
  {
    slug: "creer-cv-telephone",
    court: "CV sur téléphone",
    titre: "Créer son CV depuis son téléphone, pas à pas",
    description: "Comment faire un CV propre uniquement avec un téléphone : préparer ses informations, choisir un outil, écrire sur petit écran et envoyer le fichier.",
    h1: "Créer son CV depuis son téléphone, étape par étape",
    intro:
      "Pas besoin d'ordinateur pour avoir un CV soigné. Beaucoup de candidats à Dakar et ailleurs au Sénégal n'utilisent que leur téléphone, et c'est tout à fait possible. Voici comment vous organiser, quels outils choisir, comment écrire confortablement sur un petit écran et comment envoyer votre CV. Nous disons aussi clairement ce qui est payant et ce qui ne l'est pas, pour que vous choisissiez en connaissance de cause.",
    sections: [
      {
        h2: "Avant de commencer : rassemblez vos informations",
        paragraphes: ["Le plus long n'est pas de saisir le CV, c'est de retrouver les informations. Prenez quelques minutes pour les noter dans l'application de notes de votre téléphone."],
        liste: [
          "Votre nom, votre numéro de téléphone, votre adresse e-mail et votre ville.",
          "Vos expériences : poste, structure, ville et période pour chacune.",
          "Vos diplômes et formations, avec l'établissement et l'année si vous la connaissez.",
          "Vos compétences et vos langues.",
          "Le métier que vous visez, pour écrire une accroche précise.",
        ],
      },
      {
        h2: "Première option : le créateur de CV de Facilité",
        paragraphes: [
          "Le créateur de CV de Facilité fonctionne dans le navigateur de votre téléphone, sans installer d'application. Vous ouvrez [[/creer-cv|la page de création de CV]], vous vous connectez avec votre compte, vous choisissez un modèle puis vous remplissez les rubriques une par une. L'aperçu vous montre le résultat avant de continuer.",
          "Soyons clairs sur le prix : le téléchargement du CV final est payant, et le tarif s'affiche avant que vous payiez. Si vous préférez ne rien payer, passez à la deuxième option.",
        ],
      },
      {
        h2: "Deuxième option : une application de traitement de texte gratuite",
        paragraphes: [
          "Des applications gratuites de traitement de texte existent sur Android et sur iPhone. Vous pouvez y écrire votre CV comme un document normal, puis l'enregistrer en PDF. Le résultat dépend de votre mise en page : prenez le temps de bien aligner les titres et de laisser de l'espace.",
          "Cette méthode demande plus de soin, car il faut tout organiser vous-même. Pour vous guider, suivez l'ordre décrit dans notre guide sur [[/conseils/modele-cv-senegal|les rubriques d'un CV]] : en-tête, accroche, expériences, formation, compétences, langues.",
        ],
      },
      {
        h2: "Écrire sur un petit écran sans se fatiguer",
        paragraphes: [
          "Écrivez d'abord le texte dans l'application de notes, rubrique par rubrique, puis copiez-le dans l'outil choisi. Vous évitez de tout perdre si l'application se ferme. Si votre connexion mobile est instable, ce brouillon écrit hors ligne vous évite de recommencer.",
          "Faites des pauses et relisez par petits morceaux. Tournez le téléphone en mode paysage pour mieux voir la mise en page. Enregistrez régulièrement et gardez une copie de votre CV dans la mémoire du téléphone et dans votre messagerie.",
        ],
      },
      {
        h2: "Quelques réflexes pour vos données et votre batterie",
        paragraphes: [
          "Travailler sur un CV demande du temps d'écran. Branchez votre téléphone ou gardez un chargeur à portée de main, et fermez les autres applications pour qu'il reste fluide. Si vous le pouvez, utilisez une connexion wifi pour ouvrir le créateur en ligne et pour télécharger le fichier final : votre forfait de données vous remerciera.",
          "Si vous travaillez sur le téléphone d'un proche ou d'un cybercafé, déconnectez-vous de votre compte à la fin et supprimez le fichier de la mémoire si vous ne souhaitez pas qu'il y reste. Votre CV contient votre numéro et votre adresse e-mail : gardez-les pour vous.",
        ],
      },
      {
        h2: "Vérifier le rendu avant d'envoyer",
        paragraphes: [
          "Ouvrez le fichier PDF terminé et faites défiler toutes les pages. Vérifiez que rien n'est coupé, que les titres sont bien visibles et que votre numéro de téléphone est lisible. Si un mot est mal écrit, corrigez-le avant de partager : une fois le fichier envoyé, vous ne pouvez plus le modifier.",
          "Donnez au fichier un nom simple comme « CV-Prenom-Nom ». C'est plus professionnel que « nouveau document » et le recruteur le retrouvera sans effort.",
        ],
      },
      {
        h2: "Envoyer son CV par WhatsApp ou par e-mail",
        paragraphes: [
          "Une fois le PDF prêt, vous pouvez l'envoyer par e-mail ou par WhatsApp selon ce que demande l'offre. Notre guide sur [[/conseils/postuler-whatsapp-email|la candidature par WhatsApp ou par e-mail]] détaille les messages à écrire et les erreurs à éviter.",
          "Quand vous êtes prêt, découvrez [[/offres|les offres d'emploi]] et envoyez votre candidature. Si vous avez besoin d'un message d'accompagnement, notre guide sur [[/conseils/lettre-de-motivation|la lettre de motivation]] propose un exemple à adapter.",
        ],
      },
    ],
    liensPage: ["modele-cv-senegal", "lettre-de-motivation", "postuler-whatsapp-email"],
  },
  {
    slug: "postuler-whatsapp-email",
    court: "Postuler par WhatsApp ou e-mail",
    titre: "Postuler par WhatsApp ou par e-mail : le guide",
    description: "Comment envoyer sa candidature par e-mail ou par WhatsApp : objet, message, pièces jointes, politesse, relance et précautions à prendre.",
    h1: "Comment postuler à une offre par WhatsApp ou par e-mail",
    intro:
      "Vous avez trouvé une offre qui vous plaît. Il reste à envoyer votre candidature de manière claire, polie et complète. Selon l'entreprise, on vous demandera un e-mail, un message WhatsApp ou parfois les deux. Chaque canal a ses règles. Voici comment faire dans les deux cas, ce qui se passe quand vous postulez depuis Facilité, et les précautions utiles pour éviter les mauvaises surprises.",
    sections: [
      {
        h2: "Lisez d'abord comment l'entreprise veut être contactée",
        paragraphes: [
          "La plupart des offres indiquent une adresse e-mail, un numéro WhatsApp, ou les deux. Suivez ce choix à la lettre. Si l'offre demande un e-mail avec un objet précis, écrivez exactement cet objet. Si elle demande un numéro WhatsApp, n'envoyez pas votre candidature par e-mail à la place.",
          "Repérez aussi les pièces demandées : CV seul, CV et lettre, copie d'un diplôme. Préparez-les à l'avance au format PDF, avec des noms de fichiers clairs.",
        ],
      },
      {
        h2: "Postuler par e-mail",
        paragraphes: [
          "Un bon e-mail de candidature tient en quelques lignes. L'objet doit dire le poste visé et votre nom, par exemple « Candidature au poste de vendeur – Prénom Nom ». Dans le message, saluez poliment, dites quel poste vous intéresse, expliquez en deux phrases pourquoi vous convenez et indiquez que votre CV est en pièce jointe.",
          "Terminez par une formule de politesse et vos coordonnées : nom, téléphone, ville. Joignez le CV et, si l'offre le demande, la lettre de motivation. Avant d'envoyer, vérifiez l'adresse du destinataire lettre par lettre et ouvrez vos pièces jointes pour être sûr qu'elles sont bien les bonnes.",
        ],
      },
      {
        h2: "Postuler par WhatsApp",
        paragraphes: [
          "WhatsApp est pratique, mais il invite à écrire trop vite. Gardez le même sérieux que pour un e-mail. Commencez par vous présenter : bonjour, votre nom, le poste qui vous intéresse et l'endroit où vous avez vu l'offre. Envoyez ensuite votre CV en PDF, pas en photo prise au hasard.",
          "Évitez les messages vocaux longs, les abréviations de type SMS et les émojis en grand nombre. Écrivez à une heure raisonnable, pas tard le soir ni très tôt le matin. Vérifiez le numéro avant d'appuyer sur envoyer : une erreur d'un chiffre et votre message part chez un inconnu.",
        ],
      },
      {
        h2: "Postuler depuis Facilité",
        paragraphes: [
          "Sur une offre de Facilité, le bouton Postuler vous permet d'écrire un message et de joindre votre CV. Votre candidature part par e-mail vers le recruteur, qui peut vous répondre directement, et vous recevez un e-mail de confirmation. Certaines offres proposent aussi un contact direct, par exemple un bouton WhatsApp ou une adresse e-mail : l'offre indique ce que le recruteur accepte.",
          "Avant de postuler, [[/creer-cv|préparez votre CV]] et lisez bien l'offre. Vous pouvez parcourir [[/offres|toutes les offres disponibles]] et choisir celles qui correspondent à votre profil.",
        ],
      },
      {
        h2: "Après l'envoi : patience et relance polie",
        paragraphes: [
          "Une réponse peut prendre du temps : les recruteurs reçoivent beaucoup de candidatures. Gardez une trace de ce que vous avez envoyé et à qui. Si vous n'avez aucune nouvelle après un délai raisonnable, vous pouvez envoyer une seule relance courte et polie, en rappelant le poste visé.",
          "Ne harcelez pas le recruteur par des messages répétés ou des appels à toute heure : cela produit l'effet inverse de celui que vous cherchez.",
        ],
      },
      {
        h2: "Se protéger des fausses offres",
        paragraphes: [
          "Méfiez-vous de toute offre qui vous demande de l'argent pour postuler, pour passer un entretien ou pour obtenir le poste. Un recruteur sérieux ne fait pas payer une candidature. Méfiez-vous aussi des offres qui promettent beaucoup sans rien préciser sur le poste.",
          "Ne donnez jamais vos codes de paiement mobile, votre code secret ou des photos de vos papiers d'identité sans raison claire. En cas de doute, demandez des précisions sur l'entreprise, son adresse et le poste. Pour préparer la suite, lisez notre guide sur [[/conseils/entretien-embauche|l'entretien d'embauche]].",
        ],
      },
    ],
    liensPage: ["creer-cv-telephone", "lettre-de-motivation", "entretien-embauche"],
  },
  {
    slug: "entretien-embauche",
    court: "Entretien d'embauche",
    titre: "Entretien d'embauche : questions et réponses",
    description: "Se préparer à un entretien d'embauche : le trajet et la tenue, les questions les plus fréquentes et des pistes simples pour y répondre honnêtement.",
    h1: "Entretien d'embauche : les questions fréquentes et comment répondre",
    intro:
      "Être convoqué à un entretien est une bonne nouvelle : le recruteur a lu votre candidature et veut vous rencontrer. L'entretien est surtout l'occasion de montrer que vous êtes sérieux, que vous savez expliquer votre parcours et que vous comprenez le poste. Voici comment vous préparer, les questions les plus fréquentes et des pistes pour y répondre simplement et honnêtement, sans réponse apprise par cœur.",
    sections: [
      {
        h2: "La veille : préparer le trajet, la tenue et les papiers",
        paragraphes: ["Une bonne partie de la réussite se joue avant d'entrer dans la pièce. Vérifiez ces points la veille."],
        liste: [
          "Le lieu exact du rendez-vous et le trajet. Avec la circulation à Dakar, partez tôt pour arriver un peu en avance.",
          "Votre tenue : propre, simple et adaptée au métier visé.",
          "Une copie de votre CV, un stylo et un carnet pour noter les informations.",
          "Votre téléphone chargé, en mode silencieux pendant l'entretien.",
          "Le nom de la personne qui doit vous recevoir, si vous le connaissez.",
        ],
      },
      {
        h2: "Se renseigner sur l'entreprise et relire l'offre",
        paragraphes: [
          "Relisez l'offre : elle dit ce que l'entreprise attend de vous. Cherchez ensuite ce que fait l'entreprise : ses activités, ses clients, son quartier. Un candidat qui connaît un peu la structure se distingue tout de suite de celui qui n'en sait rien.",
          "Préparez deux ou trois exemples concrets de ce que vous avez déjà fait et qui correspond au poste. Un exemple précis vaut mieux qu'une longue phrase générale.",
        ],
      },
      {
        h2: "« Parlez-moi de vous »",
        paragraphes: [
          "C'est presque toujours la première question. Ne racontez pas toute votre vie. En une minute, dites qui vous êtes, ce que vous avez fait et ce que vous cherchez. Suivez un fil simple : votre parcours en quelques mots, vos points forts liés au poste, puis la raison pour laquelle ce poste vous intéresse.",
        ],
      },
      {
        h2: "« Pourquoi voulez-vous travailler chez nous ? »",
        paragraphes: [
          "Évitez de répondre seulement que vous avez besoin d'un travail : c'est vrai pour tout le monde. Parlez de ce que vous avez compris de l'entreprise, de ce que le poste vous permettrait d'apprendre et de ce que vous pouvez apporter. Soyez sincère : le recruteur sent vite une réponse récitée.",
        ],
      },
      {
        h2: "« Quels sont vos points forts et vos points faibles ? »",
        paragraphes: [
          "Pour les points forts, choisissez deux qualités utiles pour le poste et appuyez-les avec un exemple vécu. Pour les points faibles, donnez un vrai défaut sans gravité, puis expliquez ce que vous faites pour l'améliorer. Dire que vous n'en avez pas, ou donner un défaut qui est en réalité une qualité, ne convainc personne.",
        ],
      },
      {
        h2: "« Où vous voyez-vous plus tard ? » et la question du salaire",
        paragraphes: [
          "Pour la première, parlez d'apprendre, de prendre des responsabilités et de progresser dans le métier, sans promettre ce que vous ne pouvez pas tenir. Pour la question du salaire, informez-vous avant l'entretien sur ce qui se pratique pour ce type de poste. Répondez calmement, sans exiger ni vous sous-estimer, et dites que vous êtes ouvert à la discussion.",
        ],
      },
      {
        h2: "« Avez-vous des questions ? »",
        paragraphes: [
          "Dites toujours oui. Posez une ou deux questions utiles : comment se déroule une journée type, avec qui vous travaillerez, quelles seraient les premières tâches. Cela montre votre intérêt réel pour le poste.",
        ],
      },
      {
        h2: "Un entretien par téléphone ou par appel WhatsApp",
        paragraphes: [
          "Certains entretiens se passent à distance. Choisissez un endroit calme avec un bon réseau, chargez votre téléphone et prévenez votre entourage. Gardez votre CV et l'offre devant vous. Parlez clairement et posément : la voix remplace tout le reste.",
        ],
      },
      {
        h2: "Après l'entretien",
        paragraphes: [
          "Remerciez la personne avant de partir, puis envoyez un court message de remerciement dans la journée. Notez ce qui s'est bien passé et ce que vous pourriez améliorer, pour la prochaine fois. Pour trouver d'autres occasions, consultez [[/offres|les offres d'emploi]]. Et si votre CV a besoin d'être refait, lisez notre guide sur [[/conseils/modele-cv-senegal|le modèle de CV]] ou [[/creer-cv|créez votre CV sur Facilité]].",
        ],
      },
    ],
    liensPage: ["modele-cv-senegal", "lettre-de-motivation", "postuler-whatsapp-email"],
  },
];

export const pageConseil = (slug) => PAGES_CONSEILS.find((p) => p.slug === slug) || null;

/** Texte brut d'un paragraphe : les liens [[/chemin|texte]] sont remplacés par leur texte. */
export const texteBrut = (s) => String(s).replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, "$1");

/** Tous les textes visibles d'une page (titre h1, introduction, sous-titres, paragraphes et listes), dans l'ordre. */
export function textesVisibles(page) {
  return [
    page.h1,
    page.intro,
    ...page.sections.flatMap((s) => [s.h2, ...(s.paragraphes || []), ...(s.liste || [])]),
  ].map(texteBrut);
}

/** Nombre de mots du contenu visible de la page. */
export const compterMots = (page) => textesVisibles(page).join(" ").split(/\s+/).filter(Boolean).length;
