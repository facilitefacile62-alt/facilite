const { test, expect } = require("@playwright/test");
const { classerConversationDirecte } = require("../../src/lib/conversationsDirectes.js");

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
