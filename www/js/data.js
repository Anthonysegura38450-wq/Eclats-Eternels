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
    den: {
      name: 'Antre des créatures', icon: '🥚', size: 3, h: 60, cat: 'war',
      desc: 'Invoque et abrite des créatures magiques. Chaque Antre donne +6 places dans ton armée.',
      cost: { gold: 400, wood: 120, stone: 80 }, time: 40, xp: 40, summons: true, pop: 6,
      max: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3],
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

    // --- Créatures (invoquées à l'Antre). pop = places occupées dans l'armée ; req = repaire à vaincre avant ---
    rabbit: { monster: true, rarity: 'common', name: 'Lapin-éclair', icon: '🐇', atk: 12, hp: 40, pop: 2, cost: { food: 60, gold: 50 }, time: 20, unlock: 3,
      desc: 'Si rapide qu’il laisse une traînée d’étincelles.' },
    shroom: { monster: true, rarity: 'common', name: 'Champignon sauteur', icon: '🍄', atk: 8, hp: 75, pop: 2, cost: { food: 50, gold: 60 }, time: 20, unlock: 3,
      desc: 'Rebondit sur ses ennemis et encaisse les coups.' },
    ladybug: { monster: true, rarity: 'common', name: 'Coccinelle titan', icon: '🐞', atk: 11, hp: 60, pop: 2, cost: { food: 70, gold: 60 }, time: 25, unlock: 3,
      desc: 'Sa carapace porte bonheur… sauf aux Ombres.' },
    wolf: { monster: true, rarity: 'rare', name: "Loup d'aurore", icon: '🐺', atk: 24, hp: 95, pop: 3, cost: { food: 140, gold: 150 }, time: 45, unlock: 4,
      desc: 'Il hurle quand le soleil se lève sur l’île.' },
    owl: { monster: true, rarity: 'rare', name: 'Hibou des étoiles', icon: '🦉', atk: 30, hp: 60, pop: 3, cost: { food: 120, gold: 180 }, time: 45, unlock: 4,
      desc: 'Ses plumes reflètent la voie lactée.' },
    turtle: { monster: true, rarity: 'rare', name: 'Tortue-rocher', icon: '🐢', atk: 12, hp: 240, pop: 3, cost: { food: 150, gold: 120, stone: 60 }, time: 50, unlock: 4,
      desc: 'Une forteresse vivante. Rien ne la fait reculer.' },
    bat: { monster: true, rarity: 'rare', name: 'Chauve-souris apprivoisée', icon: '🦇', atk: 26, hp: 70, pop: 3, cost: { food: 120, gold: 140 }, time: 40, unlock: 3, req: 1,
      desc: 'Une ancienne servante des Ombres, libérée par ta victoire.' },
    unicorn: { monster: true, rarity: 'epic', name: "Licorne d'éclat", icon: '🦄', atk: 48, hp: 170, pop: 4, cost: { food: 300, gold: 400, gems: 2 }, time: 90, unlock: 5,
      desc: 'Sa corne est un cristal pur qui soigne ses alliés.' },
    griffin: { monster: true, rarity: 'epic', name: 'Griffon céleste', icon: '🦅', atk: 58, hp: 140, pop: 4, cost: { food: 280, gold: 450, gems: 2 }, time: 90, unlock: 5,
      desc: 'Il fond sur ses proies depuis les nuages.' },
    golem: { monster: true, rarity: 'epic', name: 'Golem apprivoisé', icon: '🗿', atk: 32, hp: 420, pop: 5, cost: { food: 200, gold: 300, stone: 200 }, time: 100, unlock: 4, req: 2,
      desc: 'Le Golem de cendre, purifié, protège désormais ton royaume.' },
    ghost: { monster: true, rarity: 'epic', name: 'Spectre bienveillant', icon: '👻', atk: 62, hp: 110, pop: 4, cost: { food: 250, gold: 400, gems: 3 }, time: 90, unlock: 5, req: 3,
      desc: 'Une âme apaisée qui veut réparer le mal des brumes.' },
    kraken: { monster: true, rarity: 'legend', name: 'Kraken des nuages', icon: '🐙', atk: 95, hp: 320, pop: 6, cost: { food: 600, gold: 900, gems: 6 }, time: 180, unlock: 6,
      desc: 'Il nage dans le ciel et broie les tours ennemies.' },
    dragon: { monster: true, rarity: 'legend', name: 'Dragon de cristal', icon: '🐲', atk: 125, hp: 400, pop: 7, cost: { food: 800, gold: 1200, gems: 8 }, time: 240, unlock: 6, req: 4,
      desc: 'Né d’un éclat éternel, il est l’ennemi juré du Dragon d’obsidienne.' },
  },

  // Œuf mystère : donne une créature au hasard (même une qui n'est pas encore débloquée)
  EGG: { name: 'Œuf mystère', icon: '🥚', cost: { gems: 8 }, time: 60, pop: 2,
    weights: { common: 60, rare: 28, epic: 10, legend: 2 } },

  RARITY: {
    common: { name: 'Commune', color: '#7d8a96' },
    rare: { name: 'Rare', color: '#2f80ed' },
    epic: { name: 'Épique', color: '#9b51e0' },
    legend: { name: 'Légendaire', color: '#e0a100' },
  },

  CAMPS: [
    { name: "Rôdeurs d'ombre", place: 'Île des Ronces', icon: '👺', gx: 4, gy: 15, atk: 6, hp: 60, loot: { gold: 150, wood: 40 }, gems: 2, xp: 40,
      desc: 'Des bandits corrompus par les Ombres qui pillent les champs.' },
    { name: 'Nuée des ailes noires', place: 'Pic des Ailes noires', icon: '🦇', gx: 17, gy: 5, atk: 14, hp: 160, loot: { gold: 300, wood: 80, stone: 40 }, gems: 3, xp: 80,
      desc: 'Des chauves-souris géantes nichées dans une tour en ruine.' },
    { name: 'Golem de cendre', place: 'Forge de Cendre', icon: '👹', gx: 18, gy: 17, atk: 28, hp: 350, loot: { gold: 600, stone: 150 }, gems: 4, xp: 150,
      desc: 'Un colosse de roche brûlante réveillé par un éclat noir.' },
    { name: 'Spectres des brumes', place: 'Îlot des Brumes', icon: '👻', gx: 2, gy: 3, atk: 45, hp: 700, loot: { gold: 1000, food: 300 }, gems: 5, xp: 250,
      desc: 'Des âmes perdues qui glacent le sang des soldats.' },
    { name: 'Seigneur liche', place: 'Nécropole flottante', icon: '💀', gx: 3, gy: 20, atk: 75, hp: 1300, loot: { gold: 1800, wood: 400, stone: 400 }, gems: 8, xp: 400,
      desc: 'Un ancien mage qui a vendu son âme aux Ombres.' },
    { name: "Dragon d'obsidienne", place: "Trône d'Obsidienne", icon: '🐉', gx: 20, gy: 1, atk: 130, hp: 2600, loot: { gold: 4000 }, gems: 20, xp: 800,
      desc: 'La source de la corruption. Il dort sur un trésor d’éclats noirs.' },
  ],

  // Rejouer un repaire déjà libéré : délai de repos (en secondes) et part du butin / de l'XP
  REPLAY: { cooldown: 1200, loot: 0.35, xp: 0.3 },

  CLEAR: {
    tree: { name: 'Arbre', cost: { gold: 10 }, gain: { wood: 20 }, xp: 3, verb: 'Abattre' },
    rock: { name: 'Rocher', cost: { gold: 25 }, gain: { stone: 20 }, xp: 4, verb: 'Briser' },
  },
};
