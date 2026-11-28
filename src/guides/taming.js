// Taming и прокачка питомцев: как растёт Taming, откуда питомец получает полный опыт, что ускоряет прокачку
// (Exp Boost, Beastmaster Crest, Diana, Exp Share, Fann, Carrot Candy), сколько опыта до 100 и выгодно ли качать на продажу.
// Какой питомец нужен для занятия — не здесь, а в таблицах «Питомцы по этапам» гайдов Mining, Farming и др. (pets.js).
// Сверено 28.11.2026 по hypixel-skyblock.fandom.com: Taming, Pets (Leveling, Exp Sharing, Upgrading Rarity),
// Pet Items, Exp Share, Exp Share Core, Pet Food (Pet_Candies), Fann, Kat, George, Beastmaster Crest.
// Опыт до 100 — таблица pet_levels NEU (constants/pets.json), до 200 у драконов — custom_pet_leveling.
import { fmt, short, plural, constants, cell, topNext } from './gathering-util.js';
import { RARITY } from './pets.js';
import { tamingCapPlan, TAMING_MAX_CAP } from '../analysis/pet-score.js';
import { activePerks } from '../calendar/index.js';
import { tx } from '../../i18n/msg.js';

const RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
// Опыт с 1 до 100 уровня по редкости (Mythic как Legendary); драконы идут до 200
export const XP_TO_100 = [5_624_785, 8_644_220, 12_626_665, 18_608_500, 25_353_230, 25_353_230];
export const XP_TO_200 = 214_023_230;
const DRAGONS = new Set(['GOLDEN_DRAGON', 'JADE_DRAGON', 'ROSE_DRAGON']);

// Что умножает опыт питомца (все множители перемножаются)
export const XP_FACTORS = [
  { key: 'taming', name: 'Taming', mult: '×1,01–1,6', text: '+1% за каждый уровень Taming (перк Zoologist)' },
  { key: 'diana', name: 'Diana: Pet XP Buff', mult: '×1,35', text: 'перк мэра Diana, только пока она в должности' },
  { key: 'item', name: 'Exp Boost у питомца', mult: '×1,1–1,5', text: 'предмет питомца; почти все — только для своего скилла' },
  { key: 'crest', name: 'Beastmaster Crest', mult: '×1,001–1,05', text: 'аксессуар; растёт с редкостью и убийствами мифических мобов' },
  { key: 'mf', name: 'Mining и Fishing', mult: '×1,5', text: 'опыт этих двух скиллов качает питомца на 50% быстрее' },
  { key: 'battle', name: 'Battle Experience X', mult: '×1,1', text: 'атрибут, только для опыта Combat' },
  { key: 'reindeer', name: 'Reindeer', mult: '×2', text: 'перк самого питомца: двойной опыт' },
  { key: 'other', name: 'Чужой скилл', mult: '×0,33', text: 'опыт скилла не того типа, что у питомца' },
  { key: 'alch', name: 'Alchemy и Enchanting', mult: '×0,083', text: 'для питомцев не этого типа почти ничего не дают' },
];

// Предметы Exp Boost: бонус к опыту питомца и где взять (Pet Items, 28.11.2026). coins — цена у NPC
export const EXP_BOOSTS = [
  { id: 'PET_ITEM_ALL_SKILLS_BOOST_COMMON', skill: 'ALL', pct: 10, how: 'Zog в Pet Care', coins: 50e3 },
  { id: 'ALL_SKILLS_SUPER_BOOST', skill: 'ALL', pct: 20, how: 'крафт: All Skills Exp Boost, 18 Enchanted Gold Block и Zog Anvil' },
  { id: 'PET_ITEM_FARMING_SKILL_BOOST_COMMON', skill: 'FARMING', pct: 20, how: 'Zog в Pet Care', coins: 60e3 },
  { id: 'PET_ITEM_FARMING_SKILL_BOOST_UNCOMMON', skill: 'FARMING', pct: 30, how: 'награда посетителя Garden Hungry Hiker' },
  { id: 'PET_ITEM_FARMING_SKILL_BOOST_RARE', skill: 'FARMING', pct: 40, how: 'Zog в Pet Care', coins: 500e3 },
  { id: 'PET_ITEM_FARMING_SKILL_BOOST_EPIC', skill: 'FARMING', pct: 50, how: 'Duncan', coins: 1.5e6 },
  { id: 'PET_ITEM_MINING_SKILL_BOOST_COMMON', skill: 'MINING', pct: 20, how: 'Zog в Pet Care', coins: 60e3 },
  { id: 'PET_ITEM_MINING_SKILL_BOOST_UNCOMMON', skill: 'MINING', pct: 30, how: 'Zog в Pet Care', coins: 250e3 },
  { id: 'PET_ITEM_MINING_SKILL_BOOST_RARE', skill: 'MINING', pct: 40, how: 'шанс 20% за участие в Mining Event в Dwarven Mines' },
  { id: 'PET_ITEM_COMBAT_SKILL_BOOST_COMMON', skill: 'COMBAT', pct: 20, how: 'Zog в Pet Care', coins: 60e3 },
  { id: 'PET_ITEM_COMBAT_SKILL_BOOST_UNCOMMON', skill: 'COMBAT', pct: 30, how: 'редкий дроп с Magma Cube' },
  { id: 'PET_ITEM_COMBAT_SKILL_BOOST_RARE', skill: 'COMBAT', pct: 40, how: 'Seer (0,015%), Obsidian Defender (0,01%)' },
  { id: 'PET_ITEM_COMBAT_SKILL_BOOST_EPIC', skill: 'COMBAT', pct: 50, how: 'Seer (0,002%), Obsidian Defender (0,0033%)' },
  { id: 'PET_ITEM_FORAGING_SKILL_BOOST_COMMON', skill: 'FORAGING', pct: 20, how: 'Zog в Pet Care', coins: 60e3 },
  { id: 'PET_ITEM_FORAGING_SKILL_BOOST_EPIC', skill: 'FORAGING', pct: 50, how: 'Ent (0,02%), Soul of the Alpha (0,01%)' },
  { id: 'PET_ITEM_FISHING_SKILL_BOOST_COMMON', skill: 'FISHING', pct: 20, how: 'Zog в Pet Care', coins: 60e3 },
  { id: 'PET_ITEM_FISHING_SKILL_BOOST_UNCOMMON', skill: 'FISHING', pct: 30, how: 'Night Squid (0,5%)' },
  { id: 'PET_ITEM_FISHING_SKILL_BOOST_RARE', skill: 'FISHING', pct: 40, how: 'Night Squid (0,1%), Sea Leech (0,08%)' },
  { id: 'PET_ITEM_FISHING_SKILL_BOOST_EPIC', skill: 'FISHING', pct: 50, how: 'Sea Leech и Deep Sea Protector (0,02%), Water Hydra (0,04%)' },
];
const BOOST_BY_ID = new Map(EXP_BOOSTS.map(b => [b.id, b]));

// Остальные предметы питомцев (Pet Items, 28.11.2026): что дают, где взять и кому подходят.
// Статы в процентах (Claws, Remedies, Textbook, Relic) умножают статы самого питомца, а не игрока.
export const PET_ITEMS = [
  // бой
  { id: 'MINOS_RELIC', group: 'Бой', what: 'все статы питомца +33,3% (не перки)', how: 'Minos Champion (0,02–0,04%) на Diana', fit: 'сильным боевым питомцам: Ender Dragon, Golden Dragon, Tiger' },
  { id: 'HEPHAESTUS_RELIC', group: 'Бой', what: 'все статы питомца +50% (не перки)', how: 'крафт: 3 Minos Relic и Hephaestus Anvil', fit: 'эндгейм-питомцам вместо Minos Relic' },
  { id: 'GOLD_CLAWS', group: 'Бой', what: 'Crit Damage и Crit Chance питомца +50%', how: 'крафт: Iron Claws (Zog, 750 тыс.), 18 Enchanted Gold Block и Zog Anvil', fit: 'питомцам с крит-статами: Ender Dragon, Tiger' },
  { id: 'ANTIQUE_REMEDIES', group: 'Бой', what: 'Strength питомца +80%', how: 'Harpy (0,35–0,6%) на Diana', fit: 'питомцам с большой Strength: Tiger, Golden Dragon' },
  { id: 'SERRATED_CLAWS', group: 'Бой', what: '+25 Crit Damage', how: 'крафт: Sharpened Claws (Zog, 1 млн), 18 Enchanted Gold Block и Zog Anvil', fit: 'любому питомцу, если нужен Crit Damage' },
  { id: 'BIGGER_TEETH', group: 'Бой', what: '+10 Crit Chance', how: 'крафт: Big Teeth (Zog, 750 тыс.), 18 Enchanted Gold Block и Zog Anvil', fit: 'пока не хватает Crit Chance' },
  { id: 'CROCHET_TIGER_PLUSHIE', group: 'Бой', what: '+35 Bonus Attack Speed', how: 'Siamese Lynx (0,05–0,4%) на Diana; Hephaestus Plushie — 3 штуки и Hephaestus Anvil, +50', fit: 'ближнему бою с низкой скоростью атаки' },
  { id: 'REAPER_GEM', group: 'Бой', what: '+8 Ferocity на 5 с после убийства', how: 'Rusty за 20 млн, нужен Zombie Slayer 9', fit: 'фарму мобов и слеерам' },
  { id: 'PET_ITEM_TEXTBOOK', group: 'Бой', what: 'Intelligence питомца +100%', how: 'крафт после Lapis X: 8 Enchanted Lapis Block и 64 Enchanted Paper', fit: 'Mage-питомцам с Intelligence, например Sheep' },
  { id: 'REINFORCED_SCALES', group: 'Бой', what: '+40 Defense', how: 'крафт: Hardened Scales (Zog, 1 млн), 18 Enchanted Gold Block и Zog Anvil', fit: 'Tank в Dungeons' },
  { id: 'DWARF_TURTLE_SHELMET', group: 'Бой', what: '+10 True Defense и нет отбрасывания', how: 'Gaia Construct (0,35–0,6%) на Diana; Hephaestus Shelmet — 3 штуки и Hephaestus Anvil, +20', fit: 'Tank и боссам, которые отбрасывают' },
  { id: 'PET_ITEM_BUBBLEGUM', group: 'Бой', what: 'Deployables (Flare, Orb) держатся вдвое дольше', how: 'Zog за 5 млн', fit: 'тому, кто ставит Flare или Power Orb: слееры, Healer' },
  // добыча
  { id: 'PET_ITEM_QUICK_CLAW', group: 'Mining', what: '+1 Mining Speed и +1 Mining Fortune за каждые 2 уровня питомца', how: 'Treasure stash Crystal Nucleus', fit: 'Mining-питомцам высокого уровня: Scatha, Glacite Golem, Goblin' },
  { id: 'BEJEWELED_COLLAR', group: 'Mining', what: '+25 Mining Speed, +10 Mining Fortune', how: 'Forge (HotM 2): Bejeweled Handle и 4 Refined Mithril', fit: 'дешёвый вариант для Mining-питомца' },
  { id: 'PET_ITEM_TITANIUM_MINECART', group: 'Mining', what: '+33,3 Mining Fortune по Titanium Ore', how: 'шанс 20% за участие в Mining Event в Dwarven Mines', fit: 'фарму Titanium в Dwarven Mines' },
  { id: 'YELLOW_BANDANA', group: 'Farming', what: '+30 Farming Fortune', how: 'SkyMart на Garden за 300 Copper', fit: 'Farming-питомцу, пока Garden ниже 8 уровня' },
  { id: 'GREEN_BANDANA', group: 'Farming', what: '+4 Farming Fortune за каждый уровень Garden', how: 'награда посетителей Garden', fit: 'Farming-питомцу с Garden 8 и выше: Mooshroom Cow, Elephant, Rose Dragon' },
  { id: 'BROWN_BANDANA', group: 'Farming', what: '+0,2 Bonus Pest Chance за тир бестиария Pests', how: 'Talbot за 50 тыс.', fit: 'питомцам для Pests: Slug, Hedgehog, Mosquito' },
  { id: 'WASHED_UP_SOUVENIR', group: 'Fishing', what: '+5 Sea Creature Chance', how: 'Stranded Nymph (0,2–0,5%) на Diana; Hephaestus Souvenir — 3 штуки и Hephaestus Anvil, +10', fit: 'рыбалке на существ: Flying Fish, Ammonite, Dolphin' },
  { id: 'EDIBLE_SEAWEED', group: 'Fishing', what: '+10 Fishing Speed', how: 'Snapping Turtle (0,5%)', fit: 'рыбалке на Trophy Fish и предметы' },
  { id: 'BURNT_TEXTS', group: 'Fishing', what: '+5 Double Hook Chance, −50 Fishing Speed', how: 'Ragnarock (1%)', fit: 'фарму существ, когда Fishing Speed с запасом' },
  // удача и редкость
  { id: 'PET_ITEM_LUCKY_CLOVER', group: 'Удача', what: '+7 Magic Find', how: 'крафт: 256 Enchanted Emerald и Lucky Clover Core', fit: 'фарму редких дропов, где питомец не даёт статов для боя' },
  { id: 'CRETAN_URN', group: 'Удача', what: '+5 Pet Luck', how: 'Cretan Bull (0,2–0,5%) на Diana; Hephaestus Urn — 3 штуки и Hephaestus Anvil, +10', fit: 'охоте за питомцами с мобов' },
  { id: 'PET_ITEM_TIER_BOOST', group: 'Редкость', what: 'редкость питомца +1 ступень (до Legendary)', how: 'крафт: 10 Enchanted Iron Block и Tier Boost Core', fit: 'Epic-питомцу, у которого Legendary открывает нужный перк; Kat такого питомца не берёт' },
  // только для одного питомца
  { id: 'FOUR_EYED_FISH', group: 'Свой питомец', pet: 'GRIFFIN', what: '+10 Magic Find, +55 Defense, +2 000 монет с каждой норы', how: 'крафт: 384 Enchanted Spider Eye, Lucky Clover, Reinforced Scales и Pre-Digestion Fish', fit: 'только Griffin' },
  { id: 'PET_ITEM_FLYING_PIG', group: 'Свой питомец', pet: 'PIG', what: '+40 Potato Fortune, +20 Speed', how: 'Shiny Pig (0,14%)', fit: 'только Pig' },
  { id: 'GRANDMAS_KNITTING_NEEDLE', group: 'Свой питомец', pet: 'GRANDMA_WOLF', what: '+5% Magic Find при комбо от 50', how: 'Oruo the Almighty за 50 Sun Gecko Essence', fit: 'только Grandma Wolf' },
  { id: 'PET_ITEM_SADDLE', group: 'Свой питомец', pet: 'HORSE', what: 'скорость +50%, прыжок +100%', how: 'крафт после Leather VII: 24 Enchanted Leather и 8 Enchanted Iron', fit: 'только Horse и Skeleton Horse' },
];
const PET_ONLY = new Map(PET_ITEMS.filter(i => i.pet).map(i => [i.pet, i]));
const ITEM_BY_ID = new Map([...EXP_BOOSTS, ...PET_ITEMS].map(i => [i.id, i]));
const PEST_PETS = new Set(['SLUG', 'HEDGEHOG', 'MOSQUITO']);

/** Что надеть питомцу: id предметов по порядку (первый — лучший), по типу питомца, уровню и уровню Garden. */
export function petItemFor(p, type, { garden = 0 } = {}) {
  if (PET_ONLY.has(p.type)) return [PET_ONLY.get(p.type).id];
  if (p.type === 'SKELETON_HORSE') return ['PET_ITEM_SADDLE'];
  if (PEST_PETS.has(p.type)) return ['BROWN_BANDANA'];
  const lvl = p.level || 0;
  if (type === 'MINING') return lvl >= 30 ? ['PET_ITEM_QUICK_CLAW', 'BEJEWELED_COLLAR'] : ['BEJEWELED_COLLAR', 'PET_ITEM_QUICK_CLAW'];
  if (type === 'FARMING') return garden >= 8 ? ['GREEN_BANDANA', 'YELLOW_BANDANA'] : ['YELLOW_BANDANA', 'GREEN_BANDANA'];
  if (type === 'FISHING') return ['WASHED_UP_SOUVENIR', 'EDIBLE_SEAWEED'];
  if (type === 'COMBAT') return ['MINOS_RELIC', 'GOLD_CLAWS'];
  return ['PET_ITEM_ALL_SKILLS_BOOST_COMMON'];
}

// Fann в Pet Care (с Taming 10): тренировка за монеты, опыт в день (без Owl)
export const FANN = [
  { name: 'Free', coins: 0, xp: 20_000, xpTop: 50_000, note: 'растёт с Taming' },
  { name: 'Light', coins: 200e3, xp: 250_000 },
  { name: 'Moderate', coins: 1e6, xp: 500_000 },
  { name: 'Expert', coins: 2e6, xp: 750_000 },
  { name: 'Ultra', coins: 2.75e6, xp: 1_500_000 },
  { name: 'Turbo!', coins: 3e6, bits: 500, xp: 2_500_000 },
];

// Еда для питомцев: опыт за штуку. limit — входит в лимит 10 Carrot Candy за жизнь питомца
export const FOOD = [
  { id: 'SIMPLE_CARROT_CANDY', xp: 20_000, limit: true, how: 'крафт из 576 Carrot (коллекция Carrot II)' },
  { id: 'GREAT_CARROT_CANDY', xp: 200_000, limit: true, how: 'крафт: Simple Carrot Candy и 320 Enchanted Carrot (Carrot VI)' },
  { id: 'SUPERB_CARROT_CANDY', xp: 750_000, limit: true, how: 'крафт: Great Carrot Candy и 24 Enchanted Golden Carrot (Carrot VIII)' },
  { id: 'ULTIMATE_CARROT_CANDY', xp: 1_500_000, limit: true, how: '8 Superb Carrot Candy и Ultimate Carrot Candy Upgrade (8 000 Bits) → 10 штук' },
  { id: 'CHYME', xp: 90_000, how: 'Aranya' },
  { id: 'PET_CAKE', xp: 10_000, how: 'Oringo на Garden' },
];

// Beastmaster Crest: % к опыту питомца = (ступень убийств × 0,1%) × (редкость + 1)
const CREST = ['BEASTMASTER_CREST_COMMON', 'BEASTMASTER_CREST_UNCOMMON', 'BEASTMASTER_CREST_RARE', 'BEASTMASTER_CREST_EPIC', 'BEASTMASTER_CREST_LEGENDARY'];
const CREST_KILLS = [0, 25, 100, 250, 500, 1000, 2500, 5000, 7500, 10000];
export function crestBonus(rarity, kills) {
  if (rarity < 0) return 0;
  const step = CREST_KILLS.filter(k => kills >= k).length; // 1…10
  return Math.round(step * (rarity + 1)) / 10; // в процентах
}

// Kat: с какого уровня Taming можно поднять до редкости
export const KAT_TAMING = [{ lvl: 1, tier: 1 }, { lvl: 5, tier: 2 }, { lvl: 10, tier: 3 }, { lvl: 20, tier: 4 }, { lvl: 25, tier: 5 }];

const SKILL_NAME = { MINING: 'Mining', FISHING: 'Fishing', FARMING: 'Farming', FORAGING: 'Foraging', COMBAT: 'Combat', ALCHEMY: 'Alchemy', ENCHANTING: 'Enchanting', TAMING: 'Taming', ALL: 'все скиллы' };
const tierOf = p => RARITY.indexOf(String(p?.tier || '').toUpperCase());
const maxXp = p => (DRAGONS.has(p.type) ? XP_TO_200 : XP_TO_100[Math.max(0, tierOf(p))] || XP_TO_100[0]);
const isMax = p => Number(p.exp || 0) >= maxXp(p);
const petLabel = (ctx, p) => String(ctx.name(tx`${p.type};${Math.max(0, tierOf(p))}`) || p.type).replace(/^\[Lvl \{LVL\}\] /, '');

/**
 * Доля опыта для Exp Share: 0,2% за уровень Taming, +15% Exp Share, +10% от Sharing is Caring и Why Not More.
 * Вики называет итог 37% (12 + 15 + 10), поэтому эти два бонуса вместе считаем за 10%.
 */
export function expShareRate(taming, { item = false, diana = false, attr = false } = {}) {
  return Math.round((0.2 * Math.min(taming, TAMING_MAX_CAP) + (item ? 15 : 0) + (diana || attr ? 10 : 0)) * 10) / 10;
}

/** Самый дешёвый способ купить опыт: монет за 1 опыт (Fann Light или Carrot Candy по живой цене). */
export function cheapestXp(price, market = true) {
  const opts = [{ name: 'Fann Light', perXp: FANN[1].coins / FANN[1].xp }];
  if (market) for (const f of FOOD) { const p = price(f.id); if (p > 0 && f.xp >= 100_000) opts.push({ name: f.id, perXp: p / f.xp, food: f }); }
  return opts.sort((a, b) => a.perXp - b.perXp)[0];
}

export function build(m, ctx) {
  const market = ctx.adv?.market !== false;
  const sk = m.skills?.taming || {};
  const taming = sk.level || 0;
  const cap = m.tamingCap || 50;
  const perks = (() => { try { return activePerks(); } catch { return []; } })();
  const petBuff = perks.includes('Pet XP Buff');
  const sharing = perks.includes('Sharing is Caring');
  const pets = (m.pets || []).filter(p => p?.type);
  const active = pets.find(p => p.active) || null;
  const types = constants(ctx).pets?.pet_types || {};
  const kills = m.extras?.mythos?.kills || 0;
  const crestTier = CREST.reduce((best, id, i) => (ctx.has(id) ? i : best), -1);
  const crest = crestBonus(crestTier, kills);
  const activeBoost = active?.heldItem ? BOOST_BY_ID.get(active.heldItem) : null;
  const shareItem = pets.some(p => p.heldItem === 'PET_ITEM_EXP_SHARE');
  const gl = m.extras?.view?.gardenLevel;
  const garden = Number(typeof gl === 'object' ? gl?.level : gl) || 0;
  const heldCell = p => {
    if (p.heldItem) return cell(ctx.name(p.heldItem), { item: p.heldItem, tone: ITEM_BY_ID.has(p.heldItem) || p.heldItem === 'PET_ITEM_EXP_SHARE' ? 'good' : undefined });
    const pick = petItemFor(p, types[p.type], { garden })[0];
    const boost = !isMax(p) && (EXP_BOOSTS.find(b => b.skill === types[p.type] && b.coins) || EXP_BOOSTS[0]);
    if (boost && boost.id !== pick) return cell(tx`пусто → ${ctx.name(boost.id)}, после прокачки ${ctx.name(pick)}`, { item: boost.id, tone: 'warn' });
    return cell(tx`пусто → ${ctx.name(pick)}`, { item: pick, tone: 'warn' });
  };
  const sections = [];
  const next = [];

  // --- Taming: вехи ---
  const katMax = [...KAT_TAMING].reverse().find(k => taming >= k.lvl);
  sections.push({
    kind: 'checklist', title: 'Твой Taming', news: 'taming',
    note: tx`Taming ${taming} из ${cap}${cap < TAMING_MAX_CAP ? tx` (кап поднимается до ${TAMING_MAX_CAP} у George)` : ''}. Сейчас питомцы получают +${taming}% опыта, а Kat поднимает их до ${RARITY_NAME[katMax?.tier ?? 1]}.`,
    items: [
      { text: 'Taming 5: Kat поднимает до Rare', done: taming >= 5 },
      { text: 'Taming 10: Kat поднимает до Epic, открывается тренировка у Fann', done: taming >= 10 },
      { text: 'Taming 20: Kat поднимает до Legendary', done: taming >= 20 },
      { text: 'Taming 25: Kat поднимает до Mythic (нужен особый предмет)', done: taming >= 25 },
      { text: 'Taming 50: George берёт питомцев за кап', done: taming >= 50 },
      { text: tx`Кап Taming ${TAMING_MAX_CAP}: George получил 10 питомцев`, done: cap >= TAMING_MAX_CAP, hint: cap < TAMING_MAX_CAP ? tx`сдано ${m.tamingSacrificed || 0} из 10` : undefined },
    ],
  });

  sections.push({
    kind: 'text', title: 'Как растёт Taming',
    text: [
      'Taming растёт только вместе с активным питомцем: питомец получает опыт от твоих скиллов, а Taming — свою долю от него.',
      'Больше всего дают скиллы того же типа, что и питомец: Combat-питомец в бою, Mining-питомец на шахте. С чужого скилла и питомец, и Taming получают в три раза меньше.',
      'Carpentry, Runecrafting, Social, Taming и Catacombs опыта питомцам не дают. Питомец на 100 уровне всё равно качает Taming, а лишний опыт копится и пригодится после повышения редкости у Kat.',
      'Каждый уровень Taming — это +1% опыта всем питомцам и +1 Pet Luck (перк Zoologist), плюс доля Exp Share растёт на 0,2%.',
    ],
  });

  // --- Множители ---
  const activeType = active ? types[active.type] : null;
  const facStatus = {
    taming: cell(tx`×${(1 + taming / 100).toFixed(2).replace('.', ',')}`, { tone: taming ? 'good' : 'muted' }),
    diana: petBuff ? cell('сейчас действует', { tone: 'good' }) : cell('Diana сейчас не мэр', { tone: 'muted' }),
    item: activeBoost ? cell(tx`+${activeBoost.pct}% (${SKILL_NAME[activeBoost.skill]})`, { tone: 'good' }) : active ? cell('у активного питомца нет', { tone: 'warn' }) : cell('нет активного питомца', { tone: 'muted' }),
    crest: crestTier >= 0 ? cell(tx`+${String(crest).replace('.', ',')}% (${RARITY_NAME[crestTier]}, ${fmt(kills)} убийств)`, { tone: 'good' }) : cell('нет', { tone: 'muted' }),
    mf: activeType === 'MINING' || activeType === 'FISHING' ? cell(tx`да: активный питомец ${SKILL_NAME[activeType]}`, { tone: 'good' }) : cell('—', { tone: 'muted' }),
    reindeer: pets.some(p => p.type === 'REINDEER') ? cell('есть', { tone: 'good' }) : cell('—', { tone: 'muted' }),
  };
  sections.push({
    kind: 'table', title: 'Что ускоряет опыт питомца', news: 'xp',
    note: 'Все множители перемножаются. Wisdom твоего скилла тоже работает: больше опыта скилла — больше питомцу.',
    columns: ['Источник', 'Множитель', 'Как работает', 'У тебя'],
    rows: XP_FACTORS.map(f => [f.name, cell(f.mult, { tone: f.mult.startsWith('×0') ? 'bad' : 'good' }), f.text, facStatus[f.key] || cell('—', { tone: 'muted' })]),
  });

  // --- Свои питомцы: где качать и сколько осталось ---
  const best = new Map();
  for (const p of pets) {
    const cur = best.get(p.type);
    if (!cur || tierOf(p) > tierOf(cur) || (tierOf(p) === tierOf(cur) && (p.exp || 0) > (cur.exp || 0))) best.set(p.type, p);
  }
  const growing = [...best.values()].filter(p => !isMax(p) && types[p.type] !== 'GABAGOOL')
    .sort((a, b) => Number(b.active) - Number(a.active) || tierOf(b) - tierOf(a) || (b.exp || 0) - (a.exp || 0)).slice(0, 12);
  if (growing.length) {
    sections.push({
      kind: 'table', title: 'Твои питомцы: где качать',
      note: 'Лучший питомец каждого вида, который ещё не на максимуме. «Полный опыт» — скилл, от которого питомец растёт без штрафа.',
      columns: ['Питомец', 'Уровень', 'Полный опыт', 'До максимума', 'Предмет'],
      rows: growing.map(p => {
        const t = types[p.type];
        return [
          cell(tx`${petLabel(ctx, p)} (${RARITY_NAME[tierOf(p)] || p.tier})${p.active ? ' · активный' : ''}`, { item: tx`${p.type};${Math.max(0, tierOf(p))}` }),
          p.level ? tx`${p.level} / ${p.maxLevel || (DRAGONS.has(p.type) ? 200 : 100)}` : '—',
          t ? cell(tx`${SKILL_NAME[t] || t}${t === 'MINING' || t === 'FISHING' ? ' (×1,5)' : ''}`) : cell('—', { tone: 'muted' }),
          tx`${short(maxXp(p) - (p.exp || 0))} опыта`,
          heldCell(p),
        ];
      }),
    });
  }

  // --- Exp Boost ---
  sections.push({
    kind: 'table', title: 'Предметы Exp Boost',
    note: tx`Предмет питомца даёт бонус только к опыту своего скилла (All Skills — ко всем). Если надеть новый предмет, старый вернётся за плату (от 25 тыс. до 2,5 млн по редкости), так что Exp Boost на время прокачки не пропадает.${market ? ' Цена — Bazaar или самый дешёвый лот аукциона.' : ''}`,
    columns: market ? ['Предмет', 'Бонус', 'Скилл', 'Где взять', 'Цена'] : ['Предмет', 'Бонус', 'Скилл', 'Где взять'],
    rows: EXP_BOOSTS.map(b => {
      const row = [cell(ctx.name(b.id), { item: b.id }), tx`+${b.pct}%`, SKILL_NAME[b.skill], b.coins ? tx`${b.how} за ${short(b.coins)}` : b.how];
      if (market) { const p = ctx.price(b.id); row.push(p ? short(p) : cell('—', { tone: 'muted' })); }
      return row;
    }),
  });

  // --- Остальные предметы ---
  const holders = new Map();
  for (const p of pets) if (p.heldItem) holders.set(p.heldItem, [...(holders.get(p.heldItem) || []), p]);
  const fitsMine = it => it.pet ? pets.some(p => p.type === it.pet || (it.pet === 'HORSE' && p.type === 'SKELETON_HORSE')) : true;
  const itemRows = PET_ITEMS.filter(it => !it.pet || fitsMine(it));
  sections.push({
    kind: 'table', title: 'Предметы для питомцев: статы и бонусы', news: 'items',
    note: tx`Один предмет на питомца: ПКМ по призванному питомцу с предметом в руке. Проценты (Claws, Remedies, Textbook, Relic) умножают статы самого питомца, поэтому их ставят питомцам, у которых этих статов много. Предметы с Diana падают с мифических мобов Mythological Ritual.${market ? ' Цена — Bazaar или самый дешёвый лот аукциона.' : ''}`,
    columns: market ? ['Предмет', 'Для чего', 'Что даёт', 'Кому', 'Где взять', 'Цена'] : ['Предмет', 'Для чего', 'Что даёт', 'Кому', 'Где взять'],
    rows: itemRows.map(it => {
      const on = holders.get(it.id);
      const row = [
        cell(on ? tx`${ctx.name(it.id)} · у ${on.map(p => petLabel(ctx, p)).join(', ')}` : ctx.name(it.id), { item: it.id, ...(on || ctx.has(it.id) ? { tone: 'good' } : {}) }),
        it.group, it.what, it.fit, it.how,
      ];
      if (market) { const pr = ctx.price(it.id); row.push(pr ? short(pr) : cell('—', { tone: 'muted' })); }
      return row;
    }),
  });

  // --- Exp Share ---
  const shareNow = expShareRate(taming, { item: shareItem, diana: sharing });
  sections.push({
    kind: 'table', title: 'Exp Share: качать питомцев, пока они в меню', news: 'share',
    note: tx`Меню /pets → Exp Share. Питомец в слоте получает долю опыта активного питомца (штраф чужого скилла и ×1,5 за Mining и Fishing действуют). Без активного питомца слоты не качаются. Твоя доля сейчас: ${String(shareNow).replace('.', ',')}%.`,
    columns: ['Что даёт', 'Доля', 'Как получить', 'У тебя'],
    rows: [
      ['Taming', '+0,2% за уровень, до 12%', 'качать Taming', cell(tx`+${String(Math.round(taming * 2) / 10).replace('.', ',')}%`, { tone: taming ? 'good' : 'muted' })],
      [cell('Exp Share', { item: 'PET_ITEM_EXP_SHARE' }), '+15%', 'предмет питомца в слоте Exp Share: 72 Enchanted Gold Ingot и Exp Share Core (1 из 10 000 с мобов Deep Caverns)', shareItem ? cell('есть', { tone: 'good' }) : cell('нет', { tone: 'muted' })],
      ['Diana: Sharing is Caring', '+10% и ещё 2 слота', 'перк мэра Diana', sharing ? cell('сейчас действует', { tone: 'good' }) : cell('не сейчас', { tone: 'muted' })],
      ['Why Not More', '+10%', 'атрибут; вместе с Sharing is Caring по вики выходит максимум 37%', cell('—', { tone: 'muted' })],
    ],
  });

  // --- Fann ---
  const legLeft = XP_TO_100[4];
  sections.push({
    kind: 'table', title: 'Fann: тренировка за монеты', news: 'fann',
    note: tx`Fann в Pet Care (Hub) тренирует питомца, пока ты играешь: 1, 5, 10, 20 дней или до нужного уровня. Нужен Taming 10${taming >= 10 ? '' : tx` (у тебя ${taming})`}. Owl рядом даёт до +10% опыта и до −5% цены. Слоты 2 и 3 открываются за 5 Great и 1 Ultimate Carrot Candy для Hootie. Цены и опыт — по вики, точные цифры видны в меню Fann.`,
    columns: ['Тренировка', 'Цена в день', 'Опыт в день', 'Монет за 1 млн опыта', 'Legendary 1 → 100'],
    rows: FANN.map(f => [
      f.name,
      f.coins ? tx`${short(f.coins)}${f.bits ? tx` + ${f.bits} Bits` : ''}` : 'бесплатно',
      f.xpTop ? tx`${short(f.xp)}–${short(f.xpTop)} (${f.note})` : short(f.xp),
      f.coins ? short(f.coins / f.xp * 1e6) : '—',
      (() => { if (!f.coins) return cell('больше года', { tone: 'muted' }); const d = Math.ceil(legLeft / f.xp); return tx`${d} ${plural(d, 'день', 'дня', 'дней')}, ${short(d * f.coins)}`; })(),
    ]),
  });

  // --- Еда ---
  sections.push({
    kind: 'table', title: 'Carrot Candy и другая еда',
    note: 'ПКМ по питомцу с едой в руке. Carrot Candy — не больше 10 за жизнь питомца, и покупатели ценят «съевших конфеты» ниже (у Legendary и выше отметка пропадает, если питомец дошёл до 100 без них). Chyme и Pet Cake — без лимита и без отметки.',
    columns: market ? ['Еда', 'Опыт', 'Лимит 10', 'Где взять', 'Цена', 'Монет за 1 млн опыта'] : ['Еда', 'Опыт', 'Лимит 10', 'Где взять'],
    rows: FOOD.map(f => {
      const row = [cell(ctx.name(f.id), { item: f.id }), short(f.xp), f.limit ? 'да' : cell('нет', { tone: 'good' }), f.how];
      if (market) { const p = ctx.price(f.id); row.push(p ? short(p) : '—', p ? short(p / f.xp * 1e6) : '—'); }
      return row;
    }),
  });

  // --- Сколько опыта до 100 ---
  sections.push({
    kind: 'table', title: 'Сколько опыта до 100 уровня',
    note: 'Опыт с 1 уровня. Kat сохраняет весь опыт при повышении редкости и пересчитывает уровень, поэтому качать можно до или после повышения.',
    columns: ['Редкость', 'Опыт до 100', 'Ultimate Carrot Candy', 'Fann Turbo!'],
    rows: [
      ...RARITY_NAME.slice(0, 5).map((r, i) => [r, short(XP_TO_100[i]), tx`${Math.ceil(XP_TO_100[i] / 1.5e6)} шт.`, tx`${Math.ceil(XP_TO_100[i] / 2.5e6)} дн.`]),
      ['Golden, Jade и Rose Dragon до 200', short(XP_TO_200), '—', tx`${Math.ceil(XP_TO_200 / 2.5e6)} дн.`],
    ],
  });

  // --- Выгода: прокачать своего питомца и продать ---
  if (market) {
    const cheap = cheapestXp(ctx.price, market);
    const deals = [...best.values()].filter(p => !isMax(p) && tierOf(p) >= 3).map(p => {
      const id = tx`${p.type};${tierOf(p)}`;
      const info = ctx.priceInfo(id);
      const low = info?.bin?.price || ctx.price(id) || 0;
      const top = info?.bin?.max || 0;
      const left = maxXp(p) - (p.exp || 0);
      const cost = left * cheap.perXp;
      return { p, id, low, top, left, cost, gain: top - low - cost };
    }).filter(d => d.low && d.top && d.top > d.low).sort((a, b) => b.gain - a.gain).slice(0, 8);
    if (deals.length) {
      const how = cheap.food ? ctx.name(cheap.food.id) : cheap.name;
      sections.push({
        kind: 'table', title: 'Выгодно ли докачать до 100', news: 'profit',
        note: tx`Разница цен на аукционе: 100 уровень против самого дешёвого лота. Опыт посчитан по самому дешёвому способу сейчас — ${how} (${short(cheap.perXp * 1e6)} за 1 млн опыта). Продажа на аукционе стоит ещё около 1–2% налога.`,
        columns: ['Питомец', 'Дешёвый лот', '100 уровень', 'Опыт докачать', 'Итог'],
        rows: deals.map(d => [
          cell(tx`${petLabel(ctx, d.p)} (${RARITY_NAME[tierOf(d.p)]})`, { item: d.id }),
          short(d.low), short(d.top),
          tx`${short(d.left)} ≈ ${short(d.cost)}`,
          cell(d.gain > 0 ? tx`+${short(d.gain)}` : tx`−${short(-d.gain)}`, { tone: d.gain > 0 ? 'good' : 'bad' }),
        ]),
      });
      const top = deals[0];
      if (top.gain > 2e6) next.push({ priority: 40, item: top.id, title: tx`Докачай ${petLabel(ctx, top.p)} до 100: прибавка ~${short(top.gain)}`,
        why: tx`На аукционе 100 уровень стоит ${short(top.top)}, дешёвый лот — ${short(top.low)}. Осталось ${short(top.left)} опыта — это около ${short(top.cost)} через ${how}.` });
    }
  }

  // --- George ---
  if (cap < TAMING_MAX_CAP) {
    const plan = tamingCapPlan({ tamingCap: cap, sacrificed: m.tamingSacrificedTypes || [], pets, price: market ? ctx.price : () => 0 });
    sections.push({
      kind: 'checklist', title: tx`Кап Taming ${cap} → ${TAMING_MAX_CAP}: питомцы для George`,
      note: tx`${plan.text.intro} ${plan.text.note}`,
      items: [...(m.tamingSacrificedTypes || []).map(t => ({ text: tx`${petLabel(ctx, { type: t, tier: 'EPIC' })}`, done: true })),
        ...plan.candidates.map(c => ({ text: tx`${petLabel(ctx, { type: c.type, tier: c.minTier })} (${RARITY_NAME[RARITY.indexOf(c.minTier)]} или выше)`, done: false, item: c.id,
          hint: c.owned ? 'уже есть у тебя' : market && c.cost ? tx`от ${short(c.cost)}` : undefined }))],
    });
  }

  sections.push({
    kind: 'text', title: 'Kat: повышение редкости',
    text: [
      'Kat в Pet Care поднимает редкость на одну ступень за монеты и время; у части питомцев нужен ещё предмет. Опыт остаётся, уровень пересчитывается.',
      'Чем выше уровень питомца, тем дешевле: −0,3% цены за каждый уровень. Kat Flower (500 Bits) сокращает ожидание на день, Kat Bouquet — на 5 дней.',
      'Питомца с Tier Boost Kat не берёт. Bingo, Grandma Wolf, Kuudra, Montezuma и Wisp улучшаются своими способами.',
      'Какого питомца брать под занятие — в таблицах «Питомцы по этапам» гайдов Mining, Farming, Foraging, Fishing, Slayers и Dungeons.',
    ],
  });

  // --- Что делать ---
  if (petBuff) next.push({ priority: 70, title: 'Diana сейчас мэр: +35% опыта питомцам', why: 'Pet XP Buff действует, пока Diana в должности. Самое время качать питомцев и Taming.', item: 'GRIFFIN_FEATHER' });
  if (active && !isMax(active) && !activeBoost) {
    const t = types[active.type];
    const pick = EXP_BOOSTS.find(b => b.skill === t && b.coins) || EXP_BOOSTS[0];
    next.push({ priority: 55, item: pick.id, title: tx`Дай ${petLabel(ctx, active)} ${ctx.name(pick.id)}`,
      why: tx`+${pick.pct}% опыта питомцу${t && pick.skill === t ? tx` от ${SKILL_NAME[t]}` : ' от всех скиллов'}. Продаёт Zog в Pet Care за ${short(pick.coins)}.` });
  }
  if (active && !active.heldItem && isMax(active)) {
    const pick = petItemFor(active, activeType, { garden })[0];
    const it = ITEM_BY_ID.get(pick);
    if (it) next.push({ priority: 50, item: pick, title: tx`Дай ${petLabel(ctx, active)} ${ctx.name(pick)}`, why: tx`${it.what[0].toUpperCase()}${it.what.slice(1)}. Где взять: ${it.how}.` });
  }
  if (active && activeType && activeType !== 'ALL' && !isMax(active)) {
    next.push({ priority: 30, item: tx`${active.type};${Math.max(0, tierOf(active))}`, title: tx`${petLabel(ctx, active)} растёт быстрее всего от ${SKILL_NAME[activeType] || activeType}`,
      why: tx`Опыт других скиллов даёт этому питомцу ×0,33${activeType === 'MINING' || activeType === 'FISHING' ? tx`, а ${SKILL_NAME[activeType]} — ×1,5` : ''}. Под другое занятие лучше взять питомца, совпадающего по типу со скиллом.` });
  }
  if (taming < 10) next.push({ priority: 50, title: tx`Подними Taming до 10 (сейчас ${taming})`, why: 'Откроются тренировка у Fann и повышение до Epic у Kat. Taming растёт с любым активным питомцем.', item: 'PET_ITEM_ALL_SKILLS_BOOST_COMMON' });
  else if (taming < 20) next.push({ priority: 45, title: tx`Подними Taming до 20 (сейчас ${taming})`, why: 'С Taming 20 Kat поднимает питомцев до Legendary.', item: 'PET_ITEM_ALL_SKILLS_BOOST_COMMON' });
  else if (taming < 50) next.push({ priority: 20, title: tx`Качай Taming до 50 (сейчас ${taming})`, why: tx`Каждый уровень — +1% опыта всем питомцам и +1 Pet Luck. С 50 George поднимает кап до ${TAMING_MAX_CAP}.`, item: 'PET_ITEM_ALL_SKILLS_BOOST_COMMON' });
  const idle = growing.find(p => !p.active && tierOf(p) >= 4);
  if (taming >= 10 && idle) next.push({ priority: 35, item: tx`${idle.type};${tierOf(idle)}`, title: tx`Отдай ${petLabel(ctx, idle)} на тренировку к Fann`,
    why: tx`Бесплатная тренировка даёт до 50 тыс. опыта в день, Light — 250 тыс. за 200 тыс. монет в день. До максимума осталось ${short(maxXp(idle) - (idle.exp || 0))} опыта.` });
  if (!shareItem && growing.length > 1) next.push({ priority: 25, item: 'PET_ITEM_EXP_SHARE', title: 'Заполни слоты Exp Share в /pets',
    why: tx`Меню /pets → Exp Share: питомец получает ${String(expShareRate(taming)).replace('.', ',')}% опыта активного, а с предметом Exp Share — ещё +15%.` });
  if (taming >= 50 && cap < TAMING_MAX_CAP) next.push({ priority: 60, title: tx`Подними кап Taming: ${cap} → ${TAMING_MAX_CAP}`, why: 'George в Pet Care поднимает кап на 1 за каждого питомца из списка. Список — в блоке ниже.', item: 'ENDERMAN;5' });

  return {
    summary: active
      ? tx`Taming ${taming} из ${cap}, активный питомец ${petLabel(ctx, active)}${isMax(active) ? ' (максимум)' : active.level ? tx` (ур. ${active.level})` : ''}`
      : tx`Taming ${taming} из ${cap}, активного питомца нет`,
    status: taming >= TAMING_MAX_CAP ? 'done' : taming ? 'progress' : 'start',
    level: { label: 'Taming', value: taming, max: cap },
    next: topNext(next),
    sections,
  };
}

export default { id: 'taming', title: 'Taming и прокачка питомцев', icon: 'PET_ITEM_EXP_SHARE', group: 'skills', build };
