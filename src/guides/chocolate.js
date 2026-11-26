// Гайд «Chocolate Factory»: престиж, сотрудники, Time Tower, Coach, Shrine, Hitman, вехи, яйца Hoppity,
// кролики-резиденты и Chocolate Shop — по профилю (events.easter). Советы считает analysis/chocolate.js.
// Числа сверены с fandom «Chocolate Factory» и «Hoppity's Hunt» (2026-11-23).
import { chocolateAdvice, PRESTIGES, EMPLOYEES, TIME_TOWER_MAX, SHRINE_COSTS, COACH_COSTS, CF, employeeCostTo, towerCost } from '../analysis/chocolate.js';
import { fmt, short, cell } from './gathering-util.js';
import { tx } from '../../i18n/msg.js';

const RAR_MAX = { 1: 'Uncommon', 2: 'Rare', 3: 'Epic', 4: 'Legendary', 5: 'Mythic', 6: 'Divine' };
const UNLOCK = { 2: 'Time Tower', 3: 'Rabbit Shrine', 4: 'Coach Jackrabbit', 6: 'Divine-кролики (+1 к капу сотрудников каждый)' };

// Chocolate Shop: [id, название, уровень фабрики, цена, в год]
const SHOP = [
  ['SUPREME_CHOCOLATE_BAR', 'Supreme Chocolate Bar', 1, '2 млн', '500'],
  ['EGGLOCATOR', 'Egglocator', 1, '7,5 млн', '1'],
  ['NIBBLE_CHOCOLATE_STICK', 'Nibble Chocolate Stick', 2, '250 млн', '1'],
  ['SMOOTH_CHOCOLATE_BAR', 'Smooth Chocolate Bar', 2, '1 млрд + Nibble', '1'],
  ['RICH_CHOCOLATE_CHUNK', 'Rich Chocolate Chunk', 3, '2 млрд + Smooth', '1'],
  ['GANACHE_CHOCOLATE_SLAB', 'Ganache Chocolate Slab', 3, '3 млрд + Rich', '1'],
  ['PRESTIGE_CHOCOLATE_REALM', 'Prestige Chocolate Realm', 4, '4,5 млрд + Ganache', '1'],
  ['DARK_CACAO_TRUFFLE', 'Dark Cacao Truffle', 4, '2,5 млрд', '2'],
  ['PET_ITEM_CHOCOLATE_SYRINGE', 'Chocolate Syringe', 5, '10 млрд', '1'],
  ['ZORROS_CAPE', "Zorro's Cape", 5, '20 млрд', '1'],
  ['DYE_CHOCOLATE', 'Chocolate Dye', 5, '40 млрд', '4'],
  ['HOT_CHOCOLATE_MIXIN', 'Hot Chocolate Mixin', 6, '1,5 млрд', '4'],
  [null, 'Chocolate Fortune (+1 Cocoa Beans Fortune)', 6, '2 млрд', '25 всего'],
];

function build(m, ctx) {
  const ch = m.extras?.chocolate;
  if (!ch) {
    return { summary: 'Фабрика ещё не открыта: зайди в /cf и накликай 50 Chocolate на Rabbit Bro.', status: 'start', sections: [intro()] };
  }
  const a = chocolateAdvice(ch);
  const P = a.prestige;
  const next = a.tips.map(t => ({ title: t.title, why: t.text, priority: t.prio, item: t.icon }));
  const sections = [intro()];

  sections.push({
    kind: 'table', title: 'Престиж (уровень фабрики)',
    note: 'Престиж обнуляет Chocolate и сотрудников, но поднимает множитель, кап сотрудников и потолок Chocolate. Найденные кролики и Rabbit Barn остаются.',
    columns: ['Уровень', 'Нужно Chocolate', 'Множитель', 'Кап сотрудников', 'Потолок Chocolate', 'Редкость кроликов до', 'Открывает'],
    current: P - 1,
    rows: Object.entries(PRESTIGES).map(([lvl, p]) => [
      cell(String(lvl), { tone: Number(lvl) <= P ? 'good' : undefined }), p.need ? short(p.need) : '—', tx`${String(p.mult).replace('.', ',')}×`,
      String(p.cap), short(p.maxChocolate), RAR_MAX[lvl], UNLOCK[lvl] || '—',
    ]),
  });

  sections.push({
    kind: 'table', title: 'Сотрудники',
    note: tx`Кап сейчас ${a.cap}. Цена считается по формуле с вики (без скидки Zeta −1%). Новый сотрудник появляется, когда предыдущий дойдёт до 20 уровня.`,
    columns: ['Сотрудник', 'Chocolate/с за уровень', 'Уровень', 'До капа', 'Chocolate до капа', 'Прибавка'],
    rows: a.employees.map(e => [
      e.name, tx`+${e.cps}`, cell(tx`${e.level} / ${e.cap}`, { tone: e.left ? undefined : 'good' }),
      e.left ? fmt(e.left) : cell('кап', { tone: 'good' }),
      e.left ? short(employeeCostTo(e.n, e.level, e.cap, P)) : '—',
      e.left ? tx`+${fmt(e.gain)}/с` : '—',
    ]),
  });

  const tt = ch.timeTower || 0;
  sections.push({
    kind: 'table', title: 'Улучшения',
    note: 'Цены — по вики. Сверху то, что ускоряет фабрику сильнее всего.',
    columns: ['Улучшение', 'Что даёт', 'У тебя', 'Следующий уровень'],
    rows: [
      ['Time Tower', '+0,1× к множителю за уровень, пока башня работает. 3 заряда по 8 ч, каждый — час ускорения. Rabbit Mu даёт ещё +0,7×, Einstein — заряд за 7 ч.',
        cell(tx`${tt} / ${TIME_TOWER_MAX}`, { tone: tt >= TIME_TOWER_MAX ? 'good' : undefined }), P < 2 ? 'с престижа 2' : tt >= TIME_TOWER_MAX ? '—' : short(towerCost(tt + 1, P))],
      ['Coach Jackrabbit', '+0,01× к множителю навсегда за уровень (до +0,2×).',
        ch.coach == null ? '—' : cell(tx`${ch.coach} / ${COACH_COSTS.length}`, { tone: ch.coach >= COACH_COSTS.length ? 'good' : undefined }),
        P < 4 ? 'с престижа 4' : ch.coach != null && ch.coach < COACH_COSTS.length ? short(COACH_COSTS[ch.coach]) : '—'],
      ['Rabbit Shrine', '+2% к шансу редкого кролика в Hoppity\'s Hunt за уровень (до +40%).',
        ch.shrine == null ? '—' : cell(tx`${ch.shrine} / ${SHRINE_COSTS.length}`, { tone: ch.shrine >= SHRINE_COSTS.length ? 'good' : undefined }),
        P < 3 ? 'с престижа 3' : ch.shrine != null && ch.shrine < SHRINE_COSTS.length ? short(SHRINE_COSTS[ch.shrine]) : '—'],
      ['Rabbit Barn', 'Сколько разных кроликов вмещает коллекция. Сверх лимита новые кролики «раздавливаются». Не сбрасывается.', ch.barn ? tx`ур. ${ch.barn}` : '—', 'цена растёт на 5% за уровень'],
      ['Hand-Baked Chocolate', '+1 Chocolate за клик, до 10 за клик.', ch.clickUpgrades ? tx`ур. ${ch.clickUpgrades}` : '—', '500 × уровень'],
      ['Rabbit Hitman', 'Ловит пропущенные яйца, пока тебя нет. Слот после выдачи яйца остывает 20 минут.', ch.hitmanSlots == null ? '—' : tx`${ch.hitmanSlots} слотов`, 'за монеты, всего 28 слотов'],
    ],
  });

  sections.push({
    kind: 'text', title: "Hoppity's Hunt: яйца и кролики",
    text: [
      'Событие идёт каждый игровой год с Early Spring 1 почти три игровых месяца. Каждый реальный час появляется 9 яиц: Breakfast, Lunch и Dinner по три раза.',
      'Яйца появляются на всех островах в одних и тех же местах. Одновременно живут 6 яиц, новое вытесняет самое старое. Из одного появления можно взять только одно яйцо, на другом острове то же яйцо уже не даст кролика.',
      'Яйцо даёт случайного кролика. Повтор превращается в Chocolate: от 150 секунд производства за Common до 15 000 за Divine, +10% за каждый повтор (до +100%).',
      'Удобнее всего искать в Crystal Hollows: все места рядом с Crystal Nucleus. Без HOTM 4 — в Gold Mine. Egglocator из Chocolate Shop показывает ближайшее яйцо.',
      'Hoppity в Hub продаёт до 7 кроликов за монеты: Common 250 тыс., Uncommon 500 тыс., Rare 1 млн, Epic 2,5 млн, Legendary 5 млн.',
    ],
  });

  sections.push({
    kind: 'table', title: 'Бродячие и золотые кролики',
    note: 'Бродячий кролик сидит в окне фабрики 20 секунд: кликни. После яйца он появляется не позже чем через 30 секунд, с шансом 10% (20% с Omega) — золотой.',
    columns: ['Золотой кролик', 'Что даёт'],
    rows: [
      ['Jackpot', 'Chocolate за 480 секунд производства'],
      ['Chocolate Mountain', 'Chocolate за 1500 секунд производства'],
      ['Stampede', '10 бродячих кроликов сразу'],
      ['Golden Click', '+5 Chocolate/с до конца игрового года, складывается'],
      ['Side Dish', 'открывает шоколадное яйцо'],
      ['El Dorado', 'немного Chocolate, на третий раз — Legendary-кролик El Dorado'],
    ],
  });

  // Резиденты: по островам, сначала где больше всего не найдено
  if (a.residents?.byIsland?.length) {
    sections.push({
      kind: 'table', title: tx`Rabbits-резиденты: найдено ${a.residents.found} из ${a.residents.total}`,
      note: 'Резиденты стоят на своём острове круглый год. Зайди туда и кликни по кролику. Точные места подсвечивает мод SkyHanni.',
      columns: ['Остров', 'Найдено', 'Ещё не найдены'],
      rows: a.residents.byIsland.map(r => [r.islandRu, cell(tx`${r.found.length} / ${r.found.length + r.missing.length}`, { tone: r.missing.length ? undefined : 'good' }),
        r.missing.length ? r.missing.join(', ') : cell('все', { tone: 'good' })]),
    });
  }
  if (a.eggs?.length) {
    sections.push({
      kind: 'table', title: 'Места яиц, где ты ещё не брал яйцо',
      note: 'За первое яйцо в каждом месте острова идёт отметка в коллекции мест.',
      columns: ['Остров', 'Не собрано'],
      rows: a.eggs.map(e => [e.islandRu, tx`${e.missing} из ${e.total}`]),
    });
  }

  const total = ch.total || 0;
  sections.push({
    kind: 'table', title: 'Вехи фабрики (Chocolate за всё время)',
    note: tx`У тебя ${short(total)}. Каждая веха — уникальный кролик.`,
    columns: ['Chocolate', 'Rabbit', ''],
    rows: CF.factoryMilestones.map(x => [short(x.amount), x.rabbit, cell(total >= x.amount ? '✓' : tx`ещё ${short(x.amount - total)}`, { tone: total >= x.amount ? 'good' : 'muted' })]),
  });
  if (ch.shopSpent != null) {
    sections.push({
      kind: 'table', title: 'Вехи Chocolate Shop (потрачено в магазине)',
      note: tx`Потрачено ${short(ch.shopSpent)}. Zeta (250 млн) даёт −1% к цене сотрудников, Mu (25 млрд) — +0,7× к Time Tower, Omega (800 млрд) — вдвое чаще золотые кролики.`,
      columns: ['Потратить', 'Rabbit', ''],
      rows: CF.shopMilestones.map(x => [short(x.amount), x.rabbit, cell(ch.shopSpent >= x.amount ? '✓' : tx`ещё ${short(x.amount - ch.shopSpent)}`, { tone: ch.shopSpent >= x.amount ? 'good' : 'muted' })]),
    });
  }

  sections.push({
    kind: 'table', title: 'Chocolate Shop',
    note: 'Магазин открывается из окна фабрики. Лимит покупок обновляется каждый игровой год. Всё потраченное здесь идёт в вехи магазина.',
    columns: ['Предмет', 'Фабрика', 'Цена', 'В год'],
    rows: SHOP.map(([id, name, lvl, cost, stock]) => [id ? cell(name, { item: id }) : name, cell(tx`ур. ${lvl}`, { tone: P >= lvl ? 'good' : 'muted' }), cost, stock]),
  });

  sections.push({
    kind: 'table', title: 'Что дают кролики по редкости',
    note: 'Каждый новый кролик навсегда добавляет Chocolate в секунду и множитель. Mythic даёт особый бонус, Divine — +1 к капу сотрудников.',
    columns: ['Редкость', 'Chocolate/с', 'Множитель'],
    rows: [['Common', '+1', '+0,002×'], ['Uncommon', '+2', '+0,003×'], ['Rare', '+4', '+0,004×'], ['Epic', '+10', '+0,005×'], ['Legendary', '—', '+0,02×'], ['Mythic', '+5 с кроликом Sigma', 'особый бонус'], ['Divine', '—', '+0,025×']],
  });

  const done = P >= CF.maxPrestige && a.maxedEmployees && tt >= TIME_TOWER_MAX && (ch.rabbits || 0) >= CF.maxRabbits;
  return {
    summary: tx`Престиж ${P} из ${CF.maxPrestige}, множитель ${String(a.mult).replace('.', ',')}×, кроликов ${fmt(ch.rabbits)} из ${fmt(CF.maxRabbits)}${a.maxedEmployees ? ', сотрудники на капе' : ''}.`,
    status: done ? 'done' : 'progress',
    level: { label: 'Престиж', value: P, max: CF.maxPrestige },
    next,
    sections,
  };
}

function intro() {
  return {
    kind: 'text', title: 'Как устроена фабрика',
    text: [
      'Chocolate Factory открывается командой /cf. Chocolate копится сам: его делают сотрудники-кролики, а найденные кролики Hoppity поднимают скорость и множитель.',
      'Chocolate тратится на сотрудников, улучшения и Chocolate Shop. Chocolate за всё время открывает вехи-кроликов, траты в магазине — свои вехи.',
      'Когда накопишь нужное количество с прошлого престижа, можно поднять уровень фабрики (престиж, до 6). Это главный рост множителя.',
      tx`Всего кроликов ${fmt(CF.maxRabbits)}. Их дают яйца Hoppity's Hunt весной, бродячие кролики в окне фабрики, вехи и резиденты на островах.`,
    ],
  };
}

export default { id: 'chocolate', title: 'Chocolate Factory', icon: 'PRESTIGE_CHOCOLATE_REALM', group: 'other', build };
