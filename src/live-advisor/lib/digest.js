// Сжатая сводка профиля для ИИ (~1–2 тыс. токенов). Только факты, которые нужны для совета.
// Текст детерминированный: при тех же данных байты те же, поэтому кэш промпта не ломается.
import { fmtCoins, fmtTime } from './util.js';
import { cleanName, compactItem, compareWeapons } from './inventory.js';
import { briefLines } from '../../calendar/index.js';
import { armorLoadouts, describeLoadout, dungeonLoadout, familiesLabel, offClassPieces, WITHER_FAMILIES, SLOT_RU } from '../../advisor/lib/loadouts.js';
import { tx } from '../../../i18n/msg.js';

const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const lv = s => s ? `${s.level}${s.level < (s.maxLevel ?? 99) && s.progress ? `+${Math.round(s.progress * 100)}%` : ''}` : '?';

/**
 * @param {Object} member
 * @param {Object} analysis  { roadmap, plan?, map?, acc?, gear?, methods? }
 * @param {{ now?: number, tz?: string, priceOf?: Function, priceTrend?: Function, itemName?: Function, topSteps?: number, calendar?: Object }} [opt]
 *   calendar — calendarBrief() из server/calendar: мэр, перки, что идёт и что скоро
 * @returns {string}
 */
export function buildDigest(member, analysis = {}, opt = {}) {
  const m = member || {};
  const L = [];
  const name = opt.itemName || (id => id);
  L.push(tx`# Профиль игрока (данные на ${fmtTime(opt.now ?? Date.now(), opt.tz)})`);
  const coop = (m.coopMembers || 1) > 1;
  if (m.profileName) L.push(tx`«${m.profileName}» — название профиля (сейва), а не имя человека: не пиши о нём как об игроке.`);
  L.push(tx`Профиль ${m.profileName || '?'} (${m.gameMode || 'normal'}, ${coop ? tx`кооп из ${m.coopMembers}` : 'соло'}). SkyBlock ${Math.floor(m.sbLevel || 0)}. Монеты: кошелёк ${fmtCoins(m.purse)}, Bank ${fmtCoins(m.bank)}${coop ? ' (общий Bank кооп-острова)' : ''}${m.personalBank ? tx`, личный Bank ${fmtCoins(m.personalBank)}` : ''}${analysis.gear?.networth?.total ? `, networth ${fmtCoins(analysis.gear.networth.total)}` : ''}. Booster Cookie: ${m.cookie ? 'да' : 'нет'}. Fairy Souls ${m.fairySouls?.collected ?? '?'}/289.`);
  if (coop) {
    const share = (m.coopRoster || []).find(c => c.uuid === m.uuid)?.share;
    // Без этой строки модель пишет «в банке 75М — купи всё», хотя Bank делят все участники острова
    L.push(tx`Кооп: Bank, Garden, миньоны на острове и тиры коллекций общие для всех ${m.coopMembers} участников. Skills, слееры, данжи, снаряжение, аксессуары, питомцы, кошелёк и музей у каждого свои.${share != null ? tx` Личный вклад игрока в коллекции острова: ${Math.round(share * 100)}%.` : ''} Советуя траты из общего банка, напоминай, что это деньги всего коопа.`);
  }

  const sk = Object.entries(m.skills || {}).filter(([, s]) => !s.apiMissing).map(([, s]) => `${s.name || '?'} ${lv(s)}`);
  if (sk.length) L.push(tx`Skills: ${sk.join(', ')}. Средний ${m.skillAverage ?? '?'}.${m.tamingCap ? tx` Кап Taming ${m.tamingCap}.` : ''}`);

  const sl = Object.entries(m.slayers || {}).map(([, s]) => `${s.name || '?'} ${s.level}/${s.maxLevel}`);
  if (sl.length) L.push(`Slayers: ${sl.join(', ')}.`);

  const d = m.dungeons;
  if (d) {
    const fl = Object.entries(d.floors || {}).filter(([, n]) => n).map(([f, n]) => `F${f}×${n}`).join(' ');
    const mf = Object.entries(d.masterFloors || {}).filter(([, n]) => n).map(([f, n]) => `M${f}×${n}`).join(' ') || 'нет';
    const cls = Object.entries(d.classes || {}).map(([, c]) => `${c.name || '?'} ${c.level}`).join(', ');
    L.push(tx`Dungeons: Catacombs ${lv(d.catacombs)}, класс ${d.selectedClass || '?'}; классы: ${cls}. Этажи: ${fl || 'нет'}. Master Mode: ${mf}. Секреты ${d.secrets ?? '?'}.`);
  }
  const c = m.crimson;
  if (c) {
    const k = Object.entries(c.kuudra || {}).map(([t, n]) => `${t} ${n}`).join(', ');
    L.push(tx`Crimson Isle: фракция ${c.faction || '?'}, репутация ${Math.max(c.barbarianRep || 0, c.mageRep || 0)}. Kuudra: ${k}.`);
  }
  if (m.mining) L.push(`Mining: HotM ${m.mining.hotm?.level ?? '?'}, Powder mithril ${fmtCoins(m.mining.powder?.mithril)}, gemstone ${fmtCoins(m.mining.powder?.gemstone)}, glacite ${fmtCoins(m.mining.powder?.glacite)}.`);
  if (m.garden) L.push(tx`Garden: copper ${fmtCoins(m.garden.copper)}, участков ${m.garden.unlockedPlots ?? '?'}/24.`);
  L.push(`Magical Power ${m.magicalPower ?? '?'}${m.selectedPower ? tx`, сила ${m.selectedPower}` : ''}. Rift: Enigma Souls ${m.rift?.enigmaSouls ?? '?'}/52, motes ${fmtCoins(m.rift?.motes)}.`);

  // Снаряжение и питомцы
  // Названия без значков звёзд (они плохо отображаются), звёзды числом
  const short = it => { const c = compactItem(it); return `${c.name}${c.stars ? ` (${c.stars})` : ''}`; };
  const armor = (m.inv?.armor || []).filter(Boolean).map(short).join(', ');
  if (armor) L.push(tx`Надетая броня: ${armor}.`);
  // Сеты в гардеробе: без них модель советует «купи Necron's Armor», когда смешанный Wither уже лежит в слоте
  try {
    const sets = armorLoadouts(m).filter(lo => !lo.equipped).slice(0, 6).map(lo => `${lo.label}: ${lo.items.filter(Boolean).map(short).join(', ')}`);
    if (sets.length) L.push(`Wardrobe: ${sets.join('; ')}.`);
    const dl = dungeonLoadout(m);
    if (dl) {
      const cls = String(m.dungeons?.selectedClass || '').toLowerCase();
      const off = offClassPieces(dl, cls).map(p => `${SLOT_RU[p.slot]} ${WITHER_FAMILIES[p.family].short}`);
      L.push(tx`Сет для данжей: ${dl.label}${dl.equipped ? ' (надет)' : ''}: ${dl.wither}/4 частей Wither${dl.mixed ? tx` вперемешку (${familiesLabel(dl.families)})` : ` (${familiesLabel(dl.families)})`}, звёзд всего ${dl.stars}.`
        + (dl.witherborn ? ' Necron/Storm/Maxor/Goldor/Wither делят один бонус Witherborn, поэтому смешанный сет — полный сет: НЕ советуй покупать Wither-броню с нуля. Можно советовать заменить отдельные части под класс, звёзды, книги, перековку.' : ' Сет неполный: советуй докупить недостающие части, а не весь сет.')
        + (off.length ? tx` Под класс ${cls} хуже подходят: ${off.join(', ')}.` : ''));
    }
  } catch { /* старый формат профиля без гардероба */ }
  const equip = (m.inv?.equipment || []).filter(Boolean).map(short).join(', ');
  if (equip) L.push(tx`Экипировка: ${equip}.`);
  // Сразу кладём оценку урона: на частые вопросы «что сильнее / как одеться» модель отвечает без лишних раундов инструментов
  const cw = compareWeapons(m);
  const ws = Object.entries(cw.wornStats).filter(([k]) => ['Strength', 'Crit Chance', 'Crit Damage', 'Health', 'Defense', 'Intelligence'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ');
  if (ws) L.push(tx`Статы надетой брони и экипировки (из лора): ${ws}.`);
  const weapons = cw.weapons.slice(0, 6).map(w => tx`${w.name}${w.stars ? ` (${w.stars})` : ''}${w.reforge ? ` [${w.reforge}]` : ''}: Damage ${w.stats?.Damage ?? '?'}, Strength ${w.stats?.Strength ?? 0}, удар ~${w.estimate.hit}, крит ~${w.estimate.crit} (${w.where})`);
  if (weapons.length) L.push(tx`Оружие по урону (оценка с текущей бронёй, без скиллов, питомца и способностей): ${weapons.join('; ')}.`);
  else if (analysis.gear?.weapons?.length) L.push(tx`Оружие (все хранилища, по цене): ${analysis.gear.weapons.slice(0, 8).map(short).join(', ')}.`);
  L.push('Подробности (статы из лора, перековка, книги, зачарования, камни, гардероб, мешки, питомцы, аксессуары) — через инструменты get_gear, compare_weapons, find_items, get_pets, get_accessories.');
  const pets = (m.pets || []).slice().sort((a, b) => (b.active - a.active) || (b.exp - a.exp)).slice(0, 6).map(p => `${p.type} ${p.tier}${p.active ? ' (активен)' : ''}`);
  if (pets.length) L.push(tx`Питомцы (лучшие): ${pets.join(', ')}.`);
  if (analysis.acc?.missing?.length != null) L.push(tx`Аксессуары: не хватает ${analysis.acc.missing.length} шт.`);

  // Мэр и события: советы подстраиваются под то, что идёт в игре сейчас (Diana → копать, Paul → данжи и т. п.)
  const cal = opt.auto ? [] : briefLines(opt.calendar);
  if (cal.length) L.push('', '# Сейчас в игре (мэр и события)', ...cal);

  // План от движка правил — это «скелет», ИИ его объясняет и уточняет
  const steps = (analysis.roadmap || []).filter(s => s.priority > 0 && !s.done).slice(0, opt.topSteps ?? 8);
  // Автодиагноз: игрок видит эти шаги рядом в «Что делать», поэтому только названия и запрет их повторять
  if (opt.auto) {
    if (steps.length) {
      L.push('', '# Уже на экране в «Что делать» (НЕ повторять, не перефразировать, не советовать эти действия и их предметы)');
      steps.slice(0, 6).forEach(s => L.push(`- ${s.title}`));
    }
    return L.join('\n');
  }
  if (steps.length) {
    L.push('', '# Шаги от движка правил (по приоритету)');
    steps.forEach((s, i) => {
      L.push(tx`${i + 1}. [${s.id}] (${s.cat}, приоритет ${s.priority}, ${s.effort}${s.cost ? `, ~${fmtCoins(s.cost)}` : ''}${s.needsSaving ? ', нужно накопить' : ''}) ${s.title}. ${cut(s.why, 220)}`);
      if (i < 3 && s.how?.length) L.push(tx`   Как: ${s.how.slice(0, 3).map(h => cut(h, 120)).join(' / ')}`);
    });
  }
  const plan = (analysis.plan || []).slice(0, 5);
  if (plan.length) {
    L.push('', '# План покупок');
    for (const p of plan) L.push(tx`- ${p.title}: ${fmtCoins(p.cost)} (накопительно ${fmtCoins(p.cumulative)})${p.affordableNow ? ', хватает уже сейчас' : ''}${p.hoursOfFarming ? tx`, ~${Math.round(p.hoursOfFarming)} ч заработка` : ''}`);
  }
  const methods = (analysis.methods || []).filter(x => x.available !== false).sort((a, b) => (b.coinsPerHour || 0) - (a.coinsPerHour || 0)).slice(0, 5);
  if (methods.length) {
    L.push('', '# Заработок, доступный сейчас');
    for (const x of methods) L.push(`- ${x.title}${x.coinsPerHour ? tx`: ~${fmtCoins(x.coinsPerHour)}/ч` : ''}${x.tag ? ` (${x.tag})` : ''}`);
  }

  // Цены предметов, которые фигурируют в шагах
  if (opt.priceOf) {
    const ids = [...new Set(steps.flatMap(s => s.items || []))].slice(0, 12);
    const rows = [];
    for (const id of ids) {
      const p = opt.priceOf(id);
      if (!p) continue;
      const t = opt.priceTrend?.(id);
      // priceTrend отдаёт pct уже в процентах (10 = +10%)
      const tr = t?.d1?.pct != null ? tx`, за сутки ${t.d1.pct > 0 ? '+' : ''}${Math.round(t.d1.pct)}%` : '';
      rows.push(`- ${name(id)} [${id}]: ${fmtCoins(p)}${tr}`);
    }
    if (rows.length) L.push('', '# Цены', ...rows);
  }
  return L.join('\n');
}

/** Блок «что изменилось» для автосовета */
export function buildDelta(events, { reason, prevAdvice } = {}) {
  const L = ['# Что изменилось с прошлого совета'];
  if (!events.length) L.push('- Ничего существенного');
  for (const e of events.slice().sort((a, b) => b.weight - a.weight).slice(0, 15)) L.push(`- ${e.text}`);
  if (reason) L.push(tx`(Повод для разбора: ${reason})`);
  if (prevAdvice?.headline) L.push('', tx`Прошлый совет был: «${prevAdvice.headline}». Не повторяй его слово в слово; обнови вывод и цифры.`);
  return L.join('\n');
}
