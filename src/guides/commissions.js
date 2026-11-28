// Commissions (задания King и Emissary) и Commission Milestones для гайда Mining.
// Сверено 28.11.2026: hypixelskyblock.minecraft.wiki — Commissions, Emissaries, King, Royal Pigeon, Royal Compass,
// Queen Mismyla, Travel Scroll to Dwarven Mines, Heart of the Mountain (опыт, бонусы), Template:Heart of the Mountain/List/Tier 5
// (Daily Grind, Core of the Mountain 3 → слот задания).
// Прогресс игрока — только по выбранному профилю: веха — objectives.tutorial «commission_milestone_reward_mining_xp_tier_N»
// (ставится, когда награда забрана). Число заданий — mining_core.commissions_completed, если API его отдаёт.
// Достижение Hard Working Miner из /player общее на аккаунт (все профили, и удалённые тоже) — его не берём, чтобы не смешивать профили.
import { fmt, short, plural, hasItem, cell } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Вехи: сколько заданий нужно, что дают. Mining XP за вехи не умножается бустами. */
export const COMMISSION_MILESTONES = [
  { need: 5, xp: 100_000, sbxp: 20, reward: 'Emissary по всей Dwarven Mines и Royal Compass', item: 'ROYAL_COMPASS' },
  { need: 25, xp: 200_000, sbxp: 30, reward: 'только Mining XP и SkyBlock XP' },
  { need: 100, xp: 400_000, sbxp: 30, reward: '+1 слот заданий (третий)' },
  { need: 250, xp: 800_000, sbxp: 50, reward: 'Travel Scroll to Dwarven Mines', item: 'MINING_3_TRAVEL_SCROLL' },
  { need: 500, xp: 1_200_000, sbxp: 50, reward: 'Royal Pigeon: меню заданий из любой точки шахт', item: 'ROYAL_PIGEON' },
  { need: 750, xp: 1_600_000, sbxp: 75, reward: 'Travel Scroll to the Crystal Nucleus', item: 'CRYSTAL_NUCLEUS_TRAVEL_SCROLL' },
].map((m, i) => ({ ...m, n: i + 1, roman: ROMAN[i] }));

/** Острова с заданиями: опыт HotM за задание, Powder (до HotM 10 / на HotM 10), Mining XP. */
export const COMMISSION_AREAS = [
  {
    k: 'mines', name: 'Dwarven Mines', powder: 'Mithril', hotm: lvl => (lvl >= 10 ? 0 : lvl >= 3 ? 400 : lvl === 2 ? 200 : 100), hotmText: '100 / 200 / 400 (HotM 1 / 2 / 3+), на HotM 10 — 0',
    pw: [500, 1000], daily: 1600, skill: '5–10k',
    where: 'King в Royal Palace, после вехи I — любой Emissary: Lilith (Lava Springs), Eliza (Dwarven Village), Carlton (Rampart’s Quarry), Ceanna (Cliffside Veins), Wilson (Royal Mines), Fraiser (Upper Mines), Braum (вход в Crystal Hollows)',
    fast: 'Goblin Slayer, Glacite Walker Slayer и Treasure Hoarder Puncher — любым оружием; Mithril и Titanium — с хорошим буром. Задания событий (Goblin Raid, Raffle, 2x Powder) делаются только во время ивента',
  },
  {
    k: 'hollows', name: 'Crystal Hollows', powder: 'Gemstone', hotm: () => 400, hotmText: '400',
    pw: [1000, 2000], daily: 3200, skill: '10–20k',
    where: 'Emissary Sisko в Crystal Nucleus; первый набор выдаёт Emissary Braum у входа',
    fast: 'Chest Looter (3 сундука) и Hard Stone Miner идут сами при добыче; Crystal Hunter долгий — оставь его на заход за кристаллами',
  },
  {
    k: 'glacite', name: 'Glacite Tunnels', powder: 'Glacite', hotm: () => 750, hotmText: '750',
    pw: [1500, 3000], daily: 4000, skill: '12,5–25k',
    where: 'Emissary Lissandra в Dwarven Base Camp или Royal Pigeon',
    fast: 'Collector (1 500 Glacite, Umber, Tungsten или гемов) рядом с базой; в Mineshaft за один заход закрываются Mineshaft Explorer, Corpse Looter, Scrap Collector и Maniac Slayer',
  },
];

const DAILY_BONUS = 900;     // опыт HotM за каждое из первых 4 заданий дня (до HotM 10)
const DAILY_COUNT = 4;
const num = v => Number(v) || 0;

/** Только из профиля: сколько заданий (если API отдаёт), какая веха забрана, сколько слотов. */
export function commissionState(m = {}) {
  const mi = m.mining || {};
  const completions = Number.isFinite(mi.commissionsDone) && mi.commissionsDone > 0 ? mi.commissionsDone : null;
  const claimed = num(mi.commissionMilestone);
  // Забранная веха значит, что заданий не меньше её порога
  const atLeast = claimed ? COMMISSION_MILESTONES[claimed - 1].need : 0;
  // Сколько вех хватает по числу заданий. Без числа — не больше уже забранной
  const reached = completions == null ? claimed : Math.max(claimed, COMMISSION_MILESTONES.filter(x => completions >= x.need).length);
  const potm = num(mi.potm);
  const slots = 2 + (reached >= 3 ? 1 : 0) + (potm >= 3 ? 1 : 0);
  const next = COMMISSION_MILESTONES[reached] || null;
  return { completions, atLeast, claimed, reached, slots, potm, next, left: next && completions != null ? Math.max(0, next.need - completions) : null };
}

/** Сколько заданий до следующего уровня HotM: лучший остров по уровню и с бонусом первых 4 заданий дня. */
export function commissionsToNextHotm(hotm = {}) {
  const lvl = num(hotm.level);
  if (lvl >= 10 || !hotm.xpForNext) return null;
  const need = Math.max(0, num(hotm.xpForNext) - num(hotm.xpCurrent));
  const per = lvl >= 7 ? 750 : 400;            // Glacite Tunnels с HotM 7, раньше — Dwarven Mines (HotM 3+) или Crystal Hollows
  const area = lvl >= 7 ? 'Glacite Tunnels' : lvl >= 3 ? 'Crystal Hollows или Dwarven Mines' : 'Dwarven Mines';
  const perLow = lvl >= 7 ? 750 : COMMISSION_AREAS[0].hotm(lvl);
  const dayXp = DAILY_COUNT * (perLow + DAILY_BONUS);
  const days = Math.ceil(need / dayXp);
  return { need, per: lvl >= 3 ? per : perLow, area, count: Math.ceil(need / (lvl >= 3 ? per : perLow)), days, dayXp };
}

function remoteAccess(ctx, m) {
  const pigeon = hasItem(ctx, 'ROYAL_PIGEON');
  const mismyla = (m.abiphone?.active || []).some(k => /mismyla/i.test(k));
  return { pigeon, mismyla, any: pigeon || mismyla };
}

/**
 * Шаги и секции про задания для гайда Mining.
 * @returns {{ state, toHotm, next: Array, sections: Array, hotmHow: string, slotHint: string }}
 */
export function commissionGuide(m, ctx) {
  const mi = m.mining || {};
  const lvl = num(mi.hotm?.level);
  const st = commissionState(m);
  const toHotm = commissionsToNextHotm(mi.hotm);
  const remote = remoteAccess(ctx, m);
  const king = hasItem(ctx, 'KING_TALISMAN');
  const next = [];
  const sections = [];
  const active = lvl > 0 || st.claimed > 0 || num(st.completions) > 0;

  // ---- Шаги ----
  if (active && st.reached > st.claimed) {
    const ms = COMMISSION_MILESTONES[st.reached - 1];
    next.push({
      title: tx`Забери награду за Commission Milestone ${ms.roman}: ${ms.reward}`, priority: ms.n === 3 || ms.n === 5 ? 64 : 52, item: ms.item,
      why: tx`В этом профиле выполнено ${fmt(st.completions)} ${plural(st.completions, 'задание', 'задания', 'заданий')}, а забрана веха ${st.claimed ? ROMAN[st.claimed - 1] : '—'}. Награды не приходят сами: открой меню заданий у King, Emissary или через Royal Pigeon и нажми Commission Milestones. Там же ${fmt(ms.xp)} Mining XP.`,
    });
  }
  if (active && lvl >= 5 && st.potm < 3) {
    next.push({
      title: tx`Четвёртый слот заданий: Core of the Mountain ${st.potm} → 3`, priority: 60,
      why: 'Core of the Mountain 2 стоит 50 000 Mithril Powder, 3 — ещё 100 000. Уровень 3 даёт четвёртый слот заданий: за заход закрывается вдвое больше заданий, чем на старте.',
    });
  }
  if (active && st.reached >= 5 && !remote.any) {
    next.push({
      title: 'Royal Pigeon: меню заданий без похода к Emissary', priority: 45, item: 'ROYAL_PIGEON',
      why: 'Веха V уже пройдена, а Royal Pigeon не нашёлся. Его можно забрать в Commission Milestones или купить у Rusty. Queen Mismyla за голубя даёт контакт Abiphone, но в Glacite Tunnels у телефона нет связи — для Glacite держи голубя.',
    });
  }

  // ---- Секция: вехи ----
  const done = st.completions == null ? null : st.completions;
  const parts = [];
  parts.push(done != null
    ? tx`Выполнено заданий в этом профиле: ${fmt(done)}. Забрано вех: ${st.claimed} из 6.`
    : tx`Забрано вех в этом профиле: ${st.claimed} из 6${st.atLeast ? tx`, то есть выполнено не меньше ${fmt(st.atLeast)} заданий` : ''}. Точное число заданий по профилю Hypixel не отдаёт: его видно в игре, в меню заданий → Commission Milestones.`);
  if (st.next && st.left != null) parts.push(tx`До вехи ${st.next.roman}: ${fmt(st.left)} ${plural(st.left, 'задание', 'задания', 'заданий')}.`);
  parts.push(tx`Слотов заданий: ${st.slots} из 4 — третий за 100 заданий, четвёртый за Core of the Mountain 3.`);
  parts.push('Награду за веху забирают сами в меню заданий → Commission Milestones. Mining XP за вехи не умножается бустами.');
  sections.push({
    kind: 'table', title: 'Commission Milestones', news: 'commissions',
    note: parts.join(' '),
    columns: ['Веха', 'Заданий', 'Награда', 'Mining XP'],
    current: st.next ? st.next.n - 1 : undefined,
    rows: COMMISSION_MILESTONES.map(x => {
      const got = x.n <= st.claimed, ready = !got && x.n <= st.reached, isNext = st.next?.n === x.n;
      const need = isNext && done != null ? cell(tx`${fmt(Math.min(done, x.need))}/${fmt(x.need)}`, { tone: 'warn' }) : cell(fmt(x.need), got ? { tone: 'good' } : ready ? { tone: 'warn' } : {});
      return [
        cell(got ? tx`✓ ${x.roman}` : ready ? tx`${x.roman} · забрать` : x.roman, got ? { tone: 'good' } : ready ? { tone: 'warn' } : {}),
        need,
        x.item ? cell(x.reward, { item: x.item }) : x.reward,
        tx`${short(x.xp)} · ${x.sbxp} SB XP`,
      ];
    }),
  });

  // ---- Секция: где брать и что дают ----
  sections.push({
    kind: 'table', title: 'Commissions: где брать и что дают',
    note: tx`За каждое из первых ${DAILY_COUNT} заданий дня (на любом острове) ещё +${fmt(DAILY_BONUS)} опыта HotM, а на HotM 10 вместо него Powder острова. Перк Daily Grind даёт за первое задание дня на каждом острове +500 Powder за уровень HotM. Сброс в полночь по времени Hypixel (ET).${toHotm ? tx` До HotM ${lvl + 1}: ${fmt(toHotm.need)} опыта — ≈${fmt(toHotm.count)} ${plural(toHotm.count, 'задание', 'задания', 'заданий')} в ${toHotm.area}, или ≈${fmt(toHotm.days)} ${plural(toHotm.days, 'день', 'дня', 'дней')}, если делать только первые ${DAILY_COUNT} за день.` : ''}`,
    columns: ['Остров', 'Где брать', 'Опыт HotM', 'Powder', 'Быстрые задания'],
    rows: COMMISSION_AREAS.map(a => [
      a.name,
      a.where,
      cell(a.hotmText, a.k === 'glacite' && lvl >= 7 && lvl < 10 ? { tone: 'good' } : {}),
      tx`${fmt(a.pw[0])} ${a.powder} (на HotM 10 — ${fmt(a.pw[1])})`,
      a.fast,
    ]),
  });

  // ---- Секция: советы ----
  sections.push({
    kind: 'checklist', title: 'Commissions быстрее',
    note: tx`Первые ${DAILY_COUNT} задания дня дают по +${fmt(DAILY_BONUS)} опыта HotM — больше, чем само задание, поэтому самый быстрый подъём HotM — ${DAILY_COUNT} задания каждый день плюс Daily Grind на всех трёх островах. Задания на добычу считают сырой материал: Compact на буре и перк Efficient Miner их ускоряют, Pristine — нет. Attribute Mountain Climber (Troglobyte Shard) даёт +10% опыта HotM с заданий.`,
    items: [
      { text: tx`Слоты заданий: ${st.slots} из 4`, done: st.slots >= 4, hint: 'третий — веха III (100 заданий), четвёртый — Core of the Mountain 3. В наборе всегда есть хотя бы одно задание без ивента' },
      { text: 'Меню заданий в кармане: Royal Pigeon или контакт Queen Mismyla', done: remote.any, item: 'ROYAL_PIGEON', hint: remote.mismyla && !remote.pigeon ? 'у Abiphone нет связи в Glacite Tunnels и Mineshafts: для них купи второго голубя у Rusty' : 'голубь — веха V или Rusty; Queen Mismyla в Royal Palace меняет голубя на контакт Abiphone, но в Glacite Tunnels у телефона нет связи' },
      { text: 'King Talisman: +10 опыта HotM за каждое задание', done: king, item: 'KING_TALISMAN', hint: 'поговори со всеми семью King в Royal Palace: король меняется каждые 20 минут, по кругу' },
    ],
  });

  const hotmHow = toHotm
    ? tx`Задания: ≈${fmt(toHotm.count)} до HotM ${lvl + 1} (${fmt(toHotm.per)} опыта за задание в ${toHotm.area}), первые ${DAILY_COUNT} за день дают ещё +${fmt(DAILY_BONUS)}.`
    : '';
  return { state: st, toHotm, next, sections, hotmHow };
}
