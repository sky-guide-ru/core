// Блок «Источники» в конце каждого гайда: откуда взяты данные (API Hypixel, NEU-REPO, SkyHanni, fandom-вики)
// и проверенные видеогайды на YouTube. Видео подобраны вручную: каждая ссылка проверена (видео открыто, название
// и канал совпадают). Не добавляй ссылку, которую не открыл сам: битая или выдуманная ссылка хуже пустого места.
import { GUIDE_PAGES, WIKI_URL } from '../wiki/watch.js';

/** Общие источники данных: подпись по-русски, ссылка, что оттуда берём. */
export const DATA = {
  api: { title: 'Hypixel API', url: 'https://api.hypixel.net/', what: 'твой профиль, Bazaar и аукцион — обновляется само' },
  neu: { title: 'NEU-REPO', url: 'https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO', what: 'предметы, рецепты, требования и лор (база мода NotEnoughUpdates)' },
  skyhanni: { title: 'SkyHanni-REPO', url: 'https://github.com/hannibal002/SkyHanni-REPO', what: 'шансы и разделка Trophy Fish (база мода SkyHanni)' },
  skycrypt: { title: 'SkyCrypt', url: 'https://sky.shiiyu.moe/', what: 'сверить свой профиль на другом сайте' },
};

// Какие базы, кроме API и NEU (они есть у всех), использует гайд.
const EXTRA_DATA = { trophy: ['skyhanni'] };

// Страницы fandom-вики по гайду, кроме тех, за правками которых следит wiki/watch.js (GUIDE_PAGES).
// Каждая страница проверена поиском: она существует на hypixel-skyblock.fandom.com.
const WIKI_EXTRA = {
  dungeons: ['Catacombs', 'Dungeons'],
  'slayer-zombie': ['Slayer', 'Revenant Horror'],
  'slayer-spider': ['Slayer', 'Tarantula Broodfather'],
  'slayer-wolf': ['Slayer', 'Sven Packmaster'],
  'slayer-enderman': ['Slayer', 'Voidgloom Seraph'],
  'slayer-blaze': ['Slayer', 'Inferno Demonlord'],
  'slayer-vampire': ['Slayer', 'Riftstalker Bloodfiend'],
  dragons: ['Ender Dragon', 'Summoning Eye', 'Zealot', "Dragon's Nest", 'Dragon Armor', 'Draconic Altar', 'Tutorial:Dragon Fights Guide'],
  kuudra: ['Kuudra', 'Tutorial:Kuudra Guide', 'Kuudra Key'],
  bestiary: ['Bestiary', 'Bramass Beastslayer'],
  crimson: ['Crimson Isle'],
  rift: ['Rift Dimension'],
  fishing: ['Fishing'],
  mining: ['Mining', 'Heart of the Mountain'],
  forge: ['The Forge', 'Drills'],
  farming: ['Farming', 'The Garden'],
  foraging: ['Galatea', 'Heart of the Forest'],
  minions: ['Minions'],
  museum: ['Museum', 'Museum/Items'],
  collectibles: ['Fairy Souls', 'Abiphones'],
  enchanting: ['Experiments', 'Experimentation Table', 'Enchanting', 'Metaphysical Serum'],
  alchemy: ['Alchemy', 'Potions', 'God Potion', 'Booster Cookie', 'Mixins', 'Brewing Stand'],
  taming: ['Taming', 'Pets', 'Pet Items', 'Fann', 'Pet Food', 'Kat', 'George'],
};

// Проверено 23.11.2026 через oEmbed YouTube: видео открыто, название и канал ниже — как отдаёт YouTube.
const SLAYER_ALL = { id: 'Pxw0k5hQNVU', label: 'Как прокачивать всех слееров по порядку', channel: 'Yadi', lang: 'en', title: 'The FULLY COMPREHENSIVE Guide to Slayer Progression! (Hypixel Skyblock)' };
/**
 * Видеогайды: id гайда → [{ id: id видео YouTube, label: что это по-русски, channel, lang: 'en'|'ru', year?, title }].
 * title — оригинальное название ролика (во всплывающей подсказке), подпись label — своя, по-русски.
 */
export const VIDEOS = {
  dungeons: [
    { id: '7LDHl3MfA5M', label: 'Dungeons с нуля: классы, этажи, снаряжение', channel: 'Blank', lang: 'en', title: 'The ONLY Dungeons Guide You’ll Ever Need - Hypixel Skyblock' },
  ],
  'slayer-zombie': [
    { id: '0Jrax9efosE', label: 'Полный разбор Revenant Horror', channel: 'ZiggZagg', lang: 'en', year: 2024, title: 'The Complete Guide to Zombie Slayer | Hypixel Skyblock' },
    SLAYER_ALL,
  ],
  'slayer-spider': [
    { id: 'fpbmBTTeWs4', label: 'Как победить Tarantula Broodfather 4 тира', channel: 'Cookierider282', lang: 'en', title: 'How to Defeat a T4 Tarantula Broodfather! [FULL GUIDE!] (Hypixel Skyblock)' },
    SLAYER_ALL,
  ],
  'slayer-wolf': [SLAYER_ALL],
  'slayer-enderman': [
    { id: 'VtGRqNQgQVE', label: 'Большой гайд по Voidgloom Seraph', channel: 'Conitor', lang: 'en', title: 'The ULTIMATE Guide to ENDERMAN Slayer... | Hypixel Skyblock' },
    SLAYER_ALL,
  ],
  'slayer-blaze': [
    { id: '8gasC85twNs', label: 'Всё про Inferno Demonlord', channel: 'udKay', lang: 'en', title: "The Only Blaze Slayer Guide YOU'LL EVER NEED! | Hypixel Skyblock." },
    SLAYER_ALL,
  ],
  'slayer-vampire': [
    { id: '_G-5JYx23lw', label: 'Как проходить Riftstalker Bloodfiend', channel: 'Naillic', lang: 'en', title: 'The PERFECT Guide to Vampire Slayer... | Hypixel Skyblock' },
  ],
  kuudra: [
    { id: 'J_KzCK1oxLs', label: 'Kuudra целиком: тиры, роли, лут', channel: 'Future77', lang: 'en', title: 'The ULTIMATE Kuudra Guide | EVERYTHING you need to know (Hypixel Skyblock)' },
  ],
  crimson: [
    { id: 'QjTTBG31mZI', label: 'Прогрессия на Crimson Isle', channel: 'EnderVO1D', lang: 'en', year: 2024, title: 'The COMPLETE Guide to Crimson Isles Progression (Updated 2024) | Hypixel Skyblock' },
  ],
  rift: [
    { id: 'XUlrF9mEvio', label: 'Полный гайд по Рифту для новичков', channel: 'WaterSpais', lang: 'ru', title: 'ПОЛНЫЙ ГАЙД ПО РИФТУ ДЛЯ НОВИЧКОВ! | Hypixel SkyBlock | #2' },
    { id: 'ALpsSZ-GSRs', label: 'Рифт шаг за шагом', channel: 'dotakimu', lang: 'en', title: 'The Complete Step By Step Guide To The Rift (Hypixel Skyblock) [new one in description]' },
  ],
  fishing: [
    { id: 'W7XGTHeMSNY', label: 'Актуальный гайд по рыбалке', channel: 'WaterSpais', lang: 'ru', title: 'АКТУАЛЬНЫЙ ГАЙД НА ФИШИНГ! (Hypixel SkyBlock)' },
    { id: 'CrMGxhTCZ_s', label: 'Прогрессия рыбалки от начала до конца', channel: 'Yadi', lang: 'en', year: 2025, title: 'The FULLY COMPREHENSIVE Guide to Fishing Progression! (Hypixel Skyblock) *2025*' },
  ],
  trophy: [
    { id: 'pHyMfMUcXiA', label: 'Большой гайд по трофейной рыбе', channel: 'Asxent', lang: 'en', year: 2026, title: 'The ULTIMATE Trophy Fishing Guide *2026* (Hypixel Skyblock)' },
  ],
  mining: [
    { id: 'SgkoxCUnlgw', label: 'Подробный гайд по майнингу', channel: 'Noguti', lang: 'ru', title: 'Подробный гайд по майнингу (Hypixel skyblock)' },
    { id: 'j8cfzN9sbo4', label: 'Прогрессия добычи: HotM, снаряжение, питомцы', channel: 'Skyployee', lang: 'en', year: 2026, title: 'COMPREHENSIVE Mining Progression Guide *2026 Updated* (Hypixel Skyblock)' },
  ],
  farming: [
    { id: 'Afa-EaaFIGE', label: 'Гайд по Garden', channel: 'Pumpukk', lang: 'ru', title: 'Гайд на гарден! (Hypixel Skyblock)' },
    { id: 'nw7nzNBxot4', label: 'Прогрессия Farming', channel: 'Udex2', lang: 'en', year: 2026, title: 'The COMPLETE Farming Progression Guide! Hypixel SkyBlock 2026' },
  ],
  foraging: [
    { id: 'f7QC4wX-6_Y', label: 'Foraging после обновления Galatea', channel: 'Asxent', lang: 'en', year: 2026, title: 'The Complete Guide To FORAGING *UPDATED 2026* | Hypixel Skyblock IRONMAN' },
  ],
  hunting: [
    { id: 'LF2HlihlupY', label: 'Hunting: осколки и атрибуты', channel: 'RawHuney', lang: 'en', year: 2025, title: 'ULTIMATE Comprehensive Hunting Guide (UPDATED) 2025 | Hypixel Skyblock!' },
  ],
  minions: [
    { id: 'nEB6q-d8Pk0', label: 'Какие миньоны ставить и когда', channel: 'ZiggZagg', lang: 'en', title: 'The COMPLETE Minion Progression Guide | Hypixel Skyblock' },
  ],
  museum: [
    { id: 'Bwfv3uute3Q', label: 'Музей для новичка', channel: 'Derailious', lang: 'en', title: "The Museum: Complete Beginner's Guide (Hypixel Skyblock)" },
  ],
  essence: [
    { id: '8mxfJJ6RKwA', label: 'Что брать в магазинах эссенций', channel: 'AcaciaDragon', lang: 'en', title: 'Essence shop guide for Hypixel Skyblock' },
  ],
  collectibles: [
    { id: 'paw1rnwE5yc', label: 'Феи-души по местам (227 из 289, без новых островов)', channel: 'AggeronTV', lang: 'en', title: '[UPDATED] All 227/227 Fairy Souls Locations | Hypixel Skyblock | Gain Over 500 Health' },
  ],
  diana: [
    { id: 'wmHOgxUjIOk', label: 'Гайд по событию Diana', channel: 'Import', lang: 'en', year: 2025, title: 'The Ultimate Diana Guide 2025 | Hypixel Skyblock' },
  ],
  chocolate: [
    { id: 'VAcggHaHIQY', label: 'Гайд по Chocolate Factory (Hoppity)', channel: 'Nameless4Now', lang: 'en', title: 'The ULTIMATE Hoppity Chocolate Factory Update Guide (Hypixel Skyblock)' },
  ],
};

export const wikiUrl = title => WIKI_URL + encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':').replace(/%2F/g, '/');
export const videoUrl = id => `https://www.youtube.com/watch?v=${id}`;

/** Секция «Источники» для гайда (есть у каждого: хотя бы API и NEU). */
export function sourcesSection(guideId) {
  const data = ['api', 'neu', ...(EXTRA_DATA[guideId] || []), 'skycrypt'].map(k => ({ ...DATA[k] }));
  const pages = [...new Set([...(WIKI_EXTRA[guideId] || []), ...(GUIDE_PAGES[guideId] || [])])];
  const wiki = pages.map(title => ({ title, url: wikiUrl(title) }));
  const videos = (VIDEOS[guideId] || []).map(v => ({ ...v, url: videoUrl(v.id) }));
  return {
    kind: 'sources', title: 'Источники',
    note: 'Откуда взяты цифры этого гайда и где посмотреть подробнее. Ссылки открываются в новой вкладке.',
    data, wiki, videos,
  };
}
