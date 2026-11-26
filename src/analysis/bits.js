// Bits: сколько монет стоит 1 Bit в каждом товаре Community Shop, что выгодно продать, что взять себе.
import { BITS_SHOP, COOKIE_BITS, FAME_RANKS } from './wealth-data.js';
import { tx } from '../../i18n/msg.js';

// «EXPERTISE;1» → «Книга Expertise I» (в NEU у всех книг одно имя Enchanted Book)
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function bookName(id) {
  const m = /^([A-Z0-9_]+);(\d+)$/.exec(id);
  if (!m) return null;
  return tx`Книга ${m[1].toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} ${ROMAN[+m[2]] || m[2]}`;
}

const bookIds = id => {
  const m = /^([A-Z0-9_]+);(\d+)$/.exec(id);
  return m ? [id, tx`ENCHANTMENT_${m[1]}_${m[2]}`] : [id];
};

/**
 * @param member разобранный профиль (может быть null — тогда без личных советов)
 * @param ctx { sellPrice(id) → монеты при продаже, buyPrice(id) → цена покупки, itemName(id), bits?, fame? }
 */
export function bitsAnalysis(member, ctx) {
  const sell = id => { for (const k of bookIds(id)) { const v = ctx.sellPrice(k); if (v > 0) return v; } return 0; };
  const fameIdx = Math.max(0, Math.min(FAME_RANKS.length - 1, Number.isFinite(+ctx.fame) ? +ctx.fame : 0));
  const fame = FAME_RANKS[fameIdx];
  const cookiePrice = ctx.buyPrice('BOOSTER_COOKIE') || 0;
  const cookieBits = Math.round(COOKIE_BITS * fame.mult);
  const bits = Math.max(0, Number(ctx.bits) || 0);

  const owned = ownedIds(member);
  const items = BITS_SHOP.map(s => {
    const price = sell(s.id);
    return {
      id: s.id, name: bookName(s.id) || ctx.itemName(s.id) || s.id, bits: s.bits, use: s.use,
      price, perBit: price > 0 ? price / s.bits : 0, owned: s.once ? hasFamily(owned, s.id) : false,
      affordable: bits > 0 ? Math.floor(bits / s.bits) : null,
    };
  }).sort((a, b) => b.perBit - a.perBit);

  const sellable = items.filter(i => i.perBit > 0);
  const best = sellable[0] || null;
  const forYou = member ? personalPicks(member, items, owned) : [];

  return {
    fame: { idx: fameIdx, ...fame }, ranks: FAME_RANKS.map((r, i) => ({ idx: i, name: r.name, mult: r.mult })),
    bits,
    cookie: { price: cookiePrice, bits: cookieBits, coinsPerBit: cookiePrice > 0 ? cookiePrice / cookieBits : 0,
      // Продать все Bits печенья через лучший товар: сколько монет вернётся с одного печенья
      returnOnBest: best ? Math.round(cookieBits * best.perBit) : 0 },
    best: best && { id: best.id, name: best.name, perBit: best.perBit, bits: best.bits, price: best.price },
    bitsWorth: best && bits ? Math.round(bits * best.perBit) : 0,
    items, forYou,
  };
}

// Какие из «одноразовых» вещей у игрока уже есть: аксессуары, рюкзаки, мешки
function ownedIds(member) {
  const s = new Set();
  const inv = member?.inv || {};
  const add = arr => { for (const it of arr || []) if (it?.id) s.add(it.id); };
  add(inv.talismans); add(inv.inventory); add(inv.enderChest); add(inv.vault); add(inv.backpackItems); add(inv.sacksBag);
  for (const v of Object.values(inv.backpacks || {})) add(v);
  return s;
}
const FAMILY = { BITS_TALISMAN: ['BITS_TALISMAN', 'BITS_RING', 'BITS_ARTIFACT'], ABICASE_SUMSUNG_1: ['ABICASE_SUMSUNG_1', 'ABICASE_SUMSUNG_2'] };
const hasFamily = (owned, id) => (FAMILY[id] || [id]).some(x => owned.has(x));

function personalPicks(m, items, owned) {
  const by = Object.fromEntries(items.map(i => [i.id, i]));
  const out = [];
  const push = (id, why) => { if (by[id]) out.push({ ...by[id], why }); };
  if (!hasFamily(owned, 'BITS_TALISMAN')) push('BITS_TALISMAN', 'У тебя нет Bits Talisman: это ещё один аксессуар в сумку, то есть +Magical Power.');
  if (!hasFamily(owned, 'ABICASE_SUMSUNG_1')) push('ABICASE_SUMSUNG_1', 'Чехол абифона тоже считается аксессуаром: +Magical Power.');
  const master = Object.keys(m.dungeons?.masterFloors || {}).map(Number).filter(n => n >= 5 && (m.dungeons.masterFloors[n] || 0) > 0);
  if (master.length) push('KISMET_FEATHER', tx`Ты проходишь Master Mode (M${Math.max(...master)}): перебросить сундук ради дорогого дропа обычно выгоднее, чем продать перо.`);
  push('GOD_POTION_2', 'Все эффекты зелий разом. Полезно на любом этапе, особенно для фарма и слеера.');
  const levelling = (m.pets || []).filter(p => p.level < 100 && ['LEGENDARY', 'MYTHIC'].includes(p.tier)).length;
  if (levelling) push('KAT_BOUQUET', 'Есть питомцы, которых можно улучшать у Kat: букет сокращает ожидание.');
  return out;
}
