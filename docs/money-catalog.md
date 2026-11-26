# Каталог способов заработка в Hypixel SkyBlock

Составлено 23.11.2026. Цель: собрать всё, на чём в игре можно заработать монеты, сравнить с тем, что уже есть во вкладке «Заработок», и выдать очередь работ для параллельных тредов.

## Откуда данные

| Источник | Что взято | Как проверено |
|---|---|---|
| Живой Bazaar (api.hypixel.net, 23.11.2026, 14:40 Екб) | 2207 товаров, из них 1342 с оборотом от 20 млн монет в неделю | цена продажи и недельный оборот, раздел «Куда текут деньги» |
| NEU-REPO (8993 предмета) | рецепты: 2565 крафтов, 1088 товаров у NPC, 511 таблиц дропа, 124 рецепта Forge, 78 обменов; описания предметов | откуда берётся предмет |
| Вики fandom (через встроенный браузер ПК) | статьи об островах, ивентах, обновлениях 2025–2026 (Galatea, Hunting, Attribute Fusion, Greenhouse, Year of the Witch, Hotspot, Glacite Mineshafts, Frozen Corpses и т.д.) | статья есть и правилась в 2026 |
| Код сайта | `server/market/methods.js` (21 метод) | что уже показывается |

**Чего нет:** вики не даёт готовых цифр дохода в час (страницы Money Making Guide на fandom нет). Поэтому доход ниже дан уровнями, а не точными числами. Точные цифры треды считают сами по живым ценам.

## Условные обозначения

**Доход (оценка сообщества, не сверено с игрой):** 🟢 низкий (до 2 млн/ч) · 🟡 средний (2–8 млн/ч) · 🟠 высокий (8–20 млн/ч) · 🔴 очень высокий (20+ млн/ч) · ⏳ пассивный/разовый (считать за день или за штуку).

**Статус:**
- ✅ уже есть во вкладке «Заработок» (id метода)
- 🎣 берёт тред «Исследовать заработок на рыбалке»
- ⚔️ берёт тред «…на мобах и слеерах»
- ⛏️ берёт тред «…на майнинге»
- 🌀 берёт тред «…в Рифте и прочем» (у него очень широкий охват: Сад, Foraging/Hunting, миньоны, ивенты, крафт/NPC-флипы, питомцы, Dark Auction, Bits)
- ⬜ никто не берёт, в очереди (см. раздел «Очередь»)

**Сверено:** «рынок» — товар живой на Bazaar 23.11 (в скобках недельный оборот); «вики» — статья fandom есть и обновлялась в 2026; «NEU» — предмет и его источник есть в NEU-REPO; «—» — не сверено.

---

## 1. Фермерство и Сад

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Фарм культур (сырьё, сжатое, NPC) | Garden | Farming 40+, хороший Farming Fortune | Enchanted/компакт культуры | 🟡–🟠 | ✅ `farming` | рынок, патч 0.27.3 |
| Охота на вредителей (Pests) | Garden | Garden 5+, вакуум, SkyMart | дропы вредителей: Overgrown Grass (1,1 млрд/нед), Pesthunting Guide, Dung, Beady Eyes, книги Pesterminator, Chirping Stereo и др. | 🟠–🔴 (цель Hypixel 25–30 млн/ч) | 🌀 (Сад) | рынок, вики (Pest, 2026-11) |
| Редкие дропы с культур (Cropie, Squash, Fermento, Helianthus) | Garden | Farming Fortune, Fermento/Cropie/Squash сеты | Cropie (14 млрд/нед), Squash (10 млрд), Fermento (25 млрд), Condensed Fermento, Helianthus (27 млрд) | 🟡 (сверху к фарму) | ⬜ Q2 | рынок |
| Jacob's Farming Contest | Garden, каждые 3 игровых дня | Farming 10+ | медали → магазин Anita (Jacob's Ticket 15 млрд/нед, улучшения), дропы контеста | ⏳ 🟡 | ⬜ Q2 | рынок, вики |
| Гости Сада (Visitors) | Garden | Garden 1+ | Copper, редкие награды (Flowering Bouquet, Dedication IV, Jungle Key, Visitor's Gratitude 4,8 млрд/нед, Overgrown Grass, Space Helmet) | ⏳ 🟡 | ✅ `visitors` | рынок |
| Greenhouse и мутации культур | Garden, участок Greenhouse | Garden 7, чертёж Greenhouse от Carpenter | новые культуры/мутации (Ashwreath, Chocoberry, Glasscorn, Startlevine, Devourer и др.), бонусные дропы | ⏳ — | ⬜ Q2 | вики (Greenhouse, 2026-10), рынок |
| Garden Chips | Greenhouse/Garden | Garden 7+ | Rarefinder (8,8 млрд/нед), Overdrive, Mechamind, Cropshot и др. | ⏳ — | ⬜ Q2 | рынок, NEU |
| Composter | Garden | Garden 3+ | Compost, Enchanted Compost (продаём или тратим на культуры) | ⏳ 🟢 | ⬜ Q2 | рынок |
| Грибы, мицелий, красный песок (Mushroom Desert/Garden) | Garden, Mushroom Desert | Farming | Enchanted Mycelium/Cube, Red Sand Cube, Huge Mushroom блоки | 🟢 | ⬜ Q2 | рынок |
| Новые цветы-культуры Sunflower/Moonflower/Wild Rose | Garden | Farming, Turbo-книги | Compacted Sunflower/Moonflower/Wild Rose (по 16 млрд/нед), Turbo-книги | 🟡 | 🌀 (Сад) | рынок |
| Лабиринт Sugar Cane/Cactus/Cocoa на других островах | The Barn, Desert | — | старый способ, хуже Сада | 🟢 | не нужен отдельно | — |

## 2. Майнинг

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Гемы (Ruby/Jade/Amber/Topaz/Sapphire/Amethyst) | Crystal Hollows | HotM 4+, дрель | Fine/Flawless/Perfect гемы | 🟡–🟠 | ✅ `gemstones` | рынок, патч 0.27.3 |
| Гемы Mineshaft (Opal/Aquamarine/Citrine/Peridot/Onyx/Jasper) | Glacite Mineshafts | HotM 7, Glacite Tunnels | Fine Peridot 62 млрд/нед, Flawless Onyx 29 млрд, Perfect Jasper 30 млрд | 🟠 | ⛏️ | рынок, вики |
| Frozen Corpses (ключи и рюкзаки трупов) | Glacite Mineshafts | Tungsten/Umber/Skeleton Key | лут трупов: Skeleton Key (74 млрд/нед, это ключ), Glacite Amalgamation, Opal, броня, RNG Meter (с 02.2026) | 🟠 | ⛏️ | рынок, вики (Frozen Corpses) |
| Fossil Excavator | Dwarven Base Camp | Suspicious Scrap | Suspicious Scrap (79 млрд/нед), окаменелости → питомец Scatha/Bal, Glacite Powder | 🟡 | ⛏️ | рынок, вики |
| Tungsten/Umber/Glacite руда | Glacite Tunnels | HotM 6+ | Enchanted Tungsten (98 млрд/нед), Enchanted Umber (96 млрд), Refined Tungsten/Umber, Glacite Jewel | 🟡 | ⛏️ | рынок |
| Mithril/Titanium | Dwarven Mines | HotM 1+ | Enchanted Mithril, Refined Mithril (81 млрд), Titanium, Refined Titanium (58 млрд) | 🟢–🟡 | ⛏️ | рынок |
| Crystal Nucleus (5 кристаллов) | Crystal Hollows | доступ в Hollows, ключевые предметы для каждой зоны | лут Nucleus: Jungle Key, части Divan, Prehistoric Egg, Pickonimbus, Treasurite, Sludge Juice | 🟡 | ⛏️ | вики |
| Сундуки Hollows (Treasure Chests) | Crystal Hollows | — | Goblin Egg (синие 61 млрд/нед), Treasurite, Pickonimbus, Sludge Juice (116 млрд), Jungle Heart | 🟡 | ⛏️ | рынок |
| Commissions и Powder | Dwarven Mines, Hollows | HotM | Powder (на перки), Mithril Powder, Golden Goblin; прямые монеты малы | 🟢 | ⛏️ | — |
| Mining Fiesta (мэр Cole) | все шахты | — | Glossy Gemstone (393 млрд/нед!), Refined Mineral (62 млрд) | 🔴 во время ивента | ⛏️ (стоит проверить, что взяли) | рынок, вики |
| Forge | Dwarven Mines | HotM 2+ | Mithril Plate (124 млрд/нед), Gemstone Mixture (106 млрд), Refined-руды, Divan, Gleaming Crystal | ⏳ 🟡–🟠 | ✅ `forge` | рынок, NEU |
| Сульфур, кварц, нижний мир | Crimson Isle | — | Enchanted Sulphur Cube (79 млрд/нед) | 🟢 | ✅ `crimson-sulphur` | рынок |
| End Stone, Obsidian (плюс миньоны) | The End | — | Enchanted Obsidian (45 млрд/нед) | 🟢 | ⬜ Q5 (миньоны) | рынок |
| Hard Stone/Coal/Lapis/Redstone/Diamond | Deep Caverns, Hollows | — | Enchanted Diamond Block (293 млрд/нед, в основном с миньонов), Enchanted Coal (88 млрд), Lapis Block (67 млрд) | 🟢 | ⬜ Q5 (миньоны) | рынок |

## 3. Рыбалка

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Trophy Fishing | Crimson Isle | Fishing 12+, Magma Rod | Trophy Fish, Magma Fish | 🟢–🟡 | ✅ `trophy` | рынок |
| Лава: Lord Jawbus, Thunder, Plhlegblast | Crimson Isle | Fishing 27+, лавовое снаряжение | Magma Lord Fragment (43 млрд/нед), Thunder Shards, Plasma Bucket (19 млрд), Radioactive Vial, Flash-книги | 🟠 | ✅ `fish-crimson-lava` | рынок, патч 0.27.3 (дроп 100%→50%) |
| Водные существа (Hub/Park/Spider's Den/Galatea) | разные | Fishing 10–30 | Water Hydra, Sea Emperor, Great White Shark Tooth и т.д. | 🟢–🟡 | ✅ `fish-water`, `fish-galatea` | рынок |
| Hotspot-существа | Hub, Spider's Den, Bayou, Jerry, Crimson | разговор с Hattie | Hotspot Water Orb (5,4 млрд/нед), Hotspot Bait | 🟡 | ✅ `fish-water-hotspot`, `fish-lava-hotspot` | рынок, вики (Hotspot) |
| Backwater Bayou (Titanoboa и др.) | Backwater Bayou | Fishing 30+ | Titanoboa Shed (6,7 млрд/нед), Alligator Skin (30 млрд), Bayou Water Orb, Rusty Coin (24 млрд) → Junker Joel | 🟡–🟠 | ✅ `fish-bayou` | рынок, NEU |
| Рыбалка Jerry (зима) и Jerry Island | Jerry's Workshop | Season of Jerry или Jerry Island QoL (03.2026) | Frozen Scute, Ice Hunk, Yeti/Reindrake дропы | 🟡 | ✅ `fish-winter` | рынок, вики |
| Spooky Fishing (Halloween) | Hub/Park во время Spooky | — | дропы Phantom Fisher и Grim Reaper | 🟡 | ✅ `fish-spooky` | — |
| Fishing Festival (акулы, мэр Marina) | любые воды | — | Shark Tooth (Great White 9,2 млрд/нед), Shark Fin | 🟡 | ✅ `fish-festival` | рынок, вики |
| Treasure Fishing (сокровища) | любые | Treasure Chance | Treasure Bait, Golden Bait, Squeaky Toy, Wet Book | 🟢 | ⬜ не посчитано: улов-сокровища не входят в таблицу существ | рынок |
| Сбор водных ресурсов (Sea Lumies, Water Lily) | Galatea, Hub | — | Sea Lumies (1,1 млрд/нед), Condensed Water Lily | 🟢 | 🎣 / Q3 | рынок |
| Crystal Hollows: черви и лава Magma Fields | Crystal Hollows | Fishing 15+ | Rough Amber/Sapphire/Topaz, Worm Membrane, Magma Core | 🟢 | ✅ `fish-hollows` | вики |
| Продажа наживки и ловушек | Hunting/Bayou | — | Whale Bait (19 млрд/нед), Hot/Light/Dark Bait | 🟢 | 🎣 | рынок |

## 4. Бой: слееры, данжи, Kuudra, мобы

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Revenant Horror T5 | Hub, кладбище | Zombie Slayer 5+ | Revenant Viscera, Scythe Blade, Smite VII, Shard of Shredded | 🟡 | ✅ `slayer-zombie` | — |
| Tarantula Broodfather T4–T5 | Spider's Den | Spider Slayer 5+ | Tarantula Silk (34 млрд/нед), Toxic Arrow Poison, Fly Swatter, Flycatcher (18 млрд) | 🟢–🟡 | ✅ `slayer-spider` | рынок |
| Primordial Broodfather (T5, 07.2025) | Spider's Den | Spider Slayer 7+ | Primordial-шарды (10 млрд/нед), новые предметы | 🟡–🟠 | ⚔️ | вики (07.2025), рынок |
| Sven Packmaster T4 | Ruins (Hub) | Wolf Slayer 5+ | Wolf Tooth (69 млрд/нед), Overflux Capacitor, Grizzly Bait | 🟢 | ✅ `slayer-wolf` | рынок |
| Voidgloom Seraph T4 | The End | Ender Slayer 5+ | Null Sphere, Null Ovoid, Judgement Core, Ender Slayer-книги, Summoning Eye | 🟡–🟠 | ✅ `slayer-enderman` | рынок |
| Inferno Demonlord T3–T4 | Crimson Isle | Blaze Slayer | Derelict Ashe (132 млрд/нед), Fire Aspect III, Molten Powder, High Class Archfiend Dice | 🟠 | ✅ `slayer-blaze` | рынок |
| Riftstalker Bloodfiend (Vampire) | Rift | Vampire Slayer | McGrubber's Burger, Unfanged Vampire Part, Covenant Seal | 🟢 | ⚔️/🌀 | — |
| Catacombs F1–F7 | Dungeon Hub | Catacombs | сундуки, Kismet, Wither Essence (89 млрд/нед), Wither Catalyst (184 млрд), Necron-части | 🟡 | ✅ `dungeon-f7` (только F7) | рынок |
| Master Mode M1–M7 | Dungeon Hub | Cata 24–40+ | Master Stars (5-я 34 млрд/нед), Scrolls (Implosion/Shadow Warp/Wither Shield по 55–67 млрд), Recombobulator, Dark Claymore | 🟠–🔴 | ✅ `dungeon-m*` | рынок |
| Dungeonbreaker | данжи | — | новая кирка/эндгейм-апгрейд (10.2025) | — | ⚔️ | вики |
| Продажа ключей/дропов данжей (Dungeon Chest Key, Kismet Feather) | Croesus | — | реролл сундуков; Kismet 115 млрд/нед | ⏳ | ✅ `kismet` (подсказка, без дохода в час) | рынок |
| Kuudra Hot→Infernal | Crimson Isle | фракция, Kuudra Key | Kuudra Teeth, Attribute-броня, Hellfire/Burning-книги, Crimson Essence (81 млрд/нед), Kuudra Tentacle | 🟡–🔴 | ✅ `kuudra-*` | рынок |
| Мини-боссы Crimson Isle (Ashfang, Bladesoul, Barbarian Duke, Mage Outlaw, Magma Boss) | Crimson Isle | Combat 24+ | эссенция Crimson, Magma Urchin, Ragnarock Axe, Flaming Fist, Fire Fury Staff, ключи Kuudra | 🟢–🟡 | ✅ `crimson-minibosses`, `crimson-magma-boss` | рынок |
| Matriarch (Heavy Pearl) | Crimson Isle, Belly of the Beast | — | Heavy Pearl (23 млрд/нед), раз в день | ⏳ 🟡 | ⬜ Q5 | рынок, NEU |
| Vanquisher (Crimson) | Crimson Isle | Vanquisher-хант | Nether Star ×3 (CORRUPTED_NETHER_STAR) | 🟢 | ✅ `crimson-vanquisher`, `crimson-mobs` | рынок |
| Драконы (Dragon's Nest) | The End | Summoning Eye | Dragon Claw/Horn, фрагменты брони, Ender Dragon pet; Ritual Residue (7,7 млрд/нед) | 🟡 | ⚔️ | рынок |
| Зилоты и Special Zealot | The End | — | Summoning Eye (106 млрд/нед), Enchanted Ender Pearl | 🟢–🟡 | ⚔️ | рынок |
| Arachne | Spider's Den | Arachne's Keeper fragment | Arachne Fragment, Arachne Fang | 🟢 | ⚔️ | рынок |
| Призраки (Ghosts) в Dwarven Mines | Dwarven Mines | Combat 30+ | Sorrow (15 млрд/нед), Plasma (31 млрд), Volta, Bag of Cash | 🟢–🟡 | ⚔️ | рынок |
| Прочие мобы для коллекций (Golem, Ice Walker, Star Sentry, Automaton, Corleone, Yog, Goblin) | разные | — | Golem Poppy, Glacite, Robotron/Precursor-части (Precursor Apparatus 45 млрд/нед), Corleonite | 🟢 | ⚔️/⛏️ | рынок |
| Бестиарий | везде | — | косвенно (статы) | — | не метод | — |
| Черви и Scatha (Crystal Hollows) | Hollows | — | Worm Membrane (42 млрд/нед), Scatha-шарды | 🟢 | ⛏️ | рынок |

## 5. Hunting, Galatea, Foraging

Hunting появился в 2025 вместе с островом Galatea: шарды ловятся лассо, сетью, ловушками и выпадают с мобов. Шарды торгуются на Bazaar, их почти 250 видов (`SHARD_*`).

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Охота лассо (лесные шарды) | Galatea | Abysmal Lasso | шарды: Power Dragon (15 млрд/нед), Paragon (12 млрд), Chameleon (9,7 млрд), Kraken (8,3 млрд), Gecko, Wolverine | 🟡–🟠 | 🌀 (Foraging/Hunting) | рынок, вики (Hunting) |
| Водная охота сетью | Galatea/Bayou | Basic Fishing Net+ | Verdant, Birries, водные шарды | 🟢–🟡 | 🌀 | вики |
| Ловушки (Trap Hunts у David Hunterborough) и Salt Hunts | Galatea | Hunting | шарды по ловушкам | ⏳ 🟢 | 🌀 | вики |
| Attribute Fusion (флип шардов) | Tangleburg, Fusion House | — | дешёвые шарды → дорогие; удвоение с Pure Reptile | 🟡 | ⬜ Q3 (если 🌀 не возьмёт) | вики (Attribute Fusion) |
| Шарды с мобов и боссов (`SHARD_*` боевые) | везде | — | Apex Dragon, Starborn (4,2 млн/шт), Molthorn (8 млн/шт), Etherdrake, Jormung | 🟡 | ⬜ Q3 (связать с ⚔️) | рынок |
| Foraging на Galatea (Fig, Mangrove) | Galatea | Foraging 20+, HotF | Enchanted Fig Log (20 млрд/нед), Enchanted Mangrove Log (13 млрд), Figstone, Mangcore, Moonglade Jewel | 🟢–🟡 | 🌀 | рынок, вики (Galatea, 2026-11) |
| Agatha и Miria (купоны Galatea) | Galatea | — | Agatha Coupon (18,5 млрд/нед), Miria Coupon (24 млрд) | ⏳ 🟢 | ⬜ Q3 | рынок, вики (Agatha) |
| Galatea-ресурсы (Lushlilac, Vinesap, Tender Wood, Sea Lumies, Starfall) | Galatea | — | Enchanted Vinesap, Enchanted Tender Wood, Forest's Favor | 🟢 | 🌀 | рынок |
| Foraging на Park (дуб, ель и др.) | The Park | Treecapitator | Enchanted логи (по 3–6 млрд/нед) | 🟢 | 🌀 | рынок |
| Foraging-ивенты/подарки деревьев | Galatea | — | Tree Gifts, Wood Singularity (1 млрд/нед) | ⏳ | ⬜ Q3 | рынок |

## 6. Рифт

Почти всё внутри Рифта привязано к профилю (Motes не продаются). Монеты дают немногие вещи.

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Vampire Slayer (см. бой) | Stillgore Château | — | см. выше | 🟢 | 🌀/⚔️ | — |
| Предметы Рифта, которые торгуются (Rift Prism не продаётся) | Rift | — | Agaricus Cap и т.п. — почти нет рынка | 🟢 | 🌀 | — |
| Montezuma (питомец) и души Enigma | Rift | — | не продаются | — | не метод | вики |

## 7. Ивенты и мэры

| Метод | Когда | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Mythological Ritual (Diana) | мэр Diana | Griffin pet, Ancestral Spade | Divine Gift (87 млрд/нед), Griffin Feather (34 млрд), Mythos Fragment, Chimera-книги, Braided Griffin Feather (v2, 11.2025) | 🔴 | ✅ `diana` | рынок, вики |
| Spooky Festival | раз в год, октябрь игры | — | Purple/Green Candy (31 млрд/нед) → Fear Mongerer, Spooky-питомцы, Horseman Candle | ⏳ 🟡 | ⬜ Q2 | рынок, вики |
| Great Spook (с 10.2025) | Halloween | — | Primal Fears, новые дропы | ⏳ — | ⬜ Q2 | вики |
| Season of Jerry / Jerry's Workshop | зима игры | — | Gifts (Red Gift 18 млрд/нед, White, Green), Jerry Box, Frozen Bauble, Glacial Fragment | ⏳ 🟡 | ⬜ Q2 | рынок, вики |
| Year of the Witch (новый, с 02.2026) | раз в 12 игровых лет | — | ингредиенты с мобов (Singed Powder 45 млрд/нед, Spell Powder и т.д.), лавка Agnes | ⏳ 🟠 во время ивента | ⬜ Q2 | рынок, вики |
| Traveling Zoo | 2 раза в год | — | питомцы (Elephant, Giraffe, Lion, Monkey, Blue Whale, Tiger) для перепродажи | ⏳ | ⬜ Q2 | вики |
| New Year Celebration / Century Cakes | Новый год игры | — | New Year Cake (коллекционные), Century Cake | ⏳ 🟢 | ⬜ Q2 | вики |
| Carnival (мэр Foxy/Carnival) | мэр | — | Carnival Ticket → Carnival Shop | ⏳ 🟢 | ⬜ Q2 | вики |
| Cult of the Fallen Star | 4 раза в месяц игры | — | Starfall и награды культа | ⏳ 🟢 | ⬜ Q2 | рынок |
| Hoppity's Hunt и Chocolate Factory | весна и всегда | Chocolate Factory | Faction Rabbits (Sunset/Rosebud по 18 млн, Mayor 9 млн), Hoppity-кролики, NPC Chocolate Shop | ⏳ 🟡 | ⬜ Q2 | рынок, NEU, вики |
| Mining Fiesta, Fishing Festival | мэры Cole, Marina | — | см. майнинг и рыбалку | 🔴/🟡 | ⛏️/🎣 | — |
| Мэр Diaz: Stock of Stonks, Shen's Special | мэр Diaz | Museum 20 | Stock of Stonks (258 млрд/нед), обмен у Liz | ⏳ | ⬜ Q5 | рынок, NEU |
| Мэр Derpy/Aatrox/Paul/Finnegan/Jerry | мэры | — | бонусы к слеерам/данжам/фарму; влияют на доход других методов | множитель | ⬜ Q5 (множители) | вики |
| Bingo | раз в месяц | Bingo-профиль | Bingo-магазин, предметы не переносятся | — | не метод | вики |

## 8. Пассив и ежедневка

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Миньоны (лучшие по доходу, с Super Compactor, Flycatcher, топливом) | остров | слоты миньонов | Enchanted Clay Block (140 млрд/нед), Slime Block (144 млрд), Diamond Block и др. | ⏳ 🟡 | 🌀 | рынок |
| Inferno-миньоны (топливо Gabagool) | остров | Inferno Minion, Hypergolic/Heavy Gabagool | Chili Pepper (49 млрд/нед), Vertex/Apex, Reaper Pepper | ⏳ 🟡 | ⬜ Q5 | рынок |
| Experimentation Table | Hub/остров | Enchanting | книги, Exp Bottles, Titanic Exp Bottle (29 млрд/нед) | ⏳ 🟢 | ✅ `experiments` | рынок |
| Bits: Booster Cookie → магазин Elizabeth | Hub | Booster Cookie (792 млрд/нед) | Kismet Feather, Kat Flower, Heat Core, God Potion, Ultimate Carrot Candy, Jumbo Backpack | ⏳ 🟡 | 🌀 | рынок, вики (Bits Shop, 2026-10) |
| Chocolate Factory | Hoppity | — | см. ивенты | ⏳ | ⬜ Q2 | — |
| Dark Auction | раз в игровой день | — | перепродажа ставок (Midas, Hegemony, Shen's Ring) | ⏳ | 🌀 | вики (Dark Auction) |
| Shen's Auction/Special | Museum 10/20 | — | ставки на редкие предметы | ⏳ | ⬜ Q1 | вики |
| Matriarch, Kuudra-ключи, ежедневные квесты фракции | Crimson | — | Heavy Pearl | ⏳ 🟢 | ⬜ Q5 | рынок |
| Проценты в банке | банк | — | 2% в сезон | ⏳ 🟢 | ⬜ Q5 (мелочь) | вики (Bank) |
| Forge | Dwarven Mines | HotM 2 | см. майнинг | ⏳ | ✅ `forge` | — |
| Гости Сада, Composter | Garden | — | см. Сад | ⏳ | ✅/⬜ | — |

## 9. Торговля и перепродажа

| Метод | Где | Требования | Суть | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Флипы на Bazaar (ордера) | Bazaar | капитал | спред купить/продать | 🟢–🟡 | ✅ `bazaar-flip` | рынок |
| Крафт-флипы | Bazaar/AH | коллекции | дешёвые ингредиенты → готовый предмет | 🟡 | ✅ `craft-flip` | рынок |
| NPC → Bazaar (купить у NPC, продать на Bazaar) | NPC-магазины (1088 товаров в NEU) | — | Builder, Farm Merchant, Adventurer и т.д. | 🟢 | 🌀 (NPC-флипы) | NEU |
| Bazaar → NPC (продать NPC дороже) | любой NPC | — | когда цена на Bazaar ниже NPC-цены | 🟢 | 🌀 | NEU |
| Флипы аукциона (снайп ниже Lowest BIN) | Auction House | капитал | покупать дешевле рынка, перепродавать | 🟡–🟠 | ✅ `ah-snipe` | — |
| Комбинирование книг (I+I → V/VI/VII) | Anvil | — | например Ultimate Chimera I (28,5 млн) → V (383 млн), Looting/Critical/Power VII; считать по живым ценам | 🟡 | ✅ `book-combine` | рынок |
| Улучшение и перепродажа предметов (звёзды Essence, Master Stars, Recombobulator, Hot/Fuming Potato Book, Art of War) | Anvil, Essence Shop | эссенции | покупаем «голый» предмет, улучшаем, продаём дороже суммы | 🟡 | ✅ `upgrade-flip` (звёзды, Master Stars, Recombobulator) | рынок |
| Камни перековки (Reforge Stones) | Hub/Forge | — | крафт или покупка и перепродажа | 🟢 | частично ✅ `craft-flip` | рынок |
| Флипы питомцев (прокачка до 100 и продажа) | AH, Exp Share | Taming | купить питомца lvl 1, прокачать, продать | 🟡 | 🌀 (питомцы) | — |
| Kat (повышение редкости питомца) | Kat NPC | — | купить ниже, поднять у Kat, продать | 🟡 | 🌀 (питомцы) | NEU (katgrade, 217 записей) |
| Перепродажа предметов Dark Auction/Shen | AH | — | см. выше | ⏳ | 🌀/⬜ Q1 | — |
| Разборка (salvage) снаряжения данжей на Essence | Dungeon Hub | — | дешёвый хлам → Wither/Undead Essence | 🟢 | ⬜ Q1 | рынок |
| Улучшение гемов (Flawed→Fine→Flawless→Perfect) | крафт | — | 80× ниже по ступени = 1 выше | 🟢 | ✅ `craft-flip` (проверить, что рецепты попадают) | NEU |
| Бутылки опыта (Grand → Titanic → Colossal) | крафт | Enchanting | Colossal Exp Bottle (5,9 млрд/нед) | 🟢 | ✅ `craft-flip` (проверить) | рынок |
| Флип миньонов (скрафтить миньона T11 и продать) | AH | коллекции | — | 🟢 | ⬜ Q1 | — |
| Перепродажа Booster Cookie | Bazaar | — | спред | 🟢 | ✅ `bazaar-flip` | рынок |

## 10. Навыки-ремёсла

| Метод | Где | Требования | Что продаём | Доход | Статус | Сверено |
|---|---|---|---|---|---|---|
| Alchemy (варка зелий на продажу) | Brewing Stand | Alchemy | зелья для данжей, Wisdom-зелья | 🟢 | ⬜ Q1 | — |
| Enchanting (книги со стола) | Enchanting Table | Enchanting | дешёвые книги для комбинирования | 🟢 | ⬜ Q1 | — |
| Carpentry (мебель) | крафт | — | почти нет рынка | — | не метод | — |
| Runecrafting (руны) | Rune Pedestal | — | руны с мобов → AH | 🟢 | ⬜ Q1 | — |

---

## Куда текут деньги: топ оборота Bazaar за неделю

Самые крупные рынки Bazaar на 23.11.2026 (оборот = цена продажи × продано за неделю). По ним видно, какие способы реально кормят игроков. Последний столбец показывает, закрыт ли источник.

| Товар | Оборот, млрд/нед | Откуда берётся | Кто закрывает |
|---|---|---|---|
| Booster Cookie | 792 | покупка за гемы → Bits | 🌀 (Bits) |
| Glossy Gemstone | 393 | гемы во время Mining Fiesta | ⛏️ |
| Recombobulator 3000 | 391 | данжи, Bits | ✅ данжи |
| Enchanted Diamond Block | 293 | миньоны, майнинг | 🌀 миньоны |
| Stock of Stonks | 258 | мэр Diaz, Stonks Auction | ⬜ Q5 |
| Looting VII (книга) | 190 | слееры/комбинирование | ⚔️ / ⬜ Q1 |
| Wither Catalyst | 184 | данжи M7 | ✅ данжи |
| Enchanted Slime/Clay Block | 144 / 140 | миньоны | 🌀 миньоны |
| Derelict Ashe | 132 | Inferno Demonlord | ✅ `slayer-blaze` |
| Mithril Plate | 124 | Forge | ✅ `forge` |
| Sludge Juice | 116 | Crystal Hollows (Jungle, сундуки) | ⛏️ |
| Kismet Feather | 115 | Bits, данжи | ✅ `kismet` |
| Gemstone Mixture | 106 | Forge | ✅ `forge` |
| Summoning Eye | 106 | Зилоты | ⚔️ |
| Enchanted Tungsten / Umber | 98 / 96 | Glacite Tunnels | ⛏️ |
| Wither Essence | 89 | данжи | ✅ данжи |
| Divine Gift | 87 | Diana | ✅ `diana` |
| Crimson Essence | 81 | Kuudra | ✅ `kuudra-*` |
| Refined Mithril | 81 | Forge/майнинг | ⛏️ |
| Suspicious Scrap | 79 | Glacite Tunnels → Fossil Excavator | ⛏️ |
| Enchanted Sulphur Cube | 79 | Crimson Isle | ✅ `crimson-sulphur` |
| Skeleton Key | 74 | Forge (для трупов) | ⛏️ |
| Wolf Tooth | 69 | Sven | ✅ `slayer-wolf` |
| Wither Shield / Shadow Warp / Implosion | 67 / 66 / 55 | M7 | ✅ данжи |
| Goblin Egg (синий) | 61 | Crystal Hollows | ⛏️ |
| Tarantula Web | 57 | Tarantula, Spider's Den | ✅ / ⚔️ |
| Very Crude Gabagool | 54 | Crimson Isle, Inferno-миньоны | ⬜ Q5 |
| Chili Pepper | 49 | Inferno-миньоны | ⬜ Q5 |
| Habanero Tactics IV | 46 | Kuudra | ✅ |
| Singed Powder | 45 | Year of the Witch | ⬜ Q2 |
| Magma Lord Fragment | 43 | Lord Jawbus/лава | 🎣 |
| Worm Membrane | 42 | черви в Hollows | ⛏️ |
| Griffin Feather | 34 | Diana | ✅ |
| Jacob's Ticket | 15 | Jacob's Contest | ⬜ Q2 |
| Overgrown Grass | 1,1 | вредители | 🌀 |

---

## Очередь недостающих методов

То, что не входит ни во вкладку, ни в 4 запущенных треда. Разбито на 5 групп, которые не пересекаются по файлам данных: каждую можно отдать отдельному треду. Внутри группы методы идут по пользе для игрока (сначала то, где крупный оборот).

### Q1. Перепродажа и улучшение предметов (рынок, без гринда)
> Сделано (тред «Добавить заработок на перепродаже и улучшении», 23.11.2026): пункты 1–4 и 9 — методы `ah-snipe`, `book-combine`, `upgrade-flip`, `kismet` (server/market/methods/resale.js, расчёты в resale.js). Скан аукциона теперь копит цены и продажи по вариантам «ID@звёзды[r]» (0/5/10 звёзд, r — Recombobulator), отсюда цены улучшенных предметов. Крафт-флипы уже ловят улучшение гемов и Exp Bottles (рецепты есть в NEU). Hot/Fuming Potato Book и Art of War отдельно не считаем: аукцион их не различает. Не сделано: 5 (Shen), 6 (разборка), 7 (миньоны — частично ловит `craft-flip`), 8 — нет надёжных данных.
1. Флипы аукциона: снайп ниже Lowest BIN (по полному скану AH, который сайт уже делает раз в 3 мин).
2. Комбинирование книг (I→V/VI/VII) по живым ценам Bazaar: Chimera, Legion, Looting, Critical, Power, Sharpness, Growth и т.д.
3. Улучшение и перепродажа: звёзды за Essence, Master Stars, Recombobulator, Hot/Fuming Potato Books, Art of War/Peace.
4. Kismet Feather и ключи Croesus: когда выгодно рероллить сундук.
5. Shen's Auction и Shen's Special: что выгодно выкупать и перепродавать.
6. Разборка снаряжения данжей на Essence.
7. Флип миньонов (крафт T11 → AH).
8. Ремёсла на продажу: зелья Alchemy, руны Runecrafting, книги со стола Enchanting.
9. Проверить, что `craft-flip` уже ловит улучшение гемов и Exp Bottles; если нет, добавить.

### Q2. Ивенты года и Сад глубже
1. Year of the Witch: ингредиенты с мобов, лавка Agnes (Singed Powder 45 млрд/нед).
2. Spooky Festival и Great Spook: конфеты → Fear Mongerer, Horseman.
3. Season of Jerry: подарки, Jerry Box, Glacial Fragment.
4. Hoppity и Chocolate Factory: Faction Rabbits (до 18 млн за штуку), Chocolate Shop.
5. Traveling Zoo, Carnival, Cult of the Fallen Star, New Year/Century Cakes.
6. Сад: Jacob's Contest (медали, Jacob's Ticket), редкие дропы культур (Cropie, Squash, Fermento, Helianthus), Greenhouse и мутации, Garden Chips, Composter, грибы/мицелий.
   Если тред «Рифт и прочее» уже делает Сад, отдать ему только этот пункт 6 как список.

### Q3. Hunting и Galatea глубже
1. Attribute Fusion: какие пары шардов дают прибыль по живым ценам Bazaar (`SHARD_*`, ~250 видов), шанс удвоения Pure Reptile.
2. Боевые шарды с мобов и боссов (Apex Dragon, Starborn, Molthorn, Etherdrake): привязать к методам ⚔️.
3. Agatha и Miria: на что тратить купоны и что продавать.
4. Tree Gifts, Wood Singularity.
   Если тред «Рифт и прочее» возьмёт Hunting целиком, отдать ему пункты 1–4 как список.

### Q4. Crimson Isle помимо Kuudra — ✅ сделано
Методы в `server/market/methods-crimson.js`, разбор в `method-details-crimson.js`, тест `server/test/money-crimson.test.js`:
`crimson-minibosses` (Ashfang, Bladesoul, Barbarian Duke X, Mage Outlaw), `crimson-magma-boss`, `crimson-vanquisher`,
`crimson-mobs` (лучший моб острова по живым ценам), `crimson-sulphur`, `crimson-quests` (ежедневно, без монет: репутация для Kuudra).
Дропы и шансы — NEU-REPO; убийств или блоков в час — оценка, поэтому диапазон. Ключи Kuudra Co-op Soulbound, в доход не входят.
Dojo денег не даёт (пояса и опыт Combat) — он в гайде Crimson Isle и в квестах фракции.

### Q5. Пассив, мэры и ежедневка
1. Inferno-миньоны и топливо Gabagool (Chili Pepper 49 млрд/нед, Vertex/Apex, Reaper Pepper).
2. Matriarch: Heavy Pearl раз в день.
3. Мэр Diaz: Stock of Stonks (258 млрд/нед), обмен у Liz.
4. Множители мэров для существующих методов (Derpy, Aatrox, Paul, Finnegan, Marina, Cole, Diana, Jerry): показывать «сейчас выгоднее, потому что мэр …».
5. Проценты в банке (строка-подсказка, не метод).

## Что проверить у запущенных тредов

- ⛏️ майнинг: Mining Fiesta и Glossy Gemstone (второй по обороту рынок Bazaar), Skeleton Key для трупов, Sludge Juice и Goblin Egg.
- ⚔️ мобы: Primordial Broodfather (07.2025), Summoning Eye с зилотов, Looting VII.
- 🎣 рыбалка: Backwater Bayou (Alligator Skin 30 млрд/нед, Rusty Coin), Hotspot, Jerry Island (03.2026), патч 0.27.3 (дроп Magma Lord Fragment 100%→50%).
- 🌀 Рифт и прочее: охват очень широкий. Если тред не успевает, отнять у него Сад (Q2, п. 6) и Hunting (Q3) в отдельные треды. Внутри Рифта денег почти нет, это нормально.

## Не сверено

- Уровни дохода — оценки сообщества, не проверены в игре и с патчем 0.27.3.
- Состав лута Crystal Nucleus, Frozen Corpses, Greenhouse — по вики; в статье Greenhouse прямо написано, что данных о дропах не хватает.
- Torrhus Canyon (второй остров Galatea) в вики пока заглушка: в каталог не вошёл.
- Аукционные предметы (не Bazaar) по обороту не сверялись: нужен скан auctions_ended за сутки.
