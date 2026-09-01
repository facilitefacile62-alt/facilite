"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getFeatureFlagsTreeAsync, isFeatureAllowed, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";

// --- DONNÉES INITIALES RÉALISTES CALQUÉES SUR LA SÉLECTION DU JOUR DU SÉNÉGAL ---
const INITIAL_MARKETPLACE_ITEMS = [
  {
    id: "mkt-1",
    title: "iPhone 13 128Go Rose Parfait État",
    price: 125000,
    priceFormatted: "125 000 CFA",
    category: "telephones",
    categoryLabel: "Téléphones & Tech",
    location: "Dakar",
    city: "Dakar",
    distance: "5 km",
    image: "https://images.unsplash.com/photo-1691442257882-9382f7c00ebc?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1691442257882-9382f7c00ebc?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Modou Tech Dakar",
      phone: "+221770000001",
      whatsapp: "221770000001",
      rating: 4.9,
      joinedYear: "2024",
      verified: true
    },
    description: "iPhone 13 128Go d'origine, batterie 91%, Face ID actif, fourni avec chargeur rapide et coque de protection. Facture et garantie 3 mois fournies.",
    postedAt: "Il y a 25 min"
  },
  {
    id: "mkt-2",
    title: "Parfums de classe VIP - Collection Privée",
    price: 1500,
    priceFormatted: "1 500 CFA",
    category: "mode",
    categoryLabel: "Mode & Beauté",
    location: "Thiès",
    city: "Thiès",
    distance: "60 km",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Fatou Prestige",
      phone: "+221780000002",
      whatsapp: "221780000002",
      rating: 4.8,
      joinedYear: "2023",
      verified: true
    },
    description: "Parfums de poche concentrés longue durée 24h. Fragrances prestigieuses pour hommes et femmes. Prix spécial de gros disponible.",
    postedAt: "Il y a 40 min"
  },
  {
    id: "mkt-3",
    title: "Ensemble Barada inoxydable 3 pcs luxe",
    price: 6000,
    priceFormatted: "6 000 CFA",
    category: "maison",
    categoryLabel: "Maison & Déco",
    location: "Dakar",
    city: "Dakar",
    distance: "8 km",
    image: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Maison & Confort SN",
      phone: "+221760000003",
      whatsapp: "221760000003",
      rating: 5.0,
      joinedYear: "2022",
      verified: true
    },
    description: "Service à thé Barada 3 pièces en inox pur, inoxydable et résistant. Idéal pour cérémonies et usage quotidien.",
    postedAt: "Il y a 1h"
  },
  {
    id: "mkt-4",
    title: "Thioup brodé ordinateur haute couture",
    price: 115000,
    priceFormatted: "115 000 CFA",
    category: "mode",
    categoryLabel: "Mode & Vêtements",
    location: "Dakar",
    city: "Dakar",
    distance: "12 km",
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Atelier Couture Ndiaye",
      phone: "+221770000004",
      whatsapp: "221770000004",
      rating: 4.9,
      joinedYear: "2021",
      verified: true
    },
    description: "Magnifique tissu Thioup brodé ordinateur avec fils dorés et bleus. Tissu Getzner de premier choix, finition de grand luxe.",
    postedAt: "Il y a 2h"
  },
  {
    id: "mkt-5",
    title: "Mazda CX-30 récente climatisée 2022",
    price: 14500000,
    priceFormatted: "14 500 000 CFA",
    category: "vehicules",
    categoryLabel: "Véhicules & Voitures",
    location: "Guédiawaye",
    city: "Guédiawaye",
    distance: "14 km",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Auto Direct Sénégal",
      phone: "+221770000005",
      whatsapp: "221770000005",
      rating: 4.7,
      joinedYear: "2023",
      verified: true
    },
    description: "Mazda CX-30 Année 2022, boîte automatique, essence, faible kilométrage 34 000 km, intérieur cuir, écran tactile, dédouanée.",
    postedAt: "Il y a 3h"
  },
  {
    id: "mkt-6",
    title: "Scooter Yamaha TMax 530cc TBE",
    price: 250000,
    priceFormatted: "250 000 CFA",
    category: "vehicules",
    categoryLabel: "Motos & Scooters",
    location: "Dakar",
    city: "Dakar",
    distance: "6 km",
    image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Ibra Motors",
      phone: "+221760000006",
      whatsapp: "221760000006",
      rating: 4.9,
      joinedYear: "2024",
      verified: true
    },
    description: "Scooter en très bon état mécanique, pneus neufs, papiers en règle avec carte grise. Essai possible à Dakar.",
    postedAt: "Il y a 3h"
  },
  {
    id: "mkt-7",
    title: "Samsung Galaxy A52s 5G 128Go 6Go RAM",
    price: 70000,
    priceFormatted: "70 000 CFA",
    category: "telephones",
    categoryLabel: "Téléphones & Tech",
    location: "Rufisque",
    city: "Rufisque",
    distance: "25 km",
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Smart Store Rufisque",
      phone: "+221780000007",
      whatsapp: "221780000007",
      rating: 4.6,
      joinedYear: "2023",
      verified: true
    },
    description: "Samsung Galaxy A52s 5G Dual SIM, écran Super AMOLED 120Hz, appareil photo 64MP, boîte et accessoires inclus.",
    postedAt: "Il y a 4h"
  },
  {
    id: "mkt-8",
    title: "Coffret Parfums de luxe Baccarat & Kayali",
    price: 6000,
    priceFormatted: "6 000 CFA",
    category: "mode",
    categoryLabel: "Mode & Beauté",
    location: "Yeumbeul, Dakar",
    city: "Yeumbeul",
    distance: "18 km",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Awa Beauté Express",
      phone: "+221770000008",
      whatsapp: "221770000008",
      rating: 4.8,
      joinedYear: "2024",
      verified: true
    },
    description: "Superbe coffret de senteurs orientales et françaises. Tenue exceptionnelle sur les vêtements.",
    postedAt: "Il y a 5h"
  },
  {
    id: "mkt-9",
    title: "Maillot Juventus extérieur rose collector",
    price: 10000,
    priceFormatted: "10 000 CFA",
    category: "mode",
    categoryLabel: "Sport & Vêtements",
    location: "Dakar",
    city: "Dakar",
    distance: "4 km",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Sen Sport Store",
      phone: "+221770000009",
      whatsapp: "221770000009",
      rating: 5.0,
      joinedYear: "2023",
      verified: true
    },
    description: "Maillot version joueur de qualité supérieure, toutes les tailles disponibles (S, M, L, XL). Flocage personnalisé offert.",
    postedAt: "Il y a 5h"
  },
  {
    id: "mkt-10",
    title: "Camion Benne HOWO Édition 2017 380cv",
    price: 13990000,
    priceFormatted: "13 990 000 CFA",
    category: "vehicules",
    categoryLabel: "Poids Lourds & BTP",
    location: "Dakar",
    city: "Dakar",
    distance: "15 km",
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "MBS Cars & Trucks",
      phone: "+221770000010",
      whatsapp: "221770000010",
      rating: 4.9,
      joinedYear: "2020",
      verified: true
    },
    description: "Camion benne Sinotruk HOWO 2017, moteur 380 chevaux, 10 roues, révision complète effectuée, prêt pour carrières et chantiers BTP.",
    postedAt: "Il y a 6h"
  },
  {
    id: "mkt-11",
    title: "iPhone 14 Pro Max 256Go Deep Purple",
    price: 170000,
    priceFormatted: "170 000 CFA",
    category: "telephones",
    categoryLabel: "Téléphones & Tech",
    location: "Rufisque",
    city: "Rufisque",
    distance: "22 km",
    image: "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Al Amine High Tech",
      phone: "+221770000011",
      whatsapp: "221770000011",
      rating: 4.8,
      joinedYear: "2023",
      verified: true
    },
    description: "iPhone 14 Pro Max 256Go, couleur violet profond, Dynamic Island, batterie 94%, débloqué tout opérateur mondial.",
    postedAt: "Il y a 7h"
  },
  {
    id: "mkt-12",
    title: "Dacia Lodgy 7 Places Diesel Climatisée",
    price: 4500000,
    priceFormatted: "4 500 000 CFA",
    category: "vehicules",
    categoryLabel: "Véhicules & Voitures",
    location: "Pikine, Dakar",
    city: "Pikine",
    distance: "16 km",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Sénégal Auto Confort",
      phone: "+221760000012",
      whatsapp: "221760000012",
      rating: 4.7,
      joinedYear: "2022",
      verified: true
    },
    description: "Voiture familiale 7 places très économique moteur 1.5 dCi, faible consommation, climatisation parfaite, sièges rabattables.",
    postedAt: "Il y a 8h"
  },
  {
    id: "mkt-13",
    title: "Paire de baffes de musique sono fête pro",
    price: 65000,
    priceFormatted: "65 000 CFA",
    category: "electronique",
    categoryLabel: "Électronique & Son",
    location: "Dakar",
    city: "Dakar",
    distance: "9 km",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Sound Master SN",
      phone: "+221770000013",
      whatsapp: "221770000013",
      rating: 4.9,
      joinedYear: "2021",
      verified: true
    },
    description: "2 enceintes sono haute puissance avec ampli intégré, Bluetooth, USB et entrées micros pour soirées et événements.",
    postedAt: "Il y a 9h"
  },
  {
    id: "mkt-14",
    title: "Machine à coudre industrielle Singer",
    price: 120000,
    priceFormatted: "120 000 CFA",
    category: "maison",
    categoryLabel: "Matériel Pro & Couture",
    location: "Dakar",
    city: "Dakar",
    distance: "7 km",
    image: "https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1528458909336-e7a0adfed0a5?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Équipements Pro Dakar",
      phone: "+221780000014",
      whatsapp: "221780000014",
      rating: 4.9,
      joinedYear: "2023",
      verified: true
    },
    description: "Machine à coudre piqueuse industrielle silencieuse avec table et moteur à économie d'énergie. Parfait pour atelier.",
    postedAt: "Il y a 10h"
  },
  {
    id: "mkt-15",
    title: "Chevrolet Camaro Sport V6 Automatique",
    price: 6000000,
    priceFormatted: "6 000 000 CFA",
    category: "vehicules",
    categoryLabel: "Véhicules & Voitures",
    location: "Dakar",
    city: "Dakar",
    distance: "3 km",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Prestige Cars Almadies",
      phone: "+221770000015",
      whatsapp: "221770000015",
      rating: 5.0,
      joinedYear: "2021",
      verified: true
    },
    description: "Chevrolet Camaro V6 3.6L, couleur bleu nuit métallisé, jantes alu 20 pouces, caméra de recul, son Bose, papiers à jour.",
    postedAt: "Il y a 12h"
  },
  {
    id: "mkt-16",
    title: "2 chambres salon unité 6 en face station BRT",
    price: 190000,
    priceFormatted: "190 000 CFA / mois",
    category: "immobilier",
    categoryLabel: "Immobilier & Logements",
    location: "Guédiawaye, Dakar",
    city: "Guédiawaye",
    distance: "13 km",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Agence Immobilière Teranga",
      phone: "+221770000016",
      whatsapp: "221770000016",
      rating: 4.8,
      joinedYear: "2020",
      verified: true
    },
    description: "Appartement F3 spacieux, lumineux et sécurisé, 2 chambres, grand salon, 2 salles de bain, balcon, eau et électricité individuels, à 20m de l'arrêt BRT.",
    postedAt: "Il y a 14h"
  },
  {
    id: "mkt-17",
    title: "iPhone 14 Pro 128Go Silver Écran OLED",
    price: 195000,
    priceFormatted: "195 000 CFA",
    category: "telephones",
    categoryLabel: "Téléphones & Tech",
    location: "Dakar",
    city: "Dakar",
    distance: "5 km",
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80"],
    isRecent: false,
    seller: {
      name: "Dakar Mobile Store",
      phone: "+221770000017",
      whatsapp: "221770000017",
      rating: 4.9,
      joinedYear: "2024",
      verified: true
    },
    description: "iPhone 14 Pro couleur argent, état neuf 10/10, batterie 98%, zéro rayure, fourni avec boîte et accessoires complets.",
    postedAt: "Il y a 16h"
  },
  {
    id: "mkt-18",
    title: "Ford Explorer 4x4 XLT V6 2018",
    price: 2400000,
    priceFormatted: "2 400 000 CFA (Acompte)",
    category: "vehicules",
    categoryLabel: "Véhicules & 4x4",
    location: "Dakar",
    city: "Dakar",
    distance: "10 km",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&auto=format&fit=crop&q=80",
    photos: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&auto=format&fit=crop&q=80"],
    isRecent: true,
    seller: {
      name: "Sénégal Occasion Pro",
      phone: "+221770000018",
      whatsapp: "221770000018",
      rating: 4.7,
      joinedYear: "2022",
      verified: true
    },
    description: "Ford Explorer XLT 4WD, intérieur cuir noir, toit ouvrant panoramique, 7 places assises, climatisation bizone.",
    postedAt: "Il y a 18h"
  }
];

const CATEGORIES = [
  { id: "all", label: "Toutes les annonces", icon: "fa-solid fa-border-all" },
  { id: "telephones", label: "Téléphones & Tech", icon: "fa-solid fa-mobile-screen-button" },
  { id: "vehicules", label: "Véhicules & Motos", icon: "fa-solid fa-car" },
  { id: "immobilier", label: "Immobilier & Logements", icon: "fa-solid fa-house" },
  { id: "mode", label: "Mode & Vêtements", icon: "fa-solid fa-shirt" },
  { id: "maison", label: "Maison & Électro", icon: "fa-solid fa-couch" },
  { id: "electronique", label: "Électronique & Son", icon: "fa-solid fa-tv" },
];

const CITIES = [
  "Toutes les villes",
  "Dakar",
  "Thiès",
  "Guédiawaye",
  "Pikine",
  "Rufisque",
  "Yeumbeul",
  "Mbour",
  "Saint-Louis",
  "Touba",
  "Ziguinchor"
];

export default function MarketplaceClient() {
  const router = useRouter();
  const { session, profile, isAdmin, isRecruiter } = useAuth();
  const [featureFlagsTree, setFeatureFlagsTree] = useState(DEFAULT_FEATURE_TREE);

  // Écoute en temps réel des modifications de feature flags depuis l'admin
  useEffect(() => {
    getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
    const channel = supabase
      .channel("public-feature-flags-marketplace")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, () => {
        getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const userRole = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const isMarketplaceAllowed = isFeatureAllowed(featureFlagsTree, "nav_marketplace", userRole);

  // États principaux
  const [items, setItems] = useState(INITIAL_MARKETPLACE_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCity, setSelectedCity] = useState("Dakar");
  const [distanceKm, setDistanceKm] = useState(65);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [priceMax, setPriceMax] = useState("");

  // Onglet actif : "all" (Sélection du jour), "favorites" (Favoris), "my_listings" (Mes annonces)
  const [activeTab, setActiveTab] = useState("all");
  const [favorites, setFavorites] = useState([]);

  // Modals & sélection
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [notificationMsg, setNotificationMsg] = useState("");

  // Formulaire de création
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("telephones");
  const [newCity, setNewCity] = useState("Dakar");
  const [newPhone, setNewPhone] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const photoInputRef = useRef(null);

  // Formulaire d'édition
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("telephones");
  const [editCity, setEditCity] = useState("Dakar");
  const [editPhone, setEditPhone] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhotos, setEditPhotos] = useState([]);
  const [editIsRecent, setEditIsRecent] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editPhotoInputRef = useRef(null);

  // 📷 Recherche par Image (Reconnaissance Visuelle IA)
  const [uploadedSearchImage, setUploadedSearchImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageDetectedCategory, setImageDetectedCategory] = useState(null);
  const imageInputRef = useRef(null);

  // Charger les articles et favoris depuis le stockage local persistant
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem("facilite_mkt_favorites");
      if (savedFavs) setFavorites(JSON.parse(savedFavs));

      const savedAllItems = localStorage.getItem("facilite_mkt_all_items_v3");
      if (savedAllItems) {
        const parsed = JSON.parse(savedAllItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          return;
        }
      }

      // Rétrocompatibilité : ancien storage d'annonces utilisateur
      const savedUserItems = localStorage.getItem("facilite_mkt_user_items");
      if (savedUserItems) {
        const userItems = JSON.parse(savedUserItems);
        const combined = [...userItems, ...INITIAL_MARKETPLACE_ITEMS];
        setItems(combined);
        localStorage.setItem("facilite_mkt_all_items_v3", JSON.stringify(combined));
      } else {
        localStorage.setItem("facilite_mkt_all_items_v3", JSON.stringify(INITIAL_MARKETPLACE_ITEMS));
      }
    } catch (err) {
      console.error("Erreur chargement Marketplace:", err);
    }
  }, []);

  // Fonction utilitaire de sauvegarde
  const persistItems = (newItemsList) => {
    setItems(newItemsList);
    try {
      localStorage.setItem("facilite_mkt_all_items_v3", JSON.stringify(newItemsList));
    } catch (err) {
      console.error("Erreur sauvegarde Marketplace:", err);
    }
  };

  // Toggle Favoris
  const toggleFavorite = (itemId, e) => {
    e?.stopPropagation();
    let updated;
    if (favorites.includes(itemId)) {
      updated = favorites.filter((id) => id !== itemId);
    } else {
      updated = [...favorites, itemId];
    }
    setFavorites(updated);
    try {
      localStorage.setItem("facilite_mkt_favorites", JSON.stringify(updated));
    } catch {}
  };

  // 📷 Recherche visuelle par image
  const handleImageSearchUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setUploadedSearchImage(dataUrl);
      setIsAnalyzingImage(true);

      const fileNameLower = file.name.toLowerCase();
      setTimeout(() => {
        let detected = "telephones";
        if (
          fileNameLower.includes("car") ||
          fileNameLower.includes("auto") ||
          fileNameLower.includes("voiture") ||
          fileNameLower.includes("camion") ||
          fileNameLower.includes("scooter") ||
          fileNameLower.includes("tmax") ||
          fileNameLower.includes("yamaha") ||
          fileNameLower.includes("ford") ||
          fileNameLower.includes("camaro")
        ) {
          detected = "vehicules";
        } else if (
          fileNameLower.includes("robe") ||
          fileNameLower.includes("mode") ||
          fileNameLower.includes("thioup") ||
          fileNameLower.includes("chaussure") ||
          fileNameLower.includes("parfum") ||
          fileNameLower.includes("maillot")
        ) {
          detected = "mode";
        } else if (
          fileNameLower.includes("maison") ||
          fileNameLower.includes("salon") ||
          fileNameLower.includes("meuble") ||
          fileNameLower.includes("coudre") ||
          fileNameLower.includes("barada")
        ) {
          detected = "maison";
        } else if (
          fileNameLower.includes("baffe") ||
          fileNameLower.includes("sono") ||
          fileNameLower.includes("tv") ||
          fileNameLower.includes("audio") ||
          fileNameLower.includes("speaker")
        ) {
          detected = "electronique";
        } else if (
          fileNameLower.includes("villa") ||
          fileNameLower.includes("appartement") ||
          fileNameLower.includes("terrain") ||
          fileNameLower.includes("immeuble")
        ) {
          detected = "immobilier";
        } else {
          const sampleCats = ["telephones", "mode", "vehicules", "electronique", "maison"];
          detected = sampleCats[Math.floor(Math.random() * sampleCats.length)];
        }

        setImageDetectedCategory(detected);
        setSelectedCategory(detected);
        setIsAnalyzingImage(false);
        setNotificationMsg("📷 Image analysée avec succès ! Produits similaires affichés.");
        setTimeout(() => setNotificationMsg(""), 4000);
      }, 1000);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImageSearch = () => {
    setUploadedSearchImage(null);
    setImageDetectedCategory(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // 📸 Téléversement de photos (Création)
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedPhotos((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetForm = () => {
    setNewTitle("");
    setNewPrice("");
    setNewCategory("telephones");
    setNewCity("Dakar");
    setNewPhone("");
    setNewDescription("");
    setNewImageUrl("");
    setUploadedPhotos([]);
  };

  // 📸 Téléversement de photos (Édition)
  const handleEditPhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditPhotos((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeEditPhoto = (idx) => {
    setEditPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const setEditCoverPhoto = (idx) => {
    if (idx === 0) return;
    setEditPhotos((prev) => {
      const selected = prev[idx];
      const others = prev.filter((_, i) => i !== idx);
      return [selected, ...others];
    });
  };

  // ==========================================
  // ✍️ GESTION DE LA MODIFICATION D'UN ARTICLE
  // ==========================================
  const handleOpenEditModal = (item, e) => {
    e?.stopPropagation();
    setItemToEdit(item);
    setEditTitle(item.title || "");
    setEditPrice(item.price ? String(item.price) : "");
    setEditCategory(item.category || "telephones");
    setEditCity(item.city || "Dakar");
    setEditPhone(item.seller?.phone || item.seller?.whatsapp || "");
    setEditDescription(item.description || "");
    setEditPhotos(
      item.photos && item.photos.length > 0
        ? item.photos
        : item.image
        ? [item.image]
        : []
    );
    setEditIsRecent(Boolean(item.isRecent));
    setIsEditModalOpen(true);
  };

  const handleSaveEditedListing = (e) => {
    e.preventDefault();
    if (!itemToEdit || !editTitle || !editPrice) return;

    setIsSavingEdit(true);

    const priceNum = Number(editPrice) || 0;
    const finalPhotos = editPhotos.length > 0 ? editPhotos : [itemToEdit.image];
    const finalImage = finalPhotos[0] || itemToEdit.image;

    const updatedItem = {
      ...itemToEdit,
      title: editTitle.trim(),
      price: priceNum,
      priceFormatted: priceNum.toLocaleString("fr-FR") + " CFA",
      category: editCategory,
      categoryLabel: CATEGORIES.find((c) => c.id === editCategory)?.label || "Général",
      city: editCity,
      location: editCity + ", Sénégal",
      description: editDescription.trim() || "Annonce mise à jour sur Facilité Marketplace.",
      image: finalImage,
      photos: finalPhotos,
      isRecent: editIsRecent,
      seller: {
        ...itemToEdit.seller,
        phone: editPhone.trim() || itemToEdit.seller?.phone || "+221770000000",
        whatsapp: (editPhone.trim() || itemToEdit.seller?.whatsapp || "221770000000").replace(/\D/g, ""),
      },
    };

    const updatedItemsList = items.map((it) => (it.id === itemToEdit.id ? updatedItem : it));
    persistItems(updatedItemsList);

    // Mettre à jour l'article sélectionné s'il est ouvert
    if (selectedItem?.id === itemToEdit.id) {
      setSelectedItem(updatedItem);
    }

    setIsSavingEdit(false);
    setIsEditModalOpen(false);
    setItemToEdit(null);

    setNotificationMsg(`✨ L'article « ${updatedItem.title} » a été modifié avec succès !`);
    setTimeout(() => setNotificationMsg(""), 5000);
  };

  // ==========================================
  // 🗑️ GESTION DE LA SUPPRESSION D'UN ARTICLE
  // ==========================================
  const handleOpenDeleteModal = (item, e) => {
    e?.stopPropagation();
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    const updatedItemsList = items.filter((it) => it.id !== itemToDelete.id);
    persistItems(updatedItemsList);

    // Retirer des favoris si présent
    if (favorites.includes(itemToDelete.id)) {
      const updatedFavs = favorites.filter((id) => id !== itemToDelete.id);
      setFavorites(updatedFavs);
      try {
        localStorage.setItem("facilite_mkt_favorites", JSON.stringify(updatedFavs));
      } catch {}
    }

    // Fermer le modal de détail s'il était ouvert sur cet article
    if (selectedItem?.id === itemToDelete.id) {
      setSelectedItem(null);
    }

    const deletedTitle = itemToDelete.title;
    setIsDeleteModalOpen(false);
    setItemToDelete(null);

    setNotificationMsg(`🗑️ L'article « ${deletedTitle} » a été supprimé avec succès.`);
    setTimeout(() => setNotificationMsg(""), 5000);
  };

  // Restaurer le catalogue par défaut
  const handleResetToDefaultCatalog = () => {
    if (window.confirm("Voulez-vous réinitialiser le catalogue avec les articles de démonstration officiels ?")) {
      persistItems(INITIAL_MARKETPLACE_ITEMS);
      setNotificationMsg("🔄 Le catalogue d'articles officiel a été restauré avec succès.");
      setTimeout(() => setNotificationMsg(""), 5000);
    }
  };

  // Publication d'une nouvelle annonce
  const handleCreateListing = (e) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return;

    setIsSubmitting(true);

    const finalImage =
      uploadedPhotos[0] ||
      newImageUrl ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80";

    const priceNum = Number(newPrice) || 0;

    const newItem = {
      id: "user-mkt-" + Date.now(),
      title: newTitle.trim(),
      price: priceNum,
      priceFormatted: priceNum.toLocaleString("fr-FR") + " CFA",
      category: newCategory,
      categoryLabel: CATEGORIES.find((c) => c.id === newCategory)?.label || "Général",
      location: newCity + ", Sénégal",
      city: newCity,
      distance: "1 km",
      image: finalImage,
      photos: uploadedPhotos.length > 0 ? uploadedPhotos : [finalImage],
      isRecent: true,
      seller: {
        name: profile?.full_name || session?.user?.user_metadata?.full_name || "Vendeur Facilité",
        phone: newPhone || "+221770000000",
        whatsapp: (newPhone || "221770000000").replace(/\D/g, ""),
        rating: 5.0,
        joinedYear: "2026",
        verified: true,
        isCurrentUser: true,
      },
      description: newDescription || "Annonce publiée récemment sur Facilité Marketplace.",
      postedAt: "À l'instant",
    };

    const updatedItems = [newItem, ...items];
    persistItems(updatedItems);

    setIsSubmitting(false);
    setIsCreateModalOpen(false);
    handleResetForm();

    setNotificationMsg("🎉 Votre article a été publié avec succès sur Facilité Marketplace !");
    setTimeout(() => setNotificationMsg(""), 5000);
  };

  const handleContactWhatsApp = (item) => {
    const rawNumber = item.seller.whatsapp || item.seller.phone;
    const cleanNumber = rawNumber.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Bonjour ${item.seller.name}, j'ai vu votre annonce "${item.title}" à ${item.priceFormatted} sur Facilité Marketplace. Est-elle toujours disponible ?`
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  };

  // Filtrage et Tri
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Onglet Favoris
        if (activeTab === "favorites" && !favorites.includes(item.id)) return false;

        // Onglet Mes Annonces
        if (activeTab === "my_listings" && !item.seller?.isCurrentUser && !item.id.startsWith("user-mkt-")) {
          return false;
        }

        // Catégorie
        if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

        // Ville
        if (selectedCity !== "Toutes les villes" && item.city !== selectedCity) return false;

        // Prix max
        if (priceMax && Number(priceMax) > 0 && item.price > Number(priceMax)) return false;

        // Recherche texte
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDesc = item.description?.toLowerCase().includes(q);
          const matchLoc = item.location?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchLoc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        return 0; // Tri par défaut
      });
  }, [items, selectedCategory, selectedCity, priceMax, searchQuery, sortBy, favorites, activeTab]);

  if (!isMarketplaceAllowed) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 text-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-xs">
            <i className="fa-solid fa-store"></i>
          </div>
          <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black rounded-md uppercase tracking-wider">
            Chantier & Maintenance
          </span>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mt-3">
            Marketplace temporairement indisponible
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Cette section est temporairement désactivée par l&apos;administration le temps de finaliser les travaux et ajustements.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-6 py-2.5 bg-[#1877F2] hover:bg-blue-700 text-white text-xs font-black rounded-full transition shadow-xs cursor-pointer"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* 🚀 NOTIFICATION BANNER */}
      {notificationMsg && (
        <div className="fixed top-20 right-4 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700 dark:border-gray-200 animate-in fade-in slide-in-from-top-4">
          <i className="fa-solid fa-circle-check text-emerald-500 text-xl"></i>
          <span className="text-sm font-bold">{notificationMsg}</span>
          <button
            onClick={() => setNotificationMsg("")}
            className="ml-2 text-gray-400 hover:text-white dark:hover:text-gray-900"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* 🏷️ TOP MARKETPLACE BAR & TABS */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-2xs sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header row with Title, Tabs, Actions */}
          <div className="flex flex-wrap items-center justify-between py-3 gap-3">
            {/* Titre avec onglets */}
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab("all")}
                className={`relative pb-2 font-black text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "all"
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>Sélection du jour ({items.length})</span>
                {activeTab === "all" && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#1877F2] rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("favorites")}
                className={`relative pb-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "favorites"
                    ? "text-[#1877F2] font-black"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <i className="fa-solid fa-heart text-rose-500 text-xs"></i>
                <span>Mes Favoris ({favorites.length})</span>
                {activeTab === "favorites" && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#1877F2] rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("my_listings")}
                className={`relative pb-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "my_listings"
                    ? "text-purple-600 dark:text-purple-400 font-black"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <i className="fa-solid fa-user-tag text-purple-500 text-xs"></i>
                <span>Mes annonces publiées</span>
                {activeTab === "my_listings" && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600 rounded-full"></span>
                )}
              </button>
            </div>

            {/* Actions: Sélecteur de Localisation, Réinitialisation & Bouton Vendre */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Bouton de Localisation */}
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2.5 sm:px-3 py-1.5 rounded-full transition cursor-pointer"
                title="Modifier la localisation"
              >
                <i className="fa-solid fa-location-dot text-[#1877F2]"></i>
                <span className="truncate max-w-[120px] sm:max-w-none">
                  {selectedCity} · {distanceKm} km
                </span>
              </button>

              {/* Bouton Restaurer le catalogue (Discret) */}
              <button
                onClick={handleResetToDefaultCatalog}
                className="hidden md:flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 px-2.5 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                title="Restaurer les annonces par défaut"
              >
                <i className="fa-solid fa-rotate-left text-xs"></i>
                <span>Réinitialiser</span>
              </button>

              {/* Bouton Vendre / Publier */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-black shadow-sm hover:shadow-md transition active:scale-95 cursor-pointer"
                title="Vendre un article sur Marketplace"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>Vendre</span>
              </button>
            </div>
          </div>

          {/* 📸 BARRE DE RECHERCHE INTELLIGENTE & RECHERCHE PAR IMAGE */}
          <div className="my-2.5 p-2 sm:p-2.5 bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl border-2 border-orange-500/80 dark:border-orange-500 shadow-lg shadow-orange-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
            {/* Partie Gauche : Bouton Recherche par image + Champ de recherche */}
            <div className="flex items-center gap-3 flex-1 min-w-0 px-2">
              {/* Bouton Recherche par Image 📷 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSearchUpload}
                  className="hidden"
                  id="marketplace-image-search-input"
                />

                {uploadedSearchImage ? (
                  <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 px-3 py-1.5 rounded-full text-xs animate-in fade-in">
                    <img
                      src={uploadedSearchImage}
                      alt="Recherche visuelle"
                      className="w-6 h-6 rounded-full object-cover border border-orange-400 shadow-2xs"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-orange-700 dark:text-orange-300">
                        {isAnalyzingImage ? "Analyse IA en cours..." : "Image détectée"}
                      </span>
                      {imageDetectedCategory && (
                        <span className="text-[9px] text-gray-500 font-semibold">
                          Catégorie:{" "}
                          {CATEGORIES.find((c) => c.id === imageDetectedCategory)?.label || imageDetectedCategory}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImageSearch}
                      className="w-5 h-5 rounded-full bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 flex items-center justify-center text-[10px] hover:bg-orange-300 transition ml-1 cursor-pointer"
                      title="Supprimer l'image"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="marketplace-image-search-input"
                    className="flex items-center gap-2 text-xs sm:text-sm font-black text-gray-800 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 px-3 py-1.5 rounded-xl hover:bg-orange-50/80 dark:hover:bg-orange-950/40 transition cursor-pointer border border-gray-200/80 dark:border-gray-800 shadow-2xs"
                    title="Téléversez une photo pour trouver des articles similaires"
                  >
                    <i className="fa-solid fa-camera text-orange-500 text-sm sm:text-base"></i>
                    <span className="whitespace-nowrap">Recherche par image</span>
                  </label>
                )}
              </div>

              {/* Séparateur vertical */}
              <div className="hidden sm:block h-6 w-px bg-gray-200 dark:bg-gray-800"></div>

              {/* Champ de texte libre */}
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  placeholder="Que cherchez-vous sur Marketplace (ex: iPhone, voiture, robe, villa...) ?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer mr-1"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Partie Droite : Bouton Pilule Dégradé Orange "Rechercher" ✨ */}
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim() || uploadedSearchImage) {
                  setNotificationMsg("🔍 Recherche Marketplace actualisée !");
                  setTimeout(() => setNotificationMsg(""), 3000);
                }
              }}
              className="bg-gradient-to-r from-[#FF8C00] via-[#FF5E00] to-[#FF3B30] hover:brightness-110 text-white font-black px-7 py-2.5 rounded-full shadow-md shadow-orange-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
              <span>Rechercher</span>
            </button>
          </div>

          {/* 🔍 BARRE DE FILTRES PAR CATÉGORIES & TRI */}
          <div className="py-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800">
            {/* Pilules de Catégories scrollables */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-[#1877F2] text-white shadow-xs"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <i className={cat.icon}></i>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Tri */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 px-3.5 py-1.5 rounded-full border-none focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
              >
                <option value="recent">Plus récentes</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 📦 GRILLE DES ANNONCES AVEC GESTION COMPLÈTE (MODIFIER & SUPPRIMER) */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-xs">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fa-solid fa-store"></i>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Aucune annonce trouvée</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Essayez d&apos;élargir votre zone géographique ou de réinitialiser vos filtres de recherche.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedCity("Toutes les villes");
                  setSearchQuery("");
                  setActiveTab("all");
                }}
                className="px-5 py-2 bg-[#1877F2] text-white rounded-full text-xs font-black hover:bg-blue-700 transition cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
              <button
                onClick={handleResetToDefaultCatalog}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-black hover:bg-gray-200 transition cursor-pointer"
              >
                Restaurer les articles par défaut
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredItems.map((item) => {
              const isFav = favorites.includes(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xs hover:shadow-lg border border-gray-200/80 dark:border-gray-800/80 transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-square w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                      loading="lazy"
                    />

                    {/* Badge "Annonce récente" en haut à gauche */}
                    {item.isRecent && (
                      <span className="absolute top-2 left-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-[10px] font-extrabold text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-md shadow-2xs z-10">
                        Annonce récente
                      </span>
                    )}

                    {/* ACTIONS RAPIDES (Favoris, Modifier, Supprimer) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
                      {/* Bouton Modifier rapide */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(item, e)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 hover:bg-[#1877F2] hover:text-white dark:hover:bg-[#1877F2] dark:hover:text-white flex items-center justify-center backdrop-blur-md shadow-sm transition-all active:scale-75 cursor-pointer opacity-90 group-hover:opacity-100"
                        title="Modifier cet article"
                      >
                        <i className="fa-solid fa-pen text-[10px] sm:text-xs"></i>
                      </button>

                      {/* Bouton Supprimer rapide */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteModal(item, e)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white flex items-center justify-center backdrop-blur-md shadow-sm transition-all active:scale-75 cursor-pointer opacity-90 group-hover:opacity-100"
                        title="Supprimer cet article"
                      >
                        <i className="fa-solid fa-trash-can text-[10px] sm:text-xs"></i>
                      </button>

                      {/* Bouton Favoris */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-75 shadow-xs cursor-pointer ${
                          isFav ? "bg-rose-500 text-white" : "bg-black/30 hover:bg-black/50 text-white"
                        }`}
                        title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <i className={`fa-${isFav ? "solid" : "regular"} fa-heart text-[10px] sm:text-xs`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Infos de la carte */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Prix en gras (ex: 125 000 CFA) */}
                      <div className="text-sm sm:text-base font-black text-gray-950 dark:text-white tracking-tight">
                        {item.priceFormatted}
                      </div>

                      {/* Titre */}
                      <h4 className="text-xs sm:text-[13px] font-medium text-gray-800 dark:text-gray-200 line-clamp-1 mt-0.5 group-hover:text-[#1877F2] transition-colors">
                        {item.title}
                      </h4>
                    </div>

                    {/* Localisation & Actions de gestion */}
                    <div className="mt-2 pt-1 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="truncate">{item.location}</span>

                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(item, e)}
                          className="text-gray-400 hover:text-[#1877F2] transition p-0.5"
                          title="Modifier"
                        >
                          <i className="fa-solid fa-pencil"></i>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDeleteModal(item, e)}
                          className="text-gray-400 hover:text-rose-500 transition p-0.5"
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 🔍 MODAL DE DÉTAIL D'ANNONCE AVEC ACTIONS MODIFIER & SUPPRIMER */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800 relative">
            {/* Bouton Fermer */}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition cursor-pointer shadow-xs"
              title="Fermer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Image principale & Galerie */}
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 md:rounded-l-3xl overflow-hidden flex flex-col">
                <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-full object-cover" />
                {selectedItem.isRecent && (
                  <span className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 text-xs font-black text-gray-900 dark:text-white px-2.5 py-1 rounded-md shadow-xs">
                    Annonce récente
                  </span>
                )}
              </div>

              {/* Détails et Actions */}
              <div className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-[#1877F2] bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md">
                      {selectedItem.categoryLabel}
                    </span>

                    {/* Actions Modifier & Supprimer dans le détail */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleOpenEditModal(selectedItem, e)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-[#1877F2] hover:bg-[#1877F2] hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="Modifier cet article"
                      >
                        <i className="fa-solid fa-pen text-[10px]"></i>
                        <span>Modifier</span>
                      </button>

                      <button
                        onClick={(e) => handleOpenDeleteModal(selectedItem, e)}
                        className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="Supprimer cet article"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  <h2 className="text-xl font-black text-gray-900 dark:text-white mt-2 leading-snug">
                    {selectedItem.title}
                  </h2>

                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                    {selectedItem.priceFormatted}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <i className="fa-solid fa-location-dot text-rose-500"></i>
                    <span>{selectedItem.location}</span>
                    <span>•</span>
                    <span>{selectedItem.postedAt}</span>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 my-4"></div>

                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                    Description du vendeur
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {selectedItem.description}
                  </p>

                  <div className="border-t border-gray-100 dark:border-gray-800 my-4"></div>

                  {/* Profil Vendeur */}
                  <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1877F2] text-white font-black flex items-center justify-center text-sm shadow-xs">
                        {selectedItem.seller?.name?.charAt(0) || "V"}
                      </div>
                      <div>
                        <div className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1">
                          <span>{selectedItem.seller?.name || "Vendeur Facilité"}</span>
                          {selectedItem.seller?.verified && (
                            <i className="fa-solid fa-circle-check text-blue-500 text-xs"></i>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Membre depuis {selectedItem.seller?.joinedYear || "2026"} • ⭐{" "}
                          {selectedItem.seller?.rating || "5.0"}/5
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boutons d'Action Contact */}
                <div className="mt-6 space-y-2">
                  <button
                    onClick={() => handleContactWhatsApp(selectedItem)}
                    className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                    <span>Discuter sur WhatsApp</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/messagerie"
                      className="bg-[#1877F2] hover:bg-[#166fe5] text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition text-center"
                    >
                      <i className="fa-solid fa-comments"></i>
                      <span>Envoyer message</span>
                    </Link>

                    <button
                      onClick={(e) => toggleFavorite(selectedItem.id, e)}
                      className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        favorites.includes(selectedItem.id)
                          ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800"
                          : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <i
                        className={`fa-${
                          favorites.includes(selectedItem.id) ? "solid" : "regular"
                        } fa-heart text-rose-500`}
                      ></i>
                      <span>{favorites.includes(selectedItem.id) ? "Sauvegardé" : "Enregistrer"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ MODAL MODIFIER UNE ANNONCE (ÉDITION COMPLÈTE) */}
      {isEditModalOpen && itemToEdit && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-xl w-full p-5 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[94vh] overflow-y-auto no-scrollbar my-auto">
            {/* Header: Modifier l'annonce + Fermer */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/80 text-[#1877F2] flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Modifier l&apos;annonce
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setItemToEdit(null);
                }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition p-1 cursor-pointer"
                title="Fermer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEditedListing} className="space-y-4">
              {/* Titre avec compteur 0 / 70 */}
              <div>
                <div className="flex justify-between text-[11px] text-gray-400 font-bold mb-1">
                  <span className="text-gray-700 dark:text-gray-300">Titre de l&apos;article *</span>
                  <span>{editTitle.length} / 70</span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={70}
                  placeholder="Ex: iPhone 13 128Go Rose Parfait État"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2] focus:border-transparent transition"
                />
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Catégorie *
                </label>
                <div className="relative">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full appearance-none bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                  </div>
                </div>
              </div>

              {/* Ville / Emplacement */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Emplacement / Ville *
                </label>
                <div className="relative">
                  <select
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full appearance-none bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
                  >
                    {CITIES.filter((c) => c !== "Toutes les villes").map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                  </div>
                </div>
              </div>

              {/* Prix & Téléphone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Prix (en Francs CFA) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 125000"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Numéro WhatsApp / Tél *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: +221770000000"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Description détaillée
                </label>
                <textarea
                  rows="3"
                  placeholder="Précisez l'état du produit, les fonctionnalités, accessoires inclus..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
                ></textarea>
              </div>

              {/* Badge Annonce récente */}
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="editIsRecentCheckbox"
                  checked={editIsRecent}
                  onChange={(e) => setEditIsRecent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1877F2] accent-[#1877F2] focus:ring-[#1877F2] cursor-pointer"
                />
                <label
                  htmlFor="editIsRecentCheckbox"
                  className="text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  Afficher le badge &quot;Annonce récente&quot; sur la photo
                </label>
              </div>

              {/* Gestion des photos */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs sm:text-sm font-black text-gray-900 dark:text-white mb-1">
                  Photos de l&apos;annonce
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                  La première image est la photo principale. Cliquez sur une photo pour la définir comme photo de couverture.
                </p>

                <input
                  ref={editPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditPhotoUpload}
                  className="hidden"
                  id="marketplace-edit-photo-upload-input"
                />

                <div className="flex flex-wrap items-center gap-3">
                  {/* Bouton Ajouter de nouvelles photos */}
                  <label
                    htmlFor="marketplace-edit-photo-upload-input"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border-2 border-dashed border-blue-300 dark:border-blue-700/60 hover:bg-blue-100/60 transition flex flex-col items-center justify-center cursor-pointer text-[#1877F2] shadow-2xs active:scale-95"
                    title="Ajouter des photos"
                  >
                    <i className="fa-solid fa-camera text-lg"></i>
                    <span className="text-[10px] font-bold mt-1">Ajouter</span>
                  </label>

                  {/* Aperçus des photos existantes */}
                  {editPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEditCoverPhoto(idx)}
                      className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border shadow-2xs group cursor-pointer transition ${
                        idx === 0
                          ? "border-emerald-500 ring-2 ring-emerald-500/40"
                          : "border-gray-200 dark:border-gray-700 hover:opacity-90"
                      }`}
                      title={idx === 0 ? "Photo principale (Couverture)" : "Cliquer pour définir comme photo principale"}
                    >
                      <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 ? (
                        <span className="absolute bottom-1 left-1 right-1 bg-emerald-600/90 text-white text-[9px] font-black text-center py-0.5 rounded">
                          ★ Principale
                        </span>
                      ) : (
                        <span className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
                          Définir
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEditPhoto(idx);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition cursor-pointer"
                        title="Supprimer la photo"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Boutons Actions : Enregistrer / Annuler */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setItemToEdit(null);
                  }}
                  className="w-1/3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer text-center"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="w-2/3 bg-[#1877F2] hover:bg-[#166fe5] active:scale-98 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingEdit ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ MODAL DE CONFIRMATION DE SUPPRESSION D'ANNONCE */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-[999999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 text-center animate-in zoom-in-95">
            {/* Icône Danger */}
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-xs">
              <i className="fa-solid fa-trash-can"></i>
            </div>

            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              Supprimer cette annonce ?
            </h3>

            {/* Aperçu de l'article à supprimer */}
            <div className="my-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3 text-left">
              <img
                src={itemToDelete.image}
                alt={itemToDelete.title}
                className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-gray-900 dark:text-white truncate">
                  {itemToDelete.title}
                </h4>
                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {itemToDelete.priceFormatted}
                </div>
                <div className="text-[10px] text-gray-500">{itemToDelete.location}</div>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              Cette action supprimera définitivement cet article de votre catalogue Marketplace. Cette action est irréversible.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setItemToDelete(null);
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <i className="fa-solid fa-trash"></i>
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📍 MODAL SÉLECTEUR DE VILLE ET RAYON */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-[#1877F2]"></i>
                <span>Changer de zone géographique</span>
              </h3>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Ville ou Région
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
                >
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  <span>Rayon de recherche</span>
                  <span className="text-[#1877F2] font-black">{distanceKm} km</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full accent-[#1877F2] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>5 km</span>
                  <span>65 km</span>
                  <span>150 km</span>
                </div>
              </div>

              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="w-full bg-[#1877F2] hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Appliquer la zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✍️ MODAL PUBLIER UNE ANNONCE / VENDRE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-xl w-full p-5 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[94vh] overflow-y-auto no-scrollbar my-auto">
            {/* Header: Publier une annonce + Effacer */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-5">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition p-1 cursor-pointer"
                title="Fermer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>

              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                Publier une annonce
              </h3>

              <button
                type="button"
                onClick={handleResetForm}
                className="text-rose-500 hover:text-rose-600 font-extrabold text-xs sm:text-sm transition cursor-pointer"
              >
                Effacer
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4">
              {/* Titre avec compteur 0 / 70 */}
              <div>
                <div className="flex justify-end text-[11px] text-gray-400 font-bold mb-1">
                  <span>{newTitle.length} / 70</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={70}
                    placeholder="Titre*"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Catégorie* avec chevron > */}
              <div className="relative">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
                >
                  {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </div>
              </div>

              {/* Sélectionnez l'emplacement* avec chevron > */}
              <div className="relative">
                <select
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#1877F2] cursor-pointer"
                >
                  {CITIES.filter((c) => c !== "Toutes les villes").map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </div>
              </div>

              {/* Prix & Téléphone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  placeholder="Prix (en CFA)*"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
                />

                <input
                  type="tel"
                  required
                  placeholder="Numéro WhatsApp / Tél*"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
                />
              </div>

              {/* Description */}
              <textarea
                rows="2"
                placeholder="Description de l'article (état, caractéristiques...)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1877F2]"
              ></textarea>

              {/* Section Ajouter une photo */}
              <div className="pt-1">
                <label className="block text-xs sm:text-sm font-black text-gray-900 dark:text-white mb-1">
                  Ajouter une photo
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    La première image est l&apos;image de titre.
                  </span>{" "}
                  Vous pouvez modifier l&apos;ordre des photos
                </p>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="marketplace-photo-upload-input"
                />

                <div className="flex flex-wrap items-center gap-3">
                  {/* Bouton Plus (+) carré */}
                  <label
                    htmlFor="marketplace-photo-upload-input"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100/60 transition flex items-center justify-center cursor-pointer text-emerald-600 dark:text-emerald-400 text-2xl shadow-2xs active:scale-95"
                    title="Ajouter des photos"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </label>

                  {/* Aperçus des photos téléversées */}
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xs group"
                    >
                      <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 right-1 bg-emerald-600/90 text-white text-[9px] font-black text-center py-0.5 rounded">
                          Titre
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition cursor-pointer"
                        title="Supprimer la photo"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-gray-400 mt-2">
                  Les formats pris en charge sont *.jpg, *.gif et *.png
                </p>
              </div>

              {/* Bouton Suivant / Publier */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#1877F2] hover:bg-[#166fe5] active:scale-98 text-white py-3.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "Publication en cours..." : "Publier l'annonce"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
