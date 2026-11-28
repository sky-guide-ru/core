// Разбор ответа Hypixel API /v2/skyblock/profiles в удобную модель
import { profileMode, CAP_RAISE } from '../lib/profile-mode.js';
import { skillLevel, cataLevel, hotmLevel, slayerLevel, petLevel, round2, overflowLevel } from './leveling.js';
import { PET_TIERS } from '../nbt.js';
import { decodeItems } from '../nbt.js';
import { SKILLS, SLAYERS, CLASSES } from '../../i18n/ru.js';
import { parseFishing } from './fishing.js';
import * as xv from './extras-view.js';
import { activityTimes, compactActivity } from './activity.js';
import { tx } from '../../i18n/msg.js';
import { parseEffects } from '../lib/effects.js';

// Есть ли в объекте хоть одно непустое значение (пустые {} Hypixel создаёт для всех зон Рифта сразу)
const hasTruthy = v => v && typeof v === 'object' ? Object.values(v).some(hasTruthy) : !!v;
const g = (o, path, d = undefined) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o) ?? d;

// История Jacob's Contest: ключ «год:месяц_день:КУЛЬТУРА» → { collected, claimed_medal, claimed_position, claimed_participants }.
// Медали тут — заработанные за всё время (medals_inv — только неистраченные).
const MEDALS = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];
export function contestStats(contests = {}) {
  const list = Object.entries(contests || {}).filter(([, c]) => c && typeof c === 'object');
  const medals = Object.fromEntries(MEDALS.map(k => [k, 0]));
  let best = null;
  for (const [key, c] of list) {
    if (MEDALS.includes(c.claimed_medal)) medals[c.claimed_medal]++;
    const pos = Number(c.claimed_position), n = Number(c.claimed_participants);
    if (pos >= 0 && n > 0) {
      const top = (pos + 1) / n;
      if (!best || top < best.top) best = { crop: key.split(':')[2] || null, place: pos + 1, of: n, top };
    }
  }
  return { total: list.length, claimed: list.filter(([, c]) => c.claimed_rewards).length, medals, best };
}

// Abiphone: контакты в телефоне (active_contacts) и NPC, с которыми уже было общение (ключи contact_data).
export function parseAbiphone(m) {
  const a = g(m, 'nether_island_player_data.abiphone', null);
  if (!a) return null;
  return {
    active: (a.active_contacts || []).map(String),
    known: Object.keys(a.contact_data || {}),
  };
}

// Арфа Melody: поля song_<id>_best_completion / _completions / _perfect_completions.
// Раньше лежали в quests.harp_quest, после обновления Foraging часть — в foraging.songs.harp: читаем оба места.
export function parseHarp(m) {
  const srcs = [g(m, 'quests.harp_quest', null), g(m, 'foraging.songs.harp', null)].filter(x => x && typeof x === 'object');
  if (!srcs.length) return null;
  const songs = {};
  let claimedHair = false, selected = null;
  for (const o of srcs) {
    for (const [k, v] of Object.entries(o)) {
      const mm = k.match(/^song_(.+?)_(best_completion|perfect_completions|completions)$/);
      if (mm) {
        const s = songs[mm[1]] ||= { best: 0, completions: 0, perfect: 0 };
        const f = { best_completion: 'best', completions: 'completions', perfect_completions: 'perfect' }[mm[2]];
        s[f] = Math.max(s[f], Number(v) || 0);
      }
    }
    if (o.claimed_talisman) claimedHair = true;
    if (o.selected_song) selected = o.selected_song;
  }
  return { songs, claimedHair, selected };
}

export function pickProfile(profiles, uuid, wantedName) {
  if (!profiles?.length) return null;
  if (wantedName) {
    const p = profiles.find(p => p.cute_name?.toLowerCase() === wantedName.toLowerCase());
    if (p) return p;
  }
  return profiles.find(p => p.selected) || profiles.sort((a, b) =>
    (g(b, tx`members.${uuid}.profile.last_save`, 0)) - (g(a, tx`members.${uuid}.profile.last_save`, 0)))[0];
}

async function riftInv(r) {
  if (!r) return null;
  const dec = d => decodeItems(d?.data);
  return {
    inventory: await dec(r.inv_contents),
    armor: (await dec(r.inv_armor)).reverse(),
    equipment: await dec(r.equipment_contents),
    enderChest: await dec(r.ender_chest_contents),
  };
}

// Музей: items[id].items.data и special[].items.data — NBT с предметами
async function museumDecoded(mu) {
  if (!mu) return null;
  const out = [];
  for (const e of Object.values(mu.items || {})) if (!e.borrowing) out.push(...await decodeItems(e?.items?.data));
  for (const e of mu.special || []) out.push(...await decodeItems(e?.items?.data));
  return out.filter(i => i?.id);
}

/**
 * Музей участника: что пожертвовано (ключи items — id записи музея: предмет или сет брони), что одолжено обратно,
 * особые предметы, оценка. status: 'ok' — данные есть; 'off' — запрос к музею прошёл, но этого игрока в ответе нет
 * (Museum API выключен в настройках или музей ещё не открыт); null — музей не запрашивали или запрос упал.
 */
async function parseMuseum(extra) {
  const mu = extra.museum;
  if (!mu) return extra.museumFetched ? { status: 'off', value: 0, appraisal: false, count: 0, keys: [], borrowing: [], donatedAt: {}, special: [], decoded: [] } : null;
  const items = mu.items || {};
  const keys = Object.keys(items);
  const special = [];
  for (const e of mu.special || []) {
    const its = await decodeItems(e?.items?.data);
    for (const it of its) if (it?.id) special.push({ id: it.id, name: it.name, rarity: it.rarity, at: e.donated_time || null });
  }
  return {
    status: 'ok',
    value: mu.value || 0,
    appraisal: !!mu.appraisal,
    count: keys.length,
    keys,
    borrowing: keys.filter(k => items[k]?.borrowing),
    donatedAt: Object.fromEntries(keys.map(k => [k, items[k]?.donated_time || null])),
    featured: keys.filter(k => items[k]?.featured_slot).map(k => ({ id: k, slot: items[k].featured_slot })),
    special,
    decoded: await museumDecoded(mu),
  };
}

// Wardrobe теперь лежит в members[uuid].loadout (система наборов), а не в inventory.wardrobe_contents.
// loadout.armor[N] = { id, HELMET, CHESTPLATE, LEGGINGS, BOOTS: { type, data } }, loadout.equipment[N] = { EQUIPMENT_SLOT_1..4 }
async function loadoutSets(lo, kind) {
  const parts = kind === 'armor' ? ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] : ['EQUIPMENT_SLOT_1', 'EQUIPMENT_SLOT_2', 'EQUIPMENT_SLOT_3', 'EQUIPMENT_SLOT_4'];
  const names = {};
  for (const l of Object.values(lo?.loadouts || {})) {
    const sid = kind === 'armor' ? l?.armor_set_id : l?.equipment_set_id;
    if (sid != null && l?.name && !/^Loadout \d+$/.test(l.name)) (names[sid] ||= []).push(l.name);
  }
  const src = lo?.[kind] || {};
  const sets = [];
  for (const key of Object.keys(src).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b)) {
    const slot = src[key];
    const items = [];
    for (const p of parts) items.push(slot?.[p]?.data ? (await decodeItems(slot[p].data))[0] || null : null);
    if (items.some(Boolean)) sets.push({ slot: Number(key), names: names[key] || [], equipped: String(src.equipped_set) === key, items });
  }
  // Номер надетого набора: его вещи сейчас на игроке, а в самом наборе пусто (см. inventories)
  const eq = Number(src.equipped_set);
  if (Number.isInteger(eq) && eq > 0 && !sets.some(x => x.slot === eq)) sets.equippedEmpty = { slot: eq, names: names[String(eq)] || [] };
  return sets;
}

// Сохранённые наборы игры (меню Loadouts): броня из слота гардероба + набор снаряжения + питомец + Power.
// pet — uniqueId питомца из pets_data. Пустые «Loadout N» без брони пропускаем.
function savedLoadouts(lo) {
  return Object.values(lo?.loadouts || {})
    .filter(l => l && (l.armor_set_id != null || l.equipment_set_id != null || l.pet))
    .map(l => ({ id: Number(l.id), name: /^Loadout \d+$/.test(l.name || '') ? null : l.name || null, armorSlot: l.armor_set_id ?? null, equipmentSlot: l.equipment_set_id ?? null, pet: l.pet || null, power: l.power_stone || null }))
    .sort((a, b) => a.id - b.id);
}

async function inventories(m) {
  const inv = m.inventory || {};
  const dec = d => decodeItems(d?.data);
  const backpacks = {};
  for (const [k, v] of Object.entries(inv.backpack_contents || {})) backpacks[k] = await dec(v);
  const bags = {};
  for (const [k, v] of Object.entries(inv.bag_contents || {})) bags[k] = await dec(v);
  const r = {
    inventory: await dec(inv.inv_contents),
    armor: (await dec(inv.inv_armor)).reverse(), // шлем, нагрудник, поножи, ботинки
    equipment: await dec(inv.equipment_contents),
    wardrobeSets: await loadoutSets(m.loadout, 'armor'),
    equipmentSets: await loadoutSets(m.loadout, 'equipment'),
    loadouts: savedLoadouts(m.loadout),
    backpackItems: (await Promise.all(Object.entries(inv.backpack_icons || {}).sort((a, b) => a[0] - b[0]).map(([, v]) => dec(v)))).flat(),
    enderChest: await dec(inv.ender_chest_contents),
    vault: await dec(inv.personal_vault_contents),
    backpacks,
    talismans: bags.talisman_bag || [],
    quiver: bags.quiver || [],
    potions: bags.potion_bag || [],
    fishingBag: bags.fishing_bag || [],
    sacksBag: bags.sacks_bag || [],
    sacks: inv.sacks_counts || {},
    rift: await riftInv(m.rift?.inventory),
    // Inventory API выключен: Hypixel всё равно присылает inventory, но только с Sack of Sacks
    // (bag_contents.sacks_bag), без инвентаря, брони, эндерсундука и Accessory Bag
    apiDisabled: !m.inventory || !(inv.inv_contents || inv.inv_armor || inv.ender_chest_contents || inv.bag_contents?.talisman_bag),
  };
  // Старое поле, если вдруг вернётся; иначе гардероб = все части из наборов брони (по 4 в ряд)
  // Надетый набор в гардеробе пустой: показываем его на своём месте с надетой бронёй (иначе столбцы начинаются со «Слот 2»)
  const ee = r.wardrobeSets.equippedEmpty;
  if (ee && r.armor.some(Boolean)) {
    r.wardrobeSets.push({ slot: ee.slot, names: ee.names, equipped: true, worn: true, items: r.armor.slice(0, 4).map(i => i || null) });
    r.wardrobeSets.sort((a, b) => a.slot - b.slot);
  }
  delete r.wardrobeSets.equippedEmpty;
  const old = await dec(inv.wardrobe_contents);
  r.wardrobe = old.length ? old : r.wardrobeSets.filter(s => !s.worn).flatMap(s => s.items); // надетое уже в armor
  r.wardrobeEquipment = r.equipmentSets.flatMap(s => s.items);
  r.wardrobeMissing = !r.wardrobe.some(Boolean);
  return r;
}

// Дополнительные сырые данные для гайдов по добыче, Foraging (Galatea) и Garden.
// HotM/HotF (опыт, узлы, токены, кристаллы, Glacite) уже разобраны в mining / hotfXp / hotfNodes — здесь только остальное.
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
// foraging_core.whispers = { forest: { total, available?, spent? }, desert: {…} } (поля внутри могут меняться)
function pickWhispers(w) {
  const one = o => (typeof o === 'number' ? { total: o, available: o, spent: 0 } : {
    total: num(o?.total), available: o?.available != null ? num(o.available) : o?.current != null ? num(o.current) : null, spent: num(o?.spent),
  });
  return { forest: one(w?.forest), desert: one(w?.desert) };
}
export function gatherRaw(m) {
  const st = m.skill_tree || {};
  const fc = m.foraging_core || {};
  const fo = m.foraging || {};
  const gl = m.glacite_player_data || {};
  return {
    tokensForest: num(st.tokens_spent?.forest),
    axeAbility: st.selected_ability?.foraging || null,
    whispers: pickWhispers(fc.whispers),
    treeGifts: fo.tree_gifts || {},
    hina: fo.hina || {},
    starlyn: fo.starlyn || {},
    dailyLogs: Array.isArray(fc.daily_log_cut) ? fc.daily_log_cut : [],
    fossils: Array.isArray(gl.fossils_donated) ? gl.fossils_donated : [],
    forge: Object.values(m.forge?.forge_processes?.forge_1 || {}).map(f => ({ id: f?.id, start: num(f?.startTime), slot: num(f?.slot) })).filter(f => f.id),
    gardenPlayer: m.garden_player_data || {},
  };
}

/**
 * Участники кооп-острова без вышедших и не принявших приглашение.
 * share — доля игрока в общем сборе коллекций: в коопе тиры коллекций общие, а member.collection у каждого свой вклад.
 */
export function coopRoster(profile) {
  const members = Object.entries(profile?.members || {})
    .filter(([, m]) => !g(m, 'profile.deletion_notice') && g(m, 'profile.coop_invitation.confirmed', true) !== false);
  const sums = members.map(([id, m]) => [id, Object.values(m.collection || {}).reduce((s, n) => s + (Number(n) || 0), 0)]);
  const total = sums.reduce((s, [, n]) => s + n, 0);
  return sums.map(([id, n]) => ({ uuid: id, share: total > 0 ? Math.round(n / total * 1000) / 1000 : null }));
}

/**
 * Общие для кооператива коллекции и крафты миньонов. null — профиль одиночный.
 * Уникальные крафты миньонов, как в игре (и у SkyCrypt / SkyHelper), — объединение crafted_generators всех,
 * кто когда-либо был в коопе: ушедшие остаются в members с deletion_notice, и их крафты профиль не теряет.
 * Коллекции и список участников — только по нынешним участникам.
 */
export function coopShared(profile, uuid) {
  const members = Object.entries(profile?.members || {});
  if (members.length < 2) return null;
  const collections = {}, minions = new Set(), list = [];
  for (const [id, mm] of members) {
    // Приглашённый, но не принявший приглашение, в коопе не был
    if (mm?.profile?.coop_invitation && !mm.profile.coop_invitation.confirmed) continue;
    for (const s of mm?.player_data?.crafted_generators || []) minions.add(s);
    if (mm?.profile?.deletion_notice) continue; // ушёл из коопа
    const col = mm?.collection;
    for (const [k, v] of Object.entries(col || {})) collections[k] = (collections[k] || 0) + (Number(v) || 0);
    list.push({ uuid: id, self: id === uuid, collectionsApi: !!col, minions: (mm?.player_data?.crafted_generators || []).length });
  }
  const own = new Set(profile.members?.[uuid]?.player_data?.crafted_generators || []);
  if (list.length < 2 && minions.size === own.size) return null;
  // Сейчас один, но крафты ушедших засчитаны: коллекции свои (collections: null), миньоны — общие
  return { members: list, collections: list.length < 2 ? null : collections, minions: [...minions] };
}

export async function parseMember(profile, uuid, extra = {}) {
  const m = profile.members?.[uuid] || {};
  const pd = m.player_data || {};
  const xp = pd.experience || {};

  const farmingCap = 50 + (g(m, 'jacobs_contest.perks.farming_level_cap', 0));
  const tamingSacrificedTypes = g(m, 'pets_data.pet_care.pet_types_sacrificed', []);
  const tamingSacrificed = tamingSacrificedTypes.length;
  const tamingCap = 50 + Math.min(10, tamingSacrificed);

  const skills = {};
  for (const key of Object.keys(SKILLS)) {
    let raw = xp[tx`SKILL_${key.toUpperCase()}`];
    // Social общий на весь профиль: в игре виден опыт всех участников вместе
    if (key === 'social') {
      const all = Object.values(profile.members || {}).map(mm => mm?.player_data?.experience?.SKILL_SOCIAL).filter(v => v != null);
      if (all.length) raw = all.reduce((a, b) => a + b, 0);
    }
    const cap = key === 'farming' ? farmingCap : key === 'taming' ? tamingCap : undefined;
    skills[key] = { ...skillLevel(key, raw || 0, cap), name: SKILLS[key], apiMissing: raw == null, ...(CAP_RAISE[key] && cap < CAP_RAISE[key].max ? { capMax: CAP_RAISE[key].max, capHow: CAP_RAISE[key].how } : {}) };
  }
  const mainSkills = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy', 'taming', 'carpentry'];
  const skillAverage = mainSkills.reduce((s, k) => s + skills[k].level + (skills[k].progress < 1 ? skills[k].progress : 0), 0) / mainSkills.length;
  // Overflow Average: как у ботов (!osk) — 10 скиллов вместе с Hunting, без Social и Runecrafting, без игрового капа
  const overflowSkills = [...mainSkills, 'hunting'];
  const skillAverageOverflow = round2(overflowSkills.reduce((s, k) => s + overflowLevel(k, skills[k].xp).level, 0) / overflowSkills.length);

  const slayers = {};
  for (const [key, meta] of Object.entries(SLAYERS)) {
    const b = g(m, tx`slayer.slayer_bosses.${key}`, {});
    const kills = {}, attempts = {};
    for (let t = 0; t < 5; t++) { kills[t + 1] = b[tx`boss_kills_tier_${t}`] || 0; attempts[t + 1] = b[tx`boss_attempts_tier_${t}`] || 0; }
    slayers[key] = { ...slayerLevel(key, b.xp || 0), ...meta, kills, attempts };
  }

  const d = m.dungeons || {};
  const cata = g(d, 'dungeon_types.catacombs', {});
  const master = g(d, 'dungeon_types.master_catacombs', {});
  const classes = {};
  for (const [k, ru] of Object.entries(CLASSES)) {
    classes[k] = { ...cataLevel(g(d, tx`player_classes.${k}.experience`, 0)), name: ru };
  }
  const dungeons = {
    catacombs: cataLevel(cata.experience || 0),
    selectedClass: d.selected_dungeon_class || null,
    classes,
    classAverage: Object.values(classes).reduce((s, c) => s + c.level, 0) / 5,
    floors: cata.tier_completions || {},
    masterFloors: master.tier_completions || {},
    fastestS: cata.fastest_time_s || {},
    fastestSPlus: cata.fastest_time_s_plus || {},
    masterFastestSPlus: master.fastest_time_s_plus || {},
    // Рекорды этажей: лучший счёт (300+ — S+), самый большой урон по классам
    bestScore: cata.best_score || {},
    masterBestScore: master.best_score || {},
    mostDamage: Object.fromEntries(Object.keys(CLASSES).map(k => [k, Math.max(Number(g(cata, tx`most_damage_${k}.best`, 0)) || 0, Number(g(master, tx`most_damage_${k}.best`, 0)) || 0)]).filter(([, v]) => v > 0)),
    watcherKills: g(cata, 'watcher_kills.total', 0),
    secrets: d.secrets || g(m, 'player_stats.dungeons.secrets', 0) || 0,
  };

  const mc = m.mining_core || {};
  // Деревья HOTM/HOTF теперь в members[uuid].skill_tree (опыт, узлы, токены); mining_core — старое место
  const st = m.skill_tree || {};
  const hotmNodes = st.nodes?.mining || mc.nodes || {};
  const mining = {
    hotm: hotmLevel(st.experience?.mining ?? mc.experience ?? 0),
    powder: {
      mithril: (mc.powder_mithril || 0) + (mc.powder_spent_mithril || 0),
      gemstone: (mc.powder_gemstone || 0) + (mc.powder_spent_gemstone || 0),
      glacite: (mc.powder_glacite || 0) + (mc.powder_spent_glacite || 0),
      mithrilAvail: mc.powder_mithril || 0, gemstoneAvail: mc.powder_gemstone || 0, glaciteAvail: mc.powder_glacite || 0,
    },
    nodes: hotmNodes,
    potm: hotmNodes.core_of_the_mountain ?? hotmNodes.special_0 ?? 0,
    tokensSpent: st.tokens_spent?.mountain ?? null,
    ability: st.selected_ability?.mining || mc.selected_pickaxe_ability || null,
    crystals: Object.fromEntries(Object.entries(mc.crystals || {}).map(([k, v]) => [k.replace(/_crystal$/, ''), { state: v.state || null, found: v.total_found || 0, placed: v.total_placed || 0 }])),
    kingQuests: g(mc, 'biomes.goblin.king_quests_completed', 0),
    mineshafts: g(m, 'glacite_player_data.mineshafts_entered', 0),
    corpses: g(m, 'glacite_player_data.corpses_looted', {}),
    nucleusRuns: g(m, 'leveling.completions.NUCLEUS_RUNS', 0),
    // Забранная веха Commission Milestones: objectives.tutorial «commission_milestone_reward_mining_xp_tier_N»
    commissionMilestone: (g(m, 'objectives.tutorial', []) || []).reduce((mx, k) => {
      const t = /^commission_milestone_reward_mining_xp_tier_(\d+)$/.exec(String(k));
      return t ? Math.max(mx, Number(t[1])) : mx;
    }, 0),
    nucleusMeter: findNucleusMeter(m),
  };

  const nether = m.nether_island_player_data || {};
  const kuudraTiers = nether.kuudra_completed_tiers || {};
  const crimson = {
    faction: nether.selected_faction || null,
    barbarianRep: nether.barbarians_reputation || 0,
    mageRep: nether.mages_reputation || 0,
    kuudra: { basic: kuudraTiers.none || 0, hot: kuudraTiers.hot || 0, burning: kuudraTiers.burning || 0, fiery: kuudraTiers.fiery || 0, infernal: kuudraTiers.infernal || 0 },
    dojo: nether.dojo || {},
    // лучшая волна по тирам: kuudra_completed_tiers.highest_wave_<tier> (SkyCrypt пропускает эти ключи при подсчёте заходов)
    kuudraWaves: Object.fromEntries(Object.entries(kuudraTiers).filter(([key]) => key.startsWith('highest_wave_')).map(([key, v]) => [key.slice(13) === 'none' ? 'basic' : key.slice(13), v || 0])),
    // поля ниже читаются, только если Hypixel их отдаёт (на живом профиле не сверены)
    lastMinibosses: Array.isArray(nether.last_minibosses_killed) ? nether.last_minibosses_killed : [],
    matriarch: nether.matriarch && typeof nether.matriarch === 'object' ? { pearls: nether.matriarch.pearls_collected ?? null, lastAttempt: nether.matriarch.last_attempt ?? null } : null,
    abiphoneContacts: g(nether, 'abiphone.active_contacts', []).length,
    trophyFish: m.trophy_fish || nether.trophy_fish || {}, // сейчас лежит в members[uuid].trophy_fish
  };

  const acc = m.accessory_bag_storage || {};
  const pets = (g(m, 'pets_data.pets', [])).map(p => ({
    type: p.type, tier: p.tier, exp: p.exp || 0, active: !!p.active, heldItem: p.heldItem || null, uid: p.uniqueId || p.uuid || null,
    skin: p.skin || null, candyUsed: p.candyUsed || 0,
    id: tx`${p.type};${PET_TIERS.indexOf(p.tier)}`, ...petLevel(p.type, p.tier, p.exp || 0),
  })).sort((a, b) => Number(b.active) - Number(a.active) || PET_TIERS.indexOf(b.tier) - PET_TIERS.indexOf(a.tier) || b.level - a.level);

  const inv = await inventories(m);

  // Остальные разделы профиля, которые раньше не читались (сверка полей API, 2026-11-23)
  const easter = g(m, 'events.easter', null);
  const ps = m.player_stats || {};
  const sq = g(m, 'slayer.slayer_quest', null);
  const extras = {
    chocolate: easter ? {
      prestige: easter.chocolate_level || 0,
      rabbits: Object.keys(easter.rabbits || {}).filter(k => typeof easter.rabbits[k] === 'number').length,
      chocolate: easter.chocolate || 0,
      total: easter.total_chocolate || 0,
      sincePrestige: easter.chocolate_since_prestige || 0,
      employees: easter.employees || {},
      timeTower: g(easter, 'time_tower.level', 0),
      barn: easter.rabbit_barn_capacity_level || 0,
      clickUpgrades: easter.click_upgrades || 0,
      // Для советов (analysis/chocolate.js); null — поля нет в API, совет не показываем
      timeTowerCharges: g(easter, 'time_tower.charges', null),
      shrine: easter.rabbit_rarity_upgrades ?? null,
      coach: easter.chocolate_multiplier_upgrades ?? null,
      hitmanSlots: g(easter, 'rabbit_hitmen.rabbit_hitmen_slots', null),
      shopSpent: g(easter, 'shop.chocolate_spent', null),
      found: Object.keys(easter.rabbits || {}).filter(k => typeof easter.rabbits[k] === 'number'),
      locations: g(easter, 'rabbits.collected_locations', null),
    } : null,
    attributes: Object.entries(g(m, 'attributes.stacks', {})).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    shards: (g(m, 'shards.owned', [])).map(x => ({ type: x.type, owned: x.amount_owned || 0 })),
    shardHunts: { fishing: ps.shard_fishing_hunts || 0, combat: ps.shard_combat_hunts || 0, forest: ps.shard_forest_hunts || 0, trap: ps.shard_trap_hunts || 0, salt: ps.shard_salt_hunts || 0 },
    leveling: {
      symbol: g(m, 'leveling.selected_symbol', null), tasksDone: (g(m, 'leveling.completed_tasks', [])).length,
      petScore: g(m, 'leveling.highest_pet_score', 0), bopBonus: g(m, 'leveling.bop_bonus', null),
    },
    experiments: (() => {
      const e = m.experimentation || {};
      const best = (o, pre) => Math.max(0, ...Object.entries(o || {}).filter(([k]) => k.startsWith(pre)).map(([, v]) => Number(v) || 0));
      // Самая высокая ставка, на которой игрок хоть раз играл: attempts_N / claims_N, N — 0 Beginner … 5 Metaphysical
      const top = o => Math.max(-1, ...Object.entries(o || {}).filter(([k, v]) => /^(attempts|claims)_\d+$/.test(k) && Number(v) > 0).map(([k]) => Number(k.split('_')[1])));
      const sum = (o, pre) => Object.entries(o || {}).filter(([k]) => k.startsWith(pre)).reduce((s, [, v]) => s + (Number(v) || 0), 0);
      return {
        superpairs: best(e.pairings, 'best_score_'), chronomatron: best(e.simon, 'best_score_'), ultrasequencer: best(e.numbers, 'best_score_'), serums: e.serums_drank || 0,
        top: { superpairs: top(e.pairings), chronomatron: top(e.simon), ultrasequencer: top(e.numbers) },
        claims: sum(e.pairings, 'claims_'),
      };
    })(),
    gardenChips: pd.garden_chips || {},
    deaths: pd.death_count || 0,
    zones: (pd.visited_zones || []).length,
    soulflow: g(m, 'item_data.soulflow', 0),
    activeSlayer: sq ? { type: sq.type, tier: (sq.tier || 0) + 1, xp: sq.combat_xp || 0 } : null,
    auctions: ps.auctions ? { sold: ps.auctions.completed || 0, won: ps.auctions.won || 0, earned: ps.auctions.gold_earned || 0, spent: ps.auctions.gold_spent || 0, highestBid: ps.auctions.highest_bid || 0, fees: ps.auctions.fees || 0 } : null,
    mythos: ps.mythos ? { kills: ps.mythos.kills || 0, burrows: g(ps, 'mythos.burrows_dug_treasure.total', 0) + g(ps, 'mythos.burrows_dug_combat.total', 0) + g(ps, 'mythos.burrows_dug_next.total', 0), chains: g(ps, 'mythos.burrows_chains_complete.total', 0) } : null,
    gifts: ps.gifts || null,
    races: ps.races || null,
    highestDamage: ps.highest_damage || ps.highest_critical_damage || 0,
    candy: g(ps, 'candy_collected.total', 0),
    dragons: g(ps, 'end_island.dragon_fight.amount_summoned', null),
    zealotLoot: g(ps, 'end_island.special_zealot_loot_collected', 0),
    abiphone: (g(nether, 'abiphone.active_contacts', [])).length,
    matriarchPearls: g(nether, 'matriarch.pearls_collected', 0),
    trapperPelts: g(m, 'quests.trapper_quest.pelt_count', 0),
    harpSong: g(m, 'foraging.songs.harp.selected_song', null),
    treeGifts: g(m, 'foraging.tree_gifts', {}),
    dungeonClass: g(m, 'dungeons.selected_dungeon_class', null),
    communityUpgrades: (g(profile, 'community_upgrades.upgrade_states', [])).reduce((o, u) => ({ ...o, [u.upgrade]: Math.max(o[u.upgrade] || 0, u.tier || 0) }), {}),
    firstJoin: g(m, 'profile.first_join', null),
    // Кто чаще всего убивает (player_stats.deaths: причина → раз, плюс total)
    deathCauses: Object.entries(ps.deaths || {}).filter(([k, v]) => k !== 'total' && Number(v) > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, n: Number(n) })),
    // Вехи питомцев Rock (руда) и Dolphin (морские существа): player_stats.pets.milestone
    petMilestones: { ores: Number(g(ps, 'pets.milestone.ores_mined', 0)) || 0, seaCreatures: Number(g(ps, 'pets.milestone.sea_creatures_killed', 0)) || 0 },
    // Улучшение кооператива, которое сейчас строится (Elizabeth → Community Shop); null — ничего не строится
    communityUpgrading: (() => {
      const u = g(profile, 'community_upgrades.currently_upgrading', null);
      return u && typeof u === 'object' && u.upgrade ? { id: String(u.upgrade).toLowerCase(), tier: Number(u.new_tier ?? u.tier) || null, startedAt: Number(u.start_ms ?? u.started_ms) || null } : null;
    })(),
  };

  // Готовый к показу вид: названия вместо ID, иконки, максимумы (страница «Прогресс»)
  try {
    const gd = extra.garden || {};
    extras.view = {
      attributes: xv.viewAttributes(extras.attributes),
      shards: xv.viewShards(extras.shards),
      employees: extras.chocolate ? xv.viewEmployees(extras.chocolate.employees) : [],
      chips: xv.viewGardenChips(extras.gardenChips),
      greenhouse: xv.viewGreenhouse(gd.upgrades),
      visitors: xv.viewVisitors(gd.activeVisitors),
      treeGifts: xv.viewTreeGifts(extras.treeGifts),
      community: xv.viewCommunity(extras.communityUpgrades),
      upgrading: xv.viewUpgrading(extras.communityUpgrading),
      petMilestones: xv.viewPetMilestones(extras.petMilestones),
      gardenLevel: gd.experience != null ? xv.gardenLevel(Number(gd.experience) || 0) : null,
      max: { timeTower: xv.TIME_TOWER_MAX, plots: xv.GARDEN_PLOTS },
    };
  } catch (e) { extras.view = null; }

  return {
    uuid,
    profileId: profile.profile_id,
    profileName: profile.cute_name,
    gameMode: profile.game_mode || 'normal',
    mode: profileMode(profile.game_mode),
    coopMembers: Math.max(1, coopRoster(profile).length),
    coopRoster: coopRoster(profile), // [{ uuid, share }] — и сам игрок тоже (member.coop — общие коллекции и миньоны)
    sbLevel: (g(m, 'leveling.experience', 0)) / 100,
    purse: g(m, 'currencies.coin_purse', 0),
    bank: g(profile, 'banking.balance', null),
    personalBank: g(m, 'profile.bank_account', 0),
    // Для блока «Bank»: улучшения счёта лежат в leveling.completed_tasks (BANK_UPGRADE_GOLD…), начисления процентов — в transactions
    bankUpgrades: (g(m, 'leveling.completed_tasks', []) || []).filter(t => typeof t === 'string' && t.startsWith('BANK_UPGRADE_')),
    personalBankUpgrade: g(m, 'profile.personal_bank_upgrade', 0),
    bankTransactions: (g(profile, 'banking.transactions', []) || []).slice(-60).map(t => ({
      amount: Number(t?.amount) || 0, at: Number(t?.timestamp) || 0, action: t?.action || null,
      by: String(t?.initiator_name || '').replace(/§./g, '').trim(),
    })),
    cookie: (g(m, 'profile.cookie_buff_active', false)),
    // Зелья (active/paused/disabled) и торты Century Cake — блок «Зелья и баффы» и прибавка к статам на главной
    effects: parseEffects(m.player_data || {}),
    essence: Object.fromEntries(Object.entries(g(m, 'currencies.essence', {})).map(([k, v]) => [k, v.current || 0])),
    fairySouls: { collected: g(m, 'fairy_soul.total_collected', 0), exchanges: g(m, 'fairy_soul.fairy_exchanges', 0), unspent: g(m, 'fairy_soul.unspent_souls', 0) },
    abiphone: parseAbiphone(m),
    harp: parseHarp(m),
    skills, skillAverage, skillAverageOverflow, farmingCap, tamingCap, tamingSacrificed, tamingSacrificedTypes,
    slayers,
    dungeons,
    mining,
    hotfXp: g(m, 'skill_tree.experience.foraging', null) ?? g(m, 'foraging_core.experience', null),
    hotfNodes: g(m, 'skill_tree.nodes.foraging', {}),
    gather: gatherRaw(m),
    crimson,
    magicalPower: acc.highest_magical_power || 0,
    selectedPower: acc.selected_power || null,
    tuning: acc.tuning || {},
    unlockedPowers: acc.unlocked_powers || [],
    bagUpgrades: acc.bag_upgrades_purchased || 0,
    riftPrism: !!g(m, 'rift.access.consumed_prism', false),
    pets,
    collections: m.collection || {},
    unlockedCollTiers: pd.unlocked_coll_tiers || [],   // ["NETHER_STALK_11", ...]
    minions: pd.crafted_generators || [],
    // Кооп: коллекции в игре общие (сумма вкладов участников), уникальные крафты миньонов тоже складываются.
    // collection нет у участника с выключенным Collections API — его вклад не виден.
    coop: coopShared(profile, uuid),
    perks: pd.perks || {},
    garden: { copper: g(m, 'garden_player_data.copper', 0), ...extra.garden },
    jacob: {
      medals: g(m, 'jacobs_contest.medals_inv', {}),
      perks: g(m, 'jacobs_contest.perks', {}),
      uniqueBrackets: g(m, 'jacobs_contest.unique_brackets', {}),
      personalBests: g(m, 'jacobs_contest.personal_bests', {}),
      contests: contestStats(g(m, 'jacobs_contest.contests', {})),
    },
    rift: {
      motes: g(m, 'currencies.motes_purse', 0),
      enigmaSouls: (g(m, 'rift.enigma.found_souls', [])).length,
      // Сырые данные Рифта для гайда (server/rift): коды душ, таймчармы, глаза Porhtal, части Montezuma
      foundSouls: g(m, 'rift.enigma.found_souls', []),
      boughtCloak: !!g(m, 'rift.enigma.bought_cloak', false),
      trophies: (g(m, 'rift.gallery.secured_trophies', []) || []).map(t => t?.type).filter(Boolean),
      eliseStep: g(m, 'rift.gallery.elise_step', 0),
      eyes: g(m, 'rift.wither_cage.killed_eyes', []),
      cats: g(m, 'rift.dead_cats.found_cats', []),
      catDetector: !!g(m, 'rift.dead_cats.picked_up_detector', false),
      montezuma: g(m, 'rift.dead_cats.montezuma', null),
      boundaries: g(m, 'rift.lifetime_purchased_boundaries', []),
      areasSeen: Object.entries(m.rift || {}).filter(([k, v]) => !['inventory', 'access', 'enigma', 'gallery', 'dead_cats', 'wither_cage', 'lifetime_purchased_boundaries', 'slayer_quest'].includes(k) && hasTruthy(v)).map(([k]) => k),
      quests: {
        shaniaStage: g(m, 'rift.dreadfarm.shania_stage', 0),
        bughunterStep: g(m, 'rift.wyld_woods.bughunter_step', 0),
        threebrothers: (g(m, 'rift.wyld_woods.talked_threebrothers', []) || []).length,
        sirius: !!g(m, 'rift.wyld_woods.sirius_completed_q_a', false),
        mirrorverse: !!g(m, 'rift.west_village.mirrorverse.claimed_reward', false),
        mirrorRooms: (g(m, 'rift.west_village.mirrorverse.visited_rooms', []) || []).length,
        okronWand: !!g(m, 'rift.west_village.glyphs.claimed_wand', false),
        leechScience: !!g(m, 'rift.black_lagoon.delivered_science_paper', false),
        wizardStep: g(m, 'rift.wizard_tower.wizard_quest_step', 0),
        grubberStacks: g(m, 'rift.castle.grubber_stacks', 0),
      },
    },
    fishing: parseFishing(m),
    bestiaryMilestone: g(m, 'bestiary.milestone.last_claimed_milestone', 0),
    // Убийства по мобам — для уровней Bestiary в блоке Magic Find. В /api/state не уходят (lightMember)
    bestiaryKills: g(m, 'bestiary.kills', {}),
    museum: await parseMuseum(extra),
    extras,
    inv,
    lastSave: g(m, 'profile.last_save', null) || profile.last_save || null,
    // Метки активности (по убыванию) для «С возвращением»: last_save в API пустой
    activity: compactActivity(activityTimes(m, { bank: coopRoster(profile).length <= 1 ? (g(profile, 'banking.transactions', []) || []).map(t => ({ at: t?.timestamp })) : [] })),
    // Сырые поля ежедневных дел для «Дела на сегодня» (analysis/dailies.js)
    daily: {
      experiments: ['pairings', 'simon', 'numbers'].map(k => Number(g(m, tx`experimentation.${k}.last_claimed`, 0)) || 0),
      quests: Object.entries(g(nether, 'quests.quest_data', {}) || {}).filter(([k, q]) => k !== 'quest_list' && q && typeof q === 'object').map(([id, q]) => ({ id, status: q.status || null, at: Number(q.completed_at) || 0 })),
      questList: (g(nether, 'quests.quest_data.quest_list', []) || []).length,
      questsReset: Number(g(nether, 'quests.last_reset', 0)) || 0,
      matriarch: Number(g(nether, 'matriarch.last_attempt', 0)) || 0,
      visitors: (extra.garden?.activeVisitors || []).length,
    },
  };
}

export function parseGarden(resp) {
  const gd = resp?.garden;
  if (!gd) return {};
  return {
    experience: gd.garden_experience || 0,
    cropUpgrades: gd.crop_upgrade_levels || {},
    resources: gd.resources_collected || {},
    unlockedPlots: (gd.unlocked_plots_ids || []).length,
    visitorsServed: g(gd, 'commission_data.total_completed', 0),
    uniqueVisitors: g(gd, 'commission_data.unique_npcs_served', 0),
    composter: gd.composter_data?.upgrades || {},
    composterData: gd.composter_data ? { organic: gd.composter_data.organic_matter || 0, fuel: gd.composter_data.fuel_units || 0, compost: gd.composter_data.compost_items || 0 } : null,
    upgrades: gd.garden_upgrades || {},
    barnSkin: gd.selected_barn_skin || null,
    activeVisitors: Object.entries(gd.active_commissions || {}).map(([npc, c]) => ({ npc, status: c.status, items: (c.requirement || []).map(r => ({ id: r.item, amount: r.amount, originalId: r.original_item, originalAmount: r.original_amount })) })),
    visits: g(gd, 'commission_data.visits', {}),
    plotIds: gd.unlocked_plots_ids || [],
  };
}

/**
 * Прогресс RNG-метра Crystal Nucleus, если Hypixel его отдаёт. На 23.11.2026 поле в API не найдено,
 * поэтому ищем по имени (как у метров слееров/данжей: «rng»/«meter» рядом с «nucleus»), чтобы подхватить его, когда появится.
 * @returns {{ xp: number, selected: string|null } | null}
 */
export function findNucleusMeter(m) {
  const seen = new Set();
  const walk = (o, path, depth) => {
    if (!o || typeof o !== 'object' || depth > 5 || seen.has(o)) return null;
    seen.add(o);
    if (/nucleus/i.test(path) && /rng|meter/i.test(path) && !Array.isArray(o)) {
      const xpKey = Object.keys(o).find(k => /xp|exp|score|progress/i.test(k) && Number.isFinite(Number(o[k])));
      if (xpKey) {
        const selKey = Object.keys(o).find(k => /selected|item|drop/i.test(k) && typeof o[k] === 'string');
        return { xp: Number(o[xpKey]), selected: selKey ? String(o[selKey]).toUpperCase() : null };
      }
    }
    for (const [k, v] of Object.entries(o)) {
      if (!v || typeof v !== 'object') continue;
      const r = walk(v, path + '.' + k, depth + 1);
      if (r) return r;
    }
    return null;
  };
  try { return walk(m, '', 0); } catch { return null; }
}
