const { test, expect } = require("@playwright/test");
const { scrubSentryEvent } = require("../../src/lib/sentryScrub");
const { isCriticalSentryEvent } = require("../../src/lib/sentryAlert");

/**
 * Vérifie que beforeSend (sentry.server.config.js / sentry.edge.config.js)
 * retire toute donnée sensible AVANT tout envoi réel à Sentry — en
 * particulier pour /api/profil/scan-identity-document, où une exception
 * non gérée pendant le traitement d'une pièce d'identité ne doit jamais
 * faire fuiter l'image ni les champs nom/prénom/quartier extraits, même
 * accidentellement joints au contexte d'erreur.
 *
 * Test de la fonction pure scrubSentryEvent() directement (aucun appel
 * réseau, aucun SDK Sentry réellement initialisé) : reproduit la forme
 * d'un événement Sentry réel plutôt que de dépendre d'un DSN de test.
 */
test.describe("Scrubbing Sentry — pièce d'identité", () => {
  test("retire le corps de requête, cookies et headers d'authentification", () => {
    const event = {
      request: {
        url: "https://ffacilite.com/api/profil/scan-identity-document",
        method: "POST",
        data: "------WebKitFormBoundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cni.jpg\"\r\n\r\n<octets image CNI>",
        cookies: "sb-access-token=eyJ...",
        headers: {
          authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.fake.token",
          cookie: "sb-refresh-token=abc123",
          "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request.data).toBeUndefined();
    expect(scrubbed.request.cookies).toBeUndefined();
    expect(scrubbed.request.headers.authorization).toBeUndefined();
    expect(scrubbed.request.headers.cookie).toBeUndefined();
    // Les métadonnées non sensibles (URL, méthode, content-type) restent —
    // le scrubbing est ciblé, pas un vidage aveugle de tout event.request.
    expect(scrubbed.request.url).toBe("https://ffacilite.com/api/profil/scan-identity-document");
    expect(scrubbed.request.method).toBe("POST");
    expect(scrubbed.request.headers["content-type"]).toBe("multipart/form-data; boundary=----WebKitFormBoundary");
  });

  test("retire les champs extra dont le nom évoque une donnée d'identité, même joints par erreur", () => {
    // Reproduit ce qui pourrait fuiter si une exception dans
    // extractIdentityFieldsWithGemini() ou la route associée attachait par
    // erreur son contexte d'erreur à event.extra.
    const event = {
      extra: {
        nom: "DIOP",
        prenom: "Awa",
        quartier: "Grand Yoff",
        fileBuffer: Buffer.from("donnee-image-brute"),
        imageMimeType: "image/jpeg", // non sensible en soi, mais capturé par le motif "image"
        requestId: "req_9f3a21", // doit survivre : pas un fragment sensible
        durationMs: 842, // doit survivre
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.extra.nom).toBeUndefined();
    expect(scrubbed.extra.prenom).toBeUndefined();
    expect(scrubbed.extra.quartier).toBeUndefined();
    expect(scrubbed.extra.fileBuffer).toBeUndefined();
    expect(scrubbed.extra.imageMimeType).toBeUndefined();
    expect(scrubbed.extra.requestId).toBe("req_9f3a21");
    expect(scrubbed.extra.durationMs).toBe(842);
  });

  test("scénario réaliste : exception pendant le scan d'une CNI, aucune trace de l'image ni des champs extraits dans l'événement scrubbé", () => {
    const event = {
      request: {
        url: "https://ffacilite.com/api/profil/scan-identity-document",
        method: "POST",
        data: Buffer.from("<octets JPEG de la CNI>").toString("base64"),
        headers: { authorization: "Bearer session-utilisateur-reelle" },
      },
      extra: {
        isIdentityDocument: true,
        nom: "SAMAKE",
        prenom: "Macoumba",
        quartier: "Parcelles Assainies",
        bufferLength: 284213,
      },
      exception: {
        values: [{ type: "TypeError", value: "Cannot read properties of undefined" }],
      },
    };

    const scrubbed = scrubSentryEvent(event);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain("SAMAKE");
    expect(serialized).not.toContain("Macoumba");
    expect(serialized).not.toContain("Parcelles Assainies");
    expect(serialized).not.toContain("session-utilisateur-reelle");
    expect(serialized).not.toContain("octets JPEG");
    // Le diagnostic technique reste exploitable — le scrubbing ne doit pas
    // rendre Sentry inutile pour déboguer une vraie panne.
    expect(scrubbed.exception.values[0].type).toBe("TypeError");
  });

  test("ne plante jamais sur un événement sans request/extra (garde-fou defensif)", () => {
    expect(() => scrubSentryEvent({})).not.toThrow();
    expect(() => scrubSentryEvent(null)).not.toThrow();
    expect(scrubSentryEvent(null)).toBeNull();
  });
});

test.describe("Scrubbing Sentry — élargi au-delà de la pièce d'identité (2026-08-23)", () => {
  test("retire coordonnées de contact, secrets et contenu utilisateur dans event.extra", () => {
    const event = {
      extra: {
        email: "candidat@example.com",
        phone: "+221771234567",
        password: "hunter2",
        authToken: "eyJhbGciOiJIUzI1NiJ9.fake",
        coverLetter: "Madame, Monsieur, je vous écris...",
        resumeContent: "CV complet du candidat...",
        cardNumber: "4111111111111111",
        // Doit survivre : pas un fragment sensible
        statusCode: 502,
        provider: "kpay",
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.extra.email).toBeUndefined();
    expect(scrubbed.extra.phone).toBeUndefined();
    expect(scrubbed.extra.password).toBeUndefined();
    expect(scrubbed.extra.authToken).toBeUndefined();
    expect(scrubbed.extra.coverLetter).toBeUndefined();
    expect(scrubbed.extra.resumeContent).toBeUndefined();
    expect(scrubbed.extra.cardNumber).toBeUndefined();
    expect(scrubbed.extra.statusCode).toBe(502);
    expect(scrubbed.extra.provider).toBe("kpay");
  });

  test("limite connue et assumée : un champ nommé juste 'content' ou 'message' n'est PAS scrubbé", () => {
    // "message"/"content" seuls sont volontairement exclus des fragments
    // (voir sentryScrub.js) : trop génériques, ils supprimeraient aussi des
    // clés de diagnostic non sensibles (errorMessage, contentType...).
    // Défense en profondeur, pas la protection primaire : sendDefaultPii et
    // l'absence de tout Sentry.captureException explicite dans ce dépôt
    // (confirmé par grep) restent la vraie garde contre une fuite de
    // contenu de message/CV brut.
    const event = { extra: { content: "texte non capturé par le motif générique" } };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.extra.content).toBeDefined();
  });

  test("ne supprime pas les clés de diagnostic génériques utiles (errorMessage, contentType)", () => {
    // "message"/"content" ont été délibérément exclus des fragments
    // sensibles : trop génériques, ils auraient aussi supprimé ces champs
    // de diagnostic non sensibles.
    const event = {
      extra: {
        errorMessage: "Cannot read properties of undefined",
        contentType: "application/json",
      },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.extra.errorMessage).toBe("Cannot read properties of undefined");
    expect(scrubbed.extra.contentType).toBe("application/json");
  });

  test("scrubbe aussi event.user et event.contexts, pas seulement event.extra", () => {
    const event = {
      user: { id: "uuid-123", email: "candidat@example.com" },
      contexts: { runtime: { name: "node", phone: "+221771234567" } },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.user.id).toBe("uuid-123");
    expect(scrubbed.user.email).toBeUndefined();
    expect(scrubbed.contexts.runtime.name).toBe("node");
    expect(scrubbed.contexts.runtime.phone).toBeUndefined();
  });
});

test.describe("Alerte critique — classification (2026-08-23)", () => {
  test("une exception capturée automatiquement (onRequestError) est critique", () => {
    const event = { exception: { values: [{ type: "TypeError", value: "boom" }] } };
    expect(isCriticalSentryEvent(event)).toBe(true);
  });

  test("un message explicitement tagué critical est critique", () => {
    const event = { message: "[Webhook KPay] Signature invalide", tags: { critical: "true" } };
    expect(isCriticalSentryEvent(event)).toBe(true);
  });

  test("un événement ordinaire (ni exception, ni tag critical) n'est pas critique", () => {
    expect(isCriticalSentryEvent({ message: "info banale" })).toBe(false);
    expect(isCriticalSentryEvent({})).toBe(false);
    expect(isCriticalSentryEvent(null)).toBe(false);
  });
});
