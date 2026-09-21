const { test, expect } = require("@playwright/test");
const { classerConversationDirecte, repartirConversationsDirectes } = require("../../src/lib/conversationsDirectes.js");

/**
 * Classement pur d'un fil direct (aucun navigateur, aucun réseau) — voir
 * src/lib/conversationsDirectes.js. Cas central : une paire acheteur/vendeur
 * qui partage déjà une candidature (OFFRE) ne doit pas avaler le fil
 * Marketplace ("Discuter sur la plateforme").
 */

const offre = (id = "o1") => ({ id, typeDiscussion: "OFFRE", text: "Candidature envoyée pour le poste : Agent" });
const marche = (id = "m1") => ({ id, typeDiscussion: "MARKETPLACE", text: "Bonjour, l'article est-il disponible ?" });
const echange = (id = "e1") => ({ id, typeDiscussion: "ECHANGE", text: "Bonjour" });

test.describe("classerConversationDirecte", () => {
  test("cas signalé : candidature + clic Discuter sur la plateforme -> fil Marketplace, sans le dossier de candidature", () => {
    const r = classerConversationDirecte({
      messages: [offre()],
      aBoutique: true,
      contexteMarketplace: true,
      ouvertePourMarketplace: true,
    });
    expect(r.estMarketplace).toBe(true);
    expect(r.typeDiscussion).toBe("MARKETPLACE");
    expect(r.messages).toEqual([]);
  });

  test("candidature + échanges Marketplace déjà envoyés : en contexte Marketplace, seuls les échanges Marketplace restent", () => {
    const r = classerConversationDirecte({
      messages: [offre(), marche("m1"), marche("m2")],
      aBoutique: true,
      contexteMarketplace: true,
    });
    expect(r.estMarketplace).toBe(true);
    expect(r.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  test("candidature seule, ouverte SANS demande explicite en contexte Marketplace : reste un fil Facilité (pas de bruit dans la liste)", () => {
    const r = classerConversationDirecte({
      messages: [offre()],
      aBoutique: true,
      contexteMarketplace: true,
      ouvertePourMarketplace: false,
    });
    expect(r.estMarketplace).toBe(false);
    expect(r.typeDiscussion).toBe("OFFRE");
    expect(r.messages).toHaveLength(1);
  });

  test("hors contexte Marketplace : la candidature garde la paire côté Facilité, même avec des messages Marketplace", () => {
    const r = classerConversationDirecte({
      messages: [offre(), marche()],
      aBoutique: true,
      contexteMarketplace: false,
    });
    expect(r.estMarketplace).toBe(false);
    expect(r.typeDiscussion).toBe("OFFRE");
    expect(r.messages).toHaveLength(2);
  });

  test("premier contact : conversation vide avec un propriétaire de boutique -> Marketplace (règle historique)", () => {
    const r = classerConversationDirecte({ messages: [], aBoutique: true });
    expect(r.estMarketplace).toBe(true);
    expect(r.typeDiscussion).toBe("MARKETPLACE");
  });

  test("premier contact demandé explicitement, autre partie sans boutique connue : fil Marketplace quand même", () => {
    const r = classerConversationDirecte({
      messages: [],
      aBoutique: false,
      contexteMarketplace: true,
      ouvertePourMarketplace: true,
    });
    expect(r.estMarketplace).toBe(true);
  });

  test("conversation vide sans boutique : échange ordinaire", () => {
    const r = classerConversationDirecte({ messages: [], aBoutique: false });
    expect(r.estMarketplace).toBe(false);
    expect(r.typeDiscussion).toBe("ECHANGE");
  });

  test("échanges Marketplace sans candidature : Marketplace, messages intacts", () => {
    const msgs = [marche("m1"), marche("m2")];
    const r = classerConversationDirecte({ messages: msgs, aBoutique: true });
    expect(r.estMarketplace).toBe(true);
    expect(r.messages).toEqual(msgs);
  });

  test("échanges ordinaires sans candidature ni Marketplace : ECHANGE, messages intacts", () => {
    const msgs = [echange()];
    const r = classerConversationDirecte({ messages: msgs, aBoutique: true });
    expect(r.estMarketplace).toBe(false);
    expect(r.typeDiscussion).toBe("ECHANGE");
    expect(r.messages).toEqual(msgs);
  });

  test("ne modifie jamais le tableau d'origine (la candidature reste intacte)", () => {
    const msgs = [offre(), marche()];
    const copie = JSON.parse(JSON.stringify(msgs));
    classerConversationDirecte({ messages: msgs, aBoutique: true, contexteMarketplace: true, ouvertePourMarketplace: true });
    expect(msgs).toEqual(copie);
  });
});

/**
 * Répartition fils directs / Support. Cas signalé : le client (ou le vendeur)
 * était le compte admin -> "Aucun échange Marketplace" alors qu'un message
 * avait été reçu ; il n'apparaissait que dans "Discussions" (fil Support).
 */
const MOI = "user-moi";
const ADMIN = "user-admin";
const AUTRE = "user-autre";
const conv = (id, autre) => ({ id, user_1_id: MOI, user_2_id: autre });
const msg = (id, conversationId, typeDiscussion) => ({ id, conversationId, typeDiscussion });

test.describe("repartirConversationsDirectes", () => {
  test("cas signalé : échange MARKETPLACE avec l'admin -> fil direct, retiré du Support", () => {
    const messages = [msg("a", "c-admin", "MARKETPLACE")];
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c-admin", ADMIN)],
      messages,
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.conversationsDirectes.map((c) => c.id)).toEqual(["c-admin"]);
    expect(r.messagesDeConversation({ id: "c-admin" }).map((m) => m.id)).toEqual(["a"]);
    expect(r.messagesSupport).toEqual([]);
  });

  test("paire avec l'admin mêlant Support et Marketplace : le Support garde ses messages, le fil direct n'a que le Marketplace", () => {
    const messages = [msg("s1", "c-admin", "SUPPORT"), msg("m1", "c-admin", "MARKETPLACE"), msg("e1", "c-admin", "ECHANGE")];
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c-admin", ADMIN)],
      messages,
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.messagesDeConversation({ id: "c-admin" }).map((m) => m.id)).toEqual(["m1"]);
    expect(r.messagesSupport.map((m) => m.id)).toEqual(["s1", "e1"]);
  });

  test("conversation avec l'admin SANS échange Marketplace : reste entièrement dans le Support (règle historique)", () => {
    const messages = [msg("s1", "c-admin", "SUPPORT")];
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c-admin", ADMIN)],
      messages,
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.conversationsDirectes).toEqual([]);
    expect(r.messagesSupport.map((m) => m.id)).toEqual(["s1"]);
  });

  test("interlocuteur ordinaire : fil direct complet, aucun de ses messages dans le Support", () => {
    const messages = [msg("m1", "c-autre", "MARKETPLACE"), msg("e1", "c-autre", "ECHANGE")];
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c-autre", AUTRE)],
      messages,
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.conversationsDirectes.map((c) => c.id)).toEqual(["c-autre"]);
    expect(r.messagesDeConversation({ id: "c-autre" }).map((m) => m.id)).toEqual(["m1", "e1"]);
    expect(r.messagesSupport).toEqual([]);
  });

  test("les candidatures (OFFRE) ne vont jamais dans le Support", () => {
    const messages = [msg("o1", "c-autre", "OFFRE"), msg("o2", null, "OFFRE"), msg("s1", null, "SUPPORT")];
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c-autre", AUTRE)],
      messages,
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.messagesSupport.map((m) => m.id)).toEqual(["s1"]);
  });

  test("aucun admin résolu : toutes les conversations avec un tiers sont des fils directs", () => {
    const r = repartirConversationsDirectes({
      mesConversations: [conv("c1", ADMIN), conv("c2", AUTRE)],
      messages: [],
      userId: MOI,
      adminId: null,
    });
    expect(r.conversationsDirectes.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  test("l'utilisateur peut être user_1 ou user_2 de la ligne", () => {
    const inverse = { id: "c-admin", user_1_id: ADMIN, user_2_id: MOI };
    const r = repartirConversationsDirectes({
      mesConversations: [inverse],
      messages: [msg("a", "c-admin", "MARKETPLACE")],
      userId: MOI,
      adminId: ADMIN,
    });
    expect(r.conversationsDirectes.map((c) => c.id)).toEqual(["c-admin"]);
  });
});
