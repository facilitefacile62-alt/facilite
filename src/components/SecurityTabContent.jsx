"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Nettoie l'erreur d'un appel updateUser({ phone }) en message français
// exploitable. Le message Supabase pour un numéro déjà pris varie selon le
// point d'entrée ("A user with this phone number has already been
// registered" ici, vu en conditions réelles — pas juste "already
// registered") : le regex tolère un texte quelconque entre les deux mots.
function extractSendPhoneErrorMessage(err) {
  let msg = err?.message || "Impossible d'envoyer le code de vérification.";
  if (/already.*registered|already exists/i.test(msg)) {
    msg = "Ce numéro est déjà associé à un autre compte.";
  } else if (/rate limit|too many/i.test(msg)) {
    msg = "Trop de tentatives. Veuillez patienter avant de réessayer.";
  } else if (!msg || msg === "{}" || msg === "[object Object]") {
    // AuthRetryableFetchError renvoie parfois un message vide (objet
    // sérialisé en "{}") — observé quand Twilio rejette le numéro en amont.
    // Même garde-fou que PhoneAuthForm.jsx pour ce cas déjà connu.
    msg = "Impossible d'envoyer le SMS. Vérifiez que le numéro est correct et joignable.";
  }
  return msg;
}

// Même nettoyage que ci-dessus, pour updateUser({ email }) — même famille de
// réponses Supabase (déjà pris, rate limit, objet vide sérialisé en "{}").
function extractSendEmailErrorMessage(err) {
  let msg = err?.message || "Impossible d'envoyer le code de vérification.";
  if (/already.*registered|already exists/i.test(msg)) {
    msg = "Cette adresse e-mail est déjà associée à un autre compte.";
  } else if (/rate limit|too many/i.test(msg)) {
    msg = "Trop de tentatives. Veuillez patienter avant de réessayer.";
  } else if (!msg || msg === "{}" || msg === "[object Object]") {
    msg = "Impossible d'envoyer l'e-mail de vérification. Vérifiez l'adresse saisie.";
  }
  return msg;
}

// Décode le payload d'un JWT Supabase pour lire la revendication `amr`
// (Authentication Methods Reference) : la ou les méthodes ayant servi à
// obtenir la session EN COURS. Sert à savoir si l'utilisateur vient de
// prouver son identité via un code OTP fraîchement vérifié (auquel cas on
// peut dispenser de redemander l'ancien mot de passe — équivalent en
// robustesse) ou via un mot de passe (auquel cas on l'exige). Échoue de
// façon sûre : en cas de doute, on redemande toujours le mot de passe.
function getMostRecentAuthMethod(accessToken) {
  try {
    const payloadPart = accessToken.split(".")[1];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(json);
    const amr = payload?.amr;
    if (!Array.isArray(amr) || amr.length === 0) return null;
    return amr.reduce((latest, entry) => (!latest || entry.timestamp > latest.timestamp ? entry : latest), null)
      ?.method || null;
  } catch {
    return null;
  }
}

// Masquage d'affichage (pas une garantie de sécurité serveur comme
// mask_phone_number côté admin — ici c'est déjà la propre donnée de
// l'utilisateur, juste pour éviter de l'afficher en clair au premier coup
// d'œil, ex. partage d'écran). "+221 ** *** ** 32" : indicatif en clair,
// tout le numéro local masqué sauf les 2 derniers chiffres.
function maskPhoneOwn(phone) {
  if (!phone || phone.length < 8) return phone || "";
  return `${phone.slice(0, 4)} ** *** ** ${phone.slice(-2)}`;
}

// "m***@gmail.com" : premier caractère du nom + domaine en clair.
function maskEmailOwn(email) {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  return `${local.charAt(0)}***@${domain}`;
}

function formatBirthDateDisplay(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const COUNTRY_OPTIONS = [
  "Sénégal",
  "Côte d'Ivoire",
  "Maroc",
  "France",
  "Mali",
  "Guinée",
  "Bénin",
  "Togo",
  "Cameroun",
];

const passwordRules = [
  { label: "8 caractères minimum", test: (v) => v.length >= 8 },
  { label: "1 lettre", test: (v) => /[a-zA-Z]/.test(v) },
  { label: "1 chiffre", test: (v) => /\d/.test(v) },
  { label: "1 caractère spécial (#?!@)", test: (v) => /[#?!@]/.test(v) },
];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const BIRTH_MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const BIRTH_YEARS = Array.from({ length: 88 }, (_, i) => CURRENT_YEAR - 13 - i);

export default function SecurityTabContent({ userSession }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Accordéon : une seule ligne dépliée à la fois — "phone" | "email" |
  // "birthdate" | "country" | null.
  const [expandedRow, setExpandedRow] = useState(null);

  // Changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skipCurrentPassword, setSkipCurrentPassword] = useState(false);
  // Un compte n'a jamais eu de mot de passe (créé via Google ou téléphone
  // uniquement) tant qu'aucune identité 'email' n'est liée — même détection
  // que src/app/login/page.js:70-72 (hasPasswordIdentity), déjà en
  // production pour distinguer les comptes "Google uniquement".
  const [hasPasswordIdentity, setHasPasswordIdentity] = useState(true);

  // Identifiants
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  // Confirmation du téléphone (flux à 2 étapes, même pattern que PhoneAuthForm)
  const [phoneConfirmStep, setPhoneConfirmStep] = useState("idle"); // idle | sent
  const [phoneOtpToken, setPhoneOtpToken] = useState("");

  // Ajout / changement de numéro — même flux à 2 étapes (updateUser ->
  // verifyOtp type "phone_change") pour les deux cas, seule différence :
  // "Ajouter" part d'un champ vide, "Changer" le pré-remplit avec le numéro
  // actuel.
  const [addPhoneStep, setAddPhoneStep] = useState("idle"); // idle | form | sent
  const [newPhoneNumber, setNewPhoneNumber] = useState("+221");
  const [newPhoneOtpToken, setNewPhoneOtpToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (addPhoneStep !== "sent" || resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [addPhoneStep, resendCooldown]);

  // Ajout / changement d'e-mail — même flux à 2 étapes que le téléphone
  // (updateUser({ email }) -> verifyOtp type "email_change").
  const [addEmailStep, setAddEmailStep] = useState("idle"); // idle | form | sent
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [newEmailOtpToken, setNewEmailOtpToken] = useState("");
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  useEffect(() => {
    if (addEmailStep !== "sent" || emailResendCooldown <= 0) return;
    const timer = setTimeout(() => setEmailResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [addEmailStep, emailResendCooldown]);

  // Date de naissance / région — stockées dans public.profiles, jamais
  // exposées à une vue ou fonction accessible aux recruteurs (vérifié :
  // get_candidats_recherche/get_profils_publics n'y font pas référence).
  const [profileBirthDate, setProfileBirthDate] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  useEffect(() => {
    if (!userSession?.user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("country, date_naissance")
      .eq("id", userSession.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProfileCountry(data.country || "");
        setProfileBirthDate(data.date_naissance || "");
        if (data.date_naissance) {
          const [y, m, d] = data.date_naissance.split("-");
          setBirthYear(y);
          setBirthMonth(String(Number(m)));
          setBirthDay(String(Number(d)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userSession?.user?.id]);

  // Dissociation
  const [unlinkTarget, setUnlinkTarget] = useState(null); // null | "email" | "phone"
  const [unlinkPassword, setUnlinkPassword] = useState("");

  // Désactivation du compte (self-service, réversible en se reconnectant —
  // voir reactivate_own_account_if_self_suspended() et middleware.js).
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const syncFromUser = (user) => {
    setHasEmail(!!user?.email);
    setHasPhone(!!user?.phone);
    setEmailConfirmed(!!user?.email_confirmed_at);
    setPhoneConfirmed(!!user?.phone_confirmed_at);
    // Même détection que src/app/login/page.js:70 — une identité 'email'
    // n'existe dans ce projet que pour un compte email+mot de passe (jamais
    // pour le téléphone ou Google), donc son absence signifie "aucun mot de
    // passe n'a jamais été défini".
    setHasPasswordIdentity((user?.identities || []).some((i) => i.provider === "email"));
  };

  useEffect(() => {
    if (!userSession?.user) return;
    const accessToken = userSession.access_token;
    // getUser() (pas le user de la session) : la seule source qui garantit
    // le tableau `identities` à jour, même pattern que login/page.js:67.
    supabase.auth.getUser().then(({ data }) => {
      syncFromUser(data?.user || userSession.user);
    });
    // Micro-tâche : l'analyse react-hooks/set-state-in-effect interdit un
    // setState synchrone dans le corps de l'effet (dérivation directe d'une
    // prop). userSession n'arrive qu'après un getSession() asynchrone côté
    // parent — il n'y a pas d'alternative sans effet ici.
    queueMicrotask(() => {
      setSkipCurrentPassword(getMostRecentAuthMethod(accessToken) === "otp");
    });
  }, [userSession]);

  // Relit l'utilisateur directement auprès du serveur Supabase (pas le
  // cache local de la session) : la seule source fiable pour compter les
  // identifiants réellement confirmés avant une action sensible.
  const fetchFreshUser = async () => {
    const { data, error: fetchError } = await supabase.auth.getUser();
    if (fetchError || !data?.user) {
      throw new Error("Impossible de vérifier votre session. Reconnectez-vous puis réessayez.");
    }
    syncFromUser(data.user);
    return data.user;
  };

  // Revérifie le mot de passe actuel via un signInWithPassword ciblé sur
  // l'identifiant confirmé de ce compte (préférence email). Ne déconnecte
  // aucun autre appareil : ça ne fait que rafraîchir la session courante.
  const reverifyPassword = async (user, password) => {
    const credential = user.email
      ? { email: user.email, password }
      : { phone: user.phone, password };
    const { error: reauthError } = await supabase.auth.signInWithPassword(credential);
    if (reauthError) {
      throw new Error("Mot de passe actuel incorrect.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!skipCurrentPassword && !currentPassword) {
      setError("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    setLoading(true);
    try {
      const user = await fetchFreshUser();

      if (!skipCurrentPassword) {
        await reverifyPassword(user, currentPassword);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage("Mot de passe mis à jour. Déconnexion des autres appareils en cours...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSkipCurrentPassword(false);

      // scope: "global" révoque TOUTES les sessions de ce compte, y compris
      // celle-ci — l'utilisateur doit se reconnecter, même sur cet appareil,
      // cohérent avec le fait qu'un changement de mot de passe doit invalider
      // toute session ouverte avant ce changement (fuite potentielle du
      // précédent mot de passe).
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/login";
      return;
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  // Premier mot de passe (compte Google ou téléphone, aucune identité
  // 'email' donc aucun mot de passe préexistant) — pas d'ancien mot de passe
  // à redemander puisqu'il n'existe pas, et pas de déconnexion globale
  // forcée après coup : aucun ancien mot de passe n'a pu fuiter puisqu'il
  // n'a jamais existé, contrairement à un vrai changement.
  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!passwordRules.every((r) => r.test(newPassword))) {
      setError("Le mot de passe ne respecte pas encore toutes les règles ci-dessous.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      await fetchFreshUser();
      setMessage("Mot de passe créé. Vous pouvez désormais aussi vous connecter avec.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la création du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneConfirmation = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: updateError } = await supabase.auth.updateUser({ phone: user.phone });
      if (updateError) throw updateError;
      setPhoneConfirmStep("sent");
      setMessage(`Un code de vérification à 6 chiffres a été envoyé au ${user.phone}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'envoyer le code de vérification.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneConfirmation = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (phoneOtpToken.trim().length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: user.phone,
        token: phoneOtpToken.trim(),
        type: "phone_change",
      });
      if (verifyError) throw verifyError;

      await fetchFreshUser();
      setPhoneConfirmStep("idle");
      setPhoneOtpToken("");
      setMessage("Votre numéro de téléphone est confirmé.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAddPhone = () => {
    setError("");
    setMessage("");
    setNewPhoneNumber("+221");
    setAddPhoneStep("form");
    setExpandedRow("phone");
  };

  const handleStartChangePhone = () => {
    setError("");
    setMessage("");
    setNewPhoneNumber(userSession?.user?.phone || "+221");
    setAddPhoneStep("form");
    setExpandedRow("phone");
  };

  const handleSendNewPhone = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleaned = newPhoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!/^\+\d{8,15}$/.test(cleaned)) {
      setError("Numéro invalide. Utilisez le format international, ex : +221771234567.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ phone: cleaned });
      if (updateError) throw updateError;
      setNewPhoneNumber(cleaned);
      setAddPhoneStep("sent");
      setResendCooldown(60);
      setMessage(`Un code de vérification à 6 chiffres a été envoyé au ${cleaned}.`);
    } catch (err) {
      console.error(err);
      setError(extractSendPhoneErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendNewPhone = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ phone: newPhoneNumber });
      if (updateError) throw updateError;
      setNewPhoneOtpToken("");
      setResendCooldown(60);
      setMessage(`Un nouveau code a été envoyé au ${newPhoneNumber}.`);
    } catch (err) {
      console.error(err);
      setError(extractSendPhoneErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNewPhoneNumber = () => {
    setError("");
    setMessage("");
    setAddPhoneStep("form");
    setNewPhoneOtpToken("");
    setResendCooldown(0);
  };

  const handleVerifyNewPhone = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPhoneOtpToken.trim().length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: newPhoneNumber,
        token: newPhoneOtpToken.trim(),
        type: "phone_change",
      });
      if (verifyError) throw verifyError;

      await fetchFreshUser();
      setAddPhoneStep("idle");
      setNewPhoneNumber("+221");
      setNewPhoneOtpToken("");
      setExpandedRow(null);
      setMessage("Votre numéro de téléphone est lié et confirmé.");
    } catch (err) {
      console.error(err);
      let msg = err?.message || "Code invalide ou expiré.";
      if (/expired/i.test(msg)) msg = "Ce code a expiré. Demandez-en un nouveau.";
      else if (/invalid/i.test(msg)) msg = "Code incorrect. Vérifiez et réessayez.";
      else if (/rate limit|too many/i.test(msg)) msg = "Trop de tentatives. Veuillez patienter avant de réessayer.";
      else if (!msg || msg === "{}" || msg === "[object Object]") msg = "Erreur lors de la vérification du code. Veuillez réessayer.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAddPhone = () => {
    setError("");
    setMessage("");
    setAddPhoneStep("idle");
    setNewPhoneNumber("+221");
    setNewPhoneOtpToken("");
  };

  const handleResendEmailConfirmation = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: updateError } = await supabase.auth.updateUser({ email: user.email });
      if (updateError) throw updateError;
      setMessage(`Un e-mail de confirmation a été envoyé à ${user.email}. Cliquez sur le lien qu'il contient.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'envoyer l'e-mail de confirmation.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAddEmail = () => {
    setError("");
    setMessage("");
    setNewEmailAddress("");
    setAddEmailStep("form");
    setExpandedRow("email");
  };

  const handleStartChangeEmail = () => {
    setError("");
    setMessage("");
    setNewEmailAddress(userSession?.user?.email || "");
    setAddEmailStep("form");
    setExpandedRow("email");
  };

  const handleSendNewEmail = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmed = newEmailAddress.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Adresse e-mail invalide.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: trimmed });
      if (updateError) throw updateError;
      setNewEmailAddress(trimmed);
      setAddEmailStep("sent");
      setEmailResendCooldown(60);
      setMessage(`Un code de vérification a été envoyé à ${trimmed}.`);
    } catch (err) {
      console.error(err);
      setError(extractSendEmailErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendNewEmail = async () => {
    if (emailResendCooldown > 0) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmailAddress });
      if (updateError) throw updateError;
      setNewEmailOtpToken("");
      setEmailResendCooldown(60);
      setMessage(`Un nouveau code a été envoyé à ${newEmailAddress}.`);
    } catch (err) {
      console.error(err);
      setError(extractSendEmailErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNewEmailAddress = () => {
    setError("");
    setMessage("");
    setAddEmailStep("form");
    setNewEmailOtpToken("");
    setEmailResendCooldown(0);
  };

  const handleVerifyNewEmail = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newEmailOtpToken.trim().length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: newEmailAddress,
        token: newEmailOtpToken.trim(),
        type: "email_change",
      });
      if (verifyError) throw verifyError;

      await fetchFreshUser();
      setAddEmailStep("idle");
      setNewEmailAddress("");
      setNewEmailOtpToken("");
      setExpandedRow(null);
      setMessage("Votre adresse e-mail est mise à jour.");
    } catch (err) {
      console.error(err);
      let msg = err?.message || "Code invalide ou expiré.";
      if (/expired/i.test(msg)) msg = "Ce code a expiré. Demandez-en un nouveau.";
      else if (/invalid/i.test(msg)) msg = "Code incorrect. Vérifiez et réessayez.";
      else if (/rate limit|too many/i.test(msg)) msg = "Trop de tentatives. Veuillez patienter avant de réessayer.";
      else if (!msg || msg === "{}" || msg === "[object Object]") msg = "Erreur lors de la vérification du code. Veuillez réessayer.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAddEmail = () => {
    setError("");
    setMessage("");
    setAddEmailStep("idle");
    setNewEmailAddress("");
    setNewEmailOtpToken("");
  };

  const handleRequestUnlink = async (provider) => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const confirmedCount = (user.email_confirmed_at ? 1 : 0) + (user.phone_confirmed_at ? 1 : 0);
      if (confirmedCount <= 1) {
        setError("Vous devez conserver au moins un moyen de connexion vérifié (Email ou Téléphone).");
        return;
      }
      setUnlinkTarget(provider);
      setUnlinkPassword("");
    } catch (err) {
      setError(err.message || "Impossible de vérifier vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUnlink = async () => {
    setError("");
    setMessage("");

    if (!skipCurrentPassword && !unlinkPassword) {
      setError("Veuillez saisir votre mot de passe pour confirmer.");
      return;
    }

    setLoading(true);
    try {
      const user = await fetchFreshUser();

      if (!skipCurrentPassword) {
        await reverifyPassword(user, unlinkPassword);
      }

      const identity = user.identities?.find((id) => id.provider === unlinkTarget);
      if (!identity) {
        throw new Error("Impossible de trouver l'identifiant à dissocier.");
      }

      const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
      if (unlinkError) throw unlinkError;

      await fetchFreshUser();
      setMessage("Identifiant dissocié avec succès.");
      setUnlinkTarget(null);
      setUnlinkPassword("");
      setExpandedRow(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la dissociation.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateAccount = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data: ok, error: deactivateError } = await supabase.rpc("deactivate_own_account");
      if (deactivateError) throw deactivateError;
      if (!ok) throw new Error("Impossible de désactiver ce compte.");

      setShowDeactivateModal(false);
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la désactivation du compte.");
      setLoading(false);
    }
  };

  const handleSaveBirthDate = async () => {
    setError("");
    setMessage("");
    if (!birthDay || !birthMonth || !birthYear) {
      setError("Veuillez sélectionner un jour, un mois et une année.");
      return;
    }
    const iso = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
    setLoading(true);
    try {
      const { error: updErr } = await supabase.from("profiles").update({ date_naissance: iso }).eq("id", userSession.user.id);
      if (updErr) throw updErr;
      setProfileBirthDate(iso);
      setExpandedRow(null);
      setMessage("Date de naissance mise à jour.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCountry = async (value) => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: updErr } = await supabase.from("profiles").update({ country: value }).eq("id", userSession.user.id);
      if (updErr) throw updErr;
      setProfileCountry(value);
      setExpandedRow(null);
      setMessage("Région/pays mis à jour.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (row) => setExpandedRow((prev) => (prev === row ? null : row));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alertes */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {/* SECTION 1 — Informations du compte */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <h4 className="text-sm font-extrabold text-gray-900 px-5 pt-5 pb-3 flex items-center gap-2">
          <i className="fa-solid fa-id-card text-indigo-600"></i>
          Informations du compte
        </h4>

        <div className="divide-y divide-gray-100">
          {/* --- Ligne Téléphone --- */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow("phone")}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  Téléphone (SMS)
                  {hasPhone && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${phoneConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {phoneConfirmed ? "Confirmé" : "Non confirmé"}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-900 font-medium mt-0.5">
                  {hasPhone ? maskPhoneOwn(userSession?.user?.phone) : <span className="text-gray-400 italic font-normal">Aucun numéro</span>}
                </p>
              </div>
              <i className={`fa-solid fa-chevron-${expandedRow === "phone" ? "up" : "down"} text-gray-300 text-xs shrink-0`}></i>
            </button>

            {expandedRow === "phone" && (
              <div className="px-5 pb-5 space-y-3">
                {hasPhone && addPhoneStep === "idle" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {!phoneConfirmed && phoneConfirmStep === "idle" && (
                      <button
                        type="button"
                        onClick={handleSendPhoneConfirmation}
                        disabled={loading}
                        className="px-3 py-2 min-h-[48px] bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Envoyer le code SMS
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStartChangePhone}
                      disabled={loading}
                      className="px-3 py-2 min-h-[48px] bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition cursor-pointer disabled:opacity-50"
                    >
                      Changer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestUnlink("phone")}
                      disabled={loading}
                      className="px-3 py-2 min-h-[48px] bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Dissocier
                    </button>
                  </div>
                )}

                {!hasPhone && addPhoneStep === "idle" && (
                  <button
                    type="button"
                    onClick={handleStartAddPhone}
                    className="px-3 py-2 min-h-[48px] bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Ajouter un numéro
                  </button>
                )}

                {addPhoneStep === "form" && (
                  <form onSubmit={handleSendNewPhone} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="tel"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      placeholder="+221771234567"
                      className="flex-1 min-w-[180px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading || !newPhoneNumber.trim()}
                      className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "..." : "Envoyer le code"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddPhone}
                      className="px-3 py-3 min-h-[48px] text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    >
                      Annuler
                    </button>
                  </form>
                )}

                {addPhoneStep === "sent" && (
                  <div className="space-y-2">
                    <form onSubmit={handleVerifyNewPhone} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        maxLength={6}
                        value={newPhoneOtpToken}
                        onChange={(e) => setNewPhoneOtpToken(e.target.value.replace(/\D/g, ""))}
                        placeholder="Code à 6 chiffres"
                        className="flex-1 min-w-[140px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm tracking-[0.3em] text-center focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={loading || newPhoneOtpToken.length !== 6}
                        className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? "..." : "Confirmer"}
                      </button>
                    </form>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleChangeNewPhoneNumber}
                        className="px-3 py-2 min-h-[48px] text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      >
                        Changer le numéro
                      </button>
                      <button
                        type="button"
                        onClick={handleResendNewPhone}
                        disabled={loading || resendCooldown > 0}
                        className="px-3 py-2 min-h-[48px] text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer le code"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAddPhone}
                        className="px-3 py-2 min-h-[48px] text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {!phoneConfirmed && hasPhone && phoneConfirmStep === "sent" && (
                  <form onSubmit={handleVerifyPhoneConfirmation} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      maxLength={6}
                      value={phoneOtpToken}
                      onChange={(e) => setPhoneOtpToken(e.target.value.replace(/\D/g, ""))}
                      placeholder="Code à 6 chiffres"
                      className="flex-1 min-w-[140px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm tracking-[0.3em] text-center focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading || phoneOtpToken.length !== 6}
                      className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                    >
                      Valider
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* --- Ligne E-mail --- */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow("email")}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  E-mail
                  {hasEmail && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${emailConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {emailConfirmed ? "Confirmé" : "Non confirmé"}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-900 font-medium mt-0.5 truncate">
                  {hasEmail ? maskEmailOwn(userSession?.user?.email) : <span className="text-gray-400 italic font-normal">Aucune adresse</span>}
                </p>
              </div>
              <i className={`fa-solid fa-chevron-${expandedRow === "email" ? "up" : "down"} text-gray-300 text-xs shrink-0`}></i>
            </button>

            {expandedRow === "email" && (
              <div className="px-5 pb-5 space-y-3">
                {hasEmail && addEmailStep === "idle" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {!emailConfirmed && (
                      <button
                        type="button"
                        onClick={handleResendEmailConfirmation}
                        disabled={loading}
                        className="px-3 py-2 min-h-[48px] bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStartChangeEmail}
                      disabled={loading}
                      className="px-3 py-2 min-h-[48px] bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition cursor-pointer disabled:opacity-50"
                    >
                      Changer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestUnlink("email")}
                      disabled={loading}
                      className="px-3 py-2 min-h-[48px] bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Dissocier
                    </button>
                  </div>
                )}

                {!hasEmail && addEmailStep === "idle" && (
                  <button
                    type="button"
                    onClick={handleStartAddEmail}
                    className="px-3 py-2 min-h-[48px] bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Ajouter une adresse
                  </button>
                )}

                {addEmailStep === "form" && (
                  <form onSubmit={handleSendNewEmail} className="flex items-center gap-2 flex-wrap">
                    <input
                      type="email"
                      inputMode="email"
                      value={newEmailAddress}
                      onChange={(e) => setNewEmailAddress(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="flex-1 min-w-[180px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading || !newEmailAddress.trim()}
                      className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "..." : "Envoyer le code"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddEmail}
                      className="px-3 py-3 min-h-[48px] text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    >
                      Annuler
                    </button>
                  </form>
                )}

                {addEmailStep === "sent" && (
                  <div className="space-y-2">
                    <form onSubmit={handleVerifyNewEmail} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        maxLength={6}
                        value={newEmailOtpToken}
                        onChange={(e) => setNewEmailOtpToken(e.target.value.replace(/\D/g, ""))}
                        placeholder="Code à 6 chiffres"
                        className="flex-1 min-w-[140px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm tracking-[0.3em] text-center focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={loading || newEmailOtpToken.length !== 6}
                        className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? "..." : "Confirmer"}
                      </button>
                    </form>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleChangeNewEmailAddress}
                        className="px-3 py-2 min-h-[48px] text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      >
                        Changer l'adresse
                      </button>
                      <button
                        type="button"
                        onClick={handleResendNewEmail}
                        disabled={loading || emailResendCooldown > 0}
                        className="px-3 py-2 min-h-[48px] text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        {emailResendCooldown > 0 ? `Renvoyer dans ${emailResendCooldown}s` : "Renvoyer le code"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAddEmail}
                        className="px-3 py-2 min-h-[48px] text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- Ligne Date de naissance --- */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow("birthdate")}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700">Date de naissance</p>
                <p className="text-sm text-gray-900 font-medium mt-0.5">
                  {formatBirthDateDisplay(profileBirthDate) || <span className="text-gray-400 italic font-normal">Non renseignée</span>}
                </p>
              </div>
              <i className={`fa-solid fa-chevron-${expandedRow === "birthdate" ? "up" : "down"} text-gray-300 text-xs shrink-0`}></i>
            </button>

            {expandedRow === "birthdate" && (
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Jour</option>
                    {BIRTH_DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Mois</option>
                    {BIRTH_MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Année</option>
                    {BIRTH_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleSaveBirthDate}
                  disabled={loading}
                  className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "..." : "Enregistrer"}
                </button>
              </div>
            )}
          </div>

          {/* --- Ligne Région / Pays --- */}
          <div>
            <button
              type="button"
              onClick={() => toggleRow("country")}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700">Région / Pays</p>
                <p className="text-sm text-gray-900 font-medium mt-0.5">
                  {profileCountry || <span className="text-gray-400 italic font-normal">Non renseignée</span>}
                </p>
              </div>
              <i className={`fa-solid fa-chevron-${expandedRow === "country" ? "up" : "down"} text-gray-300 text-xs shrink-0`}></i>
            </button>

            {expandedRow === "country" && (
              <div className="px-5 pb-5">
                <select
                  value={profileCountry}
                  onChange={(e) => handleSaveCountry(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">Sélectionner...</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2 — Mot de passe */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-key text-blue-600"></i>
          {hasPasswordIdentity ? "Changer le mot de passe" : "Créer un mot de passe"}
        </h4>

        {hasPasswordIdentity ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {!skipCurrentPassword && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Requis pour confirmer que c'est bien vous"
                  className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                  required
                />
              </div>
            )}
            {skipCurrentPassword && (
              <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                Vous venez de vous authentifier par code — pas besoin de ressaisir un ancien mot de passe.
              </p>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmez"
                className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreatePassword} className="space-y-4">
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              Ce compte n'a pas encore de mot de passe (connexion Google ou téléphone). Vous pourrez ensuite
              aussi vous connecter avec un mot de passe.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                required
                autoFocus
              />
            </div>
            <ul className="space-y-1">
              {passwordRules.map((rule) => {
                const ok = rule.test(newPassword);
                return (
                  <li key={rule.label} className={`text-[11px] font-semibold flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-gray-400"}`}>
                    <i className={`fa-solid ${ok ? "fa-circle-check" : "fa-circle"} text-[10px]`}></i>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmez"
                className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !passwordRules.every((r) => r.test(newPassword))}
              className="px-4 py-3 min-h-[48px] bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Création..." : "Créer le mot de passe"}
            </button>
          </form>
        )}
      </div>

      {/* SECTION 3 — Désactiver le compte */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-1 flex items-center gap-2">
          <i className="fa-solid fa-power-off text-amber-600"></i>
          Désactiver le compte
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Ton profil sera masqué et la connexion bloquée. Réversible à tout moment en te reconnectant.
        </p>
        <button
          type="button"
          onClick={() => setShowDeactivateModal(true)}
          className="px-4 py-3 min-h-[48px] bg-amber-50 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition cursor-pointer"
        >
          Désactiver mon compte
        </button>
      </div>

      {/* Modale de confirmation avant désactivation */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-[950] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeactivateModal(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-extrabold text-gray-900">Désactiver ton compte ?</h4>
            <p className="text-xs text-gray-500">
              Ton profil sera masqué. Tu pourras réactiver à tout moment en te reconnectant.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-3 min-h-[48px] text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeactivateAccount}
                disabled={loading}
                className="px-4 py-3 min-h-[48px] bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "..." : "Désactiver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation avant dissociation */}
      {unlinkTarget && (
        <div className="fixed inset-0 z-[950] bg-black/50 flex items-center justify-center p-4" onClick={() => setUnlinkTarget(null)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-extrabold text-gray-900">
              Dissocier votre {unlinkTarget === "email" ? "e-mail" : "numéro de téléphone"} ?
            </h4>
            <p className="text-xs text-gray-500">
              Vous ne pourrez plus vous connecter avec ce moyen. Cette action est irréversible.
            </p>
            {!skipCurrentPassword && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={unlinkPassword}
                  onChange={(e) => setUnlinkPassword(e.target.value)}
                  placeholder="Confirmez avec votre mot de passe"
                  className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-gray-50"
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setUnlinkTarget(null)}
                className="px-4 py-3 min-h-[48px] text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={loading}
                className="px-4 py-3 min-h-[48px] bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "..." : "Dissocier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
