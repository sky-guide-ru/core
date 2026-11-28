// Гайд по Kuudra: тиры, репутация фракции, броня Kuudra, ключи и лут — по профилю игрока.
import { petLadderSection } from './pets.js';
import { CLASSES } from '../../i18n/ru.js';
import { KUUDRA_TIERS, KUUDRA_SETS, KUUDRA_LOOT } from './combat/data.js';
import { fmtCoins, plural, num, methodText, sortNext, pieces, nice, priceOfDrop } from './combat/util.js';
import { tx } from '../../i18n/msg.js';

const SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];

/**
 * Броня Kuudra у игрока по семействам: { CRIMSON: { tier, base, pieces, stars: [..], mixedTiers } }.
 * Бонус сета считается по семейству, а не по тиру (Hot-шлем + Burning-нагрудник Crimson — это 2 части Crimson),
 * поэтому части разных тиров складываем; tier — самый слабый тир среди частей (его и качать первым).
 */
function kuudraArmor(ctx) {
  const out = {};
  for (const s of KUUDRA_SETS) {
    const slots = SLOTS.map(p => {
      for (let i = KUUDRA_TIERS.length - 1; i >= 0; i--) {
        const list = ctx.owned.get(`${KUUDRA_TIERS[i].prefix}${s.base}_${p}`) || [];
        if (list.length) return { tier: i, stars: Math.max(0, ...list.map(it => it.stars || 0)) };
      }
      return null;
    });
    const have = slots.filter(Boolean);
    if (!have.length) continue;
    const tier = Math.min(...have.map(x => x.tier));
    out[s.base] = { tier, base: tx`${KUUDRA_TIERS[tier].prefix}${s.base}`, pieces: have.length, stars: slots.map(x => x?.stars || 0), mixedTiers: new Set(have.map(x => x.tier)).size > 1 };
  }
  return out;
}

export function build(m, ctx) {
  const c = m.crimson || {};
  const rep = Math.max(c.barbarianRep || 0, c.mageRep || 0);
  const k = c.kuudra || {};
  const total = KUUDRA_TIERS.reduce((s, t) => s + (k[t.key] || 0), 0);
  const combat = m.skills?.combat?.level || 0;
  const cls = m.dungeons?.selectedClass;
  const faction = c.faction === 'mages' ? 'Mages' : c.faction === 'barbarians' ? 'Barbarians' : null;
  const done = t => (k[t.key] || 0) > 0;
  const prevDone = i => i === 0 || done(KUUDRA_TIERS[i - 1]) || KUUDRA_TIERS.slice(i).some(done);
  const open = i => rep >= KUUDRA_TIERS[i].rep && prevDone(i);
  const highest = [...KUUDRA_TIERS.keys()].reverse().find(i => done(KUUDRA_TIERS[i]));
  const nextTierI = KUUDRA_TIERS.findIndex((t, i) => !done(t) && i > (highest ?? -1));
  const nextTier = KUUDRA_TIERS[nextTierI];
  const armor = kuudraArmor(ctx);
  const mySet = KUUDRA_SETS.find(s => s.for.includes(cls)) || KUUDRA_SETS[0];
  const myArmor = armor[mySet.base];
  const next = [];

  if (!faction) {
    next.push({ priority: 90, title: 'Открой Crimson Isle и выбери фракцию', why: 'Без фракции нет квестов репутации, а без репутации не открыть тиры выше Basic.' });
  }
  if (nextTier) {
    if (rep < nextTier.rep) {
      next.push({ priority: 82, title: tx`Репутация ${num(rep)} → ${num(nextTier.rep)}: откроет Kuudra ${nextTier.name}`,
        why: tx`Не хватает ${num(nextTier.rep - rep)}. Быстрее всего — ежедневные квесты фракции на доске в городе ${faction || 'фракции'}, плюс мини-боссы Crimson Isle и Dojo.` });
    } else if (open(nextTierI)) {
      next.push({ priority: 86, title: tx`Пройди Kuudra ${nextTier.name}: репутации уже хватает`,
        why: tx`Нужен ${ctx.name(nextTier.keyId) || 'ключ'} для платного сундука. Победа откроет броню тира ${nextTier.name} (нужен Combat ${nextTier.combat}, у тебя ${combat}).` });
    }
  }
  if (highest != null && total < 20) {
    next.push({ priority: 64, title: tx`Набери стабильность на ${KUUDRA_TIERS[highest].name}: всего ${total} ${plural(total, 'заход', 'захода', 'заходов')}`,
      why: 'Essence Crimson и Kuudra Teeth копятся с каждого захода; на высоких тирах ошибки команды стоят дорого.' });
  }
  if (!myArmor) {
    next.push({ priority: 60, title: tx`Купи сет ${mySet.base[0] + mySet.base.slice(1).toLowerCase()} (${mySet.role}) под свой класс`,
      why: tx`Броня Kuudra растёт вместе с тирами: ${KUUDRA_TIERS.map(t => t.name).join(' → ')}. Для класса «${CLASSES[cls] || cls || '—'}» подходит бонус сета ${mySet.bonus}.` });
  } else {
    const t = KUUDRA_TIERS[myArmor.tier];
    const nt = KUUDRA_TIERS[myArmor.tier + 1];
    const minStars = Math.min(...myArmor.stars);
    if (myArmor.pieces < 4) next.push({ priority: 62, title: tx`Собери полный сет ${t.name} ${mySet.base}: ${myArmor.pieces}/4`, why: 'Бонус сета работает только от нескольких частей.' });
    if (nt && minStars < 10) next.push({ priority: 50, title: tx`Улучшай звёзды ${t.name} ${mySet.base} (минимум сейчас ${minStars}/10)`, why: 'Звёзды стоят эссенцию Crimson; с 8-й звезды ещё и Heavy Pearl. На 10 звёздах часть переводится на следующий тир.' });
    if (nt && minStars >= 10) {
      next.push(done(nt)
        ? { priority: 58, title: tx`Переведи броню на тир ${nt.name}`, why: tx`Kuudra ${nt.name} уже пройдена. Нужен Combat ${nt.combat} (у тебя ${combat}).` }
        : { priority: 45, title: tx`${t.name} ${mySet.base} уже на 10★: следующий тир брони — после Kuudra ${nt.name}`, why: tx`Перевести броню на ${nt.name} можно только после победы на этом тире${combat < nt.combat ? tx` и с Combat ${nt.combat} (у тебя ${combat})` : ''}.` });
    }
  }

  const tierRows = KUUDRA_TIERS.map((t, i) => {
    const d = k[t.key] || 0;
    const st = d ? { text: tx`пройден ${d} ${plural(d, 'раз', 'раза', 'раз')}`, tone: 'good' }
      : open(i) ? { text: 'открыт', tone: 'warn' }
      : rep < t.rep ? { text: tx`нужно ещё ${num(t.rep - rep)} реп.`, tone: 'bad' }
      : { text: tx`сначала ${KUUDRA_TIERS[i - 1].name}`, tone: 'muted' };
    const w = c.kuudraWaves?.[t.key];
    return [{ text: t.name, item: t.keyId }, num(t.rep), `${t.combat}`, st, w ? `${w}` : '—'];
  });

  const armorRows = KUUDRA_SETS.map(s => {
    const a = armor[s.base];
    const own = a ? tx`${KUUDRA_TIERS[a.tier].name}, ${a.pieces}/4, звёзды ${a.stars.join('/')}` : 'нет';
    const tierForMe = KUUDRA_TIERS[Math.max(0, highest ?? 0)];
    const buyId = tx`${tierForMe.prefix}${s.base}_CHESTPLATE`;
    const p = ctx.price(buyId);
    return [{ text: s.base[0] + s.base.slice(1).toLowerCase(), item: tx`${s.base}_CHESTPLATE` }, s.bonus, s.role, a ? { text: own, tone: 'good' } : { text: own, tone: 'muted' }, p ? tx`${fmtCoins(p)} (${tierForMe.name})` : '—'];
  });

  const loot = KUUDRA_LOOT.map(id => ({ id, p: priceOfDrop(ctx, id) })).sort((a, b) => b.p - a.p);
  const income = (ctx.analysis?.methods || []).filter(x => /^kuudra/.test(x.id)).map(methodText).filter(Boolean);

  return {
    summary: tx`${faction ? tx`Фракция ${faction}, ` : 'Фракция не выбрана, '}репутация ${num(rep)}. Пройдено заходов: ${total}${highest != null ? tx`, лучший тир ${KUUDRA_TIERS[highest].name}` : ''}.`,
    status: k.infernal ? 'done' : total ? 'progress' : faction ? 'start' : 'locked',
    level: { label: 'Репутация фракции', value: rep, max: 12000 },
    next: sortNext(next),
    sections: [
      { kind: 'table', title: 'Тиры Kuudra', note: 'Репутация засчитывается любой фракции (Mages или Barbarians). Каждый тир требует победы на предыдущем; Hot — ещё и основной квест Crimson Isle.', columns: ['Тир', 'Репутация', 'Combat для брони', 'Статус', 'Лучшая волна'], rows: tierRows, current: nextTierI >= 0 ? nextTierI : undefined },
      petLadderSection(ctx, 'crimson', { title: 'Питомцы для Kuudra и Crimson Isle' }),
      { kind: 'text', title: 'Как устроен заход', text: [
        'Первый заход (Basic) — по квесту с NPC Elle на Crimson Isle, дальше вход через Kuudra Gatekeeper или Party Finder. Команда — 4 игрока.',
        'После победы открывается платный сундук — для него нужен Kuudra Key своего тира. Если команда погибла, остаётся только бесплатный сундук с более скромным лутом.',
        'Ключ привязан к профилю (Co-op Soulbound), его нельзя купить на аукционе. Ключи изредка падают с мини-боссов Crimson Isle, а за Nether Star с Vanquisher их продаёт Emissary в городе фракции. Перед фармом сравни цену ключа с ценой лута.',
        '«Лучшая волна» в таблице тиров — до какой волны ты доходил на этом тире (так считает Hypixel). Репутация, Dojo, мини-боссы и Matriarch — в гайде Crimson Isle.',
      ] },
      { kind: 'table', title: 'Броня Kuudra', note: tx`Под твой класс подходит ${mySet.base[0] + mySet.base.slice(1).toLowerCase()} (${mySet.bonus}). Цена — нагрудник тира, который ты уже проходишь.`, columns: ['Сет', 'Бонус сета', 'Кому', 'У тебя', 'Цена нагрудника'], rows: armorRows },
      { kind: 'steps', title: 'Как растёт броня', items: [
        { title: 'Звёзды 1–10 за эссенцию Crimson', text: 'С 4-й звезды добавляются монеты, с 8-й — Heavy Pearl (2–5 штук в зависимости от тира).', items: ['ESSENCE_CRIMSON', 'HEAVY_PEARL'] },
        { title: 'Переход на следующий тир', text: tx`Basic → Hot → Burning → Fiery → Infernal. Носить тир можно только после победы на нём; Combat: ${KUUDRA_TIERS.map(t => tx`${t.name} ${t.combat}`).join(', ')}.`, done: !!(myArmor && myArmor.tier >= (highest ?? 0)) },
        { title: 'Infernal: звёзды 11–15', text: 'У Infernal-брони есть звёзды 11–15: к эссенции и Heavy Pearl добавляются Kuudra Teeth (20–100 штук).', items: ['KUUDRA_TEETH'] },
      ] },
      { kind: 'table', title: 'Ценный лут', note: 'Текущие цены. Kuudra Teeth и эссенция Crimson падают почти всегда.', columns: ['Предмет', 'Цена'], rows: loot.map(l => [{ text: nice(ctx, l.id), item: l.id }, l.p ? fmtCoins(l.p) : '—']) },
      ...(income.length ? [{ kind: 'text', title: 'Заработок', text: income }] : []),
    ],
  };
}

export default { id: 'kuudra', title: 'Kuudra', icon: 'KUUDRA_TEETH', group: 'combat', build };
