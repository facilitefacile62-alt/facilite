import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ecrireLangue, lireLangue, type CodeLangue } from '@/lib/preferencesConnexion';

// Traduction de l'application. Les textes du code sont en français ; `t('Accueil')` renvoie le texte dans la langue
// choisie (Paramètres → Langue), ou le texte français quand aucune traduction n'existe encore pour cette phrase.
// Le changement de langue s'applique tout de suite, sans redémarrer. Couverture actuelle : les barres de navigation,
// la messagerie, les Paramètres et les Réglages de la boutique ; le reste de l'application se traduit écran par écran en
// ajoutant `t(...)` autour du texte et sa traduction dans TRADUCTIONS ci-dessous.
type Dictionnaire = Record<string, string>;

const EN: Dictionnaire = {
  Accueil: 'Home',
  Offres: 'Jobs',
  'Autour de moi': 'Around me',
  Messages: 'Messages',
  Profil: 'Profile',
  Publier: 'Post',
  'Articles proches': 'Nearby items',
  'Pleine carte': 'Full map',
  Discussions: 'Chats',
  Écrire: 'Write',
  'Rechercher ou démarrer une discussion...': 'Search or start a chat...',
  Toutes: 'All',
  'Non lues': 'Unread',
  Support: 'Support',
  Stages: 'Internships',
  Disponible: 'Available',
  "Aucune discussion pour l'instant.": 'No chats yet.',
  Paramètres: 'Settings',
  'Personnalisez votre expérience visuelle et vos préférences.': 'Customize your visual experience and preferences.',
  APPARENCE: 'APPEARANCE',
  Thème: 'Theme',
  'Apparence de Facilité': 'Facilité appearance',
  LANGUE: 'LANGUAGE',
  "Langue de l'application": 'App language',
  'CONFIDENTIALITÉ ET SÉCURITÉ': 'PRIVACY AND SECURITY',
  'Confidentialité et informations juridiques': 'Privacy and legal information',
  'Visibilité du profil, pages légales': 'Profile visibility, legal pages',
  'Sécurité & Connexion': 'Security & Sign-in',
  'Mot de passe, appareils': 'Password, devices',
  Réglages: 'Settings',
  '🤑 Faire profit & Boost': '🤑 Earn & Boost',
  Abonnés: 'Followers',
  'Avis clients': 'Customer reviews',
  Coordonnées: 'Contact details',
  'Contact & Livraison': 'Contact & Delivery',
  'Foire aux questions': 'FAQ',
  'Changer la langue': 'Change language',
  Confidentialité: 'Privacy',
  'Désactiver le chat': 'Turn off chat',
  'Désactiver les commentaires': 'Turn off comments',
  'Gérer les notifications': 'Manage notifications',
  'Se déconnecter': 'Sign out',
  '↩ Retour au Marketplace': '↩ Back to Marketplace',
  Actif: 'On',
  Actifs: 'On',
  Article: 'Item',
  Service: 'Service',
  'Modifier infos': 'Edit info',
  'Rendre mes articles visibles': 'Make my items visible',
  BOUTIQUE: 'SHOP',
};

const ES: Dictionnaire = {
  Accueil: 'Inicio',
  Offres: 'Empleos',
  'Autour de moi': 'Cerca de mí',
  Messages: 'Mensajes',
  Profil: 'Perfil',
  Publier: 'Publicar',
  'Articles proches': 'Artículos cercanos',
  'Pleine carte': 'Mapa completo',
  Discussions: 'Conversaciones',
  Écrire: 'Escribir',
  'Rechercher ou démarrer une discussion...': 'Buscar o iniciar una conversación...',
  Toutes: 'Todas',
  'Non lues': 'No leídas',
  Support: 'Soporte',
  Stages: 'Prácticas',
  Disponible: 'Disponible',
  "Aucune discussion pour l'instant.": 'Aún no hay conversaciones.',
  Paramètres: 'Ajustes',
  'Personnalisez votre expérience visuelle et vos préférences.': 'Personaliza tu experiencia visual y tus preferencias.',
  APPARENCE: 'APARIENCIA',
  Thème: 'Tema',
  'Apparence de Facilité': 'Apariencia de Facilité',
  LANGUE: 'IDIOMA',
  "Langue de l'application": 'Idioma de la aplicación',
  'CONFIDENTIALITÉ ET SÉCURITÉ': 'PRIVACIDAD Y SEGURIDAD',
  'Confidentialité et informations juridiques': 'Privacidad e información legal',
  'Visibilité du profil, pages légales': 'Visibilidad del perfil, páginas legales',
  'Sécurité & Connexion': 'Seguridad e inicio de sesión',
  'Mot de passe, appareils': 'Contraseña, dispositivos',
  Réglages: 'Ajustes',
  '🤑 Faire profit & Boost': '🤑 Ganar y Potenciar',
  Abonnés: 'Seguidores',
  'Avis clients': 'Opiniones de clientes',
  Coordonnées: 'Datos de contacto',
  'Contact & Livraison': 'Contacto y entrega',
  'Foire aux questions': 'Preguntas frecuentes',
  'Changer la langue': 'Cambiar idioma',
  Confidentialité: 'Privacidad',
  'Désactiver le chat': 'Desactivar el chat',
  'Désactiver les commentaires': 'Desactivar los comentarios',
  'Gérer les notifications': 'Gestionar notificaciones',
  'Se déconnecter': 'Cerrar sesión',
  '↩ Retour au Marketplace': '↩ Volver al Marketplace',
  Actif: 'Activo',
  Actifs: 'Activos',
  Article: 'Artículo',
  Service: 'Servicio',
  'Modifier infos': 'Editar datos',
  'Rendre mes articles visibles': 'Hacer visibles mis artículos',
  BOUTIQUE: 'TIENDA',
};

const PT: Dictionnaire = {
  Accueil: 'Início',
  Offres: 'Vagas',
  'Autour de moi': 'Perto de mim',
  Messages: 'Mensagens',
  Profil: 'Perfil',
  Publier: 'Publicar',
  'Articles proches': 'Artigos próximos',
  'Pleine carte': 'Mapa completo',
  Discussions: 'Conversas',
  Écrire: 'Escrever',
  'Rechercher ou démarrer une discussion...': 'Pesquisar ou iniciar uma conversa...',
  Toutes: 'Todas',
  'Non lues': 'Não lidas',
  Support: 'Suporte',
  Stages: 'Estágios',
  Disponible: 'Disponível',
  "Aucune discussion pour l'instant.": 'Ainda não há conversas.',
  Paramètres: 'Definições',
  'Personnalisez votre expérience visuelle et vos préférences.': 'Personalize a sua experiência visual e as suas preferências.',
  APPARENCE: 'APARÊNCIA',
  Thème: 'Tema',
  'Apparence de Facilité': 'Aparência do Facilité',
  LANGUE: 'IDIOMA',
  "Langue de l'application": 'Idioma da aplicação',
  'CONFIDENTIALITÉ ET SÉCURITÉ': 'PRIVACIDADE E SEGURANÇA',
  'Confidentialité et informations juridiques': 'Privacidade e informações legais',
  'Visibilité du profil, pages légales': 'Visibilidade do perfil, páginas legais',
  'Sécurité & Connexion': 'Segurança e início de sessão',
  'Mot de passe, appareils': 'Palavra-passe, dispositivos',
  Réglages: 'Definições',
  '🤑 Faire profit & Boost': '🤑 Ganhar e Impulsionar',
  Abonnés: 'Seguidores',
  'Avis clients': 'Avaliações de clientes',
  Coordonnées: 'Dados de contacto',
  'Contact & Livraison': 'Contacto e entrega',
  'Foire aux questions': 'Perguntas frequentes',
  'Changer la langue': 'Mudar idioma',
  Confidentialité: 'Privacidade',
  'Désactiver le chat': 'Desativar o chat',
  'Désactiver les commentaires': 'Desativar os comentários',
  'Gérer les notifications': 'Gerir notificações',
  'Se déconnecter': 'Terminar sessão',
  '↩ Retour au Marketplace': '↩ Voltar ao Marketplace',
  Actif: 'Ativo',
  Actifs: 'Ativos',
  Article: 'Artigo',
  Service: 'Serviço',
  'Modifier infos': 'Editar dados',
  'Rendre mes articles visibles': 'Tornar os meus artigos visíveis',
  BOUTIQUE: 'LOJA',
};

const AR: Dictionnaire = {
  Accueil: 'الرئيسية',
  Offres: 'الوظائف',
  'Autour de moi': 'بالقرب مني',
  Messages: 'الرسائل',
  Profil: 'الملف الشخصي',
  Publier: 'نشر',
  'Articles proches': 'منتجات قريبة',
  'Pleine carte': 'الخريطة كاملة',
  Discussions: 'المحادثات',
  Écrire: 'كتابة',
  'Rechercher ou démarrer une discussion...': 'ابحث أو ابدأ محادثة...',
  Toutes: 'الكل',
  'Non lues': 'غير مقروءة',
  Support: 'الدعم',
  Stages: 'التدريب',
  Disponible: 'متاح',
  "Aucune discussion pour l'instant.": 'لا توجد محادثات بعد.',
  Paramètres: 'الإعدادات',
  'Personnalisez votre expérience visuelle et vos préférences.': 'خصّص تجربتك المرئية وتفضيلاتك.',
  APPARENCE: 'المظهر',
  Thème: 'السمة',
  'Apparence de Facilité': 'مظهر Facilité',
  LANGUE: 'اللغة',
  "Langue de l'application": 'لغة التطبيق',
  'CONFIDENTIALITÉ ET SÉCURITÉ': 'الخصوصية والأمان',
  'Confidentialité et informations juridiques': 'الخصوصية والمعلومات القانونية',
  'Visibilité du profil, pages légales': 'ظهور الملف الشخصي، الصفحات القانونية',
  'Sécurité & Connexion': 'الأمان وتسجيل الدخول',
  'Mot de passe, appareils': 'كلمة المرور، الأجهزة',
  Réglages: 'الإعدادات',
  '🤑 Faire profit & Boost': '🤑 اربح وعزّز',
  Abonnés: 'المتابعون',
  'Avis clients': 'آراء العملاء',
  Coordonnées: 'بيانات الاتصال',
  'Contact & Livraison': 'الاتصال والتوصيل',
  'Foire aux questions': 'الأسئلة الشائعة',
  'Changer la langue': 'تغيير اللغة',
  Confidentialité: 'الخصوصية',
  'Désactiver le chat': 'إيقاف الدردشة',
  'Désactiver les commentaires': 'إيقاف التعليقات',
  'Gérer les notifications': 'إدارة الإشعارات',
  'Se déconnecter': 'تسجيل الخروج',
  '↩ Retour au Marketplace': '↩ العودة إلى السوق',
  Actif: 'مفعّل',
  Actifs: 'مفعّلة',
  Article: 'منتج',
  Service: 'خدمة',
  'Modifier infos': 'تعديل المعلومات',
  'Rendre mes articles visibles': 'إظهار منتجاتي',
  BOUTIQUE: 'متجر',
};

const TRADUCTIONS: Record<CodeLangue, Dictionnaire> = { fr: {}, en: EN, es: ES, pt: PT, ar: AR };

type Contexte = { langue: CodeLangue; changer: (code: CodeLangue) => Promise<void>; t: (texte: string) => string };

const ContexteLangue = createContext<Contexte>({ langue: 'fr', changer: async () => {}, t: (s) => s });

export function LangueProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<CodeLangue>('fr');

  useEffect(() => {
    lireLangue().then(setLangue);
  }, []);

  const changer = useCallback(async (code: CodeLangue) => {
    setLangue(code);
    await ecrireLangue(code);
  }, []);

  const valeur = useMemo<Contexte>(() => {
    const dico = TRADUCTIONS[langue];
    return { langue, changer, t: (texte) => dico[texte] ?? texte };
  }, [langue, changer]);

  return <ContexteLangue.Provider value={valeur}>{children}</ContexteLangue.Provider>;
}

export const useLangue = () => useContext(ContexteLangue);
export const useT = () => useContext(ContexteLangue).t;
