/* Éclats Éternels — données du jeu (équilibrage) */
'use strict';

window.EE_DATA = {
  MAP: 24,

  RES: {
    gold: { name: 'Or', icon: '🪙' },
    food: { name: 'Nourriture', icon: '🍖' },
    wood: { name: 'Bois', icon: '🪵' },
    stone: { name: 'Pierre', icon: '🪨' },
    gems: { name: 'Éclats', icon: '💎' },
  },

  START: { gold: 250, food: 60, wood: 40, stone: 10, gems: 5 },

  // max : nombre autorisé selon le niveau du joueur (index 0 = niveau 1)
  BUILDINGS: {
    castle: {
      name: "Citadelle d'éclat", icon: '🏰', size: 3, h: 100, cat: 'none',
      desc: 'Le cœur de ton royaume. Son cristal repousse les Ombres.',
      produce: { res: 'gold', amount: 15, time: 30 }, storage: 1000, pop: 5,
    },
    house: {
      name: 'Chaumière', icon: '🏠', size: 2, h: 50, cat: 'prod',
      desc: 'Tes habitants paient un impôt en or et rejoignent ton armée.',
      cost: { gold: 50 }, time: 8, xp: 10, pop: 3,
      produce: { res: 'gold', amount: 20, time: 60 },
      max: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
    farm: {
      name: 'Champ', icon: '🌾', size: 2, h: 14, cat: 'prod',
      desc: 'Nourrit tes soldats.',
      cost: { gold: 30 }, time: 5, xp: 8,
      produce: { res: 'food', amount: 30, time: 50 },
      max: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
    lumber: {
      name: 'Scierie', icon: '🪓', size: 2, h: 48, cat: 'prod',
      desc: 'Transforme les arbres de l’île en planches.',
      cost: { gold: 90 }, time: 15, xp: 15,
      produce: { res: 'wood', amount: 20, time: 70 },
      max: [0, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    },
    quarry: {
      name: 'Carrière', icon: '⛏️', size: 2, h: 22, cat: 'prod',
      desc: 'Extrait la pierre des profondeurs de l’île.',
      cost: { gold: 140, wood: 40 }, time: 20, xp: 20,
      produce: { res: 'stone', amount: 15, time: 90 },
      max: [0, 0, 1, 2, 2, 3, 3, 4, 4, 5],
    },
    storage: {
      name: 'Entrepôt', icon: '📦', size: 2, h: 50, cat: 'prod',
      desc: 'Augmente la quantité de ressources que tu peux stocker.',
      cost: { gold: 200, wood: 80, stone: 30 }, time: 30, xp: 30, storage: 1500,
      max: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
    },
    shrine: {
      name: "Sanctuaire d'éclats", icon: '💠', size: 2, h: 70, cat: 'prod',
      desc: 'Fait naître de précieux éclats de cristal.',
      cost: { gold: 600, wood: 150, stone: 150 }, time: 60, xp: 60,
      produce: { res: 'gems', amount: 1, time: 300 },
      max: [0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
    },
    barracks: {
      name: 'Caserne', icon: '⚔️', size: 3, h: 60, cat: 'war',
      desc: 'Entraîne les soldats qui chasseront les Ombres.',
      cost: { gold: 150, wood: 50 }, time: 25, xp: 30, trains: true,
      max: [0, 1, 1, 1, 2, 2, 2, 3, 3, 3],
    },
    tower: {
      name: 'Tour de guet', icon: '🗼', size: 1, h: 80, cat: 'war',
      desc: 'Chaque tour donne +5 % d’attaque à ton armée.',
      cost: { gold: 150, stone: 60 }, time: 20, xp: 25, bonus: 0.05,
      max: [0, 0, 0, 2, 2, 3, 3, 4, 4, 4],
    },
    flowers: {
      name: 'Massif de fleurs', icon: '🌷', size: 1, h: 10, cat: 'deco',
      desc: 'Embellit ton royaume.',
      cost: { gold: 15 }, time: 1, xp: 4,
      max: [30],
    },
    fountain: {
      name: 'Fontaine', icon: '⛲', size: 1, h: 30, cat: 'deco',
      desc: 'L’eau claire chante sur la place.',
      cost: { gold: 60 }, time: 3, xp: 12,
      max: [20],
    },
    statue: {
      name: 'Statue de cristal', icon: '🔮', size: 1, h: 50, cat: 'deco',
      desc: 'Un éclat sculpté qui brille même la nuit.',
      cost: { gold: 250, stone: 60 }, time: 10, xp: 45,
      max: [0, 0, 0, 5],
    },
  },

  UNITS: {
    squire: { name: 'Écuyer', icon: '🛡️', atk: 5, hp: 30, cost: { food: 20, gold: 15 }, time: 6, unlock: 2 },
    archer: { name: 'Archère', icon: '🏹', atk: 9, hp: 22, cost: { food: 25, gold: 30, wood: 10 }, time: 10, unlock: 3 },
    knight: { name: 'Chevalier', icon: '🐎', atk: 14, hp: 80, cost: { food: 60, gold: 70, stone: 10 }, time: 18, unlock: 4 },
    mage: { name: "Mage d'éclat", icon: '🔮', atk: 30, hp: 35, cost: { food: 50, gold: 120, stone: 20 }, time: 25, unlock: 5 },
  },

  CAMPS: [
    { name: "Rôdeurs d'ombre", icon: '👺', gx: 4, gy: 15, atk: 6, hp: 60, loot: { gold: 150, wood: 40 }, gems: 2, xp: 40,
      desc: 'Des bandits corrompus par les Ombres qui pillent les champs.' },
    { name: 'Nuée des ailes noires', icon: '🦇', gx: 17, gy: 5, atk: 14, hp: 160, loot: { gold: 300, wood: 80, stone: 40 }, gems: 3, xp: 80,
      desc: 'Des chauves-souris géantes nichées dans une tour en ruine.' },
    { name: 'Golem de cendre', icon: '👹', gx: 18, gy: 17, atk: 28, hp: 350, loot: { gold: 600, stone: 150 }, gems: 4, xp: 150,
      desc: 'Un colosse de roche brûlante réveillé par un éclat noir.' },
    { name: 'Spectres des brumes', icon: '👻', gx: 2, gy: 3, atk: 45, hp: 700, loot: { gold: 1000, food: 300 }, gems: 5, xp: 250,
      desc: 'Des âmes perdues qui glacent le sang des soldats.' },
    { name: 'Seigneur liche', icon: '💀', gx: 3, gy: 20, atk: 75, hp: 1300, loot: { gold: 1800, wood: 400, stone: 400 }, gems: 8, xp: 400,
      desc: 'Un ancien mage qui a vendu son âme aux Ombres.' },
    { name: "Dragon d'obsidienne", icon: '🐉', gx: 20, gy: 1, atk: 130, hp: 2600, loot: { gold: 4000 }, gems: 20, xp: 800,
      desc: 'La source de la corruption. Il dort sur un trésor d’éclats noirs.' },
  ],

  CLEAR: {
    tree: { name: 'Arbre', cost: { gold: 10 }, gain: { wood: 20 }, xp: 3, verb: 'Abattre' },
    rock: { name: 'Rocher', cost: { gold: 25 }, gain: { stone: 20 }, xp: 4, verb: 'Briser' },
  },
};
