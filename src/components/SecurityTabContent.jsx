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
// Exporté : réutilisé tel quel par PhoneSignupEmailPrompt.jsx (même appel
// updateUser({email}), même erreurs possibles), plutôt que dupliqué.
export function extractSendEmailErrorMessage(err) {
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

export default function SecurityTabContent({ userSession, intentCandidature = false }) {
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
  // uniquement) tant qu'aucune identité 'email' n'est liée. Vérifié côté
  // serveur (/api/auth/has-password, service_role), jamais en se fiant à
  // user.identities côté client — un navigateur peut refléter un état
  // périmé (session mise en cache) et faire passer un compte réellement
  // sans mot de passe pour "en a un", lui présentant un champ "Mot de passe
  // actuel" qu'il ne peut jamais remplir. null = résultat pas encore connu :
  // n'affiche aucun des deux formulaires plutôt que de deviner.
  const [hasPasswordIdentity, setHasPasswordIdentity] = useState(null);

  // Identifiants
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  // Date de naissance / région — stockées dans public.profiles, jamais
  // exposées à une vue ou fonction accessible aux recruteurs (vérifié :
  // get_candidats_recherche/get_profils_publics n'y font pas référence).
  const [profileBirthDate, setProfileBirthDate] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profileDeletedAt, setProfileDeletedAt] = useState(null);
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  useEffect(() => {
    if (!userSession?.user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("country, date_naissance, deleted_at")
      .eq("id", userSession.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProfileCountry(data.country || "");
        setProfileBirthDate(data.date_naissance || "");
        setProfileDeletedAt(data.deleted_at || null);
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

  // Désactivation du compte (self-service, réversible en se reconnectant —
  // voir reactivate_own_account_if_self_suspended() et middleware.js).
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Suppression du compte (30 jours, annulable en se reconnectant — voir
  // request_own_account_deletion()/cancel_own_account_deletion() et
  // /api/auth/confirm-after-login). Confirmation forte : mot de passe si le
  // compte en a un, sinon code envoyé au téléphone/e-mail déjà confirmé.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOtpStep, setDeleteOtpStep] = useState("idle"); // idle | sent
  const [deleteOtpToken, setDeleteOtpToken] = useState("");
  const [deleteOtpChannel, setDeleteOtpChannel] = useState(null); // "phone" | "email"

  const syncFromUser = (user) => {
    setHasEmail(!!user?.email);
    setHasPhone(!!user?.phone);
    setEmailConfirmed(!!user?.email_confirmed_at);
    setPhoneConfirmed(!!user?.phone_confirmed_at);
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

  // Arrivée depuis ApplyModal.jsx (?intent=candidature, voir profil/page.js)
  // : la ligne email s'ouvre directement, sans clic supplémentaire — la
  // bannière ci-dessous explique déjà pourquoi.
  useEffect(() => {
    if (intentCandidature) {
      queueMicrotask(() => setExpandedRow("email"));
    }
  }, [intentCandidature]);

  // "A un mot de passe ou non" décidé côté serveur (/api/auth/has-password,
  // service_role) — jamais déduit de user.identities côté client, qui peut
  // refléter un état périmé le temps qu'un changement d'identité se
  // propage. Tant que ce n'est pas revenu (null), aucun des deux
  // formulaires n'est affiché plutôt que de deviner.
  useEffect(() => {
    if (!userSession?.access_token) return;
    let cancelled = false;
    fetch("/api/auth/has-password", {
      headers: { Authorization: `Bearer ${userSession.access_token}` },
    })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && typeof body?.hasPassword === "boolean") {
          setHasPasswordIdentity(body.hasPassword);
        }
      })
      .catch((err) => console.warn("[Sécurité] Échec de la vérification du mot de passe :", err.message));
    return () => {
      cancelled = true;
    };
  }, [userSession?.access_token]);

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

  const handleOpenDeleteModal = () => {
    setError("");
    setMessage("");
    setDeletePassword("");
    setDeleteOtpStep("idle");
    setDeleteOtpToken("");
    setDeleteOtpChannel(null);
    setShowDeleteModal(true);
  };

  // Confirmation forte pour un compte SANS mot de passe : renvoie un code au
  // canal déjà confirmé (téléphone en priorité, sinon e-mail) — jamais un
  // nouveau canal, uniquement pour prouver que c'est bien le titulaire.
  const handleSendDeleteOtp = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      if (user.phone && user.phone_confirmed_at) {
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone: user.phone });
        if (otpError) throw otpError;
        setDeleteOtpChannel("phone");
      } else if (user.email && user.email_confirmed_at) {
        const { error: otpError } = await supabase.auth.signInWithOtp({ email: user.email });
        if (otpError) throw otpError;
        setDeleteOtpChannel("email");
      } else {
        throw new Error("Aucun moyen de contact confirmé pour vérifier votre identité.");
      }
      setDeleteOtpStep("sent");
      setMessage("Un code de vérification a été envoyé.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'envoyer le code de vérification.");
    } finally {
      setLoading(false);
    }
  };

  const requestDeletion = async () => {
    const { data: scheduledAt, error: requestError } = await supabase.rpc("request_own_account_deletion");
    if (requestError) throw requestError;
    if (!scheduledAt) throw new Error("Impossible de programmer la suppression.");
    setProfileDeletedAt(scheduledAt);
    setShowDeleteModal(false);
    setMessage(`Suppression programmée pour le ${formatBirthDateDisplay(scheduledAt.slice(0, 10))}. Reconnecte-toi avant cette date pour annuler.`);
  };

  const handleConfirmDeleteWithPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!deletePassword) {
      setError("Veuillez saisir votre mot de passe.");
      return;
    }
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      await reverifyPassword(user, deletePassword);
      await requestDeletion();
      setDeletePassword("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteWithOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (deleteOtpToken.trim().length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: verifyError } = await supabase.auth.verifyOtp(
        deleteOtpChannel === "phone"
          ? { phone: user.phone, token: deleteOtpToken.trim(), type: "sms" }
          : { email: user.email, token: deleteOtpToken.trim(), type: "email" }
      );
      if (verifyError) throw verifyError;
      await requestDeletion();
      setDeleteOtpToken("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data: ok, error: cancelError } = await supabase.rpc("cancel_own_account_deletion");
      if (cancelError) throw cancelError;
      if (!ok) throw new Error("Impossible d'annuler la suppression.");
      setProfileDeletedAt(null);
      setMessage("Suppression annulée. Votre compte reste actif.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de l'annulation.");
    } finally {
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

      {/* Bannière contextuelle — arrivée depuis un "Postuler" bloqué faute
          d'email confirmé (règle du 12/09/2026, voir ApplyModal.jsx et
          supabase/migrations/20260912030000_candidature_email_obligatoire.sql).
          Disparaît d'elle-même une fois l'email confirmé (emailConfirmed
          repasse à true). */}
      {intentCandidature && (!hasEmail || !emailConfirmed) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1.5">
          <p className="text-sm font-extrabold text-blue-900 flex items-center gap-2">
            <span>📧</span>
            <span>Il vous manque un email confirmé pour postuler</span>
          </p>
          <p className="text-xs text-blue-800 font-semibold leading-relaxed">
            Sur Facilité, une adresse email confirmée est obligatoire pour envoyer une candidature.{" "}
            {hasEmail
              ? "Confirmez votre adresse dans « Informations du compte »."
              : "Ajoutez votre adresse email dans « Informations du compte »."}
          </p>
          <p className="text-xs text-blue-700 font-semibold leading-relaxed">
            Dès qu'elle sera confirmée, votre candidature sera envoyée automatiquement — vous n'aurez rien à refaire.
          </p>
        </div>
      )}

      {/* SECTION 1 — Informations du compte */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <h4 className="text-sm font-extrabold text-gray-900 px-5 pt-5 pb-3 flex items-center gap-2">
          <i className="fa-solid fa-id-card text-indigo-600"></i>
          Informations du compte
        </h4>

        <div className="divide-y divide-gray-100">
          {/* --- Téléphone et e-mail : écran unique /informations-compte (règles côté serveur, identiques dans Facilité et Locaux) --- */}
          <div>
            <a
              href="/informations-compte"
              className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <i className="fa-solid fa-address-book text-gray-400 w-5 text-center shrink-0"></i>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">Téléphone et adresse e-mail</p>
                  <p className="text-xs text-gray-500 font-medium">Changer ou retirer, en toute sécurité</p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-300 text-xs shrink-0"></i>
            </a>
          </div>

          {/* --- Ligne Date de naissance --- */}
          <div>
            <button
              type="button"
              onClick={() => !profileBirthDate && toggleRow("birthdate")}
              disabled={Boolean(profileBirthDate)}
              className={`w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[48px] text-left transition ${profileBirthDate ? "cursor-default" : "hover:bg-gray-50 cursor-pointer"}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700">Date de naissance</p>
                <p className="text-sm text-gray-900 font-medium mt-0.5">
                  {formatBirthDateDisplay(profileBirthDate) || <span className="text-gray-400 italic font-normal">Non renseignée</span>}
                </p>
              </div>
              {profileBirthDate ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 shrink-0" title="La date de naissance ne change jamais une fois renseignée">
                  <i className="fa-solid fa-lock text-xs"></i> Non modifiable
                </span>
              ) : (
                <i className={`fa-solid fa-chevron-${expandedRow === "birthdate" ? "up" : "down"} text-gray-300 text-xs shrink-0`}></i>
              )}
            </button>

            {expandedRow === "birthdate" && !profileBirthDate && (
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
          {hasPasswordIdentity === null ? "Mot de passe" : hasPasswordIdentity ? "Changer le mot de passe" : "Créer un mot de passe"}
        </h4>

        {hasPasswordIdentity === null ? (
          <p className="text-xs text-gray-400 italic">Vérification en cours...</p>
        ) : hasPasswordIdentity ? (
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

      {/* SECTION 3 — Supprimer le compte */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-1 flex items-center gap-2">
          <i className="fa-solid fa-trash text-red-600"></i>
          Supprimer le compte définitivement
        </h4>

        {profileDeletedAt ? (
          <div className="space-y-3">
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              Ton compte et toutes tes données seront supprimés le{" "}
              <strong>{formatBirthDateDisplay(profileDeletedAt.slice(0, 10))}</strong>. Tu peux annuler avant cette date.
            </p>
            <button
              type="button"
              onClick={handleCancelDeletion}
              disabled={loading}
              className="px-4 py-3 min-h-[48px] bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "..." : "Annuler la suppression"}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              Irréversible après 30 jours — annulable pendant ce délai en te reconnectant.
            </p>
            <button
              type="button"
              onClick={handleOpenDeleteModal}
              className="px-4 py-3 min-h-[48px] bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition cursor-pointer"
            >
              Supprimer mon compte
            </button>
          </>
        )}
      </div>

      {/* Modale de confirmation avant suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[950] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-extrabold text-gray-900">Supprimer ton compte ?</h4>
            <p className="text-xs text-gray-500">
              Ton compte et toutes tes données seront supprimés dans 30 jours. Tu peux annuler avant cette date.
            </p>

            {hasPasswordIdentity ? (
              <form onSubmit={handleConfirmDeleteWithPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Confirmez avec votre mot de passe"
                    className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-gray-50"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-3 min-h-[48px] text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-3 min-h-[48px] bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "..." : "Supprimer"}
                  </button>
                </div>
              </form>
            ) : deleteOtpStep === "idle" ? (
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-3 min-h-[48px] text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSendDeleteOtp}
                  disabled={loading}
                  className="px-4 py-3 min-h-[48px] bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "..." : "Envoyer un code de vérification"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmDeleteWithOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Code reçu par {deleteOtpChannel === "phone" ? "SMS" : "e-mail"}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={deleteOtpToken}
                    onChange={(e) => setDeleteOtpToken(e.target.value.replace(/\D/g, ""))}
                    placeholder="Code à 6 chiffres"
                    className="w-full px-3 py-3 min-h-[48px] border border-gray-200 rounded-xl text-sm tracking-[0.3em] text-center focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-gray-50"
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-3 min-h-[48px] text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading || deleteOtpToken.length !== 6}
                    className="px-4 py-3 min-h-[48px] bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "..." : "Supprimer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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

    </div>
  );
}
