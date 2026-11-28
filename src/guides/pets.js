// Питомцы по этапам для гайдов: лестница «дёшево → средне → эндгейм» по каждому занятию.
// Цена — живая с аукциона (ctx.price), шанс выпадения — у питомцев, которых только выбивают.
// Уже имеющихся питомцев учитываем: если у игрока есть питомец не хуже для той же цели, младший не советуем.
// Источники (сверено 28.11.2026): лор и рецепты Kat/Forge — NEU-REPO (items/*;N.json), способы получения и шансы —
// hypixel-skyblock.fandom.com (разделы Obtaining страниц «X Pet», Scatha, Worm, Bal).
import { tx } from '../../i18n/msg.js';
import { bestPet, cell } from './gathering-util.js';
import { fmtCoins } from '../advisor/lib/util.js';

export const RARITY = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const STAGES = { 1: 'Старт', 2: 'Средний', 3: 'Эндгейм' };
const EVENT = 'Событие';

/**
 * Ступень лестницы.
 * type — id питомца, tier — какую редкость советуем (0–5), stage — 1 старт / 2 средний / 3 эндгейм,
 * use — для чего (питомцы с одним use заменяют друг друга: старший закрывает младшего),
 * why — что даёт, how — где взять, odds — шанс для выбиваемых (реалистичная оценка),
 * Редкость поднимает Kat (проверено по рецептам katgrade в NEU); kat: false — у Kat не поднять.
 * boss — только для этого слеера; cls — только для этих классов Dungeons.
 * event — нужен только в событие или особом месте (не советуем шагом плана); onlyOwned — строку видно, только если питомец уже есть.
 * coins — сколько монет просит NPC (для Ironman и др. без рынка вместо цены аукциона).
 */
export const PET_LADDERS = {
  mining: [
    { type: 'SILVERFISH', tier: 4, stage: 1, use: 'опыт Mining', why: 'Mining Wisdom, скорость и немного Fortune: быстрее качает скилл', how: 'крафт после Cobblestone III (яйцо), редкость у Kat' },
    { type: 'MITHRIL_GOLEM', tier: 4, stage: 1, use: 'Mithril и коммишены', why: 'больше Mithril Powder, скорость по Mithril, боевые статы на шахтах', how: 'крафт после Mithril III: 256 Mithril + Enchanted Egg; Mythic у Kat за Pure Mithril Gem' },
    { type: 'ARMADILLO', tier: 4, stage: 1, use: 'гемы в Crystal Hollows', why: 'сам прокладывает туннель в Crystal Hollows, раз в несколько секунд гем падает вдвое', how: 'вылупляется из Prehistoric Egg: Legendary после 100 000 шагов' },
    { type: 'MOLE', tier: 4, stage: 2, use: 'Crystal Nucleus', why: 'шанс на лишний предмет с Crystal Nucleus, больше находок в Mines of Divan', how: 'Forge: Claw Fossil + 300 тыс., 3 дня, нужен HotM 4' },
    { type: 'BAL', tier: 4, stage: 2, use: 'гемы в Magma Fields', why: 'Pristine в Magma Fields и Mining Fortune, убийства мобов снижают жару', how: 'дроп с босса Bal в Khazad-dûm (Crystal Hollows); Epic → Legendary у Kat за 100 Yoggie', odds: 'Epic или Legendary примерно с 1 из 28 убийств Bal' },
    { type: 'GOBLIN', tier: 4, stage: 2, use: 'руды', why: 'Ore Fortune и скорость по рудам, Mining Spread в Mines of Divan', how: 'Forge: Flawless Amber + Ugly Fossil, 7 дней (после сдачи Ugly Fossil Dr. Stone), HotM 7' },
    { type: 'SNAIL', tier: 4, stage: 2, use: 'блоки', why: 'Mining Spread по блокам и Block Fortune за Speed выше 100', how: 'крафт после Red Sand III: Super Enchanted Egg, редкость у Kat' },
    { type: 'GLACITE_GOLEM', tier: 4, stage: 2, use: 'Glacite и Mineshafts', why: 'больше Glacite Powder, Fortune и Pristine в Glacite Mineshafts', how: 'крафт после Glacite IV, Legendary у Kat за Glacite Amalgamation' },
    { type: 'MAMMOTH', tier: 4, stage: 2, use: 'Frozen Corpse', why: 'лишний Glacite Powder с каждого Frozen Corpse, статы в Mineshaft', how: 'Forge: Flawless Onyx + Tusk Fossil, 7 дней (после сдачи Tusk Fossil Dr. Stone)' },
    { type: 'SCATHA', tier: 4, stage: 3, use: 'гемы в Crystal Hollows', why: 'Gemstone Fortune на бурах и больше Gemstone Powder', how: 'только дроп со Scatha в туннелях Crystal Hollows; Epic → Legendary у Kat за 256 Enchanted Hard Stone',
      odds: 'Scatha — 1 из ~3000 блоков туннеля; питомец любой редкости падает с 1 из 250 Scatha, Legendary — с 1 из 2500' },
  ],
  farming: [
    { type: 'MOOSHROOM_COW', tier: 4, stage: 1, use: 'Fortune по культурам', why: 'Farming Fortune от Strength и грибы при фарме: основной питомец для Garden', how: 'крафт после Mycelium III: Super Enchanted Egg, редкость у Kat' },
    { type: 'RABBIT', tier: 4, stage: 1, use: 'опыт Farming', why: 'Farming Wisdom (быстрее скилл) и ускорение фермерских миньонов', how: 'крафт после Raw Rabbit III, редкость у Kat' },
    { type: 'ELEPHANT', tier: 4, stage: 1, onlyOwned: true, use: 'Fortune по культурам', why: 'Farming Fortune, слабее Mooshroom Cow: менять не стоит, но и покупать тоже', how: 'Oringo (Traveling Zoo)' },
    { type: 'BEE', tier: 4, stage: 1, use: 'Fortune по культурам', why: 'немного Farming Fortune и Fortune по Sunflower, Moonflower и Wild Rose', how: 'Bea в Hub, редкость у Kat' },
    { type: 'HEDGEHOG', kat: false, tier: 4, stage: 2, use: 'Pests', why: 'больше урона по Pests и Farming Fortune за тиры бестиария Pests', how: 'Pesthunter Phillip на Garden за Pests' },
    { type: 'SLUG', tier: 4, stage: 2, use: 'больше Pests', why: 'Bonus Pest Chance и Fortune на участке со Sprayonator', how: 'дроп с Pest Slug; Epic → Legendary у Kat за Enchanted Compost', odds: 'Epic — 0,5%, Legendary — 0,1% за убитого Slug' },
    { type: 'ORCHID_MANTIS', tier: 4, stage: 2, use: 'Overbloom', why: 'Overbloom, Farming Fortune за Speed выше 100, больше опыта инструментов', how: 'крафт: 8 Floral Gelatin + Enchanted Egg; Floral Gelatin редко падает с Wild Rose на Harvest Feast, редкость у Kat за неё же' },
    { type: 'MOSQUITO', tier: 4, stage: 2, use: 'Sugar Cane', why: 'Sugar Cane Fortune за каждого обслуженного посетителя Garden, Bonus Pest Chance', how: 'крафт на Spider Slayer VII: Digested Mosquito, Tarantula Silk, Super Enchanted Egg' },
    { type: 'PIG', tier: 4, stage: 2, event: true, use: 'Potato', why: 'Potato Fortune, сильнее в Year of the Pig', how: 'Pig Shop в Year of the Pig: Shiny Shard + Enchanted Raw Porkchop' },
    { type: 'ROSE_DRAGON', tier: 4, stage: 3, use: 'Fortune по культурам', why: 'Farming Fortune за уровень Farming и каждую веху культур, Overbloom, больше Copper', coins: 500e6, how: 'яйцо у Ludleth: 500 млн + редкие культуры (Condensed Helianthus и др.)' },
  ],
  foraging: [
    { type: 'OCELOT', tier: 3, stage: 1, use: 'опыт Foraging', why: 'Foraging Wisdom (Epic хватает) и ускорение миньонов-лесорубов', how: 'крафт после Jungle Log III: 256 Jungle Log + Enchanted Egg' },
    { type: 'MONKEY', tier: 4, stage: 1, use: 'Foraging Fortune', why: 'Foraging Fortune везде, Sweep и скорость только в The Park', coins: 18e6, how: 'Oringo (Traveling Zoo): брёвна джунглей, Legendary ещё 18 млн' },
    { type: 'FROG', tier: 4, stage: 1, use: 'Foraging Fortune', why: 'Foraging Fortune после каждого прыжка, Sweep, шанс водных осколков', how: 'Agatha (Moonglade Marsh) за 20 Agatha\'s Coupon, редкость у Kat за Frog Treat' },
    { type: 'SLOTH', tier: 4, stage: 2, use: 'Foraging Fortune', why: 'лучший для Galatea: Sweep и Foraging Fortune, раз в 60 с удар сильнее, больше очков в Starlyn Contests', how: 'Miria (Torrhus Canyon) за 20 Miria\'s Coupon, редкость у Kat за Sloth Claw' },
    { type: 'JADE_DRAGON', tier: 4, stage: 3, use: 'Foraging Fortune', why: 'сила и скорость топорам, Fortune и Sweep за каждую цифру коллекции Mangrove', coins: 500e6, how: 'яйцо у дракона под Murkwater Depths: 500 млн + Shiniest + Figstone и Mangcore' },
  ],
  fishing: [
    { type: 'DOLPHIN', tier: 4, stage: 1, use: 'рыбалка', why: 'Sea Creature Chance и Fishing Speed рядом с другими игроками', how: 'бесплатно за выловленных существ: Legendary за 10 000' },
    { type: 'AMMONITE', tier: 4, stage: 1, use: 'рыбалка', why: 'Sea Creature Chance за уровни HotM, Fishing Speed за уровни Mining и Fishing', how: 'Forge: Helix Fossil + 300 тыс., 3 дня, нужен HotM 4' },
    { type: 'SQUID', tier: 4, stage: 2, use: 'опыт Fishing', why: 'Fishing Wisdom: быстрее растёт скилл', how: 'редкий улов-сокровище в любой воде', odds: 'Legendary — 0,0017% за улов, проще купить' },
    { type: 'HERMIT_CRAB', tier: 4, stage: 2, use: 'сокровища и Hotspot', why: 'Treasure Chance, Fishing Speed после сокровища, чаще существа Hotspot', how: 'Junker Joel за 32 Rusty Coin, редкость у Kat' },
    { type: 'FLYING_FISH', tier: 4, stage: 2, use: 'рыбалка', why: 'Fishing Speed, Strength и Defense у воды и лавы, сильнее Magma Lord и Diver', how: 'дроп с The Loch Emperor (Fishing 20)', odds: 'Rare 4%, Epic 2%, Legendary 0,5% за Loch Emperor' },
    { type: 'PENGUIN', tier: 4, stage: 2, use: 'Glacite Tunnels', why: 'Fishing Speed в Glacite Tunnels, каждый улов снижает холод', how: 'Forge: Flawless Aquamarine + Webbed Fossil, 7 дней (после сдачи Webbed Fossil Dr. Stone)' },
    { type: 'FLYING_FISH', tier: 5, stage: 3, use: 'рыбалка', why: 'то же, что Legendary, но сильнее', how: 'Legendary → Mythic у Kat: Radioactive Vial + 1 млн' },
    { type: 'MEGALODON', tier: 4, stage: 2, event: true, use: 'Fishing Festival', why: 'статы вдвое и больше акул во время Fishing Festival', how: 'дроп с Great White Shark', odds: '1% за Great White Shark' },
    { type: 'BABY_YETI', tier: 4, stage: 2, event: true, use: 'Jerry\'s Workshop', why: 'боевые и рыболовные статы на Jerry\'s Workshop, Magic Find по зимним существам', how: 'дроп с Yeti (рыбалка на Jerry\'s Workshop)' },
    { type: 'REINDEER', kat: false, tier: 4, stage: 1, event: true, use: 'Jerry\'s Workshop', why: 'Fishing Speed и Treasure Chance на Jerry\'s Workshop, двойной опыт питомца', how: 'Einary в Einary\'s Emporium (Jerry\'s Workshop)' },
    { type: 'BAT', tier: 4, stage: 2, event: true, use: 'Spooky Festival', why: 'чаще Spooky-существа и Green Candy во время Spooky Festival', how: 'крафт после Mushroom III: 256 Mushroom + Enchanted Egg' },
    { type: 'SEAL', tier: 4, stage: 2, event: true, use: 'сокровища', why: 'Fishing Speed, SCC и Treasure Chance, сильнее в Year of the Seal', how: 'Lukas the Aquarist в Year of the Seal' },
  ],
  trophy: [
    { type: 'SPINOSAURUS', tier: 4, stage: 2, use: 'золото и алмаз', why: 'Trophy Chance, чаще золотые и алмазные Trophy Fish', how: 'Forge: Flawless Aquamarine + Spine Fossil, 7 дней (после сдачи Spine Fossil Dr. Stone)' },
    { type: 'SLUG', tier: 3, stage: 1, use: 'Slugfish', why: 'Slugfish ловится вдвое быстрее', how: 'дроп с Pest Slug на Garden', odds: 'Epic — 0,5% за убитого Slug' },
    { type: 'KUUDRA', kat: false, tier: 4, stage: 2, onlyOwned: true, use: 'Crimson Isle', why: 'Trophy Chance и Mining Fortune на Crimson Isle, больше Crimson Essence', how: 'коллекция Kuudra, редкость — за Kuudra Chunks' },
  ],
  slayers: [
    { type: 'TIGER', tier: 3, stage: 1, use: 'урон по боссам', why: 'Strength, Crit Damage и Ferocity; больше урона, когда рядом с целью нет других мобов', how: 'Oringo (Traveling Zoo) за Enchanted Raw Chicken' },
    { type: 'TIGER', tier: 4, stage: 2, use: 'урон по боссам', why: 'то же, что Epic, но сильнее', coins: 15e6, how: 'Epic → Legendary у Kat: около 15 млн + 1024 Enchanted Raw Chicken' },
    { type: 'TYRANNOSAURUS', tier: 4, stage: 2, use: 'урон по боссам', why: 'больше урона вплотную, сильнее статы от предмета питомца', how: 'Forge: Flawless Onyx + Footprint Fossil, 7 дней (после сдачи Footprint Fossil Dr. Stone)' },
    { type: 'ENDER_DRAGON', tier: 4, stage: 3, use: 'урон по боссам', why: 'все боевые статы +%, Strength, Crit Chance и Crit Damage', how: 'дроп с Ender Dragon (нужно 450 очков урона, Summoning Eye повышают шанс)' },
    { type: 'GOLDEN_DRAGON', tier: 4, stage: 3, use: 'урон по боссам', why: 'Strength за коллекцию Gold и Magic Find, урон за монеты в банке', coins: 500e6, how: 'яйцо в Dragon\'s Lair (Crystal Hollows): 500 млн + 50 Enchanted Gold Block + 5 Perfect гемов' },
    { type: 'TARANTULA', boss: 'spider', tier: 4, stage: 1, use: 'Tarantula Broodfather', why: 'Broodfather меньше режет Vitality, опыт за Spider Slayer', how: 'дроп с пауков (Broodmother, Arachne)', odds: 'Legendary — 2% с Arachne 500, 0,008% с Broodmother' },
    { type: 'ENDERMAN', boss: 'enderman', tier: 4, stage: 1, use: 'Voidgloom Seraph', why: 'меньше урона от Ender-мобов, опыт за Enderman Slayer', how: 'дроп с Enderman и Voidling Fanatic в The End' },
    { type: 'GHOUL', boss: 'zombie', tier: 4, stage: 1, use: 'Revenant Horror', why: 'опыт за Zombie Slayer, Ferocity и Vitality', how: 'дроп с Crypt Ghoul', odds: 'Legendary — 1 из 100 000' },
    { type: 'DROPLET_WISP', boss: 'blaze', kat: false, tier: 1, stage: 1, use: 'Inferno Demonlord', why: 'лечение у огненных столбов, защита от Blaze и демонов, опыт за Blaze Slayer', how: 'крафт на Blaze Slayer 1: 8 Derelict Ashe + Omega Enchanted Egg' },
    { type: 'FROST_WISP', boss: 'blaze', kat: false, tier: 2, stage: 2, use: 'Inferno Demonlord', why: 'то же, лечит сильнее', how: 'следующая форма Droplet Wisp' },
    { type: 'GLACIAL_WISP', boss: 'blaze', kat: false, tier: 3, stage: 2, use: 'Inferno Demonlord', why: 'то же, лечит ещё сильнее', how: 'следующая форма Frost Wisp' },
    { type: 'SUBZERO_WISP', boss: 'blaze', kat: false, tier: 4, stage: 3, use: 'Inferno Demonlord', why: 'лучшее лечение и защита против Blaze, быстрее мана', how: 'следующая форма Glacial Wisp' },
  ],
  dungeons: [
    { type: 'TIGER', tier: 3, stage: 1, cls: ['berserk', 'archer'], use: 'Berserk и Archer', why: 'Strength, Crit Damage и Ferocity', how: 'Oringo (Traveling Zoo) за Enchanted Raw Chicken' },
    { type: 'ENDER_DRAGON', tier: 4, stage: 3, cls: ['berserk', 'archer'], use: 'Berserk и Archer', why: 'все боевые статы +%', how: 'дроп с Ender Dragon' },
    { type: 'GOLDEN_DRAGON', tier: 4, stage: 3, cls: ['berserk', 'archer'], use: 'Berserk и Archer', why: 'Strength за Gold и Magic Find, урон за монеты в банке', coins: 500e6, how: 'яйцо в Dragon\'s Lair: 500 млн + Perfect гемы' },
    { type: 'SKELETON', tier: 4, stage: 2, cls: ['archer'], use: 'Archer', why: 'урон стрел, вдвое в данжах, Strength за попадания', how: 'крафт после Bone III: 256 Bone + Enchanted Egg, редкость у Kat' },
    { type: 'SHEEP', tier: 4, stage: 1, cls: ['mage'], use: 'Mage', why: 'способности дешевле по мане, больше маны в данжах', how: 'крафт после Raw Mutton III: 256 Mutton + Enchanted Egg, редкость у Kat' },
    { type: 'CROW', tier: 4, stage: 2, cls: ['mage'], use: 'Mage', why: 'короче кулдаун способностей оружия, шанс не тратить ману', how: 'крафт после Moonflower III: Enchanted Moonflower + Enchanted Egg, редкость у Kat' },
    { type: 'JELLYFISH', tier: 4, stage: 2, cls: ['healer'], use: 'Healer', why: 'сильнее Dungeon Potions, Wish перезаряжается быстрее от лечения', how: 'Dark Auction' },
    { type: 'ANKYLOSAURUS', tier: 4, stage: 2, cls: ['tank'], use: 'Tank', why: 'часть Defense переходит в Strength, сильнее Last Stand и Lifeline', how: 'Forge: Flawless Opal + Clubbed Fossil, 7 дней' },
    { type: 'TURTLE', tier: 4, stage: 2, cls: ['tank'], use: 'Tank', why: 'Defense себе и группе, нет отбрасывания', how: 'Dark Auction' },
    { type: 'SPIRIT', tier: 4, stage: 1, use: 'все классы', why: 'помогает, пока ты призрак, меньше штраф за первую смерть', how: 'сундуки Catacombs: Epic с Floor IV за 1 млн, Legendary из Emerald и Obsidian за 5 млн', odds: 'около 1% за сундук' },
  ],
  crimson: [
    { type: 'BLAZE', tier: 4, stage: 1, use: 'Crimson Isle', why: 'боевые статы на Crimson Isle, сильнее Blaze Armor, Hot Potato Book вдвое', how: 'крафт после Blaze Rod VI: Enchanted Blaze Powder + Super Enchanted Egg' },
    { type: 'KUUDRA', tier: 4, stage: 2, use: 'Kuudra', why: 'больше Crimson Essence, чаще Vanquisher, Fortune и Trophy Chance на Crimson Isle', how: 'коллекция Kuudra (после Kuudra I), редкость — за Kuudra Chunks' },
  ],
};

// Где младших питомцев перестаём советовать, как только есть хоть один средний (одна общая цель — добыча).
// В боевых лестницах цели разные (класс, конкретный босс), там стартовый питомец для своей цели нужен всегда.
const ACROSS = new Set(['mining', 'farming', 'foraging', 'fishing']);

const tierName = t => RARITY_NAME[t] || '';
const petLabel = (ctx, type) => String(ctx.name(tx`${type};4`) || type).replace(/^\[Lvl \{LVL\}\] /, '');

/**
 * Разбирает лестницу для игрока: что есть, что уже не нужно, что следующее и по карману ли.
 * @returns {{ rows: object[], next: object|null, best: object|null }}
 */
export function petLadder(ctx, key, opts = {}) {
  // В гайдах режим профиля, деньги и «есть ли рынок» лежат в ctx.adv (ctx.market там — цены The Forge, не флаг)
  const src = ctx.adv || ctx;
  const market = src.market !== false;
  const bingo = src.mode?.id === 'bingo';
  const liquid = Number(src.liquid || 0);
  // Bingo живёт недолго: эндгейм не советуем; onlyOwned показываем только владельцу
  const ladder = (PET_LADDERS[key] || []).filter(r => !(bingo && r.stage === 3) && (!r.onlyOwned || bestPet(ctx, r.type))
    && (!r.boss || r.boss === opts.boss) && (!r.cls || !opts.cls || r.cls.includes(opts.cls)));
  const rows = ladder.map((r, i) => {
    const own = bestPet(ctx, r.type);
    const ownTier = own ? RARITY.indexOf(own.tier) : -1;
    const price = market ? ctx.price(tx`${r.type};${r.tier}`) : 0;
    return { ...r, i, own, ownTier, price, has: ownTier >= r.tier };
  });
  // Ступень «закрыта», если для той же цели уже есть питомец ступенью выше (или тот же питомец старшей редкости)
  for (const r of rows) {
    const better = rows.find(o => o !== r && o.has && o.use === r.use && (o.stage > r.stage || (o.type === r.type && o.tier > r.tier)));
    r.covered = !r.has && better ? better : null;
  }
  // Кто уже дошёл до средних питомцев, тому стартовые (и их редкость) не советуем: польза мала
  const top = ACROSS.has(key) ? Math.max(0, ...rows.filter(r => r.has && !r.event).map(r => r.stage)) : 0;
  for (const r of rows) if (!r.has && !r.covered && !r.event && top >= 2 && r.stage === 1) r.late = true;
  const cost = r => (market ? r.price : r.coins || 0);
  const affordable = r => !cost(r) || cost(r) <= liquid * 0.3;
  const open = rows.filter(r => !r.has && !r.covered && !r.late && !r.event && !r.onlyOwned);
  const next = open.find(r => r.stage < 3 && affordable(r)) || open.find(affordable) || null;
  const best = rows.filter(r => r.has).sort((a, b) => b.stage - a.stage || b.tier - a.tier)[0] || null;
  return { rows, next, best, market, liquid };
}

function statusCell(r, next, market, liquid) {
  if (r.has) return cell(tx`есть: ${tierName(r.ownTier)}${r.own.level ? tx`, ур. ${r.own.level}` : ''}`, { tone: 'good' });
  if (r.covered) return cell(tx`не нужен: есть ${r.covered.label}`, { tone: 'muted' });
  if (r.late) return cell(r.own ? tx`есть ${tierName(r.ownTier)}, хватит` : 'не нужен на твоём этапе', { tone: 'muted' });
  if (r.own) {
    const how = r.kat === false ? tx`, нужен ${tierName(r.tier)}` : tx` → ${tierName(r.tier)} у Kat`;
    return cell(tx`есть ${tierName(r.ownTier)}${how}`, { tone: r === next ? 'warn' : 'muted' });
  }
  if (r === next) return cell('следующий', { tone: 'warn' });
  if (market && r.price && r.price > liquid) return cell('дорого: копить', { tone: 'bad' });
  return cell('нет', { tone: 'muted' });
}

/** Секция гайда «Питомцы по этапам» (таблица). */
export function petLadderSection(ctx, key, opts = {}) {
  const L = petLadder(ctx, key, opts);
  for (const r of L.rows) r.label = petLabel(ctx, r.type);
  const where = r => {
    const parts = [r.how];
    if (r.odds) parts.push(tx`Шанс: ${r.odds}`);
    if (L.market && r.price) parts.push(tx`На аукционе от ${fmtCoins(r.price)}`);
    return parts.join('. ').replace(/\.?$/, '.');
  };
  const note = [
    'Питомец одной цели заменяет другого: если есть питомец старше, младшего покупать не нужно.',
    L.market ? 'Цены — самый дешёвый лот на аукционе (обычно 1 уровень).' : 'Без рынка: только то, что можно скрафтить, выбить или купить у NPC.',
  ];
  return {
    kind: 'table', title: opts.title || 'Питомцы по этапам', news: 'pets',
    note: note.join(' '),
    link: { href: '#/guides/taming', text: 'Как быстро прокачать питомца и какой предмет ему дать →' },
    columns: ['Этап', 'Питомец', 'Для чего', 'Что даёт', 'Где взять', 'У тебя'],
    rows: L.rows.map(r => [
      r.event ? EVENT : STAGES[r.stage],
      cell(tx`${r.label} (${tierName(r.tier)})`, { item: tx`${r.type};${r.tier}` }),
      r.use,
      r.why,
      where(r),
      statusCell(r, L.next, L.market, L.liquid),
    ]),
    current: L.next ? L.rows.indexOf(L.next) : undefined,
  };
}

/** Шаг «Что делать» про следующего питомца (или null, если всё нужное есть). */
export function petNextStep(ctx, key, priority = 30, opts = {}) {
  const L = petLadder(ctx, key, opts);
  const r = L.next;
  if (!r) return null;
  const name = petLabel(ctx, r.type);
  const upgrade = r.own && r.ownTier < r.tier && r.kat !== false;
  const cost = L.market && r.price ? tx` На аукционе от ${fmtCoins(r.price)}`.replace(/\.?$/, '.') : '';
  return {
    title: upgrade ? tx`Подними ${name} до ${tierName(r.tier)}` : tx`Питомец ${name}${r.own ? tx` ${tierName(r.tier)}` : ''}: ${r.use}`,
    why: tx`${r.why[0].toUpperCase()}${r.why.slice(1)}. Где взять: ${r.how}.${r.odds ? tx` Шанс: ${r.odds}.` : ''}${cost}`,
    priority, item: tx`${r.type};${r.tier}`,
  };
}
