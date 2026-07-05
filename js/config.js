// config.js — 全定数とゲームデータ（ロジック無し）
window.Game = window.Game || {};

// チャンピオン(named champion): 精鋭の上位レア個体。固有名の構成パーツ。
Game.CHAMPION_NAMES = {
  title: ['灰燼の', '深淵の', '業火の', '永久の', '血塗れの', '嵐呼びの', '骸の', '虚無の', '黄昏の', '星喰いの'],
  name:  ['グラル', 'ヴォルグ', 'ザイン', 'モルガ', 'ドレク', 'ネブロス', 'カイン', 'ルゴス', 'ヴェイン', 'オルガ'],
};

// 遺物(relic)アクセサリーのドロップ抽選用ID一覧
Game.RELIC_IDS = ['ring_crit', 'amulet_swift', 'fang_vamp', 'heart_regen', 'eye_xp', 'band_power', 'crest_guard', 'crest_aegis', 'core_titan', 'gauntlet_grit', 'fang_war'];

// 精鋭(elite)個体の特殊変異アフィックス。spawn時に1つ抽選 → 名前接頭辞/オーラ色/固有効果。
Game.ELITE_AFFIXES = {
  swift:     { name:'俊足の',   aura:'#5fffd0', speed:1.45 },                  // 移動速度UP
  blazing:   { name:'業火の',   aura:'#ff7a3a', burn:90 },                     // 接触で炎上(burn)付与
  regened:   { name:'不死の',   aura:'#7fff8a', regenPct:0.035 },              // 毎秒 最大HPの3.5%回復
  thorns:    { name:'棘鎧の',   aura:'#c8c8e0', thorns:0.30 },                 // 被ダメの30%を反射
  splitting: { name:'分裂の',   aura:'#ff7fd0', split:2 },                     // 死亡時に弱体な分身を2体生成
  blink:     { name:'瞬影の',   aura:'#b07fff', blink:1 },                     // 被弾すると短距離テレポートで回り込む(CD付き) — 範囲攻撃や予測で対処
  warded:    { name:'結界の',   aura:'#7fb8ff', ward:1 },                      // 周期バリア(2秒展開/3秒休み)で被ダメ70%カット — 割れ目を狙う読み合い
  soulfeed:  { name:'吸魂の',   aura:'#d04a90', leech:0.6 },                   // 与えたダメージの60%を自己回復 — 殴られ続けると倒れない。速攻で仕留めろ
};

Game.CFG = {
  TILE_SIZE: 32,          // 1タイル = 32px
  CHUNK_SIZE: 16,         // 1チャンク = 16x16タイル
  STEP_HZ: 30,            // 固定更新レート
  WORLD_BOUND: 32768,     // 論理世界境界（±タイル）
  LOAD_RADIUS: 2,         // プレイヤー中心に読み込むチャンク半径
  REACH: 3,               // 採掘/設置のリーチ（タイル）
  PICKUP_RADIUS: 28,      // ドロップ吸着距離（px）
  AUTOSAVE_MS: 30000,
  SAVE_KEY: 'haruking_survival_save',
  MAX_DPR: 2,
};

// 地面レイヤー
// CLOUD=空島の雲石(歩行可) / SKYVOID=空の虚(歩行不可・空島エンクレーブ限定) / RUIN=古代都市の割れ石畳(歩行可)
Game.TILE = { DEEP_WATER:0, WATER:1, SAND:2, GRASS:3, FOREST:4, DIRT:5, STONE:6, SNOW:7, DUNGEON_FLOOR:8, SWAMP:9, VOLCANIC:10, MUSHROOM:11, BLOOM:12, CLOUD:13, SKYVOID:14, RUIN:15, RIFT:16, RIFTVOID:17 };

// オブジェクトレイヤー（0=なし、50番台=影世界固有、100番台=プレイヤー設置物）
Game.OBJ = {
  NONE:0, TREE:1, ROCK:2, COAL_ORE:3, IRON_ORE:4, GOLD_ORE:5, BUSH:6, FLOWER:7,
  BERRY_BUSH:8, PINE_TREE:9, CACTUS:10,
  // 影世界固有
  SHADOW_TREE:50, SHADOW_CRYSTAL:51, LUMEN_ORE:52, SOUL_FLOWER:53, VOID_ROCK:54,
  PHANTOM_ORE:55, STELA:57,
  // 共鳴遺跡（二相連動）
  SEAL_WALL:58, RESONANCE_CORE:59, TREASURE_CHEST:60,
  WOOD_BLOCK:100, STONE_BLOCK:101, CRAFTING_TABLE:102, FURNACE:103, TORCH:104, CHEST:105,
  FARMLAND:106, WHEAT:107, CAMPFIRE:108, LANTERN:109, FENCE:110, DOOR:111, BED:112, SAPLING:113,
  RIFT_ANCHOR:114, LUMEN_LANTERN:115, SHADOW_ALTAR:116,
  // 建築・自由度
  WOOD_FLOOR:117, STONE_FLOOR:118, WALL:119, WINDOW:120, BRIDGE:121, SIGN:122,
  ENCHANT_TABLE:123,
  // ダンジョン
  DUNGEON_WALL:124, ICE_WALL:125, SPAWNER:126,
  // ロケット/宇宙
  ROCKET:127, STAR_ORE:128,
  // 家具・家作り
  HEALING_TOTEM:129, STREET_LAMP:130, TABLE:131, CHAIR:132, BOOKSHELF:133, GLASS:134, RUG:135,
  TOMB_WALL:136, FORGE_WALL:137, CRYSTAL_WALL:138,
  BOUNTY_BOARD:139,
  BANDIT_SPAWNER:140,
  DEAD_TREE:141, POISON_MUSHROOM:142,
  OBSIDIAN:143, SULFUR_VENT:144,
  BANNER:145, BRAZIER:146, BARREL:147, POTTED_PLANT:148,
  GIANT_MUSHROOM:149, GLOW_SHROOM:150, WISH_ALTAR:151,
  // 空島(スカイエンクレーブ)
  WIND_ALTAR:152, RETURN_ALTAR:153, SKY_PILLAR:154, SKY_TREE:155, WIND_ORE:156,
  // 古代都市(エンクレーブ)
  ANCIENT_GATE:157, RETURN_GATE:158, RUIN_COLUMN:159, RELIC_VEIN:160, RUIN_STATUE:161,
  // 狭間(エンクレーブ)
  RIFT_TEAR:162, RIFT_RETURN:163, RIFT_SPIRE:164, VOID_VEIN:165,
  // ファストトラベル
  WAYPOINT_STONE:166,
  // 建築・農業の拡張
  STONE_WALL:167, HEDGE:168, FOUNTAIN:169, LANTERN_POST:170, FLOWERBED:171, SCARECROW:172, WOOD_STAIRS:173, TRELLIS:174,
  EXIT_PORTAL:175, GARAGE_DOOR:176, LANDING_PAD:177,
  POWDER_KEG:178,
};

// 地面の色（手続き描画のベース）
Game.TILE_COLOR = {
  [Game.TILE.DEEP_WATER]: '#1b3a6b',
  [Game.TILE.WATER]:      '#2f6fb0',
  [Game.TILE.SAND]:       '#d9c98a',
  [Game.TILE.GRASS]:      '#4a8f3c',
  [Game.TILE.FOREST]:     '#357a2e',
  [Game.TILE.DIRT]:       '#8a5a36',
  [Game.TILE.STONE]:      '#7f8488',
  [Game.TILE.SNOW]:       '#e8eef2',
  [Game.TILE.DUNGEON_FLOOR]: '#3a3540',
  [Game.TILE.SWAMP]:      '#3d4a2c',
  [Game.TILE.VOLCANIC]:   '#2a1812',
  [Game.TILE.MUSHROOM]:   '#3a2c4a',
  [Game.TILE.BLOOM]:      '#6cbf46',
  [Game.TILE.CLOUD]:      '#e4ecf2',
  [Game.TILE.RUIN]:       '#b8b2a0',
  [Game.TILE.RIFT]:       '#3a2a52',
  [Game.TILE.RIFTVOID]:   '#120a1e',
  [Game.TILE.SKYVOID]:    '#7fb8dc',
};

// 影世界の地面パレット（同じTILE idを別色で描画）
Game.SHADOW_TILE_COLOR = {
  [Game.TILE.DEEP_WATER]: '#0a0618',
  [Game.TILE.WATER]:      '#241a4a',
  [Game.TILE.SAND]:       '#4a4060',
  [Game.TILE.GRASS]:      '#3a2a55',
  [Game.TILE.FOREST]:     '#2c1f44',
  [Game.TILE.DIRT]:       '#33223a',
  [Game.TILE.STONE]:      '#3b3550',
  [Game.TILE.SNOW]:       '#5a5575',
  [Game.TILE.DUNGEON_FLOOR]: '#2a2438',
  [Game.TILE.SWAMP]:      '#26233a',
  [Game.TILE.VOLCANIC]:   '#1a1020',
  [Game.TILE.MUSHROOM]:   '#241a36',
  [Game.TILE.BLOOM]:      '#352a52',
  [Game.TILE.CLOUD]:      '#4a4a68',
  [Game.TILE.RUIN]:       '#4a4740',
  [Game.TILE.RIFT]:       '#2a1e3e',
  [Game.TILE.RIFTVOID]:   '#0a0614',
  [Game.TILE.SKYVOID]:    '#181430',
};

// 宇宙の地面パレット（虚空＝ほぼ黒、小惑星＝灰）
Game.SPACE_TILE_COLOR = {
  [Game.TILE.DEEP_WATER]: '#04050c',
  [Game.TILE.WATER]:      '#080a16',
  [Game.TILE.SAND]:       '#7a6f5a',
  [Game.TILE.GRASS]:      '#5a5560',
  [Game.TILE.FOREST]:     '#4a4652',
  [Game.TILE.DIRT]:       '#5a5048',
  [Game.TILE.STONE]:      '#74747e',
  [Game.TILE.SNOW]:       '#b0b0c0',
  [Game.TILE.DUNGEON_FLOOR]: '#3a3a48',
  [Game.TILE.SWAMP]:      '#44443a',
  [Game.TILE.VOLCANIC]:   '#3a342e',
  [Game.TILE.MUSHROOM]:   '#3e3a48',
  [Game.TILE.BLOOM]:      '#5e5a52',
  [Game.TILE.CLOUD]:      '#8a8a96',
  [Game.TILE.RUIN]:       '#6a665c',
  [Game.TILE.RIFT]:       '#33284a',
  [Game.TILE.RIFTVOID]:   '#0e0a18',
  [Game.TILE.SKYVOID]:    '#06070f',
};

Game.SOLID_TILE = {
  [Game.TILE.DEEP_WATER]: true,  // 移動不可
  [Game.TILE.WATER]: false,      // 浅瀬は通れる（減速は今回省略）
  [Game.TILE.SKYVOID]: true,     // 空の虚: 落ちる先は無い(移動不可)。橋を架ければ渡れる
  [Game.TILE.RIFTVOID]: true,    // 狭間の淵: 世界の裂け目(移動不可)
};

// 発光オブジェクトの光量（lighting で使用）
Game.LIGHT_LEVEL = {
  [Game.OBJ.TORCH]: 7,
  [Game.OBJ.WISH_ALTAR]: 5,
  [Game.OBJ.CAMPFIRE]: 9,
  [Game.OBJ.LANTERN]: 10,
  [Game.OBJ.FURNACE]: 5,
  [Game.OBJ.LUMEN_LANTERN]: 14,   // 影世界用の強力な光
  [Game.OBJ.RIFT_ANCHOR]: 8,
  [Game.OBJ.LUMEN_ORE]: 6,        // 光鉱はほのかに光る
  [Game.OBJ.SHADOW_ALTAR]: 4,
  [Game.OBJ.RESONANCE_CORE]: 7,   // 影で目印として光る
  [Game.OBJ.TREASURE_CHEST]: 4,
  [Game.OBJ.ENCHANT_TABLE]: 5,
  [Game.OBJ.SPAWNER]: 3,
  [Game.OBJ.BANDIT_SPAWNER]: 8,
  [Game.OBJ.ROCKET]: 6,
  [Game.OBJ.STAR_ORE]: 4,
  [Game.OBJ.HEALING_TOTEM]: 7,
  [Game.OBJ.STREET_LAMP]: 11,
  [Game.OBJ.BRAZIER]: 9,
  [Game.OBJ.GIANT_MUSHROOM]: 6,
  [Game.OBJ.GLOW_SHROOM]: 4,
  [Game.OBJ.WIND_ALTAR]: 7,
  [Game.OBJ.RETURN_ALTAR]: 7,
  [Game.OBJ.EXIT_PORTAL]: 6,
  [Game.OBJ.WIND_ORE]: 3,
  [Game.OBJ.ANCIENT_GATE]: 5,
  [Game.OBJ.RETURN_GATE]: 5,
  [Game.OBJ.RELIC_VEIN]: 3,
  [Game.OBJ.RIFT_TEAR]: 6,
  [Game.OBJ.RIFT_RETURN]: 6,
  [Game.OBJ.RIFT_SPIRE]: 3,
  [Game.OBJ.VOID_VEIN]: 4,
  [Game.OBJ.WAYPOINT_STONE]: 4,
  [Game.OBJ.LANTERN_POST]: 8,
  [Game.OBJ.FOUNTAIN]: 2,
};

// オブジェクトのメタ情報。solid=移動阻害, drops=破壊時ドロップ
Game.OBJ_META = {
  [Game.OBJ.TREE]:      { name:'木', solid:true,  mineable:true, tool:'axe',     tier:0, hp:6,  drops:[{item:'wood', n:[1,3]}], render:'tree' },
  [Game.OBJ.ROCK]:      { name:'岩', solid:true,  mineable:true, tool:'pickaxe', tier:0, hp:5,  drops:[{item:'stone', n:[1,3]}], render:'rock' },
  [Game.OBJ.COAL_ORE]:  { name:'石炭鉱', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:8, drops:[{item:'coal', n:[1,3]}], render:'ore', oreColor:'#2b2b2b' },
  [Game.OBJ.IRON_ORE]:  { name:'鉄鉱', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:12, drops:[{item:'iron_ore', n:[1,2]}], render:'ore', oreColor:'#c98f6b' },
  [Game.OBJ.GOLD_ORE]:  { name:'金鉱', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:14, drops:[{item:'gold_ore', n:[1,2]}], render:'ore', oreColor:'#e8c54a' },
  [Game.OBJ.BUSH]:      { name:'茂み', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'apple', n:[0,2]}], render:'bush' },
  [Game.OBJ.FLOWER]:    { name:'花', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[{item:'flower', n:[1,1]}], render:'flower' },
  [Game.OBJ.WOOD_BLOCK]:{ name:'木ブロック', solid:true, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'wood_block', n:[1,1]}], render:'block', blockColor:'#9c6b3f' },
  [Game.OBJ.STONE_BLOCK]:{ name:'石ブロック', solid:true, mineable:true, tool:'pickaxe', tier:0, hp:6, drops:[{item:'stone_block', n:[1,1]}], render:'block', blockColor:'#888d91' },
  [Game.OBJ.CRAFTING_TABLE]:{ name:'作業台', solid:true, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'crafting_table', n:[1,1]}], render:'table' },
  [Game.OBJ.FURNACE]:   { name:'かまど', solid:true, mineable:true, tool:'pickaxe', tier:0, hp:6, drops:[{item:'furnace', n:[1,1]}], render:'furnace' },
  [Game.OBJ.TORCH]:     { name:'たいまつ', solid:false, mineable:true, tool:null, tier:0, hp:1, light:8, drops:[{item:'torch', n:[1,1]}], render:'torch' },
  [Game.OBJ.CHEST]:     { name:'チェスト', solid:true, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'chest', n:[1,1]}], render:'chest' },
  [Game.OBJ.BERRY_BUSH]:{ name:'木の実', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'berry', n:[1,3]}], render:'berry' },
  [Game.OBJ.PINE_TREE]: { name:'松', solid:true, mineable:true, tool:'axe', tier:0, hp:7, drops:[{item:'wood', n:[1,3]}], render:'pine' },
  [Game.OBJ.CACTUS]:    { name:'サボテン', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'cactus', n:[1,2]}], render:'cactus', touchDamage:1 },
  [Game.OBJ.DEAD_TREE]: { name:'枯れ木', solid:true, mineable:true, tool:'axe', tier:0, hp:5, drops:[{item:'wood', n:[1,3]}], render:'deadtree' },
  [Game.OBJ.POISON_MUSHROOM]:{ name:'毒キノコ', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[{item:'glow_spore', n:[1,2]}], render:'pmushroom' },
  [Game.OBJ.OBSIDIAN]:   { name:'黒曜石', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:16, drops:[{item:'obsidian', n:[1,2]}], render:'obsidian' },
  [Game.OBJ.SULFUR_VENT]:{ name:'硫黄噴気孔', solid:false, mineable:true, tool:null, tier:0, hp:2, light:4, drops:[{item:'sulfur', n:[1,2]}], render:'sulfur' },
  [Game.OBJ.GIANT_MUSHROOM]:{ name:'巨大キノコ', solid:true, mineable:true, tool:'axe', tier:0, hp:5, light:6, drops:[{item:'luminous_cap', n:[1,3]},{item:'wood', n:[0,1]}], render:'giantshroom' },
  [Game.OBJ.GLOW_SHROOM]:{ name:'発光キノコ', solid:false, mineable:true, tool:null, tier:0, hp:1, light:4, drops:[{item:'luminous_cap', n:[1,1]}], render:'glowshroom' },
  [Game.OBJ.FARMLAND]:  { name:'畑', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[], render:'farmland' },
  [Game.OBJ.WHEAT]:     { name:'小麦', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[], render:'wheat', crop:true },
  [Game.OBJ.CAMPFIRE]:  { name:'焚き火', solid:false, mineable:true, tool:null, tier:0, hp:3, light:9, drops:[{item:'campfire', n:[1,1]}], render:'campfire', cook:true },
  [Game.OBJ.LANTERN]:   { name:'ランタン', solid:false, mineable:true, tool:null, tier:0, hp:2, light:10, drops:[{item:'lantern', n:[1,1]}], render:'lantern' },
  [Game.OBJ.FENCE]:     { name:'柵', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'fence', n:[1,1]}], render:'fence' },
  [Game.OBJ.DOOR]:      { name:'扉', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'door', n:[1,1]}], render:'door' },
  [Game.OBJ.BED]:       { name:'ベッド', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'bed', n:[1,1]}], render:'bed', bed:true },
  [Game.OBJ.SAPLING]:   { name:'苗木', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[{item:'sapling', n:[1,1]}], render:'sapling', sapling:true },
  // 影世界固有オブジェクト
  [Game.OBJ.SHADOW_TREE]:  { name:'影樹', solid:true, mineable:true, tool:'axe', tier:0, hp:8, drops:[{item:'shadow_wood', n:[1,3]}], render:'shadowtree', shadowOnly:true },
  [Game.OBJ.SHADOW_CRYSTAL]:{ name:'影晶', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:14, drops:[{item:'shadow_crystal', n:[1,3]}], render:'shadowcrystal', shadowOnly:true },
  [Game.OBJ.LUMEN_ORE]:    { name:'光鉱', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:16, drops:[{item:'lumen', n:[1,2]}], render:'lumenore', shadowOnly:true },
  [Game.OBJ.SOUL_FLOWER]:  { name:'月光草', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[{item:'moonleaf', n:[1,2]}], render:'soulflower', shadowOnly:true },
  [Game.OBJ.VOID_ROCK]:    { name:'虚岩', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:7, drops:[{item:'stone', n:[1,2]},{item:'shadow_crystal', n:[0,1]}], render:'voidrock', shadowOnly:true },
  // 設置物（両世界対応）
  [Game.OBJ.RIFT_ANCHOR]:  { name:'裂け目の楔', solid:false, mineable:true, tool:null, tier:0, hp:6, drops:[{item:'rift_anchor', n:[1,1]}], render:'rift', dualPlaced:true },
  [Game.OBJ.LUMEN_LANTERN]:{ name:'光のランタン', solid:false, mineable:true, tool:null, tier:0, hp:2, light:14, drops:[{item:'lumen_lantern', n:[1,1]}], render:'lumenlantern' },
  // 狂気の視界でのみ見える幻影鉱脈（正気度が低いときだけ掘れる）
  [Game.OBJ.PHANTOM_ORE]:{ name:'幻影鉱脈', solid:false, mineable:true, tool:'pickaxe', tier:1, hp:6, drops:[{item:'lumen', n:[1,2]},{item:'shadow_crystal', n:[0,1]}], render:'phantom', phantom:true },
  // 石碑（破壊不可・対話で物語）
  [Game.OBJ.STELA]:     { name:'石碑', solid:true, mineable:false, tool:null, tier:0, hp:999, drops:[], render:'stela', lore:true },
  // 影の祭壇（ボス召喚）
  [Game.OBJ.SHADOW_ALTAR]:{ name:'影の祭壇', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:12, light:4, drops:[{item:'shadow_altar', n:[1,1]}], render:'altar', altar:true },
  [Game.OBJ.WISH_ALTAR]:  { name:'古の祭壇', solid:true, mineable:false, tool:null, tier:0, hp:999, light:5, drops:[], render:'wishaltar', wishAltar:true },
  // 共鳴遺跡: 封印壁(破壊不可)・共鳴核(影で破壊→光の封印解除)・宝箱
  [Game.OBJ.SEAL_WALL]:  { name:'封印壁', solid:true, mineable:false, tool:null, tier:0, hp:999, drops:[], render:'seal' },
  [Game.OBJ.RESONANCE_CORE]:{ name:'共鳴核', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:16, light:6, drops:[{item:'shadow_crystal', n:[1,2]}], render:'rcore', resonator:true },
  [Game.OBJ.TREASURE_CHEST]:{ name:'宝箱', solid:true, mineable:true, tool:null, tier:0, hp:6, light:3, drops:[], render:'tchest', treasure:true },
  // 建築・自由度
  [Game.OBJ.WOOD_FLOOR]: { name:'木の床', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'wood_floor', n:[1,1]}], render:'wfloor' },
  [Game.OBJ.STONE_FLOOR]:{ name:'石の床', solid:false, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'stone_floor', n:[1,1]}], render:'sfloor' },
  [Game.OBJ.WALL]:       { name:'壁', solid:true, mineable:true, tool:null, tier:0, hp:6, drops:[{item:'wall', n:[1,1]}], render:'wall' },
  [Game.OBJ.WINDOW]:     { name:'窓', solid:true, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'window', n:[1,1]}], render:'window' },
  [Game.OBJ.BRIDGE]:     { name:'橋', solid:false, bridge:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'bridge', n:[1,1]}], render:'bridge' },
  [Game.OBJ.SIGN]:       { name:'立て札', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'sign', n:[1,1]}], render:'sign' },
  [Game.OBJ.BOUNTY_BOARD]:{ name:'賞金掲示板', solid:true, mineable:true, tool:null, tier:0, hp:5, drops:[{item:'bounty_board', n:[1,1]}], render:'bounty' },
  [Game.OBJ.ENCHANT_TABLE]:{ name:'エンチャント台', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:8, light:5, drops:[{item:'enchant_table', n:[1,1]}], render:'enchant', enchant:true },
  // ダンジョン
  [Game.OBJ.DUNGEON_WALL]:{ name:'遺跡の壁', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:20, drops:[{item:'stone', n:[1,2]}], render:'dwall', dungeonWall:true },
  [Game.OBJ.ICE_WALL]:   { name:'氷壁', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:14, drops:[{item:'stone', n:[0,1]}], render:'icewall', dungeonWall:true },
  [Game.OBJ.TOMB_WALL]:  { name:'砂岩の壁', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:18, drops:[{item:'stone', n:[1,2]},{item:'gold_ore', n:[0,1]}], render:'twall', dungeonWall:true },
  [Game.OBJ.FORGE_WALL]: { name:'溶岩岩の壁', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:24, drops:[{item:'stone', n:[1,2]},{item:'iron_ore', n:[0,1]}], render:'fwall', dungeonWall:true },
  [Game.OBJ.CRYSTAL_WALL]:{ name:'水晶の壁', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:22, light:3, drops:[{item:'shadow_crystal', n:[0,1]},{item:'lumen', n:[0,1]},{item:'stone', n:[1,2]}], render:'cwall', dungeonWall:true },
  [Game.OBJ.SPAWNER]:    { name:'魔物の巣', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:16, light:3, drops:[{item:'bone', n:[1,3]},{item:'shadow_shard', n:[0,1]}], render:'spawner', spawner:true },
  [Game.OBJ.BANDIT_SPAWNER]:{ name:'略奪者の篝火', solid:true, mineable:true, tool:null, tier:0, hp:10, light:8, drops:[{item:'gold_bar', n:[0,1]},{item:'iron', n:[0,2]}], render:'bandit_spawner', spawner:true },
  // ロケット/宇宙
  [Game.OBJ.ROCKET]:     { name:'ロケット', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:30, light:6, drops:[{item:'rocket', n:[1,1]}], render:'rocket_obj', rocket:true },
  [Game.OBJ.STAR_ORE]:   { name:'星鉱', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:16, light:4, drops:[{item:'star_metal', n:[1,2]}], render:'starore' },
  // 家具・家作り
  [Game.OBJ.HEALING_TOTEM]:{ name:'癒しの祭壇', solid:true, mineable:true, tool:null, tier:0, hp:6, light:7, drops:[{item:'healing_totem', n:[1,1]}], render:'totem', healAura:true },
  [Game.OBJ.STREET_LAMP]:{ name:'街灯', solid:false, mineable:true, tool:null, tier:0, hp:3, light:11, drops:[{item:'street_lamp', n:[1,1]}], render:'streetlamp' },
  [Game.OBJ.TABLE]:      { name:'テーブル', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'table', n:[1,1]}], render:'table_f' },
  [Game.OBJ.CHAIR]:      { name:'椅子', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'chair', n:[1,1]}], render:'chair' },
  [Game.OBJ.BOOKSHELF]:  { name:'本棚', solid:true, mineable:true, tool:null, tier:0, hp:4, drops:[{item:'bookshelf', n:[1,1]}], render:'bookshelf' },
  [Game.OBJ.GLASS]:      { name:'ガラス', solid:true, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'glass', n:[1,1]}], render:'glass' },
  [Game.OBJ.RUG]:        { name:'絨毯', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'rug', n:[1,1]}], render:'rug' },
  [Game.OBJ.BANNER]:     { name:'旗', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'banner', n:[1,1]}], render:'banner' },
  [Game.OBJ.BRAZIER]:    { name:'かがり火', solid:false, mineable:true, tool:null, tier:0, hp:3, light:9, drops:[{item:'brazier', n:[1,1]}], render:'brazier', cook:true },
  [Game.OBJ.BARREL]:     { name:'樽', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'barrel', n:[1,1]}], render:'barrel' },
  [Game.OBJ.POWDER_KEG]: { name:'火薬樽', solid:true, mineable:true, tool:null, tier:0, hp:5, drops:[{item:'powder_keg', n:[1,1]}], render:'powderkeg', keg:true },
  [Game.OBJ.POTTED_PLANT]:{ name:'植木鉢', solid:false, mineable:true, tool:null, tier:0, hp:2, drops:[{item:'potted_plant', n:[1,1]}], render:'potted' },
  // ===== 空島(スカイエンクレーブ) =====
  // 風の祭壇: 空島への門(破壊不可)。風の羽根を持って傍らに立つと空へ昇る
  [Game.OBJ.WIND_ALTAR]:  { name:'風の祭壇', solid:true, mineable:false, tool:null, tier:0, hp:999, light:7, drops:[], render:'windaltar', windAltar:true },
  // 帰還の祭壇: 空島の中心。傍らに立つと大地へ還る(破壊不可)
  [Game.OBJ.RETURN_ALTAR]:{ name:'帰還の祭壇', solid:true, mineable:false, tool:null, tier:0, hp:999, light:7, drops:[], render:'returnaltar', returnAltar:true },
  [Game.OBJ.EXIT_PORTAL]:{ name:'帰還の渦', solid:false, mineable:false, tool:null, tier:0, hp:999, light:6, drops:[], render:'exitportal', dungeonExit:true },
  [Game.OBJ.GARAGE_DOOR]:{ name:'自動車庫扉', solid:true, mineable:true, tool:null, tier:0, hp:12, drops:[{item:'garage_door', n:[1,1]}], render:'garagedoor', autoDoor:true },
  [Game.OBJ.LANDING_PAD]:{ name:'発着場', solid:false, mineable:true, tool:null, tier:0, hp:8, light:4, drops:[{item:'landing_pad', n:[1,1]}], render:'landingpad', landingPad:true },
  [Game.OBJ.SKY_PILLAR]:  { name:'風化した柱', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:14, drops:[{item:'stone', n:[1,2]}], render:'skypillar' },
  [Game.OBJ.SKY_TREE]:    { name:'空の樹', solid:true, mineable:true, tool:'axe', tier:0, hp:7, drops:[{item:'wood', n:[2,3]},{item:'feather', n:[0,1]}], render:'skytree' },
  [Game.OBJ.WIND_ORE]:    { name:'風晶鉱', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:16, drops:[{item:'wind_crystal', n:[1,2]}], render:'ore', oreColor:'#8fe8e0' },
  // 古代都市(エンクレーブ)
  [Game.OBJ.ANCIENT_GATE]:{ name:'古の門', solid:true, mineable:false, tool:null, tier:0, hp:999, light:5, drops:[], render:'ancientgate', ancientGate:true },
  [Game.OBJ.RETURN_GATE]: { name:'還りの門', solid:true, mineable:false, tool:null, tier:0, hp:999, light:5, drops:[], render:'returngate', returnGate:true },
  [Game.OBJ.RUIN_COLUMN]: { name:'崩れた列柱', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:16, drops:[{item:'stone', n:[1,3]}], render:'ruincolumn' },
  [Game.OBJ.RUIN_STATUE]: { name:'古の石像', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:24, drops:[{item:'stone', n:[2,4]},{item:'relic_shard', n:[0,1]}], render:'ruinstatue' },
  [Game.OBJ.RELIC_VEIN]:  { name:'遺物の鉱脈', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:18, drops:[{item:'relic_shard', n:[1,2]}], render:'ore', oreColor:'#d8c078' },
  // 狭間(エンクレーブ)
  [Game.OBJ.RIFT_TEAR]:   { name:'狭間の裂け目', solid:true, mineable:false, tool:null, tier:0, hp:999, light:6, drops:[], render:'rifttear', riftTear:true },
  [Game.OBJ.RIFT_RETURN]: { name:'還りの裂け目', solid:true, mineable:false, tool:null, tier:0, hp:999, light:6, drops:[], render:'riftreturn', riftReturn:true },
  [Game.OBJ.RIFT_SPIRE]:  { name:'狭間の尖晶', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:18, drops:[{item:'void_shard', n:[0,1]}], render:'riftspire' },
  [Game.OBJ.VOID_VEIN]:   { name:'虚無の鉱脈', solid:true, mineable:true, tool:'pickaxe', tier:4, hp:20, drops:[{item:'void_shard', n:[1,2]}], render:'ore', oreColor:'#b088e8' },
  // 道標の石: 触れると登録済みの道標へ瞬間移動できる(ファストトラベル)。壊すと回収
  [Game.OBJ.WAYPOINT_STONE]:{ name:'道標の石', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:8, light:4, drops:[{item:'waypoint_stone', n:[1,1]}], render:'waypoint', waypoint:true },
  // 建築・農業の拡張
  [Game.OBJ.STONE_WALL]:  { name:'石壁', solid:true, mineable:true, tool:'pickaxe', tier:0, hp:14, drops:[{item:'stone_wall', n:[1,1]}], render:'stonewall' },
  [Game.OBJ.HEDGE]:       { name:'生垣', solid:true, mineable:true, tool:'axe', tier:0, hp:6, drops:[{item:'hedge', n:[1,1]}], render:'hedge' },
  [Game.OBJ.FOUNTAIN]:    { name:'噴水', solid:true, mineable:true, tool:'pickaxe', tier:0, hp:20, light:2, drops:[{item:'fountain', n:[1,1]}], render:'fountain', regenAura:true },
  [Game.OBJ.LANTERN_POST]:{ name:'ランタン柱', solid:true, mineable:true, tool:null, tier:0, hp:6, light:8, drops:[{item:'lantern_post', n:[1,1]}], render:'lanternpost' },
  [Game.OBJ.FLOWERBED]:   { name:'花壇', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'flowerbed', n:[1,1]}], render:'flowerbed' },
  [Game.OBJ.SCARECROW]:   { name:'かかし', solid:true, mineable:true, tool:null, tier:0, hp:5, drops:[{item:'scarecrow', n:[1,1]}], render:'scarecrow', cropBoost:true },
  [Game.OBJ.WOOD_STAIRS]: { name:'木の階段', solid:false, mineable:true, tool:'axe', tier:0, hp:5, drops:[{item:'wood_stairs', n:[1,1]}], render:'woodstairs' },
  [Game.OBJ.TRELLIS]:     { name:'つる棚', solid:false, mineable:true, tool:'axe', tier:0, hp:5, drops:[{item:'trellis', n:[1,1]}], render:'trellis' },
};

// アイテム定義。place=設置するOBJ id, tool/tier=道具, food=空腹回復
Game.ITEMS = {
  wood:        { name:'木材', stack:99, color:'#9c6b3f' },
  stone:       { name:'石', stack:99, color:'#888d91' },
  coal:        { name:'石炭', stack:99, color:'#2b2b2b' },
  iron_ore:    { name:'鉄鉱石', stack:99, color:'#c98f6b' },
  gold_ore:    { name:'金鉱石', stack:99, color:'#e8c54a' },
  iron:        { name:'鉄インゴット', stack:99, color:'#d8d8dc' },
  apple:       { name:'りんご', stack:16, color:'#d33', food:25 },
  flower:      { name:'花', stack:99, color:'#e85ab0' },
  glow_spore:  { name:'光胞子', stack:99, color:'#7fe0a0', flavor:'毒キノコから採れる仄かに光る胞子。沼の解毒薬の材料。' },
  obsidian:    { name:'黒曜石', stack:99, color:'#2a2440', flavor:'急冷した溶岩の黒い石。鋭く加工でき、頑丈な武具になる。' },
  sulfur:      { name:'硫黄', stack:99, color:'#d8c84a', flavor:'噴気孔に結晶する黄色い鉱物。火炎の材料。' },
  luminous_cap:{ name:'光るキノコ', stack:32, color:'#9fb0ff', food:14, flavor:'柔らかな光を放つ傘。ほのかに甘く、滋養に富む。' },
  // ボス再召喚アイテム(終盤の周回)
  mire_incense:{ name:'澱みの香', stack:8, color:'#5a7a3a', summonBoss:'swamp_lord', flavor:'焚けば沼の主を呼び覚ます瘴気の香。再戦の証。' },
  lava_shard:  { name:'溶岩の核片', stack:8, color:'#d8521f', summonBoss:'lava_lord', flavor:'砕けば溶岩の王を再び燃え上がらせる核の欠片。' },
  spore_sac:   { name:'胞子嚢', stack:8, color:'#9a6ad0', summonBoss:'spore_queen', flavor:'潰せば胞子の女王が森より舞い戻る菌糸の嚢。' },
  end_key:     { name:'終焉の鍵', stack:4, color:'#ff5a7a', summonBoss:'endbringer', flavor:'打ち倒した強敵たちの力を束ね鍛えた鍵。地上で掲げれば終焉の王が顕現する。' },
  wood_pickaxe:{ name:'木のツルハシ', stack:1, color:'#9c6b3f', tool:'pickaxe', tier:1 },
  stone_pickaxe:{ name:'石のツルハシ', stack:1, color:'#888d91', tool:'pickaxe', tier:2 },
  iron_pickaxe:{ name:'鉄のツルハシ', stack:1, color:'#d8d8dc', tool:'pickaxe', tier:3 },
  siege_pick:  { name:'破城のツルハシ', stack:1, color:'#e08a3a', tool:'pickaxe', tier:4, siege:true, flavor:'古の坑道を穿った特別なツルハシ。これでのみ堅牢なダンジョンの壁を砕ける。' },
  obsidian_blade:{ name:'黒曜の刃', stack:1, color:'#3a2f55', tool:'sword', tier:3, attack:16, flavor:'黒曜石を鋭利に研いだ刃。鉄を超える切れ味。' },
  wood_axe:    { name:'木の斧', stack:1, color:'#9c6b3f', tool:'axe', tier:1 },
  stone_axe:   { name:'石の斧', stack:1, color:'#888d91', tool:'axe', tier:2 },
  wood_block:  { name:'木ブロック', stack:99, color:'#9c6b3f', place:Game.OBJ.WOOD_BLOCK },
  stone_block: { name:'石ブロック', stack:99, color:'#888d91', place:Game.OBJ.STONE_BLOCK },
  crafting_table:{ name:'作業台', stack:99, color:'#b5803f', place:Game.OBJ.CRAFTING_TABLE },
  furnace:     { name:'かまど', stack:99, color:'#5a5a5e', place:Game.OBJ.FURNACE },
  torch:       { name:'たいまつ', stack:99, color:'#ffcf6b', place:Game.OBJ.TORCH },
  waypoint_stone:{ name:'道標の石', stack:16, color:'#7fd0e0', place:Game.OBJ.WAYPOINT_STONE, flavor:'光素を宿した道標。置いた場所どうしを結び、触れれば登録済みの道標へ瞬時に渡れる。広い世界を自在に巡れ。' },
  chest:       { name:'チェスト', stack:99, color:'#a9762f', place:Game.OBJ.CHEST },
  // 食料・素材
  berry:       { name:'木の実', stack:32, color:'#c0307a', food:12 },
  cactus:      { name:'サボテン', stack:32, color:'#3b8a3b', food:6 },
  raw_meat:    { name:'生肉', stack:16, color:'#c85a5a', food:10, cookTo:'cooked_meat', spoils:true },
  cooked_meat: { name:'焼き肉', stack:16, color:'#9c5a2a', food:40 },
  rotten_meat: { name:'腐肉', stack:16, color:'#6b7a3a', food:6, sick:true },
  frog_legs:   { name:'蛙肉', stack:16, color:'#7a9a4a', food:9, cookTo:'cooked_frog', spoils:true },
  cooked_frog: { name:'焼き蛙肉', stack:16, color:'#9c6a3a', food:34 },
  snake_meat:  { name:'蛇肉', stack:16, color:'#9a8a4a', food:8, cookTo:'cooked_snake', spoils:true },
  cooked_snake:{ name:'焼き蛇肉', stack:16, color:'#a07a4a', food:30 },
  swamp_stew:  { name:'沼の煮込み', stack:16, color:'#6a8a3a', food:42, cures:['poison','infection'], flavor:'光胞子と沼の幸を煮込んだ滋養食。毒を流し、腹を満たす。' },
  mushroom_soup:{ name:'キノコのスープ', stack:16, color:'#9fb0ff', food:38, buff:{type:'regen_buff', dur:600}, flavor:'光るキノコの温かいスープ。満腹になり、しばし傷が癒える。' },
  flower_tea:  { name:'花の蜜茶', stack:16, color:'#ff9ec4', food:30, buff:{type:'regen_buff', dur:700}, flavor:'花の蜜と木の実を煮出した優しいお茶。心が安らぎ、傷がゆっくり癒える。花の野の恵み。' },
  berry_pie:   { name:'いちごのパイ', stack:8, color:'#e0405a', food:42, buff:{type:'regen_buff', dur:650}, flavor:'甘酸っぱいいちごを焼き込んだパイ。満たされ、傷も癒える幸せの一切れ。' },
  grilled_corn:{ name:'焼きとうもろこし', stack:16, color:'#e8c84a', food:26, flavor:'香ばしく焼いたとうもろこし。素朴だが力が湧く。' },
  harvest_stew:{ name:'収穫のシチュー', stack:8, color:'#d8934a', food:50, buff:{type:'swiftness', dur:500}, flavor:'畑の恵みを煮込んだ具沢山シチュー。腹は満ち、足取りも軽くなる。' },
  guts:        { name:'臓物', stack:16, color:'#8a2a3a' },
  hide:        { name:'毛皮', stack:99, color:'#b08858' },
  leather:     { name:'なめし革', stack:99, color:'#8a5a30' },
  bone:        { name:'骨', stack:99, color:'#e8e4d0' },
  string:      { name:'糸', stack:99, color:'#dadada' },
  slime_ball:  { name:'スライム玉', stack:99, color:'#5fc46b' },
  wheat:       { name:'小麦', stack:99, color:'#d9b84a' },
  wheat_seeds: { name:'小麦の種', stack:99, color:'#9ab84a', plant:Game.OBJ.WHEAT, crop:{harvest:'wheat', seeds:'wheat_seeds', color:'#d9b84a'} },
  bread:       { name:'パン', stack:16, color:'#c79a4a', food:35 },
  // 新作物（種→成長→収穫。種は旅商人や収穫で入手）
  carrot:      { name:'にんじん', stack:32, color:'#e0902a', food:16 },
  carrot_seeds:{ name:'にんじんの種', stack:99, color:'#c0b04a', plant:Game.OBJ.WHEAT, crop:{harvest:'carrot', seeds:'carrot_seeds', color:'#e0902a'} },
  pumpkin:     { name:'かぼちゃ', stack:16, color:'#e07a2a', food:22 },
  pumpkin_seeds:{ name:'かぼちゃの種', stack:99, color:'#c8a850', plant:Game.OBJ.WHEAT, crop:{harvest:'pumpkin', seeds:'pumpkin_seeds', color:'#e07a2a'} },
  tomato:      { name:'トマト', stack:32, color:'#d83a3a', food:14 },
  tomato_seeds:{ name:'トマトの種', stack:99, color:'#b89a4a', plant:Game.OBJ.WHEAT, crop:{harvest:'tomato', seeds:'tomato_seeds', color:'#d83a3a'} },
  // 料理（食材→調理で空腹/回復が段階的に向上）
  veg_salad:   { name:'サラダ', stack:16, color:'#6fc46b', food:34 },
  pumpkin_pie: { name:'かぼちゃパイ', stack:16, color:'#e0a04a', food:48 },
  veg_stew:    { name:'野菜シチュー', stack:8, color:'#c87a3a', food:55, heal:10 },
  hearty_stew: { name:'具だくさんシチュー', stack:8, color:'#b85a2a', food:70, heal:18 },
  sapling:     { name:'苗木', stack:99, color:'#4a8f3c', place:Game.OBJ.SAPLING },
  // 武器・道具
  wood_sword:  { name:'木の剣', stack:1, color:'#9c6b3f', tool:'sword', tier:1, attack:3 },
  stone_sword: { name:'石の剣', stack:1, color:'#888d91', tool:'sword', tier:2, attack:5 },
  iron_sword:  { name:'鉄の剣', stack:1, color:'#d8d8dc', tool:'sword', tier:3, attack:8 },
  iron_axe:    { name:'鉄の斧', stack:1, color:'#d8d8dc', tool:'axe', tier:3 },
  wood_hoe:    { name:'木のクワ', stack:1, color:'#9c6b3f', tool:'hoe', tier:1 },
  stone_hoe:   { name:'石のクワ', stack:1, color:'#888d91', tool:'hoe', tier:2 },
  // 防具（armor=ダメージ軽減）
  leather_helmet: { name:'革の帽子', stack:1, color:'#8a5a30', armor:1, slot:'head' },
  leather_chest:  { name:'革の服', stack:1, color:'#8a5a30', armor:2, slot:'chest' },
  fur_coat:    { name:'毛皮のコート', stack:1, color:'#b08858', armor:2, slot:'chest', warm:true },
  // 治療・薬
  bandage:     { name:'包帯', stack:16, color:'#eee', heal:8, cures:['bleed'] },
  antidote:    { name:'解毒薬', stack:16, color:'#7fd0a0', cures:['poison','infection'] },
  recall_scroll:{ name:'帰還の巻物', stack:8, color:'#c0a0e0', recall:true, flavor:'破ると光に包まれ、拠点(初期地点)へ還る。探索からの帰り道に。' },
  // 投擲武器（使用で前方へ投げて爆発/炎上, 1個消費）
  bomb:        { name:'爆弾', stack:16, color:'#2a2a30', throw:{kind:'rocket', dmg:30, explosive:2.4, speed:6}, flavor:'導火線に火を。投げて吹き飛ばせ。' },
  molotov:     { name:'火炎瓶', stack:16, color:'#c0502a', throw:{kind:'fire', dmg:18, explosive:1.8, speed:6}, flavor:'割れて燃え広がる炎の瓶。' },
  poison_flask:{ name:'毒の小瓶', stack:16, color:'#9fe04a', throw:{kind:'venom', dmg:14, explosive:1.6, speed:6}, flavor:'割れて毒の霧を撒く小瓶。範囲の敵をむしばむ。' },
  flash_bomb:  { name:'閃光玉', stack:16, color:'#ffe9a0', throw:{kind:'tracer', dmg:10, explosive:1.9, speed:6}, flavor:'硫黄を詰めた炸裂玉。眩い光と衝撃が範囲を焼く。' },
  frost_grenade:{ name:'氷結手榴弾', stack:16, color:'#9fd8ff', throw:{kind:'frost', dmg:10, explosive:2.0, speed:6}, flavor:'割れて冷気を撒く。範囲の敵を凍えさせ足を止める。渦の杖と好相性。' },
  thunder_orb: { name:'雷玉', stack:16, color:'#ffe27a', throw:{kind:'chain', dmg:12, chain:4, speed:7}, flavor:'砕けると雷が敵から敵へ飛び移る。群れの殲滅に。' },
  // バフ薬（一時強化）
  strength_potion:{ name:'力の薬', stack:16, color:'#ff8a4a', buff:{type:'strength', dur:1800}, flavor:'飲めば一時、膂力がみなぎる。' },
  swift_potion:   { name:'俊足の薬', stack:16, color:'#7fe0a0', buff:{type:'swiftness', dur:1800}, flavor:'風のごとく駆ける。' },
  iron_potion:    { name:'守りの薬', stack:16, color:'#9fd8ff', buff:{type:'ironskin', dur:1800}, flavor:'肌が鋼のごとく硬くなる。' },
  regen_potion:   { name:'再生の薬', stack:16, color:'#ff7aa0', buff:{type:'regen_buff', dur:900}, flavor:'傷がみるみる塞がっていく。' },
  iron_helmet: { name:'鉄の兜', stack:1, color:'#d8d8dc', armor:2, slot:'head' },
  iron_chest:  { name:'鉄の鎧', stack:1, color:'#d8d8dc', armor:4, slot:'chest' },
  // 設置物
  campfire:    { name:'焚き火', stack:99, color:'#ff8a3c', place:Game.OBJ.CAMPFIRE },
  lantern:     { name:'ランタン', stack:99, color:'#ffd86b', place:Game.OBJ.LANTERN },
  fence:       { name:'柵', stack:99, color:'#9c6b3f', place:Game.OBJ.FENCE },
  door:        { name:'扉', stack:99, color:'#a9762f', place:Game.OBJ.DOOR },
  bed:         { name:'ベッド', stack:1, color:'#c44', place:Game.OBJ.BED },
  // ===== 二相世界（光と影）=====
  shadow_shard:  { name:'影の欠片', stack:99, color:'#7a4fb0', flavor:'裂け目から零れた世界の傷。夜の住人がその身に宿す。' },
  shadow_mirror: { name:'影鏡', stack:1, color:'#3a2a55', shift:true, flavor:'二つの世界を映す鏡。覗き込めば、もう一方へ渡れる——戻れる保証はない。' },
  shadow_wood:   { name:'影樹の幹', stack:99, color:'#3a2c4a' },
  shadow_crystal:{ name:'影晶', stack:99, color:'#9a5fe0', flavor:'影の側にのみ実る結晶。世界が割れた、その断面そのものだという。' },
  lumen:         { name:'光素', stack:99, color:'#ffe9a0', flavor:'闇の中で消えずに灯る光の欠片。正気をつなぎとめる。' },
  moonleaf:      { name:'月光草', stack:99, color:'#a8e0c0', food:14 },
  shadow_steel:  { name:'影鋼', stack:99, color:'#6a5a8a' },
  // 固有装備（影晶/影鋼/光素 由来）
  shadow_pickaxe:{ name:'影のツルハシ', stack:1, color:'#9a5fe0', tool:'pickaxe', tier:3 },
  shadow_blade:  { name:'影刃', stack:1, color:'#9a5fe0', tool:'sword', tier:4, attack:11, voidBonus:true },
  shadow_axe:    { name:'影の斧', stack:1, color:'#9a5fe0', tool:'axe', tier:3 },
  shadow_helmet: { name:'影鋼の兜', stack:1, color:'#6a5a8a', armor:3, slot:'head' },
  shadow_chest:  { name:'影鋼の鎧', stack:1, color:'#6a5a8a', armor:6, slot:'chest' },
  lumen_charm:   { name:'光の護符', stack:1, color:'#ffe9a0', armor:2, slot:'head', lumen:true }, // 影世界で正気維持
  // 設置物
  rift_anchor:   { name:'裂け目の楔', stack:16, color:'#7a4fb0', place:Game.OBJ.RIFT_ANCHOR },
  lumen_lantern: { name:'光のランタン', stack:16, color:'#ffe9a0', place:Game.OBJ.LUMEN_LANTERN },
  // 建築・自由度
  wood_floor:    { name:'木の床', stack:99, color:'#b07a40', place:Game.OBJ.WOOD_FLOOR },
  stone_floor:   { name:'石の床', stack:99, color:'#9a9ea2', place:Game.OBJ.STONE_FLOOR },
  wall:          { name:'壁', stack:99, color:'#8a6a44', place:Game.OBJ.WALL },
  garage_door:   { name:'自動車庫扉', stack:16, color:'#7a8088', place:Game.OBJ.GARAGE_DOOR, flavor:'近づくと自動で開き、離れると閉まるシャッター。車庫や格納庫に。' },
  landing_pad:   { name:'発着場', stack:16, color:'#3a4048', place:Game.OBJ.LANDING_PAD, flavor:'乗り物の発着場。上に乗って停めた乗り物は、燃料と耐久がゆっくり回復する。' },
  window:        { name:'窓', stack:99, color:'#a8d8e8', place:Game.OBJ.WINDOW },
  bridge:        { name:'橋', stack:99, color:'#9c6b3f', place:Game.OBJ.BRIDGE },
  sign:          { name:'立て札', stack:16, color:'#a9762f', place:Game.OBJ.SIGN },
  bounty_board:  { name:'賞金掲示板', stack:8, color:'#c8a060', place:Game.OBJ.BOUNTY_BOARD, flavor:'賞金首の討伐依頼が貼り出される板。対話で依頼を受け、達成して報酬を得る。' },
  enchant_table: { name:'エンチャント台', stack:4, color:'#5a3a8a', place:Game.OBJ.ENCHANT_TABLE },
  void_heart:    { name:'虚の心臓', stack:16, color:'#d040b0', flavor:'飢餓の獣の核。喰らうほどに飢える、終わりなき渇望の結晶。' },
  // 上位武器（銃）
  bullet:        { name:'弾丸', stack:99, color:'#caa86a' },
  pistol:        { name:'拳銃', stack:1, color:'#5a5a5e', tool:'gun', mag:12, ammo:'bullet', fireDmg:7, cd:12, gunsfx:'gun_pistol', flavor:'狭間に流れ着いた、火を吐く鋼。' },
  shadow_rifle:  { name:'影のライフル', stack:1, color:'#6a4f9a', tool:'gun', mag:20, ammo:'bullet', fireDmg:14, cd:7, gunsfx:'gun_rifle', flavor:'影鋼で鍛えた連射銃。闇さえ撃ち抜く。' },
  // ===== P32 実銃系＋口径別弾（大口径ほど高威力・高コスト）=====
  ammo_9mm:    { name:'9mm弾', stack:99, color:'#c8a050', flavor:'小口径。安価で取り回しが良い。' },
  ammo_556:    { name:'5.56mm弾', stack:99, color:'#c0b048', flavor:'高初速のライフル弾。' },
  ammo_762:    { name:'7.62mm弾', stack:99, color:'#b88838', flavor:'貫通力に優れる大口径。' },
  shell_12g:   { name:'12ゲージ散弾', stack:99, color:'#b04a3a', flavor:'拡散する散弾。近距離で凶悪。' },
  ammo_50:     { name:'.50口径弾', stack:99, color:'#9a7a40', flavor:'対物ライフル弾。一撃が重い。' },
  rocket_ammo: { name:'ロケット弾', stack:16, color:'#3a3a40', flavor:'着弾で爆発する。巻き込みに注意。' },
  star_shell:  { name:'星核弾', stack:64, color:'#aee0ff', flavor:'星鉄を芯に鍛えた炸裂弾。スターキャノン専用。安価な弾丸では星の力は放てない。' },
  he_slug:     { name:'鉄鋼榴弾', stack:32, color:'#6a6e5a', flavor:'鉄鋼の弾芯に炸薬を仕込んだ榴弾。直撃の運動エネルギーと炸裂を兼ね備える。' },
  missile:     { name:'ミサイル', stack:16, color:'#c0503a', flavor:'戦闘機の翼下に搭載する対地/対空ミサイル。高速で直進し、着弾または一定距離で炸裂する。' },
  homing_missile:{ name:'誘導ミサイル', stack:16, color:'#d0603a', flavor:'誘導装置を組み込んだ追尾ミサイル。爆撃機に搭載し、放てば自ら最寄りの敵へ曲がって飛ぶ。' },
  glock17:     { name:'グロック17', stack:1, color:'#1c1c20', tool:'gun', mag:17, ammo:'ammo_9mm', fireDmg:8,  cd:11, bkind:'bullet', gunsfx:'gun_pistol', flavor:'信頼性の高い定番ハンドガン。' },
  mp5:         { name:'MP5', stack:1, color:'#202024', tool:'gun', mag:30, ammo:'ammo_9mm', fireDmg:7,  cd:4,  bkind:'bullet', gunsfx:'gun_smg', flavor:'高速連射のサブマシンガン。' },
  m4:          { name:'M4カービン', stack:1, color:'#23231f', tool:'gun', mag:30, ammo:'ammo_556', fireDmg:12, cd:7, bkind:'tracer', gunsfx:'gun_rifle', flavor:'扱いやすい主力アサルトライフル。' },
  ak47:        { name:'AK-47', stack:1, color:'#2a2118', tool:'gun', mag:30, ammo:'ammo_762', fireDmg:15, cd:8, bkind:'tracer', gunsfx:'gun_rifle', flavor:'頑強で威力に優れる名銃。' },
  m870:        { name:'レミントンM870', stack:1, color:'#1e1e22', tool:'gun', mag:6, ammo:'shell_12g', fireDmg:6, cd:24, pellets:5, spread:0.5, bkind:'bullet', gunsfx:'gun_shotgun', flavor:'散弾を撒くポンプアクション。' },
  // ㊴ 追加の銃系統(見た目=色/サウンド=専用sfxにこだわる)
  deagle:      { name:'デザートイーグル', stack:1, color:'#c8a84a', tool:'gun', mag:7, ammo:'ammo_50', fireDmg:24, cd:19, bkind:'bullet', gunsfx:'gun_heavy', flavor:'黄金に輝く超大型拳銃。一発の重みが違う。反動も凶暴。' },
  uzi:         { name:'ウージー', stack:1, color:'#26262a', tool:'gun', mag:32, ammo:'ammo_9mm', fireDmg:6, cd:3, bkind:'bullet', gunsfx:'gun_smg', flavor:'ばら撒く小型短機関銃。取り回し軽快、弾はあっという間に尽きる。' },
  p90:         { name:'FN P90', stack:1, color:'#3a3a42', tool:'gun', mag:50, ammo:'ammo_9mm', fireDmg:7, cd:4, bkind:'tracer', gunsfx:'gun_smg', flavor:'50連の大容量マガジンを上部に備えたブルパップSMG。' },
  scar_h:      { name:'SCAR-H', stack:1, color:'#3a3222', tool:'gun', mag:20, ammo:'ammo_762', fireDmg:18, cd:8, bkind:'tracer', gunsfx:'gun_rifle', flavor:'高威力弾を扱うモジュラー・バトルライフル。中距離の王。' },
  barrett:     { name:'バレットM82', stack:1, color:'#2e3228', tool:'gun', mag:10, ammo:'ammo_50', fireDmg:62, cd:44, bkind:'tracer', pierce:true, gunsfx:'gun_antimat', flavor:'対物ライフル。装甲も敵も貫く一撃。狙って撃て。' },
  spas12:      { name:'SPAS-12', stack:1, color:'#20242a', tool:'gun', mag:8, ammo:'shell_12g', fireDmg:7, cd:21, pellets:7, spread:0.55, bkind:'bullet', gunsfx:'gun_shotgun', flavor:'戦闘用セミオート散弾銃。至近の制圧力は圧巻。' },
  minigun:     { name:'M134 ミニガン', stack:1, color:'#33352e', tool:'gun', mag:150, ammo:'ammo_556', fireDmg:4, cd:1, bkind:'tracer', spread:0.2, gunsfx:'gun_mini', flavor:'回転式六銃身の弾幕製造機。一発は軽いが毎秒数十発を浴びせる圧倒的連射。弾はみるみる溶ける。' },
  m79:         { name:'M79 擲弾銃', stack:1, color:'#3a3a2a', tool:'gun', mag:1, ammo:'rocket_ammo', fireDmg:14, cd:34, explosive:true, bkind:'rocket', gunsfx:'gun_launch', flavor:'単発の擲弾発射器。放物線を描いて着弾、炸裂。' },
  he_launcher: { name:'鉄鋼榴弾砲', stack:1, color:'#5a5e50', tool:'gun', mag:5, ammo:'he_slug', fireDmg:26, cd:22, explosive:2.2, bspeed:9, bkind:'rocket', gunsfx:'gun_launch', flavor:'鉄鋼榴弾を撃ち出す速射砲。直撃の射撃ダメージに加え、命中すれば炸裂して周囲を巻き込む。空を切れば不発——当たってこそ炸ける。' },
  lockon_launcher:{ name:'ロックオンミサイルランチャー', stack:1, color:'#4a5240', tool:'gun', mag:2, ammo:'missile', fireDmg:52, cd:40, explosive:2.6, bkind:'missile', homing:true, speedStart:7, speedMax:21, accel:1.2, dur:52, gunsfx:'missile_launch', flavor:'肩掛け式のロックオン式ミサイル発射器。放たれたミサイルは低速で出て最寄りの敵へ狙いを定め、加速して曲がりながら追尾し、着弾または一定距離で炸裂する。' },
  flamethrower:{ name:'火炎放射器', stack:1, color:'#a83a2a', tool:'gun', mag:100, ammo:'gasoline', refillPer:25, fireDmg:5, cd:3, bkind:'fire', gunsfx:'gun_flame', flavor:'ガソリンを噴射し敵を焼き尽くす。近距離で群れを炎に包め。ガソリン1つで25回分を補充。' },
  plasma_rifle:{ name:'プラズマライフル', stack:1, color:'#8a4ad0', tool:'gun', mag:24, ammo:'energy_cell', fireDmg:22, cd:9, bkind:'laser', pierce:true, gunsfx:'gun_energy', flavor:'高エネルギープラズマを撃ち出す未来兵器。光の刃が敵列を貫く。' },
  rpg7:        { name:'RPG-7', stack:1, color:'#26261e', tool:'gun', mag:1, ammo:'rocket_ammo', fireDmg:46, cd:55, explosive:2.4, bspeed:6, bkind:'rocket', gunsfx:'gun_rocket', flavor:'携行式ロケット。着弾で爆発し範囲を吹き飛ばす。' },
  // ===== P33 ワクワク武器（飛ぶ斬撃/雷/ブーメラン/ビーム）＋Fate風レジェンダリ =====
  energy_cell: { name:'エネルギーセル', stack:99, color:'#2aa0d0', flavor:'エネルギー兵器の動力。青く脈動する。' },
  wind_blade:  { name:'風斬りの剣', stack:1, color:'#bfe8d8', tool:'sword', tier:3, attack:9, proj:{kind:'slash', dmg:7, cd:14}, wsfx:'slash_air', flavor:'振るたび刃から斬撃が飛ぶ。間合いの外から斬れ。' },
  thunder_sword:{ name:'雷鳴剣', stack:1, color:'#ffe27a', tool:'sword', tier:4, attack:11, proj:{kind:'chain', dmg:9, chain:3, cd:18}, wsfx:'thunder', special:{type:'thunder', name:'雷鳴', count:2, pct:0.5, cd:90}, flavor:'放たれた雷は敵から敵へ飛び移る。斬撃の余波が天雷を呼ぶ。' },
  // 追加の特殊効果武器(クラフト可・ビルド多様化)
  frostfang_blade:{ name:'霜牙の刃', stack:1, color:'#9fd8ff', tool:'sword', tier:4, attack:11, special:{type:'nova', name:'氷結の新星', pct:0.5, cd:80, r:2.0, dot:'frost', color:'#9fd8ff'}, flavor:'斬った敵を核に氷が爆ぜ、まわりの敵をも凍てつかせる。群れを一掃せよ。' },
  emberfang_axe:{ name:'焔牙の斧', stack:1, color:'#ff7a3c', tool:'sword', tier:4, attack:12, special:{type:'nova', name:'焦熱の新星', pct:0.55, cd:85, r:2.1, dot:'burn', color:'#ff7a3c'}, wsfx:'whirl', flavor:'一撃が業火を呼び、標的を中心に炎が渦を巻く。焼き尽くせ。' },
  echoedge:{ name:'残響の刺剣', stack:1, color:'#e8c8ff', tool:'sword', tier:4, attack:10, special:{type:'echo', name:'残響', pct:0.45, cd:60, hits:2, color:'#e8c8ff'}, flavor:'突きの残響が二度、三度と敵を刺す。速き刃こそ、この剣の真価。' },
  quakehammer:{ name:'震撼の大鎚', stack:1, color:'#b0885a', tool:'sword', tier:4, attack:13, aoe:true, special:{type:'shock', name:'震撼', pct:0.5, cd:75, r:2.4, color:'#e0b060'}, wsfx:'whirl', flavor:'叩きつけると大地が揺れ、周囲の敵を衝撃波で薙ぐ。重き一撃の王。' },
  boomerang_axe:{ name:'回帰の戦斧', stack:1, color:'#caa86a', tool:'sword', tier:3, attack:12, proj:{kind:'boomerang', dmg:13, cd:28}, wsfx:'whirl', flavor:'投げれば貫き、手元へ還る。' },
  crescent_twinblade:{ name:'三日月の双刃', stack:1, color:'#9fe0d0', tool:'sword', tier:4, attack:13, proj:{kind:'slash', dmg:8, count:3, spread:0.5, cd:20}, wsfx:'slash_air', flavor:'一振りで三日月の斬撃が扇状に飛ぶ。群れを薙げ。' },
  laser_rifle: { name:'レーザーライフル', stack:1, color:'#141416', tool:'gun', mag:20, ammo:'energy_cell', fireDmg:14, cd:8, bkind:'laser', gunsfx:'beam', flavor:'敵を貫く収束光。' },
  railgun:     { name:'レールガン', stack:1, color:'#101014', tool:'gun', mag:5, ammo:'energy_cell', fireDmg:38, cd:40, bspeed:16, bkind:'pierce', gunsfx:'beam', flavor:'超電磁加速。直線上の全てを撃ち抜く。' },
  excalibur:   { name:'約束された勝利の剣', stack:1, color:'#ffe9a0', tool:'sword', tier:5, attack:22, proj:{kind:'slash', dmg:34, big:true, cd:40}, wsfx:'beam', special:{type:'shock', name:'聖光の衝撃', pct:0.5, r:2.4, cd:80, color:'#ffe9a0'}, flavor:'掲げれば光の砲撃となりて、邪悪を薙ぎ払う。' },
  gae_bolg:    { name:'刺し穿つ死棘の槍', stack:1, color:'#c0303a', tool:'sword', tier:5, attack:18, proj:{kind:'pierce', dmg:24, cd:22}, wsfx:'slash_air', special:{type:'brand', name:'死棘の毒', dot:'venom', color:'#c0303a'}, flavor:'放てば因果を捻じ曲げ、必ず心臓を貫く朱槍。' },
  gate_babylon:{ name:'王の財宝', stack:1, color:'#e8c54a', tool:'sword', tier:5, attack:26, proj:{kind:'slash', dmg:18, count:5, spread:0.7, cd:32}, wsfx:'slash_air', flavor:'無数の宝具を雨と降らせる、王の蔵。' },
  prism_blade: { name:'プリズムの刃', stack:1, color:'#c884f0', tool:'sword', tier:5, attack:19, proj:{kind:'slash', dmg:16, count:3, spread:0.4, cd:30}, wsfx:'beam', special:{type:'echo', name:'三閃残光', hits:2, pct:0.35, cd:70, color:'#c884f0'}, flavor:'水晶の女王の刃。光を七色に砕き、三閃となって奔る。' },
  dragon_fang: { name:'竜牙の大剣', stack:1, color:'#8a2fb0', tool:'sword', tier:5, attack:24, proj:{kind:'slash', dmg:28, big:true, cd:36}, wsfx:'beam', special:{type:'shock', name:'竜咆', pct:0.5, r:2.4, cd:75, color:'#8a2fb0'}, flavor:'深淵の竜の牙より鍛えし大剣。振るえば闇を裂く咆哮が奔る。' },
  endblade:    { name:'終焉の剣', stack:1, color:'#ff5a7a', tool:'sword', tier:5, attack:26, aoe:true, proj:{kind:'slash', dmg:32, big:true, cd:32}, wsfx:'beam', special:{type:'echo', name:'終焉の三連', hits:2, pct:0.4, cd:60, color:'#ff5a7a'}, flavor:'全ての強敵を退けし者に託される、終焉と再生の剣。一閃は三たび木霊する。' },
  flashstep_edge:{ name:'瞬雷・迅歩の刃', stack:1, color:'#7fe0ff', tool:'sword', tier:5, attack:17, wsfx:'slash_air', special:{type:'blink', name:'瞬歩', tiles:4, pct:0.85, shockPct:0.5, stam:12, cd:16, width:0.95, color:'#8fd0ff'}, flavor:'斬ると同時に前方へ雷の速さで瞬歩し、駆け抜けた軌跡の敵を斬り裂き感電させる。ただし瞬歩はスタミナを喰らう——乱発は許されない。' },
  voidrend_edge:{ name:'虚空断ち「セツナ」', stack:1, color:'#c48aff', tool:'sword', tier:5, attack:20, wsfx:'slash_air', special:{type:'blink', name:'刹那斬', tiles:6, pct:0.9, shockPct:0, stam:16, cd:22, width:1.0, color:'#c48aff', bleed:{pct:0.55, dur:90, every:30}}, flavor:'虚空を裂いて前方6マスへ跳び、軌跡上の敵をずたずたに斬り裂く。刻まれた深傷は3秒間、毎秒血を噴き続ける——逃げても無駄だ。' },
  // ===== 各武器種の特殊効果武器(かなり高レア) — 剣以外(鎚/槍/斧/鎌/刀)にも同格の特殊武器を用意 =====
  thunderguard_hammer:{ name:'雷轟の大鎚', stack:1, color:'#e0c060', tool:'sword', tier:5, attack:24, aoe:true, special:{type:'thunder', name:'雷轟', count:3, pct:0.6, cd:78, color:'#ffe27a'}, wsfx:'whirl', flavor:'振り下ろせば雷が三条、天より落ちて敵を撃つ。雷神の鎚。' },
  cataclysm_hammer:{ name:'災禍の戦鎚', stack:1, color:'#c0502a', tool:'sword', tier:5, attack:26, aoe:true, special:{type:'nova', name:'災禍の炎爆', pct:0.55, cd:82, r:2.4, dot:'fire', color:'#ff7a3a'}, wsfx:'whirl', flavor:'打ち据えた敵を核に業火が爆ぜ、一帯を灼く。' },
  graveshatter_hammer:{ name:'墓砕きの鉄鎚', stack:1, color:'#9a9aa0', tool:'sword', tier:5, attack:27, aoe:true, special:{type:'shock', name:'大地割り', pct:0.5, cd:75, r:2.8, color:'#c8c0a0'}, wsfx:'whirl', flavor:'一撃で大地を裂き、衝撃波が広く敵を薙ぎ倒す。' },
  runeforge_hammer:{ name:'神鍛の鎚', stack:1, color:'#e0844a', tool:'sword', tier:5, attack:23, special:{type:'brand', name:'烙印の炎', dot:'fire', color:'#ff8a3a'}, wsfx:'whirl', flavor:'古の神が鍛えし鎚。打たれた者に消えぬ炎の烙印を刻む。' },
  stormpierce_spear:{ name:'嵐貫きの槍', stack:1, color:'#9fd0e8', tool:'sword', tier:5, attack:20, proj:{kind:'pierce', dmg:26, cd:22}, wsfx:'slash_air', special:{type:'thunder', name:'雷穿', count:3, pct:0.6, cd:78, color:'#bfe0ff'}, flavor:'突けば雷が奔り、貫いた先の敵をも撃ち抜く。' },
  dragoon_spear:{ name:'竜騎士の穿槍', stack:1, color:'#c05a4a', tool:'sword', tier:5, attack:22, proj:{kind:'pierce', dmg:28, cd:24}, wsfx:'slash_air', special:{type:'shock', name:'竜穿撃', pct:0.5, r:2.2, cd:72, color:'#ff9a5a'}, flavor:'天翔ける竜騎士の槍。突きの衝撃が周囲を震わす。' },
  glacial_spear:{ name:'氷結の穿槍', stack:1, color:'#9fd8ff', tool:'sword', tier:5, attack:19, proj:{kind:'pierce', dmg:24, cd:22}, wsfx:'slash_air', special:{type:'brand', name:'凍てつく穂先', dot:'frost', color:'#bfe8ff'}, flavor:'貫いた者を芯まで凍てつかせる氷の穂先。' },
  venomfang_spear:{ name:'毒牙の刺槍', stack:1, color:'#8fb03a', tool:'sword', tier:5, attack:18, proj:{kind:'venom', dmg:20, cd:26}, wsfx:'slash_air', special:{type:'reap', name:'蝕みの吸命', healPct:0.03, cd:30, color:'#9fe06a'}, flavor:'毒に蝕まれた敵の命を啜り、使い手を癒す。' },
  thundercleave_axe:{ name:'雷断の戦斧', stack:1, color:'#e0c060', tool:'sword', tier:5, attack:23, special:{type:'thunder', name:'雷断', count:3, pct:0.6, cd:78, color:'#ffe27a'}, wsfx:'whirl', flavor:'振るえば空が裂け、雷が敵を断つ戦斧。' },
  ragestorm_axe:{ name:'憤怒の双斧', stack:1, color:'#c0402a', tool:'sword', tier:5, attack:25, aoe:true, special:{type:'shock', name:'憤怒の旋風', pct:0.5, r:2.4, cd:72, color:'#ff6a4a'}, wsfx:'whirl', flavor:'怒りに任せた一振りが、周囲の敵をまとめて薙ぐ。' },
  frostbite_axe:{ name:'氷噛みの斧', stack:1, color:'#9fd8ff', tool:'sword', tier:5, attack:22, special:{type:'brand', name:'氷噛み', dot:'frost', color:'#bfe8ff'}, flavor:'噛みついた傷口から凍てつく、氷狼の牙の斧。' },
  reaver_axe:{ name:'掠奪者の大斧', stack:1, color:'#b0704a', tool:'sword', tier:5, attack:24, special:{type:'reap', name:'略奪', healPct:0.04, cd:28, color:'#e0a060'}, wsfx:'whirl', flavor:'奪うことに特化した大斧。斬るたび命を掠め取る。' },
  soulreaper_scythe:{ name:'魂狩りの大鎌', stack:1, color:'#8a5ac0', tool:'sword', tier:5, attack:21, proj:{kind:'hex', dmg:18, count:2, spread:0.3, cd:32}, wsfx:'beam', special:{type:'reap', name:'魂狩り', healPct:0.05, cd:26, color:'#b088e8'}, flavor:'刈り取った魂を糧とする死神の大鎌。' },
  deathwind_scythe:{ name:'死風の鎌', stack:1, color:'#7a7a8a', tool:'sword', tier:5, attack:22, special:{type:'nova', name:'死の疾風', pct:0.5, cd:80, r:2.2, dot:'hex', color:'#9a9ab0'}, wsfx:'beam', flavor:'振るうたび死の風が渦を巻き、周囲を蝕む。' },
  plague_scythe:{ name:'疫病の大鎌', stack:1, color:'#8fb03a', tool:'sword', tier:5, attack:20, proj:{kind:'venom', dmg:18, count:2, spread:0.3, cd:34}, wsfx:'beam', special:{type:'brand', name:'疫病', dot:'venom', color:'#9fe04a'}, flavor:'触れた者に疫病を撒く、災いの鎌。' },
  voidharvest_scythe:{ name:'虚無刈りの鎌', stack:1, color:'#6a4fb0', tool:'sword', tier:5, attack:23, special:{type:'reap', name:'虚無刈り', healPct:0.05, cd:26, color:'#a080e0'}, wsfx:'beam', flavor:'刈り取った命を虚無へ還し、その残響で使い手を潤す。' },
  moonshadow_katana:{ name:'月影の太刀', stack:1, color:'#bfd0ff', tool:'sword', tier:5, attack:19, wsfx:'slash_air', special:{type:'blink', name:'月影', tiles:4, pct:0.85, shockPct:0.4, stam:12, cd:16, width:0.95, color:'#bfd0ff'}, flavor:'月光の速さで敵の背後へ回り込み、軌跡の者を斬り伏せる。' },
  thunderfang_katana:{ name:'雷牙の刀', stack:1, color:'#e0d060', tool:'sword', tier:5, attack:21, wsfx:'slash_air', special:{type:'thunder', name:'雷牙', count:3, pct:0.6, cd:76, color:'#ffe27a'}, flavor:'抜けば雷を纏い、斬撃が雷光となって奔る。' },
  crimson_katana:{ name:'紅蓮の刀', stack:1, color:'#e05a3a', tool:'sword', tier:5, attack:20, wsfx:'slash_air', special:{type:'brand', name:'紅蓮', dot:'fire', color:'#ff7a3a'}, flavor:'刀身が紅蓮に燃え、斬った者を炎に包む。' },
  iai_kasumi:{ name:'居合・霞', stack:1, color:'#c8b060', tool:'sword', tier:5, attack:0, wsfx:'slash_air', chg:{min:5, max:12, dmg:15, dmgScale:2.8, critBase:0.15, critScale:0.85, hits:3, cd:14, range:2.0, color:'#e0c890'}, flavor:'無明と対をなす秘剣。静寂を溜め、霞の如き一閃で断つ。溜めた時間だけ必殺に近づく。' },
  iai_mumyo:   { name:'居合・無明', stack:1, color:'#c8a860', tool:'sword', tier:5, attack:0, wsfx:'slash_air', chg:{min:5, max:12, dmg:16, dmgScale:3.0, critBase:0.15, critScale:0.85, hits:3, cd:14, range:2.0, color:'#ffb24a'}, flavor:'通常の斬撃は空を斬るのみ。だが5秒以上の静寂ののち放つ一閃は、溜めた時間の分だけ会心・威力・斬撃数を増す。長く鞘に納めるほど、一撃は必殺に近づく。忍耐こそ刃。' },
  colossus_blade:{ name:'巨像の大剣', stack:1, color:'#d08a4a', tool:'sword', tier:5, attack:23, proj:{kind:'slash', dmg:22, big:true, cd:38}, wsfx:'beam', special:{type:'shock', name:'大地断ち', pct:0.5, r:2.4, cd:75, color:'#d08a4a'}, flavor:'黄昏の巨像の核より鍛えし剛剣。一振りで大地を断つ。' },
  mire_scythe: { name:'澱みの大鎌', stack:1, color:'#7a9a3a', tool:'sword', tier:5, attack:21, proj:{kind:'venom', dmg:18, count:2, spread:0.3, cd:34}, wsfx:'beam', special:{type:'reap', name:'吸命', healPct:0.03, cd:30, color:'#8fe06a'}, flavor:'沼の主の骸より鍛えし大鎌。刈り取った命が使い手を潤す。' },
  magma_maul:  { name:'溶岩の大槌', stack:1, color:'#d8521f', tool:'sword', tier:5, attack:25, aoe:true, proj:{kind:'fire', dmg:20, explosive:1.6, cd:40}, wsfx:'beam', special:{type:'brand', name:'焔纏', dot:'fire', color:'#ff7a3a'}, flavor:'溶岩の王の核より鍛えし大槌。打たれた者は炎を纏う。' },
  spore_scythe:{ name:'菌糸の大鎌', stack:1, color:'#9a6ad0', tool:'sword', tier:5, attack:22, proj:{kind:'venom', dmg:18, count:3, spread:0.4, cd:34}, wsfx:'beam', special:{type:'reap', name:'吸命', healPct:0.03, cd:30, color:'#9a6ad0'}, flavor:'胞子の女王より生まれた大鎌。散った命は菌糸を伝って還る。' },
  // ===== エンドゲーム手作り装備(ボス素材) =====
  starcore_greatsword:{ name:'星核の大剣', stack:1, color:'#cfe0ff', tool:'sword', tier:5, attack:34, proj:{kind:'slash', dmg:34, big:true, cd:32}, wsfx:'beam', special:{type:'echo', name:'星屑残光', hits:2, pct:0.35, cd:70, color:'#cfe0ff'}, flavor:'星核を鍛え込んだ大剣。一閃の後、星屑の残光が追い斬る。' },
  voidcore_blade:{ name:'虚無の刃', stack:1, color:'#c060ff', tool:'sword', tier:5, attack:22, proj:{kind:'hex', dmg:18, count:2, spread:0.35, pierce:true, cd:32}, wsfx:'beam', special:{type:'reap', name:'虚喰', healPct:0.04, cd:30, color:'#c060ff'}, flavor:'影核と虚の心臓より生まれた刃。屠った命を喰らい、主を癒す。' },
  star_aegis:  { name:'星核の鎧', stack:1, color:'#bfe0ff', armor:12, slot:'chest', warm:true, flavor:'星鋼と星核で鍛えた鎧。あらゆる衝撃を受け流す。' },
  void_helm:   { name:'虚無の兜', stack:1, color:'#a060e0', armor:5, slot:'head', flavor:'影核を埋め込んだ兜。影の囁きを遮る。' },
  // 乗り物
  gasoline:      { name:'ガソリン', stack:16, color:'#d8b24a', fuel:60, flavor:'現代の乗り物を動かす燃料。乗車中に使うと燃料を補給できる。' },
  // ===== 中間素材(㊱㊲: クラフトの深さ。銃や上位装備は部品を経て作る) =====
  gunpowder:     { name:'火薬', stack:99, color:'#3a3a3e', flavor:'硫黄と炭を練った火薬。銃・弾薬・爆発物の要。' },
  gun_parts:     { name:'銃部品', stack:99, color:'#9a9ea6', flavor:'精密加工した銃の機関部品。あらゆる銃器の心臓部。' },
  steel_plate:   { name:'鋼板', stack:99, color:'#b0b6be', flavor:'鉄を鍛え直した頑丈な鋼板。上位の防具や車両の装甲に。' },
  rope:          { name:'ロープ', stack:99, color:'#b89a5a', flavor:'繊維を綯った丈夫なロープ。建築や道具に幅広く使う。' },
  circuit:       { name:'回路基板', stack:99, color:'#4aa06a', flavor:'光素を編み込んだ精密回路。エネルギー兵器や高度な機械の核。' },
  // ===== 新規消費アイテム(㊲) =====
  jerky:         { name:'干し肉', stack:16, color:'#8a4a30', food:30, flavor:'塩と天日で干した保存食。腐りにくく腹持ちがよい。' },
  fruit_salad:   { name:'フルーツサラダ', stack:8, color:'#ff8ab0', food:34, buff:{type:'regen_buff', dur:600}, flavor:'色とりどりの果実を和えた一皿。爽やかで、じんわり癒される。' },
  energy_bar:    { name:'携行食', stack:16, color:'#c8a84a', food:24, buff:{type:'swiftness', dur:400}, flavor:'木の実と蜜を固めた携行食。手早くエネルギー補給、足取りも軽くなる。' },
  medkit:        { name:'救急キット', stack:8, color:'#e05a5a', cures:['poison','infection','bleed','burn'], heal:40, buff:{type:'regen_buff', dur:500}, flavor:'包帯と薬をまとめた救急キット。毒・感染・出血・火傷を治し、大きく回復する。' },
  repair_kit:    { name:'修理キット', stack:8, color:'#8aa0b0', repair:50, flavor:'乗り物の耐久を回復する工具一式。乗車中に使うと機体を直せる。' },
  buggy:         { name:'バギー', stack:1, color:'#d8863c', vehicle:'buggy', fuelVeh:true, flavor:'四輪駆動の軽快なオフロード車。燃料で走る。荒地もぐいぐい進む。' },
  car:           { name:'車', stack:1, color:'#c0444a', vehicle:'car', fuelVeh:true, flavor:'大地を駆ける鉄の馬。燃料で走る。' },
  cannon_shell:  { name:'戦車砲弾', stack:32, color:'#6a6a4a', flavor:'戦車の主砲弾。着弾で炸裂し範囲に大ダメージ。乗車中に主砲として撃つ。' },
  tank:          { name:'戦車', stack:1, color:'#4a5a3c', vehicle:'tank', fuelVeh:true, tankCannon:{ directDmg:150, blastDmg:52, blastRadius:3.8, speed:9, range:12, cd:42, knock:24 }, flavor:'一人乗りの装甲戦車。鈍いが頑強。砲塔は移動と別に旋回でき、狙った方向へ砲弾を撃ち出す。砲弾は着弾か一定距離で炸裂し、直撃は特大・爆風は広範囲を薙いで敵を大きく吹き飛ばす。' },
  battle_mech:   { name:'戦闘ロボ', stack:1, color:'#7a8496', vehicle:'mech', fuelVeh:true, mechStomp:{ dmg:44, r:2.6, cd:20 }, flavor:'一人乗りの二足歩行兵器。機敏で頑強。攻撃ボタンで大地を踏み鳴らし、周囲の敵を衝撃波で薙ぐ。' },
  fighter_jet:   { name:'戦闘機', stack:1, color:'#8a96c0', vehicle:'jet', fuelVeh:true, jetGun:{ dmg:12, burst:10, spread:0.05, speed:13, rate:2.5 }, flavor:'一人乗りの戦闘機。空を高速で駆け、あらゆる地形を越える。攻撃1タップで機首砲が真っ直ぐ10連射(弾丸1消費)。ミニガンの2倍レートの弾幕で薙ぎ払い、地形も特殊物以外は撃ち砕く。L2/🚀でミサイル発射(回避で通常⇄追尾切替)。直進を続けると加速する。' },
  aerial_bomb:   { name:'T-0S21 航空爆弾', stack:16, color:'#4a5240', bomb:{ dmg:90, radius:3.4 }, flavor:'爆撃機に搭載する制式航空爆弾。投下すると着弾点を広範囲に吹き飛ばす。' },
  heavy_bomb:    { name:'GBU-45 大型爆弾', stack:8, color:'#3a4030', bomb:{ dmg:180, radius:5.2 }, flavor:'重量級の誘導爆弾。一発で拠点を更地に変える破壊力。爆撃機専用。' },
  bomber:        { name:'爆撃機', stack:1, color:'#6a7060', vehicle:'bomber', fuelVeh:true, bomberBay:true, flavor:'一人乗りの爆撃機。攻撃ボタンで搭載爆弾を投下、L2/🚀でミサイル発射(回避で通常⇄追尾切替)。追尾は1発で小型4発が最寄りの敵へ自ら曲がって飛ぶ。' },
  aircraft_gun:  { name:'機載機関銃', stack:4, color:'#5a5e66', installGun:true, flavor:'戦闘機/爆撃機に増設できる機関銃。最大4基まで設置でき、設置した数だけ同時に掃射する。搭乗中に使うと1基設置。' },
  nuke_warhead:  { name:'戦術核弾頭「デイブレイク」', stack:4, color:'#8ae04a', flavor:'一発で戦域を消し飛ばす戦術核。装填には投射機が要る。使えば戻れない。' },
  nuke_launcher: { name:'審判の核投射機「ラグナロク」', stack:1, color:'#c8d04a', tool:'gun', nukeLauncher:true, gunsfx:'gun_launch', flavor:'戦術核弾頭を指定地点へ撃ち込む最終兵器。10秒のけたたましい警報ののち着弾、1000の直撃と辺り一帯を焦土に。その地は7日間、死の灰が降り続ける——味方も敵も等しく蝕む。乱用は世界を焼く。' },
  boat:          { name:'ボート', stack:1, color:'#9c6b3f', vehicle:'boat', flavor:'水を越えるための小舟。' },
  plane:         { name:'飛行機', stack:1, color:'#8a96c0', vehicle:'plane', flavor:'空を行く翼。すべての境界を越えて。' },
  // ロケット/宇宙
  rocket:        { name:'ロケット', stack:1, color:'#d8d8e0', place:Game.OBJ.ROCKET, flavor:'空の果て、星々の海へ。全ての貴き素材を束ねて。' },
  star_metal:    { name:'星鋼', stack:99, color:'#aee0ff', flavor:'星の核から採れる金属。地上のどんな鋼より硬く、軽い。' },
  star_core:     { name:'星核', stack:16, color:'#ffe9ff', flavor:'小さな星そのもの。無限の力が秘められている。' },
  cosmic_blade:  { name:'コズミックブレード', stack:1, color:'#aee0ff', tool:'sword', tier:5, attack:28, special:{type:'thunder', name:'星の裁き', count:3, pct:0.7, cd:80, color:'#aee0ff'}, flavor:'星鋼で鍛えし剣。一閃が闇を裂き、星の光が敵を撃つ。' },
  star_cannon:   { name:'スターキャノン', stack:1, color:'#aee0ff', tool:'gun', mag:8, ammo:'star_shell', fireDmg:38, cd:9, explosive:2.6, bkind:'rocket', gunsfx:'gun_rocket', flavor:'星の力を撃ち放つ砲。着弾で炸裂する。' },
  gravity_boots: { name:'重力ブーツ', stack:1, color:'#88a', armor:4, slot:'chest', flavor:'星の重力を御す靴。' },
  // 家具・家作り
  healing_totem: { name:'癒しの祭壇', stack:16, color:'#7fd0a0', place:Game.OBJ.HEALING_TOTEM, flavor:'傍にいる者の傷を癒す祭壇。' },
  street_lamp:   { name:'街灯', stack:16, color:'#ffe9a0', place:Game.OBJ.STREET_LAMP },
  table:         { name:'テーブル', stack:16, color:'#9c6b3f', place:Game.OBJ.TABLE },
  chair:         { name:'椅子', stack:16, color:'#9c6b3f', place:Game.OBJ.CHAIR },
  bookshelf:     { name:'本棚', stack:16, color:'#7a5230', place:Game.OBJ.BOOKSHELF },
  glass:         { name:'ガラス', stack:99, color:'#a8d8e8', place:Game.OBJ.GLASS },
  rug:           { name:'絨毯', stack:99, color:'#b04a6a', place:Game.OBJ.RUG },
  banner:        { name:'旗', stack:16, color:'#b03040', place:Game.OBJ.BANNER },
  brazier:       { name:'かがり火', stack:16, color:'#ff8a3a', place:Game.OBJ.BRAZIER },
  barrel:        { name:'樽', stack:16, color:'#8a5a30', place:Game.OBJ.BARREL },
  powder_keg:    { name:'火薬樽', stack:16, color:'#9a4a2a', place:Game.OBJ.POWDER_KEG, flavor:'火や爆風で大爆発する樽。設置して離れてから火を放て。近くの火薬樽へ連鎖する。採掘なら安全に回収できる。' },
  potted_plant:  { name:'植木鉢', stack:16, color:'#7a9a4a', place:Game.OBJ.POTTED_PLANT },
  // 建築拡張
  stone_wall:    { name:'石壁', stack:99, color:'#9a9ea2', place:Game.OBJ.STONE_WALL },
  hedge:         { name:'生垣', stack:99, color:'#4a8f3c', place:Game.OBJ.HEDGE },
  fountain:      { name:'噴水', stack:8, color:'#8fd0e0', place:Game.OBJ.FOUNTAIN, flavor:'水を湛えた石の噴水。傍らでは体力が少しずつ癒える。' },
  lantern_post:  { name:'ランタン柱', stack:16, color:'#ffe9a0', place:Game.OBJ.LANTERN_POST },
  flowerbed:     { name:'花壇', stack:16, color:'#ff9ec4', place:Game.OBJ.FLOWERBED },
  scarecrow:     { name:'かかし', stack:8, color:'#c8a850', place:Game.OBJ.SCARECROW, flavor:'畑の守り手。近くの作物の育ちが早まる。' },
  wood_stairs:   { name:'木の階段', stack:99, color:'#b07a40', place:Game.OBJ.WOOD_STAIRS },
  trellis:       { name:'つる棚', stack:16, color:'#8a9a5a', place:Game.OBJ.TRELLIS },
  // 農業拡張
  watering_can:  { name:'じょうろ', stack:1, color:'#7fb8d8', waterCan:true, flavor:'水をやると、まわりの作物がひと回り育つ。使うほどに畑は豊かに。' },
  strawberry_seeds:{ name:'いちごの種', stack:99, color:'#c86a7a', plant:Game.OBJ.WHEAT, crop:{harvest:'strawberry', seeds:'strawberry_seeds', color:'#e0405a'} },
  strawberry:    { name:'いちご', stack:99, color:'#e0405a', food:14, buff:{type:'regen', dur:400} },
  corn_seeds:    { name:'とうもろこしの種', stack:99, color:'#c0b04a', plant:Game.OBJ.WHEAT, crop:{harvest:'corn', seeds:'corn_seeds', color:'#e8c84a'} },
  corn:          { name:'とうもろこし', stack:99, color:'#e8c84a', food:20 },
  // 魔法武器（ボスドロップのレア）
  warp_staff:    { name:'ワープの杖', stack:1, color:'#b06ad0', tool:'warp', flavor:'空間を歪め、一瞬で間合いを詰める/離す。' },
  grapple_hook:  { name:'鉤縄', stack:1, color:'#c8a860', tool:'grapple', flavor:'狙った先の壁や木に鉤を打ち、一気に手繰り寄せる。水や谷を飛び越え、どこへでも。' },
  stasis_glass:  { name:'時止めの砂時計', stack:8, color:'#bfe4ff', stasis:150, flavor:'砂が逆さに流れる刻。掲げれば約5秒、あらゆる敵の時が凍りつく。窮地の一手にも、狩りの好機にも。' },
  flame_staff:   { name:'炎の杖', stack:1, color:'#ff7a3c', tool:'staff', fireDmg:16, magic:'fire', flavor:'業火の弾を放つ。弾は要らぬ、己が魔力で。' },
  frost_staff:   { name:'氷結の杖', stack:1, color:'#9fd8ff', tool:'staff', fireDmg:12, magic:'frost', flavor:'凍てつく弾で敵を縛る。' },
  meteor_staff:  { name:'流星の杖', stack:1, color:'#ffb24a', tool:'staff', strike:{ dmg:30, radius:2.4, range:9, cd:48 }, flavor:'天の破片を呼び、敵の頭上に落とす。星鋼に宿る空の記憶。' },
  vortex_staff:  { name:'渦の杖', stack:1, color:'#b66ad0', tool:'staff', vortex:{ dmg:5, radius:3, range:8, dur:66, cd:120 }, flavor:'空間を歪め渦を生む。群がる敵を一点へ引き寄せる。まとめて薙ぎ払え。' },
  heavenfall_staff:{ name:'天墜の杖', stack:1, color:'#ff8a3c', tool:'staff', castMeteor:{ dur:300, radius:4, dmg:120, range:12 }, flavor:'狙いを定め、天に祈れ。約10秒の詠唱の間は無敵だが、その場を一歩も動いてはならない——詠唱の果て、巨大な隕石が指定した地に墜ち、あたり一面を焦土に変える。動けば、祈りは霧散する。' },
  flying_carpet: { name:'空飛ぶ絨毯', stack:1, color:'#c0407a', vehicle:'carpet', flavor:'古の魔法で織られた絨毯。空を自在に駆ける。' },
  shadow_altar:  { name:'影の祭壇', stack:4, color:'#3a2050', place:Game.OBJ.SHADOW_ALTAR },
  // ボス報酬
  shadow_core:   { name:'影核', stack:16, color:'#c060ff', flavor:'影の主の心臓。世界を裂いた最初の祈りが、結晶となって残ったもの。' },
  sanity_charm:  { name:'影核のお守り', stack:1, color:'#c060ff', armor:2, slot:'head', lumen:true, immuneSanity:true },
  // エンディング
  unity_core:    { name:'統合の核', stack:1, color:'#ffffff', ending:true, flavor:'光と影、ふたつの祈りを束ねる核。掲げれば、割れた世界はひとつに還る。' },
  // ===== P25 コンテンツ拡張: 素材 =====
  gold_bar:      { name:'金塊', stack:99, color:'#e8c54a', flavor:'精錬された黄金。装飾にも、刃にも。' },
  coin_charm:    { name:'守銭の護符', stack:1, color:'#ffd24a', keepBts:true, flavor:'肌身離さず持つ者のバーツを、死してなお守る黄金の護符。所持していれば死亡してもバーツを失わない。' },
  kokuhen:       { name:'刻片', stack:99, color:'#bfa0ff', flavor:'打ち倒した強敵の記憶が結晶した紫の欠片。記憶回廊に物語を呼び覚ます。' },
  shop_bell:     { name:'商館の呼び鈴', stack:1, color:'#d8b24a', opensShop:true, flavor:'鳴らせばどこからともなく商館がひらく。バーツで品を購える携帯式の呼び鈴。' },
  chitin:        { name:'甲殻', stack:99, color:'#b07030', flavor:'砂漠の蟲の硬い殻。軽く、しなやかな防具になる。' },
  // ===== P25: 武器 =====
  bone_club:     { name:'骨の棍棒', stack:1, color:'#dcdcd0', tool:'sword', tier:1, attack:4, flavor:'打ち倒した者の骨で。原始の暴力。' },
  gold_sword:    { name:'金の剣', stack:1, color:'#e8c54a', tool:'sword', tier:2, attack:6, flavor:'美しき黄金の刃。見栄えは一流、実用も悪くない。' },
  war_hammer:    { name:'戦鎚', stack:1, color:'#b8bcc0', tool:'sword', tier:3, attack:10, aoe:true, flavor:'振り抜けば鎧ごと砕く重鎚。周囲を薙ぎ払う。' },
  crystal_blade: { name:'影晶の刃', stack:1, color:'#b86ad0', tool:'sword', tier:4, attack:13, voidBonus:true, special:{type:'brand', name:'氷纏', dot:'frost', color:'#9fd8ff'}, flavor:'影晶を研ぎ澄ました刃。斬られた者は冷気に縛られ鈍る。' },
  chitin_spear:  { name:'甲殻の槍', stack:1, color:'#c08040', tool:'sword', tier:2, attack:7, flavor:'砂漠の蟲の殻を束ねた槍。間合いに優れる。' },
  // ===== P25: 防具・セット素材 =====
  gold_helmet:   { name:'金の兜', stack:1, color:'#e8c54a', armor:2, slot:'head' },
  gold_chest:    { name:'金の鎧', stack:1, color:'#e8c54a', armor:3, slot:'chest' },
  crystal_helmet:{ name:'影晶の兜', stack:1, color:'#b86ad0', armor:3, slot:'head' },
  crystal_chest: { name:'影晶の鎧', stack:1, color:'#b86ad0', armor:5, slot:'chest' },
  star_helmet:   { name:'星鋼の兜', stack:1, color:'#aee0ff', armor:4, slot:'head' },
  chitin_armor:  { name:'甲殻の鎧', stack:1, color:'#c08040', armor:3, slot:'chest' },
  // ===== P27 ボス固有レジェンダリ =====
  sand_greatsword:{ name:'砂塵の大剣', stack:1, color:'#d8b048', tool:'sword', tier:4, attack:14, aoe:true, special:{type:'shock', name:'砂塵の衝撃波', pct:0.4, r:2.0, cd:90, color:'#d8b048'}, flavor:'墳墓の王の遺刃。振るうたび、千年の砂塵が衝撃となって荒れ狂う。' },
  magma_hammer:  { name:'溶岩の戦槌', stack:1, color:'#c0502a', tool:'sword', tier:5, attack:17, aoe:true, special:{type:'shock', name:'灼熱の衝撃波', pct:0.45, r:2.2, cd:75, dot:'fire', color:'#ff7a3a'}, flavor:'溶炉の巨人の鎚。打てば大地が灼け、衝撃が炎を撒く。' },
  pharaoh_crown: { name:'王の冠', stack:1, color:'#e8c54a', armor:4, slot:'head', flavor:'墳墓に眠りし王の黄金の冠。威厳が身を護る。' },
  mind_tome:     { name:'記憶の書', stack:8, color:'#d0c0ff', respec:true, flavor:'稀少な記憶の書。読めばスキルを振り直せる。' },
  wisdom_tome:   { name:'知恵の書', stack:8, color:'#ffd86b', skillTome:1, flavor:'古の知恵が宿る稀覯本。読めばスキルポイントを1得る。' },
  expand_pouch:  { name:'拡張のポーチ', stack:8, color:'#caa86a', invExpand:[2,5], flavor:'魔法で空間が広がる革袋。使えば持ち物の上限が増える（最大100）。' },
  xp_orb:        { name:'経験の宝珠', stack:16, color:'#7fd0ff', xpGain:40, flavor:'砕けば膨大な経験が流れ込む輝く珠。' },
  // ===== 遺物(relic) アクセサリー: 装備スロット1つに1個。控えめなパッシブ効果 =====
  ring_crit:     { name:'会心の指輪', stack:1, color:'#ff7a5a', relic:{crit:0.08}, flavor:'裂け目に抗った剣豪の指輪。急所を見抜く眼が宿る。会心率+8%。' },
  amulet_swift:  { name:'俊足の護符', stack:1, color:'#5fffd0', relic:{moveSpd:0.12}, flavor:'風を駆けた斥候の護符。いまも加護を残す。移動速度+12%。' },
  fang_vamp:     { name:'吸血の牙', stack:1, color:'#c03050', relic:{lifesteal:0.06}, flavor:'影に堕ちかけた英雄の牙の首飾り。生命を啜る。吸血+6%。' },
  heart_regen:   { name:'再生の心臓', stack:1, color:'#ff7aa0', relic:{regen:0.4}, flavor:'不死と謳われた守人の心臓。絶えず脈打つ。HP自然回復+。' },
  eye_xp:        { name:'星霜の眼', stack:1, color:'#7fd0ff', relic:{xpBoost:0.15}, flavor:'時を見通した賢者の遺した瞳。獲得経験+15%。' },
  crest_aegis:   { name:'鉄壁の紋章', stack:1, color:'#9fb6d0', relic:{armor:3}, flavor:'城を守り抜いた騎士団の紋章。鉄壁の加護。防御+3。' },
  core_titan:    { name:'巨人の核', stack:1, color:'#e0844a', relic:{hp:28}, flavor:'倒れた巨人の鼓動を宿す核。最大HP+28。' },
  gauntlet_grit: { name:'不屈の篭手', stack:1, color:'#c0a060', relic:{staminaMax:40}, flavor:'幾多の死線を越えた篭手。息切れを知らぬ。スタミナ上限+40。' },
  fang_war:      { name:'戦神の牙', stack:1, color:'#e05a4a', relic:{atk:3}, flavor:'戦神に捧げられた牙。攻撃に重みが宿る。攻撃力+3。' },
  band_power:    { name:'力の腕輪', stack:1, color:'#ff8a4a', relic:{atk:4}, flavor:'大地を割った闘士の腕輪。膂力の残響が宿る。攻撃+4。' },
  crest_guard:   { name:'守護の紋章', stack:1, color:'#9fd8ff', relic:{armor:3, hp:10}, flavor:'最初の裂け目を食い止めた盾の紋章。防御+3・最大HP+10。' },
  // ===== 空島(スカイエンクレーブ)関連 =====
  feather:       { name:'羽根', stack:99, color:'#e8ecf4', flavor:'空を征く者たちの落とし物。軽く、しなやかで、風をよく憶えている。' },
  wind_crystal:  { name:'風晶', stack:99, color:'#8fe8e0', flavor:'空島の岩肌に実る青碧の結晶。耳を寄せると、遠い風の唸りが聞こえる。' },
  wind_steel:    { name:'風鋼', stack:99, color:'#9fc8c8', flavor:'風晶と鉄を吹き合わせた軽い鋼。刃にすれば風を纏う。' },
  wind_feather:  { name:'風の羽根', stack:8, color:'#cfe8ff', flavor:'羽根に光素を編み込んだ祈りの道具。風の祭壇の傍らで掲げれば、風があなたを空へ運ぶ。' },
  wind_sword:    { name:'風鋼の剣', stack:1, color:'#9fe8e0', tool:'sword', tier:4, attack:12, special:{type:'brand', name:'風纏', dot:'frost', color:'#9fe8e0'}, flavor:'風鋼で鍛えた細身の剣。斬られた者は風に縛られ、足が鈍る。' },
  sky_cloak:     { name:'天羽織', stack:1, color:'#dfe8f4', armor:5, slot:'chest', warm:true, flavor:'雲鷹の羽根を織り込んだ羽織。空島の風雪すら柔らかく受け流す。' },
  cloud_boots:   { name:'雲の靴', stack:1, color:'#cfe0ec', relic:{moveSpd:0.08, staminaMax:20}, flavor:'雲を踏む感触の軽い靴。装身具として身につければ足取りが軽くなる。移動+8%・スタミナ+20。' },
  // 古代都市の遺物
  relic_shard:   { name:'遺物のかけら', stack:99, color:'#d8c078', flavor:'古代都市の石像や鉱脈から出る黄金の破片。文字とも紋様ともつかぬ刻印が走っている。' },
  ancient_alloy: { name:'古代合金', stack:99, color:'#c8b884', flavor:'遺物のかけらを鉄と溶き合わせた失われた合金。時を経てなお錆びない。' },
  gate_key:      { name:'古の鍵', stack:8, color:'#e0cf90', flavor:'古の門をひらく鍵。金鉱と光素を門の紋様に合わせて鋳た。掲げれば沈黙の都市へ通じる。' },
  ruin_blade:    { name:'遺構の長剣', stack:1, color:'#cabf8a', tool:'sword', tier:4, attack:12, special:{type:'echo', name:'残響', pct:0.4, cd:60, color:'#e8dca0'}, flavor:'古代都市の兵が佩いた長剣。一撃が過去の残響を呼び、二度三度と斬り重なる。' },
  warden_plate:  { name:'守番の胸甲', stack:1, color:'#b8ac82', armor:6, slot:'chest', flavor:'都市を永く守り続けた守番の鎧。重いが、古代合金ゆえの堅牢さは折り紙付き。' },
  thorn_plate:   { name:'棘鎧', stack:1, color:'#7a5a4a', armor:5, slot:'chest', thornsFixed:0.28, flavor:'無数の棘に覆われた鎧。触れた者は自らの攻撃で傷つく。棘28%反射(付与効果と加算)。' },
  combat_vest:   { name:'戦術タクティカルベスト', stack:1, color:'#3c4a38', armor:5, slot:'chest', ammoStack:2, flavor:'弾倉ポーチを備えた戦闘用ベスト。装備中は1スロットに携行できる弾薬の上限が2倍になる。銃使いの相棒。' },
  reflect_aegis: { name:'反射の盾', stack:1, color:'#8fd0ff', offhand:true, ohArmor:2, reflect:0.4, flavor:'攻撃を跳ね返す盾。左手に装備すると、受けたダメージの40%を殴ってきた相手へ反射する(ボスにも有効)。防御+2。' },
  aqualung:      { name:'潜水呼吸器', stack:1, color:'#4ad0e0', offhand:true, diveGear:true, flavor:'古の海人が遺した呼吸器。左手に装備すると水中で溺れなくなり、深い海の底まで潜っていける。' },
  moonshard:     { name:'月光の欠片', stack:99, color:'#bcd0ff', flavor:'深夜に爛々と目を光らせる魔物のみが宿す、蒼い月光の結晶。夜の力が凝っている。月光装備の素材。' },
  moon_charm:    { name:'月光の護符', stack:1, color:'#aec4ff', relic:{moveSpd:0.08, xpBoost:0.12}, flavor:'月光の欠片を編んだ護符。夜の俊敏さが宿り、移動速度+8%・獲得経験+12%。装身具枠。' },
  ancient_charm: { name:'古の護符', stack:1, color:'#e0cf90', relic:{maxHp:16, armor:1}, flavor:'刻印の護符。古の守りが宿り、身を固くする。装身具として最大HP+16・防御+1。' },
  // 狭間の遺物
  void_shard:    { name:'虚無晶', stack:99, color:'#b088e8', flavor:'狭間の裂け目に結晶した虚。覗き込むと、光でも影でもない色が渦を巻いている。' },
  void_alloy:    { name:'虚無合金', stack:99, color:'#8f6fc8', flavor:'虚無晶と影晶を溶き合わせた金属。存在と非在のあわいで、わずかに揺らいでいる。' },
  void_key:      { name:'虚ろな鍵', stack:8, color:'#c0a0f0', flavor:'狭間の裂け目をひらく鍵。影核と光素を撚り合わせ、二相のあわいの形に鋳た。掲げれば世界の隙間へ落ちる。' },
  rift_blade:    { name:'狭間の裂刃', stack:1, color:'#b088e8', tool:'sword', tier:5, attack:14, special:{type:'shock', name:'裂雷', pct:0.5, cd:70, color:'#c0a0f0'}, flavor:'二相のあわいで鍛えた刃。斬撃が空間ごと裂き、近くの敵へ雷光が奔る。' },
  void_shroud:   { name:'虚無の外套', stack:1, color:'#7a5aa8', armor:6, slot:'chest', sanityResist:0.3, flavor:'狭間の布で織った外套。正気を蝕む影の囁きを、あわいの静けさが和らげる。正気耐性+30%。' },
  rift_charm:    { name:'狭間の護符', stack:1, color:'#c0a0f0', relic:{maxHp:12, moveSpd:0.05}, flavor:'あわいの護符。存在が薄れるぶん、身は軽い。装身具として最大HP+12・移動+5%。' },
  // 嵐の主の固有ドロップ: 雷を纏う戈
  tempest_spear: { name:'嵐帝の戈', stack:1, color:'#8fc8f0', tool:'sword', tier:5, attack:18, special:{type:'thunder', name:'雷帝', pct:0.55, cd:55, color:'#bfe4ff'}, proj:{kind:'chain', dmg:9, cd:16}, flavor:'嵐の主を統べた戈。振るえば刃から雷が連鎖し、遠くの敵まで貫く。空の怒りを、この手に。' },
  // 玉座の王の固有ドロップ: 威圧の王笏
  sovereign_scepter:{ name:'玉座の王笏', stack:1, color:'#d8c078', tool:'sword', tier:5, attack:19, special:{type:'shock', name:'王の威圧', pct:0.55, cd:70, r:2.6, color:'#e8cf80'}, aoe:true, flavor:'玉座の王が握りし黄金の笏。一振りで臣従を強い、周囲の者を威圧の衝撃で薙ぐ。' },
  // 虚無の帝の固有ドロップ: あわいの王冠(防具)
  rift_crown:{ name:'虚無の王冠', stack:1, color:'#b088e8', armor:6, slot:'head', thornsFixed:0.18, flavor:'虚無の帝が戴きし王冠。触れる者に虚無を刻む(棘18%反射)。あわいを統べる証。' },
};

// クラフトレシピ。station=null は手作り、それ以外は近接が必要
Game.RECIPES = [
  { out:{id:'wood_block', n:4}, in:{wood:1}, station:null },
  { out:{id:'crafting_table', n:1}, in:{wood:4}, station:null },
  { out:{id:'torch', n:4}, in:{wood:1, coal:1}, station:null },
  { out:{id:'stone_block', n:1}, in:{stone:1}, station:null },
  { out:{id:'wood_pickaxe', n:1}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'wood_axe', n:1}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'stone_pickaxe', n:1}, in:{wood:2, stone:3}, station:'crafting_table' },
  { out:{id:'stone_axe', n:1}, in:{wood:2, stone:3}, station:'crafting_table' },
  { out:{id:'furnace', n:1}, in:{stone:8}, station:'crafting_table' },
  { out:{id:'chest', n:1}, in:{wood:8}, station:'crafting_table' },
  { out:{id:'waypoint_stone', n:2}, in:{stone:8, lumen:1}, station:'crafting_table' }, // ファストトラベルの道標
  { out:{id:'grapple_hook', n:1}, in:{iron:3, string:2, wood:2}, station:'crafting_table' }, // 鉤縄(traversal)
  // 追加の特殊効果武器(ビルド多様化)
  { out:{id:'frostfang_blade', n:1}, in:{iron:5, shadow_crystal:4, lumen:1}, station:'enchant_table' },
  { out:{id:'emberfang_axe', n:1}, in:{iron:6, coal:6, gold_bar:1}, station:'enchant_table' },
  { out:{id:'echoedge', n:1}, in:{iron:5, shadow_steel:1, lumen:1}, station:'enchant_table' },
  { out:{id:'quakehammer', n:1}, in:{iron:8, stone:12, gold_bar:1}, station:'enchant_table' },
  { out:{id:'flashstep_edge', n:1}, in:{shadow_steel:2, shadow_crystal:6, lumen:3, gold_bar:2}, station:'enchant_table' },
  { out:{id:'voidrend_edge', n:1}, in:{shadow_steel:4, void_heart:1, shadow_crystal:10, lumen:4, gold_bar:4}, station:'enchant_table' },
  // 各武器種の特殊武器(かなり高レア)=一律に高価な付呪台レシピ。武器種ごとに素材の色を少し変える
  { out:{id:'thunderguard_hammer', n:1}, in:{star_metal:6, star_core:1, lumen:8, gold_bar:8}, station:'enchant_table' },
  { out:{id:'cataclysm_hammer', n:1}, in:{star_metal:6, shadow_core:2, sulfur:8, gold_bar:8}, station:'enchant_table' },
  { out:{id:'graveshatter_hammer', n:1}, in:{star_metal:7, shadow_steel:4, stone:20, gold_bar:8}, station:'enchant_table' },
  { out:{id:'runeforge_hammer', n:1}, in:{star_metal:6, shadow_core:2, lumen:6, gold_bar:8}, station:'enchant_table' },
  { out:{id:'stormpierce_spear', n:1}, in:{star_metal:5, star_core:1, lumen:8, gold_bar:6}, station:'enchant_table' },
  { out:{id:'dragoon_spear', n:1}, in:{star_metal:6, shadow_core:2, chitin:6, gold_bar:6}, station:'enchant_table' },
  { out:{id:'glacial_spear', n:1}, in:{star_metal:5, shadow_crystal:12, lumen:6, gold_bar:6}, station:'enchant_table' },
  { out:{id:'venomfang_spear', n:1}, in:{star_metal:5, void_heart:1, glow_spore:8, gold_bar:6}, station:'enchant_table' },
  { out:{id:'thundercleave_axe', n:1}, in:{star_metal:6, star_core:1, lumen:8, gold_bar:7}, station:'enchant_table' },
  { out:{id:'ragestorm_axe', n:1}, in:{star_metal:6, shadow_core:2, iron:20, gold_bar:7}, station:'enchant_table' },
  { out:{id:'frostbite_axe', n:1}, in:{star_metal:5, shadow_crystal:12, lumen:6, gold_bar:7}, station:'enchant_table' },
  { out:{id:'reaver_axe', n:1}, in:{star_metal:6, shadow_core:2, guts:8, gold_bar:7}, station:'enchant_table' },
  { out:{id:'soulreaper_scythe', n:1}, in:{star_metal:6, void_heart:1, shadow_core:3, gold_bar:7}, station:'enchant_table' },
  { out:{id:'deathwind_scythe', n:1}, in:{star_metal:6, shadow_core:3, lumen:6, gold_bar:7}, station:'enchant_table' },
  { out:{id:'plague_scythe', n:1}, in:{star_metal:5, void_heart:1, glow_spore:10, gold_bar:6}, station:'enchant_table' },
  { out:{id:'voidharvest_scythe', n:1}, in:{star_metal:6, void_heart:1, shadow_crystal:10, gold_bar:7}, station:'enchant_table' },
  { out:{id:'moonshadow_katana', n:1}, in:{star_metal:5, shadow_steel:5, lumen:8, gold_bar:6}, station:'enchant_table' },
  { out:{id:'thunderfang_katana', n:1}, in:{star_metal:5, star_core:1, lumen:8, gold_bar:6}, station:'enchant_table' },
  { out:{id:'crimson_katana', n:1}, in:{star_metal:5, shadow_core:2, sulfur:8, gold_bar:6}, station:'enchant_table' },
  { out:{id:'iai_kasumi', n:1}, in:{star_metal:6, void_heart:1, shadow_steel:5, gold_bar:8}, station:'enchant_table' },
  { out:{id:'combat_vest', n:1}, in:{iron:6, leather:4, string:3}, station:'crafting_table' },
  { out:{id:'reflect_aegis', n:1}, in:{shadow_steel:1, shadow_crystal:5, lumen:3, gold_bar:2}, station:'enchant_table' },
  { out:{id:'aqualung', n:1}, in:{iron:5, lumen:2, string:3, gold_bar:1}, station:'crafting_table' },
  { out:{id:'moon_charm', n:1}, in:{moonshard:8, lumen:2, gold_bar:1}, station:'enchant_table' },
  { out:{id:'iai_mumyo', n:1}, in:{shadow_steel:2, gold_bar:3, shadow_crystal:4, lumen:2}, station:'enchant_table' },
  { out:{id:'heavenfall_staff', n:1}, in:{star_core:1, gold_bar:3, shadow_crystal:5, lumen:3}, station:'enchant_table' },
  // 建築拡張
  { out:{id:'stone_wall', n:4}, in:{stone:4}, station:'crafting_table' },
  { out:{id:'garage_door', n:1}, in:{iron:4, steel_plate:1}, station:'crafting_table' },
  { out:{id:'landing_pad', n:2}, in:{stone:4, iron:2, lumen:1}, station:'crafting_table' },
  { out:{id:'hedge', n:4}, in:{wood:2, moonleaf:1}, station:'crafting_table' },
  { out:{id:'fountain', n:1}, in:{stone:12, lumen:1}, station:'crafting_table' },
  { out:{id:'lantern_post', n:2}, in:{wood:2, iron:1, coal:1}, station:'crafting_table' },
  { out:{id:'flowerbed', n:2}, in:{wood:1, moonleaf:2}, station:'crafting_table' },
  { out:{id:'scarecrow', n:1}, in:{wood:3, wheat:2, string:1}, station:'crafting_table' },
  { out:{id:'wood_stairs', n:4}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'trellis', n:2}, in:{wood:4}, station:'crafting_table' },
  // 農業拡張
  { out:{id:'watering_can', n:1}, in:{iron:2, wood:1}, station:'crafting_table' },
  { out:{id:'stasis_glass', n:1}, in:{lumen:2, shadow_crystal:1, gold_ore:1}, station:'enchant_table' }, // 時止めの砂時計
  { out:{id:'iron', n:1}, in:{iron_ore:1, coal:1}, station:'furnace' },
  { out:{id:'iron_pickaxe', n:1}, in:{iron:3, wood:2}, station:'crafting_table' },
  // 武器・道具
  { out:{id:'wood_sword', n:1}, in:{wood:2}, station:'crafting_table' },
  { out:{id:'stone_sword', n:1}, in:{wood:1, stone:2}, station:'crafting_table' },
  { out:{id:'iron_sword', n:1}, in:{wood:1, iron:2}, station:'crafting_table' },
  { out:{id:'iron_axe', n:1}, in:{wood:2, iron:3}, station:'crafting_table' },
  { out:{id:'wood_hoe', n:1}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'stone_hoe', n:1}, in:{wood:2, stone:2}, station:'crafting_table' },
  // 設備・設置物
  { out:{id:'campfire', n:1}, in:{wood:3, coal:1}, station:null },
  { out:{id:'lantern', n:1}, in:{iron:1, coal:1}, station:'crafting_table' },
  { out:{id:'fence', n:4}, in:{wood:2}, station:'crafting_table' },
  { out:{id:'door', n:1}, in:{wood:6}, station:'crafting_table' },
  { out:{id:'bed', n:1}, in:{wood:3, hide:3}, station:'crafting_table' },
  { out:{id:'sapling', n:1}, in:{wood:1}, station:null },
  // 食料・素材加工
  { out:{id:'cooked_meat', n:1}, in:{raw_meat:1, coal:1}, station:'furnace' },
  { out:{id:'cooked_meat', n:1}, in:{raw_meat:1}, station:'campfire' },
  { out:{id:'cooked_frog', n:1}, in:{frog_legs:1}, station:'campfire' },
  { out:{id:'cooked_snake', n:1}, in:{snake_meat:1}, station:'campfire' },
  { out:{id:'swamp_stew', n:1}, in:{glow_spore:2, frog_legs:1, carrot:1}, station:'campfire' },
  { out:{id:'mushroom_soup', n:1}, in:{luminous_cap:3, carrot:1}, station:'campfire' },
  { out:{id:'flower_tea', n:1}, in:{flower:3, berry:1}, station:'campfire' },
  { out:{id:'grilled_corn', n:1}, in:{corn:1}, station:'campfire' },
  { out:{id:'berry_pie', n:1}, in:{strawberry:3, wheat:2}, station:'campfire' },
  { out:{id:'harvest_stew', n:1}, in:{corn:1, carrot:1, tomato:1}, station:'campfire' },
  { out:{id:'mire_incense', n:1}, in:{glow_spore:3, guts:2, gold_bar:2}, station:'crafting_table' },
  { out:{id:'lava_shard', n:1}, in:{obsidian:3, sulfur:3, gold_bar:2}, station:'crafting_table' },
  { out:{id:'spore_sac', n:1}, in:{luminous_cap:3, glow_spore:3, gold_bar:2}, station:'crafting_table' },
  { out:{id:'bread', n:1}, in:{wheat:3}, station:'crafting_table' },
  // 種は野菜から増やせる（初回は旅商人から購入）
  { out:{id:'carrot_seeds', n:2}, in:{carrot:1}, station:null },
  { out:{id:'pumpkin_seeds', n:2}, in:{pumpkin:1}, station:null },
  { out:{id:'tomato_seeds', n:2}, in:{tomato:1}, station:null },
  // 調理
  { out:{id:'veg_salad', n:1}, in:{carrot:1, tomato:1, moonleaf:1}, station:'crafting_table' },
  { out:{id:'pumpkin_pie', n:1}, in:{pumpkin:2, wheat:2}, station:'furnace' },
  { out:{id:'veg_stew', n:1}, in:{cooked_meat:1, carrot:1, pumpkin:1}, station:'furnace' },
  { out:{id:'hearty_stew', n:1}, in:{cooked_meat:1, carrot:1, pumpkin:1, tomato:1}, station:'furnace' },
  { out:{id:'leather', n:1}, in:{hide:2}, station:'crafting_table' },
  // 防具
  { out:{id:'leather_helmet', n:1}, in:{leather:3}, station:'crafting_table' },
  { out:{id:'leather_chest', n:1}, in:{leather:5}, station:'crafting_table' },
  { out:{id:'iron_helmet', n:1}, in:{iron:4}, station:'crafting_table' },
  { out:{id:'iron_chest', n:1}, in:{iron:6}, station:'crafting_table' },
  // ===== 二相世界 =====
  { out:{id:'shadow_mirror', n:1}, in:{shadow_shard:8, iron:1}, station:'crafting_table' }, // シフト解禁
  { out:{id:'shadow_steel', n:1}, in:{shadow_crystal:1, iron:1}, station:'furnace' },
  { out:{id:'shadow_pickaxe', n:1}, in:{shadow_crystal:3, wood:2}, station:'crafting_table' },
  { out:{id:'shadow_axe', n:1}, in:{shadow_crystal:3, wood:2}, station:'crafting_table' },
  { out:{id:'shadow_blade', n:1}, in:{shadow_crystal:2, shadow_steel:1}, station:'crafting_table' },
  { out:{id:'shadow_helmet', n:1}, in:{shadow_steel:4}, station:'crafting_table' },
  { out:{id:'shadow_chest', n:1}, in:{shadow_steel:6}, station:'crafting_table' },
  { out:{id:'lumen_charm', n:1}, in:{lumen:3}, station:'crafting_table' },
  { out:{id:'lumen_lantern', n:2}, in:{lumen:2, iron:1}, station:'crafting_table' },
  { out:{id:'rift_anchor', n:1}, in:{shadow_crystal:2, iron:2}, station:'crafting_table' },
  { out:{id:'shadow_altar', n:1}, in:{shadow_steel:3, shadow_crystal:5}, station:'crafting_table' },
  { out:{id:'sanity_charm', n:1}, in:{shadow_core:1, lumen:5}, station:'crafting_table' },
  // 中間素材(㊱㊲: 銃/上位装備は部品を経て作る)
  { out:{id:'gunpowder', n:2}, in:{sulfur:2, coal:1}, station:'furnace' },
  { out:{id:'gun_parts', n:2}, in:{iron:3, gold_bar:1}, station:'crafting_table' },
  { out:{id:'steel_plate', n:2}, in:{iron:3, coal:2}, station:'furnace' },
  { out:{id:'rope', n:3}, in:{string:3}, station:'crafting_table' },
  { out:{id:'circuit', n:1}, in:{lumen:2, gold_bar:1, iron:1}, station:'crafting_table' },
  // 新規消費アイテム(㊲)
  { out:{id:'jerky', n:1}, in:{cooked_meat:1}, station:'campfire' },
  { out:{id:'fruit_salad', n:1}, in:{apple:1, berry:1, strawberry:1}, station:'crafting_table' },
  { out:{id:'energy_bar', n:2}, in:{berry:2, wheat:1}, station:'crafting_table' },
  { out:{id:'medkit', n:1}, in:{string:2, flower:2, lumen:1}, station:'crafting_table' },
  // 銃・弾・乗り物(㊱: 火薬・銃部品を要し簡単には作れない)
  { out:{id:'bullet', n:8}, in:{iron:1, gunpowder:1}, station:'crafting_table' },
  { out:{id:'pistol', n:1}, in:{iron:4, gun_parts:1, gunpowder:1, wood:1}, station:'crafting_table' },
  { out:{id:'shadow_rifle', n:1}, in:{shadow_steel:4, gun_parts:2, lumen:2}, station:'crafting_table' },
  { out:{id:'boat', n:1}, in:{wood:8}, station:'crafting_table' },
  // 現代の乗り物(ユーザー指示: 相当多い素材コスト。鉱石希少化と併せ「作る価値のある大目標」に)
  { out:{id:'car', n:1}, in:{iron:24, coal:12, gold_bar:2}, station:'crafting_table' },
  { out:{id:'buggy', n:1}, in:{iron:18, coal:8, string:4, gold_bar:1}, station:'crafting_table' },
  { out:{id:'tank', n:1}, in:{iron:48, shadow_steel:12, coal:18, gold_bar:5}, station:'crafting_table' },
  { out:{id:'battle_mech', n:1}, in:{iron:42, shadow_steel:14, lumen:12, gold_bar:5}, station:'crafting_table' },
  { out:{id:'fighter_jet', n:1}, in:{shadow_steel:22, iron:32, lumen:14, gold_bar:6}, station:'crafting_table' },
  { out:{id:'aircraft_gun', n:1}, in:{iron:8, gun_parts:4, gunpowder:3, steel_plate:2}, station:'crafting_table' },
  { out:{id:'nuke_launcher', n:1}, in:{iron:80, steel_plate:24, circuit:18, gun_parts:24, shadow_steel:18, gold_bar:16, star_metal:6}, station:'enchant_table' },
  { out:{id:'nuke_warhead', n:1}, in:{star_core:3, sulfur:24, circuit:12, gold_bar:12, void_heart:1, shadow_core:4}, station:'enchant_table' },
  { out:{id:'bomber', n:1}, in:{shadow_steel:20, iron:40, lumen:12, gold_bar:6}, station:'crafting_table' },
  { out:{id:'aerial_bomb', n:2}, in:{iron:4, sulfur:4, coal:3}, station:'furnace' },
  { out:{id:'heavy_bomb', n:1}, in:{iron:8, sulfur:6, coal:5, gold_bar:1}, station:'furnace' },
  { out:{id:'cannon_shell', n:4}, in:{iron:2, coal:2, sulfur:2}, station:'furnace' },
  { out:{id:'gasoline', n:3}, in:{coal:3, sulfur:1}, station:'furnace' },
  { out:{id:'repair_kit', n:1}, in:{iron:6, steel_plate:1, coal:2}, station:'crafting_table' }, // 修理を安直にしない(乗り物バランス)
  { out:{id:'plane', n:1}, in:{shadow_steel:18, iron:24, lumen:12, gold_bar:4}, station:'crafting_table' },
  // ロケット(最高コスト)・宇宙装備
  { out:{id:'rocket', n:1}, in:{iron:90, shadow_steel:45, lumen:45, shadow_core:12, gold_bar:18, circuit:10, steel_plate:12}, station:'crafting_table' },
  { out:{id:'cosmic_blade', n:1}, in:{star_metal:5, shadow_steel:3}, station:'crafting_table' },
  { out:{id:'starcore_greatsword', n:1}, in:{star_core:1, star_metal:4, iron:2}, station:'enchant_table' },
  { out:{id:'voidcore_blade', n:1}, in:{shadow_core:1, void_heart:1, shadow_steel:4}, station:'enchant_table' },
  { out:{id:'star_aegis', n:1}, in:{star_core:1, star_metal:6}, station:'enchant_table' },
  { out:{id:'void_helm', n:1}, in:{shadow_core:1, shadow_steel:4}, station:'enchant_table' },
  { out:{id:'star_cannon', n:1}, in:{star_metal:4, lumen:5}, station:'crafting_table' },
  { out:{id:'meteor_staff', n:1}, in:{star_metal:3, gold_bar:2, lumen:4}, station:'enchant_table' },
  { out:{id:'vortex_staff', n:1}, in:{shadow_core:2, shadow_crystal:5, lumen:4}, station:'enchant_table' },
  { out:{id:'end_key', n:1}, in:{shadow_core:3, star_core:2, void_heart:1, gold_bar:5}, station:'enchant_table' },
  { out:{id:'coin_charm', n:1}, in:{gold_bar:10, star_metal:2, lumen:5}, station:'enchant_table' },
  { out:{id:'shop_bell', n:1}, in:{gold_bar:3, iron:3, wood:5}, station:'crafting_table' },
  { out:{id:'gravity_boots', n:1}, in:{star_metal:4}, station:'crafting_table' },
  // 家具・家作り
  { out:{id:'healing_totem', n:1}, in:{lumen:3, wood:4}, station:'crafting_table' },
  { out:{id:'street_lamp', n:2}, in:{iron:1, coal:1}, station:'crafting_table' },
  { out:{id:'table', n:1}, in:{wood:4}, station:'crafting_table' },
  { out:{id:'chair', n:1}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'bookshelf', n:1}, in:{wood:6}, station:'crafting_table' },
  { out:{id:'glass', n:4}, in:{stone:2}, station:'furnace' },
  { out:{id:'rug', n:2}, in:{hide:2}, station:'crafting_table' },
  { out:{id:'banner', n:1}, in:{string:2, wood:1}, station:'crafting_table' },
  { out:{id:'brazier', n:1}, in:{stone:3, coal:1}, station:'crafting_table' },
  { out:{id:'barrel', n:1}, in:{wood:4}, station:'crafting_table' },
  { out:{id:'powder_keg', n:1}, in:{gunpowder:3, wood:2, iron:1}, station:'crafting_table' },
  { out:{id:'potted_plant', n:1}, in:{wood:1, flower:1}, station:'crafting_table' },
  { out:{id:'unity_core', n:1}, in:{shadow_core:3, lumen:10, shadow_crystal:10}, station:'crafting_table' }, // 世界統合
  // 建築・自由度
  { out:{id:'wood_floor', n:4}, in:{wood:1}, station:null },
  { out:{id:'stone_floor', n:4}, in:{stone:1}, station:null },
  { out:{id:'wall', n:2}, in:{wood:2}, station:null },
  { out:{id:'window', n:2}, in:{wood:1, stone:1}, station:'crafting_table' },
  { out:{id:'bridge', n:4}, in:{wood:2}, station:null },
  { out:{id:'sign', n:1}, in:{wood:2}, station:null },
  { out:{id:'bounty_board', n:1}, in:{wood:8, iron:1}, station:'crafting_table' },
  // 治療・防寒
  { out:{id:'bandage', n:2}, in:{string:2}, station:null },
  { out:{id:'antidote', n:1}, in:{moonleaf:2, flower:1}, station:null },
  { out:{id:'recall_scroll', n:1}, in:{string:1, lumen:1, shadow_shard:1}, station:'crafting_table' },
  { out:{id:'antidote', n:2}, in:{glow_spore:3, bone:1}, station:null },
  { out:{id:'strength_potion', n:1}, in:{flower:2, bone:1}, station:'crafting_table' },
  { out:{id:'swift_potion', n:1}, in:{flower:1, moonleaf:1}, station:'crafting_table' },
  { out:{id:'iron_potion', n:1}, in:{iron:1, flower:1}, station:'crafting_table' },
  { out:{id:'regen_potion', n:1}, in:{moonleaf:2, lumen:1}, station:'crafting_table' },
  { out:{id:'bomb', n:1}, in:{iron:2, coal:2}, station:'crafting_table' },
  { out:{id:'molotov', n:1}, in:{coal:1, string:1, hide:1}, station:'crafting_table' },
  { out:{id:'poison_flask', n:2}, in:{glow_spore:2, string:1}, station:'crafting_table' },
  { out:{id:'flash_bomb', n:2}, in:{sulfur:2, string:1}, station:'crafting_table' },
  { out:{id:'frost_grenade', n:2}, in:{shadow_crystal:1, string:1}, station:'crafting_table' },
  { out:{id:'thunder_orb', n:2}, in:{lumen:2, sulfur:1, string:1}, station:'crafting_table' },
  { out:{id:'molotov', n:2}, in:{sulfur:2, string:1}, station:'crafting_table' },
  { out:{id:'obsidian_blade', n:1}, in:{obsidian:3, iron:1}, station:'crafting_table' },
  { out:{id:'fur_coat', n:1}, in:{hide:5}, station:'crafting_table' },
  { out:{id:'enchant_table', n:1}, in:{shadow_steel:2, lumen:3}, station:'crafting_table' },
  { out:{id:'leather', n:1}, in:{guts:2}, station:'crafting_table' },
  // ===== P25: コンテンツ拡張レシピ =====
  { out:{id:'gold_bar', n:1}, in:{gold_ore:1, coal:1}, station:'furnace' },
  { out:{id:'bone_club', n:1}, in:{bone:3, wood:1}, station:null },
  { out:{id:'gold_sword', n:1}, in:{gold_bar:2, wood:1}, station:'crafting_table' },
  { out:{id:'war_hammer', n:1}, in:{iron:4, wood:2}, station:'crafting_table' },
  { out:{id:'crystal_blade', n:1}, in:{shadow_crystal:4, shadow_steel:2}, station:'crafting_table' },
  { out:{id:'chitin_spear', n:1}, in:{chitin:3, wood:2}, station:'crafting_table' },
  { out:{id:'gold_helmet', n:1}, in:{gold_bar:3}, station:'crafting_table' },
  { out:{id:'gold_chest', n:1}, in:{gold_bar:5}, station:'crafting_table' },
  { out:{id:'crystal_helmet', n:1}, in:{shadow_crystal:3, shadow_steel:2}, station:'crafting_table' },
  { out:{id:'crystal_chest', n:1}, in:{shadow_crystal:5, shadow_steel:3}, station:'crafting_table' },
  { out:{id:'star_helmet', n:1}, in:{star_metal:3}, station:'crafting_table' },
  { out:{id:'chitin_armor', n:1}, in:{chitin:5}, station:'crafting_table' },
  // ===== P32 弾薬(大口径ほど高コスト)＋実銃 =====
  { out:{id:'ammo_9mm', n:8}, in:{iron:1, gunpowder:1}, station:'crafting_table' },
  { out:{id:'ammo_556', n:6}, in:{iron:1, gunpowder:1}, station:'crafting_table' },
  { out:{id:'ammo_762', n:6}, in:{iron:2, gunpowder:1}, station:'crafting_table' },
  { out:{id:'shell_12g', n:5}, in:{iron:1, gunpowder:1}, station:'crafting_table' },
  { out:{id:'ammo_50', n:4}, in:{iron:3, gunpowder:2}, station:'crafting_table' },
  { out:{id:'rocket_ammo', n:1}, in:{iron:5, coal:3, gold_bar:1}, station:'crafting_table' },
  // 銃(遠距離で強力)は制作コストを引き上げ(ユーザー指示)
  { out:{id:'glock17', n:1}, in:{iron:5, gun_parts:2, gunpowder:2, wood:1}, station:'crafting_table' },
  { out:{id:'mp5', n:1}, in:{iron:8, gun_parts:3, gunpowder:3, steel_plate:1}, station:'crafting_table' },
  { out:{id:'m4', n:1}, in:{iron:10, gun_parts:4, gunpowder:3, steel_plate:2, coal:2}, station:'crafting_table' },
  { out:{id:'ak47', n:1}, in:{iron:12, gun_parts:4, gunpowder:4, steel_plate:2}, station:'crafting_table' },
  { out:{id:'m870', n:1}, in:{iron:8, gun_parts:2, gunpowder:3, wood:3}, station:'crafting_table' },
  { out:{id:'deagle', n:1}, in:{iron:6, gun_parts:3, gunpowder:2, gold_bar:2}, station:'crafting_table' },
  { out:{id:'uzi', n:1}, in:{iron:7, gun_parts:3, gunpowder:3, steel_plate:1}, station:'crafting_table' },
  { out:{id:'p90', n:1}, in:{iron:9, gun_parts:4, gunpowder:3, steel_plate:2}, station:'crafting_table' },
  { out:{id:'scar_h', n:1}, in:{iron:12, gun_parts:5, gunpowder:4, steel_plate:2}, station:'crafting_table' },
  { out:{id:'spas12', n:1}, in:{iron:10, gun_parts:3, gunpowder:4, wood:2}, station:'crafting_table' },
  { out:{id:'minigun', n:1}, in:{iron:20, gun_parts:8, gunpowder:6, steel_plate:4, gold_bar:3, shadow_steel:4}, station:'crafting_table' }, // 影世界ゲート(高DPS武器の素通り防止)
  { out:{id:'m79', n:1}, in:{iron:10, gun_parts:4, gunpowder:6, steel_plate:1}, station:'crafting_table' },
  { out:{id:'he_launcher', n:1}, in:{iron:14, gun_parts:5, steel_plate:3, gunpowder:4}, station:'crafting_table' },
  { out:{id:'he_slug', n:4}, in:{steel_plate:1, iron:2, gunpowder:2}, station:'crafting_table' },
  { out:{id:'star_shell', n:6}, in:{star_metal:1, gunpowder:2}, station:'crafting_table' },
  { out:{id:'missile', n:2}, in:{iron:6, steel_plate:1, gunpowder:4, gun_parts:1}, station:'crafting_table' },
  { out:{id:'homing_missile', n:2}, in:{missile:2, circuit:3, gun_parts:1}, station:'crafting_table' },
  { out:{id:'lockon_launcher', n:1}, in:{iron:18, steel_plate:4, gun_parts:6, circuit:3, gold_bar:2}, station:'crafting_table' },
  { out:{id:'flamethrower', n:1}, in:{iron:10, gun_parts:3, steel_plate:2, sulfur:4}, station:'crafting_table' },
  { out:{id:'plasma_rifle', n:1}, in:{iron:8, circuit:4, lumen:6, gun_parts:5, star_metal:1}, station:'crafting_table' },
  { out:{id:'barrett', n:1}, in:{iron:20, gold_bar:5, shadow_steel:2}, station:'crafting_table' },
  { out:{id:'rpg7', n:1}, in:{iron:24, gold_bar:6, shadow_steel:3}, station:'crafting_table' },
  // ===== P33 ワクワク武器 =====
  { out:{id:'energy_cell', n:4}, in:{lumen:1, iron:1}, station:'crafting_table' },
  { out:{id:'wind_blade', n:1}, in:{iron:5, lumen:1}, station:'crafting_table' },
  { out:{id:'thunder_sword', n:1}, in:{iron:6, lumen:2, gold_bar:1}, station:'crafting_table' },
  { out:{id:'boomerang_axe', n:1}, in:{iron:5, wood:3}, station:'crafting_table' },
  { out:{id:'crescent_twinblade', n:1}, in:{iron:6, lumen:2, shadow_shard:3}, station:'crafting_table' },
  { out:{id:'laser_rifle', n:1}, in:{iron:6, lumen:4, circuit:2, gun_parts:2}, station:'crafting_table' },
  { out:{id:'railgun', n:1}, in:{iron:10, star_metal:2, lumen:4, circuit:3, gun_parts:4}, station:'crafting_table' },
  // ===== 空島(スカイエンクレーブ) =====
  // 風の羽根: ハーピー/雲鷹の羽根と光素で編む(空島への鍵)。光素は氷窟/水晶洞や影世界で採れる
  { out:{id:'wind_feather', n:1}, in:{feather:5, lumen:2}, station:'crafting_table' },
  { out:{id:'wind_steel', n:1}, in:{wind_crystal:2, iron:1}, station:'furnace' },
  { out:{id:'wind_sword', n:1}, in:{wind_steel:3, wood:1}, station:'crafting_table' },
  { out:{id:'sky_cloak', n:1}, in:{feather:6, wind_steel:2, string:2}, station:'crafting_table' },
  { out:{id:'cloud_boots', n:1}, in:{feather:3, wind_steel:1, hide:2}, station:'crafting_table' },
  // 古代都市: 古の鍵で門をひらき、遺物のかけらを合金にして装備を鍛える
  { out:{id:'gate_key', n:1}, in:{gold_ore:3, lumen:2}, station:'crafting_table' }, // 都市外で入手できる素材(門に入る前に作れる)
  { out:{id:'ancient_alloy', n:1}, in:{relic_shard:2, iron:1}, station:'furnace' },
  { out:{id:'ruin_blade', n:1}, in:{ancient_alloy:3, wood:1}, station:'crafting_table' },
  { out:{id:'warden_plate', n:1}, in:{ancient_alloy:4, iron:2}, station:'crafting_table' },
  { out:{id:'thorn_plate', n:1}, in:{iron:6, cactus:4, obsidian:2}, station:'crafting_table' },
  { out:{id:'ancient_charm', n:1}, in:{relic_shard:4, gold_ore:2, lumen:1}, station:'crafting_table' },
  // 狭間: 虚ろな鍵で裂け目をひらき、虚無晶を合金にして最上位装備を鍛える(影核=影世界要素で後半ゲート)
  { out:{id:'void_key', n:1}, in:{shadow_core:1, lumen:3}, station:'crafting_table' },
  { out:{id:'void_alloy', n:1}, in:{void_shard:2, shadow_crystal:1}, station:'furnace' },
  { out:{id:'rift_blade', n:1}, in:{void_alloy:3, shadow_steel:1}, station:'enchant_table' },
  { out:{id:'void_shroud', n:1}, in:{void_alloy:4, shadow_crystal:2}, station:'crafting_table' },
  { out:{id:'rift_charm', n:1}, in:{void_shard:4, lumen:2}, station:'crafting_table' },
];

// 装備セット効果（head+chest が同セットで発動）
Game.SETS = {
  leather: { name:'革装束', items:['leather_helmet','leather_chest'], hungerSlow:0.5, moveSpd:0.05 },
  iron:    { name:'鉄装束', items:['iron_helmet','iron_chest'], armor:2 },
  shadow:  { name:'影鋼装束', items:['shadow_helmet','shadow_chest'], armor:1, sanityResist:true, lifesteal:0.04 },
  gold:    { name:'黄金装束', items:['gold_helmet','gold_chest'], armor:1, hungerSlow:0.3, crit:0.04 },
  crystal: { name:'影晶装束', items:['crystal_helmet','crystal_chest'], armor:2, sanityResist:true, crit:0.05 },
  star:    { name:'星鋼装束', items:['star_helmet','gravity_boots'], armor:3, moveSpd:0.06, crit:0.05 },
};

// スキルツリー（4系統・前提あり）。スキルポイントで習得、振り直しは記憶の書
Game.SKILL_TREE = [
  { id:'w1', branch:'war', name:'力の心得', tier:1, cost:1, req:[], eff:{atk:2}, desc:'攻撃+2' },
  { id:'w2', branch:'war', name:'鋭刃', tier:2, cost:2, req:['w1'], eff:{atk:3}, desc:'攻撃+3' },
  { id:'w3', branch:'war', name:'会心の極み', tier:2, cost:2, req:['w1'], eff:{crit:0.12}, desc:'会心率+12%(2倍)' },
  { id:'w4', branch:'war', name:'旋風斬り', tier:3, cost:3, req:['w2'], eff:{flag:'aoe'}, desc:'近接が周囲の敵全てに当たる' },
  { id:'w5', branch:'war', name:'吸血', tier:3, cost:3, req:['w3'], eff:{lifesteal:0.12}, desc:'与ダメの一部を回復' },
  { id:'w6', branch:'war', name:'狂戦士', tier:4, cost:4, req:['w4','w5'], eff:{atk:6, crit:0.08}, desc:'攻撃+6・会心+8%' },
  { id:'g1', branch:'guard', name:'頑健', tier:1, cost:1, req:[], eff:{hp:20}, desc:'最大HP+20' },
  { id:'g2', branch:'guard', name:'鉄壁', tier:2, cost:2, req:['g1'], eff:{armor:3}, desc:'防御+3' },
  { id:'g3', branch:'guard', name:'不屈', tier:2, cost:2, req:['g1'], eff:{regen:1}, desc:'自然回復+1' },
  { id:'g4', branch:'guard', name:'重装', tier:3, cost:3, req:['g2'], eff:{armor:2, hp:10}, desc:'防御+2・HP+10' },
  { id:'g5', branch:'guard', name:'守護霊', tier:4, cost:4, req:['g3','g4'], eff:{armor:4, hp:30}, desc:'防御+4・HP+30' },
  { id:'s1', branch:'surv', name:'健脚', tier:1, cost:1, req:[], eff:{moveSpd:0.12}, desc:'移動速度+12%' },
  { id:'s2', branch:'surv', name:'採掘の達人', tier:2, cost:2, req:['s1'], eff:{mining:1}, desc:'採掘速度UP' },
  { id:'s3', branch:'surv', name:'採取の達人', tier:2, cost:2, req:['s1'], eff:{flag:'forager'}, desc:'戦利品の質UP' },
  { id:'s4', branch:'surv', name:'健啖家', tier:3, cost:3, req:['s2'], eff:{hungerSlow:0.4}, desc:'空腹が減りにくい' },
  { id:'s5', branch:'surv', name:'体力増強', tier:3, cost:3, req:['s3'], eff:{staminaMax:50}, desc:'最大スタミナ+50' },
  { id:'s6', branch:'surv', name:'サバイバー', tier:4, cost:4, req:['s4','s5'], eff:{hp:20, moveSpd:0.08}, desc:'HP+20・移動+8%' },
  { id:'a1', branch:'arcane', name:'探究心', tier:1, cost:1, req:[], eff:{xpBoost:0.15}, desc:'獲得経験値+15%' },
  { id:'a2', branch:'arcane', name:'精神統一', tier:2, cost:2, req:['a1'], eff:{flag:'sanityResist'}, desc:'影で正気が減りにくい' },
  { id:'a3', branch:'arcane', name:'魔の冴え', tier:2, cost:2, req:['a1'], eff:{crit:0.1}, desc:'会心率+10%' },
  { id:'a4', branch:'arcane', name:'生命錬成', tier:3, cost:3, req:['a3'], eff:{lifesteal:0.08, hp:10}, desc:'吸血+8%・HP+10' },
  { id:'a5', branch:'arcane', name:'賢者', tier:4, cost:4, req:['a2','a4'], eff:{atk:3, hp:20, xpBoost:0.15}, desc:'攻撃+3・HP+20・経験+15%' },
  // ===== P41 スキルツリー拡張: 中間ノード＋tier5アルティメット =====
  { id:'w7', branch:'war', name:'豪腕', tier:3, cost:3, req:['w2'], eff:{atk:4}, desc:'攻撃+4' },
  { id:'w8', branch:'war', name:'剣聖', tier:5, cost:5, req:['w6'], eff:{atk:8, crit:0.1, lifesteal:0.08}, desc:'攻撃+8・会心+10%・吸血+8%' },
  { id:'g6', branch:'guard', name:'生命力', tier:3, cost:3, req:['g1'], eff:{hp:25}, desc:'最大HP+25' },
  { id:'g7', branch:'guard', name:'不滅の城壁', tier:5, cost:5, req:['g5'], eff:{armor:6, hp:40, regen:1}, desc:'防御+6・HP+40・回復+1' },
  { id:'s7', branch:'surv', name:'軽身', tier:3, cost:3, req:['s1'], eff:{moveSpd:0.1, staminaMax:30}, desc:'移動+10%・スタミナ+30' },
  { id:'s8', branch:'surv', name:'放浪の達人', tier:5, cost:5, req:['s6'], eff:{moveSpd:0.15, hp:30, mining:1, flag:'forager'}, desc:'移動+15%・HP+30・採掘UP・採取UP' },
  { id:'a6', branch:'arcane', name:'明鏡止水', tier:3, cost:3, req:['a1'], eff:{crit:0.08, xpBoost:0.1}, desc:'会心+8%・経験+10%' },
  { id:'a7', branch:'arcane', name:'大賢者', tier:5, cost:5, req:['a5'], eff:{atk:5, hp:30, xpBoost:0.25, lifesteal:0.08}, desc:'攻撃+5・HP+30・経験+25%・吸血+8%' },
  // ===== ㊶ マナ(魔法)系統: 杖/魔法攻撃の資源。最大値/回復/消費減/魔法威力 =====
  { id:'mn1', branch:'mana', name:'魔力の器', tier:1, cost:1, req:[], eff:{manaMax:30}, desc:'最大マナ+30' },
  { id:'mn2', branch:'mana', name:'精霊の加護', tier:2, cost:2, req:['mn1'], eff:{manaRegen:0.4}, desc:'マナ自然回復+0.4/tick' },
  { id:'mn3', branch:'mana', name:'魔法の冴え', tier:2, cost:2, req:['mn1'], eff:{magicPower:0.15}, desc:'魔法ダメージ+15%' },
  { id:'mn4', branch:'mana', name:'魔力節制', tier:3, cost:3, req:['mn2'], eff:{manaCostCut:0.2}, desc:'魔法のマナ消費-20%' },
  { id:'mn5', branch:'mana', name:'大魔道', tier:4, cost:4, req:['mn3','mn4'], eff:{magicPower:0.25, manaMax:40}, desc:'魔法ダメージ+25%・最大マナ+40' },
  { id:'mn6', branch:'mana', name:'賢者の秘奥', tier:5, cost:5, req:['mn5'], eff:{magicPower:0.4, manaMax:60, manaCostCut:0.2, manaRegen:0.4}, desc:'魔法+40%・最大マナ+60・消費-20%・回復+0.4' },
];
// 上位スキルはより多くのスキルポイントを要求(ユーザー指示)。序盤(tier1-2)は据え置き、tier3以降を段階的に重く。
// 強力な終盤スキルを"投資"にし、レベリングの目標感を持たせる。desc末尾のコストは UI 側が cost を参照するので自動追従。
// 必要スキルP正規化はツリー生成/追加が全て終わった後(末尾)で一括適用する。ここでは適用しない
// ===== スキルツリー大幅拡充(生成): 既存30 + 生成126 = 156ノード。数値は控えめ(インフレ防止) =====
(function () {
  const T = Game.SKILL_TREE;
  const STATWORD = { atk: '力', crit: '鋭', lifesteal: '吸', hp: '命', armor: '盾', regen: '癒', moveSpd: '疾', mining: '掘', staminaMax: '活', hungerSlow: '糧', xpBoost: '智' };
  const LABEL = { atk: '攻撃', crit: '会心', lifesteal: '吸血', hp: '最大HP', armor: '防御', regen: '回復', moveSpd: '移動', mining: '採掘', staminaMax: 'スタミナ', hungerSlow: '空腹緩和', xpBoost: '経験' };
  const PCT = { crit: 1, lifesteal: 1, moveSpd: 1, xpBoost: 1, hungerSlow: 1 };
  const RANK = ['', '初', '弐', '参', '肆', '伍'];
  const BR = [
    { b: 'war', word: '剣', pool: [['atk', 1], ['crit', 0.02], ['lifesteal', 0.015]] },
    { b: 'guard', word: '盾', pool: [['hp', 6], ['armor', 1], ['regen', 0.2]] },
    { b: 'surv', word: '探', pool: [['moveSpd', 0.02], ['mining', 0.25], ['staminaMax', 8], ['hungerSlow', 0.04]] },
    { b: 'arcane', word: '魔', pool: [['xpBoost', 0.04], ['crit', 0.02], ['hp', 5]] },
    { b: 'hunter', word: '狩', pool: [['atk', 1], ['crit', 0.025], ['moveSpd', 0.02]] },
    { b: 'mystic', word: '幽', pool: [['lifesteal', 0.02], ['xpBoost', 0.04], ['crit', 0.02], ['hp', 5]] },
    { b: 'fortune', word: '福', pool: [['mining', 0.3], ['xpBoost', 0.03], ['hp', 6], ['staminaMax', 8]] },
  ];
  const perTier = [4, 4, 4, 3, 3];
  function rnd(key, v) { return PCT[key] ? Math.round(v * 100) / 100 : Math.round(v); }
  BR.forEach(function (def) {
    let prev = [];
    for (let t = 1; t <= 5; t++) {
      const cnt = perTier[t - 1], cur = [];
      for (let i = 0; i < cnt; i++) {
        const id = 'gx_' + def.b + '_' + t + '_' + i;
        const nStats = (t >= 3 && i % 2 === 0) ? 2 : 1;
        const eff = {}, dparts = [];
        for (let k = 0; k < nStats; k++) {
          const ps = def.pool[(i + k) % def.pool.length], key = ps[0];
          eff[key] = rnd(key, (eff[key] || 0) + ps[1] * t);
        }
        for (const kk in eff) dparts.push(LABEL[kk] + '+' + (PCT[kk] ? Math.round(eff[kk] * 100) + '%' : eff[kk]));
        const primary = Object.keys(eff)[0];
        const name = def.word + STATWORD[primary] + (t > 1 ? RANK[t] : '') + (i > 0 ? '・' + (i + 1) : '');
        const req = t === 1 ? [] : [prev[i % prev.length]];
        T.push({ id: id, branch: def.b, name: name, tier: t, cost: t, req: req, eff: eff, desc: dparts.join('・') });
        cur.push(id);
      }
      prev = cur;
    }
  });
})();

// ===== パッシブ(自動発動)スキル: 各系統の最上位に配置。数値は控えめ・CDあり =====
Game.SKILL_TREE.push(
  { id:'p_focus',    branch:'war',    name:'集中',   tier:5, cost:4, req:['w6'], eff:{flag:'focus'},    desc:'10秒間 被弾しないと次の一撃が会心確定' },
  { id:'p_counter',  branch:'guard',  name:'逆襲',   tier:5, cost:4, req:['g5'], eff:{flag:'counter'},  desc:'HP30%未満で被弾時 周囲に衝撃波(CD30秒)' },
  { id:'p_tenacity', branch:'guard',  name:'執念',   tier:5, cost:5, req:['g7'], eff:{flag:'tenacity'}, desc:'致死ダメージを1度だけHP1で耐える(CD3分)' },
  { id:'p_tailwind', branch:'surv',   name:'追い風', tier:5, cost:4, req:['s6'], eff:{flag:'tailwind'}, desc:'敵を倒すと3秒間 移動+8%(重複なし)' },
  { id:'p_mend',     branch:'arcane', name:'快癒',   tier:5, cost:4, req:['a5'], eff:{flag:'mend'},     desc:'受ける状態異常の持続時間-25%' },
  { id:'p_conserve', branch:'hunter', name:'節約',   tier:5, cost:4, req:['gx_hunter_4_0'], eff:{flag:'conserve'}, desc:'射撃の12%で弾薬を消費しない' }
);

// 弾薬アイテムID(戦術ベスト装備で1スロット上限2倍の対象)
Game.AMMO_IDS = ['bullet', 'ammo_9mm', 'ammo_556', 'ammo_762', 'ammo_50', 'shell_12g', 'rocket_ammo', 'energy_cell'];

// 必要スキルP: 同じ段(tier)は必ず同一コストに揃える(高い方=設計値に統一)。
// 手書き/自動生成/追加パッシブでバラついていたのを、全スキル追加後に一括正規化して解消。
(function () { const C = { 1: 2, 2: 4, 3: 16, 4: 24, 5: 40 }; Game.SKILL_TREE.forEach(function (n) { if (C[n.tier]) n.cost = C[n.tier]; }); })();

Game.SKILL_BY_ID = {};
Game.SKILL_TREE.forEach(function (n) { Game.SKILL_BY_ID[n.id] = n; });
Game.SKILL_BRANCHES = [['war', '⚔ 剣'], ['guard', '🛡 守'], ['surv', '🌿 探'], ['arcane', '✦ 秘'], ['mana', '🔮 魔'], ['hunter', '🏹 狩'], ['mystic', '🌓 幽'], ['fortune', '💰 福']];
Game.MAX_LEVEL = 9999;

// 難易度（自由度: のんびり建築〜高難度）
Game.DIFFICULTIES = {
  peaceful: { name:'のんびり', desc:'敵が出ず、正気では死なない。建築と探索を満喫', spawnHostiles:false, sanityKill:false, dmgMult:0 },
  normal:   { name:'ふつう', desc:'標準のサバイバル', spawnHostiles:true, sanityKill:true, dmgMult:1 },
  hard:     { name:'ハード', desc:'敵は硬く精鋭も出やすい。報酬は経験値+20%', spawnHostiles:true, sanityKill:true, dmgMult:1.4, hpMult:1.35, eliteMult:1.6, xpMult:1.2 },
};

// モブ定義
Game.MOBS = {
  rabbit:   { name:'うさぎ', hostile:false, hp:4,  speed:1.6, color:'#d8cfc0', size:7,  drops:[{item:'raw_meat',n:[1,1]},{item:'hide',n:[0,1]}], flee:true, xp:1 },
  gold_thief:{ name:'金喰い', hostile:false, hp:46, speed:2.7, color:'#ffd24a', size:13, drops:[{item:'gold_bar',n:[3,6]},{item:'kokuhen',n:[0,1]}], skittish:true, shape:'beast', xp:30 },
  deer:     { name:'鹿', hostile:false, hp:8,  speed:1.4, color:'#a9762f', size:11, drops:[{item:'raw_meat',n:[1,3]},{item:'hide',n:[1,2]}], flee:true, xp:2 },
  sheep:    { name:'羊', hostile:false, hp:6,  speed:1.0, color:'#eee', size:10, drops:[{item:'raw_meat',n:[1,2]},{item:'hide',n:[1,2]}], flee:true, xp:1 },
  slime:    { name:'スライム', hostile:true, hp:8,  speed:1.1, color:'#5fc46b', size:12, drops:[{item:'slime_ball',n:[1,2]},{item:'shadow_shard',n:[0,1]}], dmg:2, hop:true, xp:2, split:{max:2} },
  zombie:   { name:'ゾンビ', hostile:true, hp:14, speed:1.3, color:'#4a7a4a', size:11, drops:[{item:'raw_meat',n:[0,1]},{item:'guts',n:[0,1]},{item:'shadow_shard',n:[0,1]}], dmg:4, xp:3, inflict:{infection:200} },
  skeleton: { name:'スケルトン', hostile:true, hp:12, speed:1.5, color:'#dcdcd0', size:10, drops:[{item:'bone',n:[1,3]},{item:'shadow_shard',n:[0,1]}], dmg:3, xp:3, ranged:{dmg:4,range:7,cd:90,kind:'bullet'} },
  spider:   { name:'クモ', hostile:true, hp:10, speed:2.2, color:'#3a2a3a', size:12, drops:[{item:'string',n:[1,2]},{item:'shadow_shard',n:[0,1]}], dmg:3, xp:3 },
  // 影世界固有モブ
  wraith:   { name:'影霊', hostile:true, hp:16, speed:2.0, color:'#6a4f9a', size:11, drops:[{item:'shadow_shard',n:[1,2]}], dmg:5, xp:4, shadow:true, ghost:true },
  shade_stalker:{ name:'影縫い', hostile:true, hp:22, speed:1.6, color:'#8a40d0', size:11, drops:[{item:'shadow_shard',n:[1,3]},{item:'shadow_crystal',n:[0,1]}], dmg:6, xp:6, shadow:true, ghost:true, shape:'wisp', blink:{cd:90} },
  watcher:  { name:'見張り目', hostile:true, hp:24, speed:0.8, color:'#241a3a', size:13, drops:[{item:'shadow_crystal',n:[0,2]},{item:'shadow_shard',n:[1,1]}], dmg:6, xp:5, shadow:true },
  // ボスと手下
  sovereign:{ name:'影の主', hostile:true, hp:560, tier:1, speed:1.4, color:'#7a30c0', size:30, drops:[{item:'shadow_core',n:[2,4]},{item:'shadow_steel',n:[4,8]},{item:'shadow_crystal',n:[5,10]},{item:'warp_staff',n:[0,1]},{item:'mind_tome',n:[0,1]},{item:'excalibur',n:[0,1]}], dmg:10, xp:60, shadow:true, boss:true },
  shadow_spawn:{ name:'影の落とし子', hostile:true, hp:6, speed:2.4, color:'#5a3a8a', size:8, drops:[{item:'shadow_shard',n:[0,1]}], dmg:3, xp:1, shadow:true, ghost:true },
  // 深層の徘徊者（影の深層でのみ出現）
  abyss_stalker:{ name:'深淵の徘徊者', hostile:true, hp:34, speed:2.0, color:'#48206a', size:15, drops:[{item:'shadow_crystal',n:[1,3]},{item:'lumen',n:[0,2]},{item:'shadow_core',n:[0,1]}], dmg:8, xp:8, shadow:true },
  // グロ: 蛭（出血+感染）
  leech:    { name:'蛭', hostile:true, hp:5, speed:2.3, color:'#5a2030', size:7, drops:[{item:'guts',n:[1,2]}], dmg:2, xp:2, inflict:{bleed:240, infection:300} },
  // 深層の徘徊ボス
  hunger_beast:{ name:'飢餓の獣', hostile:true, hp:520, tier:2, speed:1.7, color:'#7a1840', size:26, drops:[{item:'void_heart',n:[1,2]},{item:'shadow_core',n:[1,3]},{item:'shadow_crystal',n:[3,6]},{item:'guts',n:[2,4]},{item:'flame_staff',n:[0,1]}], dmg:9, xp:35, shadow:true, big:true, boss:true, summon:'leech', inflict:{bleed:300} },
  // ダンジョン系
  frost_wisp:{ name:'氷霊', hostile:true, hp:10, speed:1.6, color:'#9fd8ff', size:9, drops:[{item:'lumen',n:[0,1]},{item:'bone',n:[0,1]}], dmg:3, xp:3, inflict:{cold:240} },
  cursed_armor:{ name:'呪鎧', hostile:true, hp:30, speed:0.9, color:'#7a7a86', size:13, drops:[{item:'iron',n:[1,3]},{item:'iron_ore',n:[1,2]}], dmg:6, xp:5 },
  // 宇宙
  void_drone:{ name:'虚空ドローン', hostile:true, hp:18, speed:2.2, color:'#7fa0d0', size:10, drops:[{item:'star_metal',n:[0,2]},{item:'lumen',n:[0,1]}], dmg:5, xp:5, space:true, ghost:true },
  star_guardian:{ name:'星の守護者', hostile:true, hp:880, tier:3, speed:1.4, color:'#cfe0ff', size:30, drops:[{item:'star_core',n:[2,4]},{item:'star_metal',n:[6,12]},{item:'flying_carpet',n:[0,1]},{item:'frost_staff',n:[0,1]},{item:'gate_babylon',n:[0,1]},{item:'wisdom_tome',n:[0,1]}], dmg:11, xp:80, space:true, big:true, boss:true, summon:'void_drone' },
  // 友好NPC: 謎の旅人
  wanderer: { name:'謎の旅人', hostile:false, hp:20, speed:1.0, color:'#caa84a', size:11, drops:[], xp:0, friendly:true, npc:true },
  // ===== P25 コンテンツ拡張: 新モブ =====
  boar:     { name:'猪', hostile:true, hp:18, speed:1.8, color:'#8a6a4a', size:12, drops:[{item:'raw_meat',n:[1,3]},{item:'hide',n:[1,2]}], dmg:5, xp:4 },
  bat:      { name:'コウモリ', hostile:true, hp:6, speed:2.6, color:'#4a3a4a', size:7, drops:[{item:'guts',n:[0,1]},{item:'string',n:[0,1]}], dmg:2, xp:2, ghost:true },
  bandit:   { name:'山賊', hostile:true, hp:22, speed:1.6, color:'#7a5a3a', size:11, drops:[{item:'gold_bar',n:[0,2]},{item:'iron',n:[0,2]},{item:'bone',n:[0,1]}], dmg:6, xp:6 },
  mimic:    { name:'ミミック', hostile:true, hp:55, speed:1.15, color:'#9c6b3f', size:14, drops:[{item:'gold_bar',n:[2,4]},{item:'lumen',n:[1,3]},{item:'shadow_crystal',n:[1,3]},{item:'iron_sword',n:[0,1]},{item:'gold_ore',n:[2,5]}], dmg:9, xp:16, shape:'blob' },
  charger:  { name:'猛襲獣', hostile:true, hp:42, speed:0.82, color:'#a85432', size:15, drops:[{item:'hide',n:[1,3]},{item:'raw_meat',n:[1,3]},{item:'bone',n:[1,2]}], dmg:7, xp:11, shape:'tall', charge:{ range:4, windup:16, dashTicks:22, dashSpeed:5.2, dmg:15, cd:150 } },
  golem:    { name:'岩ゴーレム', hostile:true, hp:48, speed:0.7, color:'#8a8d91', size:15, drops:[{item:'stone',n:[2,5]},{item:'iron_ore',n:[1,2]},{item:'gold_ore',n:[0,1]}], dmg:8, xp:9, big:true, pound:{r:1.9,cd:120} },
  scorpion: { name:'サソリ', hostile:true, hp:14, speed:1.9, color:'#b07030', size:9, drops:[{item:'chitin',n:[1,2]}], dmg:4, xp:4, inflict:{poison:240} },
  ice_bear: { name:'白熊', hostile:true, hp:40, speed:1.4, color:'#e8eef2', size:16, drops:[{item:'raw_meat',n:[2,4]},{item:'hide',n:[2,3]}], dmg:7, xp:8, inflict:{cold:240}, big:true, pound:{r:1.8,cd:130} },
  astral_serpent:{ name:'宇宙の大蛇', hostile:true, hp:60, speed:2.0, color:'#b0a0ff', size:16, drops:[{item:'star_metal',n:[1,3]},{item:'star_core',n:[0,1]}], dmg:8, xp:14, space:true, ghost:true, big:true },
  // ===== P27 ダンジョンボス（大型ダンジョンの巣から稀に出現）=====
  tomb_king:  { name:'墳墓の王', hostile:true, hp:480, tier:1, speed:1.3, color:'#d8b048', size:26, drops:[{item:'sand_greatsword',n:[1,1]},{item:'pharaoh_crown',n:[0,1]},{item:'gold_bar',n:[3,6]},{item:'chitin',n:[2,4]},{item:'gae_bolg',n:[0,1]}], dmg:9, xp:45, boss:true, big:true, summon:'scorpion', inflict:{poison:240} },
  forge_titan:{ name:'溶炉の巨人', hostile:true, hp:620, tier:1, speed:1.1, color:'#c0502a', size:30, drops:[{item:'magma_hammer',n:[1,1]},{item:'iron',n:[4,8]},{item:'gold_bar',n:[2,5]},{item:'xp_orb',n:[1,2]}], dmg:12, xp:60, boss:true, big:true, summon:'golem', shape:'tall' },
  crystal_queen:{ name:'水晶の女王', hostile:true, hp:720, tier:2, speed:1.2, color:'#c884f0', size:28, drops:[{item:'prism_blade',n:[1,1]},{item:'shadow_crystal',n:[4,8]},{item:'lumen',n:[3,6]},{item:'star_core',n:[0,1]}], dmg:11, xp:70, boss:true, big:true, summon:'frost_wisp', shape:'tall', ranged:{dmg:8,range:7,cd:70,kind:'frost',status:{cold:200}} },
  twilight_colossus:{ name:'黄昏の巨像', hostile:true, hp:960, tier:3, speed:1.05, color:'#d08a4a', size:34, drops:[{item:'colossus_blade',n:[1,1]},{item:'gold_bar',n:[3,6]},{item:'iron',n:[4,8]},{item:'mind_tome',n:[0,1]}], dmg:13, xp:90, boss:true, big:true, shape:'tall', summon:'cursed_armor' },
  abyss_dragon:{ name:'深淵の竜', hostile:true, hp:1140, tier:4, speed:1.35, color:'#6a1f8a', size:34, drops:[{item:'dragon_fang',n:[1,1]},{item:'shadow_core',n:[3,6]},{item:'shadow_crystal',n:[6,12]},{item:'lumen',n:[4,8]},{item:'mind_tome',n:[0,1]}], dmg:14, xp:120, boss:true, big:true, shadow:true, shape:'tall', summon:'abyss_stalker', ranged:{dmg:10,range:8,cd:60,kind:'hex'} },
  endbringer:  { name:'終焉の王', hostile:true, hp:1560, tier:4, speed:1.3, color:'#d04a6a', size:36, drops:[{item:'endblade',n:[1,1]},{item:'star_core',n:[2,4]},{item:'shadow_core',n:[3,6]},{item:'lumen',n:[6,12]},{item:'gold_bar',n:[4,8]}], dmg:15, xp:160, boss:true, big:true, shape:'tall', summon:'abyss_stalker', ranged:{dmg:12,range:9,cd:55,kind:'hex'} },
  // 賞金首の大物(legendary wanted): 掲示板の特別依頼で出現するボス級の無法者
  wanted_boss:{ name:'賞金首の大物', hostile:true, hp:640, tier:2, speed:1.55, color:'#d84a4a', size:26, drops:[{item:'gold_bar',n:[4,8]},{item:'iron',n:[3,6]}], dmg:11, xp:65, boss:true, big:true, shape:'tall', summon:'bandit' },
  // 沼の主: 夜の毒の沼地に稀に顕現する瘴気のボス
  swamp_lord:{ name:'沼の主', hostile:true, hp:720, tier:2, speed:1.0, color:'#5a7a3a', size:30, drops:[{item:'mire_scythe',n:[1,1]},{item:'glow_spore',n:[4,8]},{item:'guts',n:[2,4]},{item:'gold_bar',n:[2,4]}], dmg:11, xp:78, boss:true, big:true, shape:'blob', summon:'leech', inflict:{poison:300, infection:300}, ranged:{dmg:8,range:7,cd:75,kind:'venom',status:{poison:240}} },
  // 溶岩の王: 火山地帯に稀に顕現する灼熱のボス
  lava_lord:{ name:'溶岩の王', hostile:true, hp:880, tier:3, speed:1.05, color:'#d8521f', size:30, drops:[{item:'magma_maul',n:[1,1]},{item:'obsidian',n:[4,8]},{item:'sulfur',n:[3,6]},{item:'gold_bar',n:[2,4]}], dmg:12, xp:82, boss:true, big:true, shape:'tall', summon:'ember_imp', inflict:{burn:240}, ranged:{dmg:9,range:7,cd:70,kind:'fire'} },
  // 胞子の女王: キノコの森に顕現する菌糸のボス
  spore_queen:{ name:'胞子の女王', hostile:true, hp:700, tier:2, speed:1.1, color:'#9a6ad0', size:28, drops:[{item:'spore_scythe',n:[1,1]},{item:'luminous_cap',n:[4,8]},{item:'glow_spore',n:[3,6]},{item:'gold_bar',n:[2,4]}], dmg:11, xp:80, boss:true, big:true, shape:'blob', summon:'swamp_wisp', inflict:{poison:240, infection:240}, ranged:{dmg:8,range:7,cd:72,kind:'venom',status:{poison:200}} },
  // 沼地/夜の新モブ3種
  swamp_wisp:{ name:'沼の鬼火', hostile:true, hp:12, speed:1.4, color:'#8fe06a', size:10, drops:[{item:'glow_spore',n:[0,1]},{item:'shadow_shard',n:[0,1]}], dmg:4, xp:4, ghost:true, shape:'wisp', ranged:{dmg:5,range:6,cd:80,kind:'venom',status:{poison:200}} },
  giant_toad:{ name:'大蛙', hostile:true, hp:22, speed:1.2, color:'#5a8a3a', size:13, drops:[{item:'frog_legs',n:[1,2]},{item:'guts',n:[0,1]}], dmg:5, xp:5, hop:true, shape:'blob', inflict:{poison:180} },
  viper:{ name:'毒蛇', hostile:true, hp:11, speed:2.3, color:'#7a9a3a', size:9, drops:[{item:'snake_meat',n:[1,1]},{item:'hide',n:[0,1]}], dmg:4, xp:4, shape:'spiky', inflict:{poison:240} },
  // 火山/砂漠/雪原の新モブ3種
  salamander:{ name:'火トカゲ', hostile:true, hp:20, speed:1.6, color:'#e0641f', size:11, drops:[{item:'sulfur',n:[0,1]},{item:'hide',n:[0,1]}], dmg:5, xp:5, shape:'spiky', inflict:{burn:120}, ranged:{dmg:6,range:6,cd:85,kind:'fire'} },
  sand_wurm:{ name:'砂蟲', hostile:true, hp:26, speed:2.0, color:'#cda85a', size:13, drops:[{item:'chitin',n:[1,2]},{item:'guts',n:[0,1]}], dmg:6, xp:6, shape:'blob', inflict:{poison:150} },
  frost_spider:{ name:'氷蜘蛛', hostile:true, hp:16, speed:2.0, color:'#bfe4f5', size:11, drops:[{item:'string',n:[1,2]},{item:'lumen',n:[0,1]}], dmg:5, xp:5, shape:'spider', inflict:{cold:200} },
  // ===== P30 敵の多様化: 遠距離魔法・巨人・形状バリエーション =====
  hex_caster:{ name:'影の呪術師', hostile:true, hp:18, speed:1.0, color:'#a060e0', size:11, drops:[{item:'shadow_crystal',n:[0,1]},{item:'shadow_shard',n:[1,2]}], dmg:4, xp:5, shadow:true, ghost:true, shape:'wisp', ranged:{dmg:6,range:7,cd:80,kind:'hex'} },
  gazer:    { name:'浮遊する眼', hostile:true, hp:14, speed:1.3, color:'#6a3a6a', size:11, drops:[{item:'shadow_shard',n:[1,2]}], dmg:4, xp:4, ghost:true, shape:'orb', ranged:{dmg:5,range:6,cd:70,kind:'hex'} },
  dust_mage:{ name:'砂の呪術師', hostile:true, hp:16, speed:1.1, color:'#d8a050', size:10, drops:[{item:'chitin',n:[0,1]},{item:'gold_ore',n:[0,1]}], dmg:4, xp:5, shape:'wisp', ranged:{dmg:5,range:6,cd:90,kind:'venom',status:{poison:200}} },
  ember_imp:{ name:'灰の小鬼', hostile:true, hp:12, speed:1.5, color:'#e06030', size:8, drops:[{item:'coal',n:[1,2]},{item:'iron_ore',n:[0,1]}], dmg:4, xp:4, shape:'spiky', ranged:{dmg:5,range:5,cd:70,kind:'fire'} },
  cinder_bomber:{ name:'燐火の自爆虫', hostile:true, hp:22, tier:2, speed:1.4, color:'#e0602a', size:12, drops:[{item:'gunpowder',n:[1,2]},{item:'sulfur',n:[0,1]}], dmg:5, xp:11, shape:'blob', bomber:{ r:2.8, dmg:34, fuse:26, trigger:2.4 } },
  // ===== ㊾ 新規モブ(見た目/攻撃を重複させない・強さtier=str1-5) =====
  thornback:{ name:'棘背獣', hostile:true, hp:34, speed:1.6, color:'#7a6a4a', size:13, str:2, drops:[{item:'hide',n:[1,2]},{item:'bone',n:[0,1]}], dmg:7, xp:8, shape:'beast', charge:{range:6,windup:20,dashTicks:14,dashSpeed:5.5,dmg:12,cd:120} },
  wisp_lantern:{ name:'誘い火', hostile:true, hp:20, speed:1.2, color:'#ffcf6a', size:9, str:2, drops:[{item:'glow_spore',n:[1,2]},{item:'lumen',n:[0,1]}], dmg:5, xp:7, shape:'wisp', ghost:true, ranged:{dmg:7,range:7,cd:75,kind:'fire',status:{burn:120}} },
  crag_golem:{ name:'岩喰い', hostile:true, hp:95, speed:0.8, color:'#6a6660', size:18, str:3, big:true, drops:[{item:'stone',n:[2,4]},{item:'iron_ore',n:[1,2]}], dmg:12, xp:20, shape:'tall', pound:{r:2.2,cd:130} },
  frost_lurker:{ name:'氷隠れ', hostile:true, hp:28, speed:1.7, color:'#9fd8ff', size:11, str:2, drops:[{item:'shadow_shard',n:[0,1]}], dmg:6, xp:8, shape:'spider', blink:{cd:150}, inflict:{} },
  sand_stalker:{ name:'砂潜み', hostile:true, hp:40, speed:1.4, color:'#d8b878', size:14, str:3, drops:[{item:'chitin',n:[1,2]},{item:'gold_ore',n:[0,1]}], dmg:9, xp:12, shape:'serpent', charge:{range:7,windup:16,dashTicks:16,dashSpeed:6,dmg:14,cd:110} },
  plague_rat:{ name:'疫鼠', hostile:true, hp:14, speed:2.1, color:'#8a7a5a', size:8, str:1, drops:[{item:'guts',n:[0,1]}], dmg:4, xp:4, shape:'beast', inflict:{infection:200}, split:{max:1} },
  gloom_bat:{ name:'闇蝙蝠', hostile:true, hp:16, speed:2.6, color:'#5a4a6a', size:8, str:1, drops:[{item:'shadow_shard',n:[0,1]}], dmg:4, xp:5, shape:'bat', shadow:true, ghost:true },
  cinder_hound:{ name:'燼の猟犬', hostile:true, hp:36, speed:2.2, color:'#c04a2a', size:12, str:3, drops:[{item:'coal',n:[1,3]},{item:'sulfur',n:[0,1]}], dmg:8, xp:11, shape:'beast', deathBurst:{r:1.8,dmg:8,status:{burn:120}} },
  bramble_wretch:{ name:'茨の亡者', hostile:true, hp:52, speed:1.0, color:'#4a6a3a', size:13, str:3, drops:[{item:'string',n:[1,2]},{item:'apple',n:[0,1]}], dmg:11, xp:13, shape:'humanoid', pound:{r:1.6,cd:150} },
  void_spawnling:{ name:'虚の落とし子', hostile:true, hp:30, speed:1.5, color:'#8f6fc8', size:10, str:3, space:true, drops:[{item:'void_shard',n:[0,1]},{item:'shadow_shard',n:[1,2]}], dmg:7, xp:10, shape:'orb', ghost:true, ranged:{dmg:8,range:7,cd:65,kind:'hex'}, split:{max:1} },
  dread_knight:{ name:'戦慄の騎士', hostile:true, hp:120, speed:1.3, color:'#4a4a5a', size:14, str:4, drops:[{item:'shadow_steel',n:[0,1]},{item:'iron',n:[1,2]}], dmg:14, xp:26, shape:'humanoid', charge:{range:6,windup:18,dashTicks:14,dashSpeed:5.5,dmg:20,cd:120} },
  storm_roc:{ name:'嵐の大鷲', hostile:true, hp:80, speed:2.4, color:'#8fa8d8', size:15, str:4, big:true, drops:[{item:'feather',n:[1,3]},{item:'wind_steel',n:[0,1]}], dmg:12, xp:24, shape:'bird', ranged:{dmg:10,range:8,cd:85,kind:'frost'} },
  // ㊾ 新規モブ 第2弾(形/攻撃を重複させない)
  marsh_leaper:{ name:'沼跳ね', hostile:true, hp:22, speed:1.8, color:'#5a7a4a', size:10, str:2, hop:true, drops:[{item:'guts',n:[0,1]},{item:'glow_spore',n:[0,1]}], dmg:6, xp:7, shape:'blob', inflict:{poison:180} },
  glacier_maw:{ name:'氷牙', hostile:true, hp:46, speed:1.9, color:'#bfe8ff', size:13, str:3, drops:[{item:'hide',n:[1,2]},{item:'shadow_shard',n:[0,1]}], dmg:9, xp:13, shape:'beast', charge:{range:6,windup:16,dashTicks:14,dashSpeed:6,dmg:15,cd:110} },
  ash_wraith:{ name:'灰の亡霊', hostile:true, hp:30, speed:1.3, color:'#a06a4a', size:11, str:3, ghost:true, drops:[{item:'coal',n:[1,2]},{item:'sulfur',n:[0,1]}], dmg:7, xp:10, shape:'wisp', ranged:{dmg:8,range:7,cd:70,kind:'fire',status:{burn:120}} },
  crystal_scuttler:{ name:'水晶蟹', hostile:true, hp:70, speed:1.1, color:'#9fd0e8', size:13, str:3, drops:[{item:'shadow_crystal',n:[0,1]},{item:'stone',n:[1,2]}], dmg:8, xp:14, shape:'spider' },
  dune_raider:{ name:'砂の略奪者', hostile:true, hp:26, speed:1.6, color:'#c8a860', size:11, str:2, drops:[{item:'chitin',n:[0,1]},{item:'gold_ore',n:[0,1]}], dmg:6, xp:8, shape:'humanoid' },
  thunder_wisp:{ name:'雷の精', hostile:true, hp:34, speed:1.5, color:'#ffe27a', size:10, str:3, ghost:true, drops:[{item:'wind_steel',n:[0,1]},{item:'lumen',n:[0,1]}], dmg:7, xp:11, shape:'wisp', ranged:{dmg:9,range:8,cd:60,kind:'hex'} },
  rot_hulk:{ name:'腐の巨躯', hostile:true, hp:130, speed:0.7, color:'#6a7a4a', size:18, str:4, big:true, drops:[{item:'guts',n:[1,3]},{item:'bone',n:[0,2]}], dmg:14, xp:28, shape:'tall', deathBurst:{r:2.4,dmg:12,status:{poison:200}} },
  shade_archer:{ name:'影の射手', hostile:true, hp:38, speed:1.4, color:'#5a4a7a', size:11, str:3, shadow:true, drops:[{item:'shadow_shard',n:[1,2]}], dmg:6, xp:11, shape:'humanoid', ranged:{dmg:11,range:9,cd:75,kind:'pierce'} },
  magma_serpent:{ name:'溶岩蛇', hostile:true, hp:88, speed:2.1, color:'#e05a2a', size:15, str:4, big:true, drops:[{item:'sulfur',n:[1,2]},{item:'iron_ore',n:[1,2]}], dmg:12, xp:22, shape:'serpent', deathBurst:{r:1.8,dmg:10,status:{burn:150}} },
  frost_giant:{ name:'霜の巨人', hostile:true, hp:150, speed:0.8, color:'#aee0ff', size:20, str:5, big:true, drops:[{item:'shadow_shard',n:[1,2]},{item:'iron',n:[1,2]}], dmg:16, xp:34, shape:'tall', pound:{r:2.6,cd:120} },
  spore_swarm:{ name:'胞子群', hostile:true, hp:24, speed:1.4, color:'#c884f0', size:10, str:2, drops:[{item:'glow_spore',n:[1,2]},{item:'luminous_cap',n:[0,1]}], dmg:5, xp:7, shape:'blob', split:{max:2} },
  void_reaver:{ name:'虚無の刈り手', hostile:true, hp:180, speed:1.9, color:'#7f5fd0', size:15, str:5, space:true, drops:[{item:'void_shard',n:[1,2]},{item:'void_alloy',n:[0,1]},{item:'shadow_steel',n:[0,1]}], dmg:16, xp:40, shape:'humanoid', ghost:true, charge:{range:7,windup:16,dashTicks:16,dashSpeed:6.5,dmg:22,cd:100} },
  troll:    { name:'森のトロル', hostile:true, hp:70, speed:0.85, color:'#6a8a4a', size:30, drops:[{item:'raw_meat',n:[2,4]},{item:'hide',n:[1,3]},{item:'bone',n:[1,2]}], dmg:11, xp:12, big:true, shape:'tall', pound:{r:2.2,cd:110} },
  bog_horror:{ name:'沼の怪異', hostile:true, hp:50, speed:0.9, color:'#5a6a3a', size:22, drops:[{item:'guts',n:[1,3]},{item:'string',n:[0,1]}], dmg:8, xp:9, shape:'blob', inflict:{infection:300}, deathBurst:{r:2.2,dmg:7,status:{poison:240}} },
  // ===== P40 バイオーム多様化: 新通常モブ =====
  harpy:    { name:'ハーピー', hostile:true, hp:12, speed:2.4, color:'#a06a9a', size:10, drops:[{item:'string',n:[0,1]},{item:'bone',n:[0,1]},{item:'feather',n:[1,2]}], dmg:4, xp:4, ghost:true, shape:'wisp', ranged:{dmg:5,range:6,cd:80,kind:'hex'} },
  dune_serpent:{ name:'砂蛇', hostile:true, hp:14, speed:2.0, color:'#cda050', size:10, drops:[{item:'chitin',n:[0,1]},{item:'hide',n:[0,1]}], dmg:5, xp:4, shape:'spiky', inflict:{poison:220} },
  frost_wolf:{ name:'雪狼', hostile:true, hp:16, speed:2.1, color:'#cfe0ee', size:11, drops:[{item:'hide',n:[1,2]},{item:'raw_meat',n:[0,1]}], dmg:5, xp:4, inflict:{cold:200} },
  mud_crawler:{ name:'沼の這う者', hostile:true, hp:18, speed:0.85, color:'#6a5a3a', size:12, drops:[{item:'guts',n:[0,1]},{item:'string',n:[0,1]}], dmg:4, xp:4, shape:'blob', inflict:{infection:260} },
  void_jelly:{ name:'虚空クラゲ', hostile:true, hp:14, speed:1.3, color:'#8fb0ff', size:12, drops:[{item:'star_metal',n:[0,1]},{item:'lumen',n:[0,1]}], dmg:5, xp:5, space:true, ghost:true, shape:'orb', ranged:{dmg:5,range:6,cd:75,kind:'frost'} },
  // ===== 中ボス(ランクD): そこそこ硬い強雑魚。HPバー表示＋良いドロップ =====
  dire_alpha:  { name:'荒野の長狼', hostile:true, hp:80, speed:1.7, color:'#5a5048', size:15, drops:[{item:'raw_meat',n:[2,4]},{item:'hide',n:[2,4]},{item:'iron_ore',n:[1,2]}], dmg:9, xp:14, midboss:true, shape:'beast', charge:{dashSpeed:5.5,dashTicks:14,windup:22,cd:150,dmg:12} },
  shadow_knight:{ name:'影の騎士', hostile:true, hp:110, speed:1.1, color:'#4a3f6a', size:14, drops:[{item:'shadow_crystal',n:[1,2]},{item:'shadow_core',n:[0,1]},{item:'iron_ore',n:[1,3]}], dmg:10, xp:16, midboss:true, shadow:true, shape:'humanoid', pound:{r:1.7,cd:120} },
  stone_warden:{ name:'石の番人', hostile:true, hp:150, speed:0.6, color:'#7a7d82', size:18, drops:[{item:'stone',n:[4,8]},{item:'iron_ore',n:[2,4]},{item:'gold_ore',n:[1,2]}], dmg:11, xp:16, midboss:true, big:true, shape:'tall', pound:{r:2.1,cd:110} },
  broodmother: { name:'毒の母蟲', hostile:true, hp:95, speed:1.2, color:'#7a9a3a', size:15, drops:[{item:'chitin',n:[2,4]},{item:'string',n:[2,4]},{item:'glow_spore',n:[1,2]}], dmg:8, xp:15, midboss:true, shape:'spider', summon:'spider', ranged:{dmg:6,range:6,cd:90,kind:'venom',status:{poison:240}}, inflict:{poison:180} },
  // ===== 空島(スカイエンクレーブ)固有モブ: エンクレーブ内でのみ湧く(band3級) =====
  wind_wisp:  { name:'風の精', hostile:true, hp:20, speed:1.5, color:'#bfe8e0', size:10, drops:[{item:'feather',n:[0,1]},{item:'wind_crystal',n:[0,1]},{item:'lumen',n:[0,1]}], dmg:5, xp:6, ghost:true, shape:'wisp', ranged:{dmg:6,range:7,cd:80,kind:'frost',status:{cold:150}} },
  cloud_hawk: { name:'雲鷹', hostile:true, hp:24, speed:2.2, color:'#dfe8f4', size:12, drops:[{item:'feather',n:[1,3]},{item:'raw_meat',n:[0,1]}], dmg:6, xp:7, shape:'bird', charge:{ range:5, windup:14, dashTicks:18, dashSpeed:5.6, dmg:10, cd:140 } },
  sky_warden: { name:'空島の番人', hostile:true, hp:140, speed:1.0, color:'#9fb8c8', size:18, drops:[{item:'wind_crystal',n:[2,4]},{item:'feather',n:[1,3]},{item:'lumen',n:[1,2]},{item:'stone',n:[2,4]}], dmg:10, xp:18, midboss:true, big:true, shape:'tall', pound:{r:2.0,cd:120}, summon:'wind_wisp', inflict:{cold:180} },
  // 空島の固有ボス: 嵐の主(雷竜)。雲海の主として稀に顕現。遠距離の雷撃と雲鷹召喚
  storm_sovereign:{ name:'嵐の主', hostile:true, hp:840, tier:3, speed:1.5, color:'#8fc8f0', size:28, drops:[{item:'tempest_spear',n:[0,1]},{item:'wind_crystal',n:[5,10]},{item:'feather',n:[3,6]},{item:'lumen',n:[2,4]},{item:'star_core',n:[0,1]}], dmg:12, xp:75, boss:true, big:true, shape:'bird', ghost:true, summon:'cloud_hawk', ranged:{dmg:9,range:9,cd:60,kind:'chain'} },
  // 古代都市の守り手
  sentinel_husk: { name:'哨士の亡骸', hostile:true, hp:60, speed:0.7, color:'#b8ac82', size:14, drops:[{item:'relic_shard',n:[0,1]},{item:'stone',n:[1,2]}], dmg:9, xp:9, shape:'tall', ranged:{dmg:7,range:7,cd:70,kind:'hex'} },
  gloom_moth:  { name:'幽き蛾', hostile:true, hp:22, speed:2.0, color:'#9a8fb8', size:11, drops:[{item:'relic_shard',n:[0,1]},{item:'glow_spore',n:[0,1]}], dmg:6, xp:6, ghost:true, shape:'wisp', inflict:{poison:120} },
  city_warden: { name:'古都の守番', hostile:true, hp:150, speed:1.0, color:'#c8bc8a', size:19, drops:[{item:'relic_shard',n:[3,5]},{item:'ancient_alloy',n:[1,2]},{item:'lumen',n:[1,2]},{item:'gold_ore',n:[1,2]}], dmg:11, xp:20, midboss:true, big:true, shape:'tall', pound:{r:2.1,cd:110}, summon:'sentinel_husk', inflict:{poison:150} },
  // 古代都市の固有ボス: 玉座の王。哨士を統べ、遠距離の呪詛と叩きつけ
  ruin_king:{ name:'玉座の王', hostile:true, hp:900, tier:3, speed:1.0, color:'#d8c078', size:30, drops:[{item:'sovereign_scepter',n:[0,1]},{item:'relic_shard',n:[6,12]},{item:'ancient_alloy',n:[2,4]},{item:'gold_ore',n:[2,4]},{item:'lumen',n:[2,4]}], dmg:13, xp:80, boss:true, big:true, shape:'tall', pound:{r:2.4,cd:100}, summon:'sentinel_husk', ranged:{dmg:9,range:8,cd:70,kind:'hex'} },
  // 狭間の固有ボス: 虚無の帝。反響の幻を統べ、空間を歪める
  void_emperor:{ name:'虚無の帝', hostile:true, hp:1000, tier:4, speed:1.2, color:'#b088e8', size:30, drops:[{item:'rift_crown',n:[0,1]},{item:'void_shard',n:[6,12]},{item:'void_alloy',n:[2,4]},{item:'shadow_core',n:[1,2]},{item:'lumen',n:[2,4]}], dmg:14, xp:90, boss:true, big:true, shape:'tall', ghost:true, summon:'echo_phantom', ranged:{dmg:10,range:9,cd:60,kind:'hex'} },
  // 狭間の住人
  rift_wraith: { name:'狭間の亡霊', hostile:true, hp:70, speed:1.2, color:'#a888e0', size:14, drops:[{item:'void_shard',n:[0,1]},{item:'shadow_shard',n:[0,1]}], dmg:11, xp:11, ghost:true, shape:'wisp', ranged:{dmg:8,range:8,cd:65,kind:'hex',status:{sanity:0}} },
  echo_phantom:{ name:'反響の幻', hostile:true, hp:30, speed:2.4, color:'#c0a0f0', size:12, drops:[{item:'void_shard',n:[0,1]}], dmg:8, xp:8, ghost:true, shape:'orb', charge:{ range:6, windup:12, dashTicks:16, dashSpeed:6.2, dmg:12, cd:130 } },
  rift_keeper: { name:'狭間の番人', hostile:true, hp:180, speed:1.1, color:'#9a7ad0', size:20, drops:[{item:'void_shard',n:[3,5]},{item:'void_alloy',n:[1,2]},{item:'shadow_core',n:[0,1]},{item:'lumen',n:[1,2]}], dmg:13, xp:24, midboss:true, big:true, shape:'tall', pound:{r:2.2,cd:100}, summon:'echo_phantom', ranged:{dmg:9,range:9,cd:80,kind:'hex'} },
};

// 防具スロット
Game.ARMOR_SLOTS = ['head', 'chest'];

// チューニング
Game.TUNE = {
  ATTACK_COOLDOWN: 14,        // tick
  ATTACK_RANGE: 1.6,          // tile
  BASE_CRIT: 0.08,            // 基礎会心率(スキル/装備で加算)
  CRIT_MULT: 1.8,             // 会心ダメージ倍率(控えめ)
  MOB_CAP: 16,
  ELITE_CHANCE: 0.04,         // 非ボス敵対モブが精鋭(elite)化する確率
  ELITE_HP_MULT: 2.2,         // 精鋭のHP倍率(インフレ防止: 控えめ)
  ELITE_DMG_MULT: 1.5,        // 精鋭の攻撃倍率
  CHAMPION_CHANCE: 0.08,      // 精鋭がさらにチャンピオン(named champion)化する確率
  CHAMPION_HP_MULT: 1.6,      // チャンピオン追加HP倍率
  CHAMPION_DMG_MULT: 1.2,     // チャンピオン追加攻撃倍率
  SPAWN_INTERVAL: 100,        // tick ごとにスポーン試行（密度を抑えめに）
  DESPAWN_TILES: 28,          // この距離超で消滅（通常モブのみ。ボス/中ボス/チャンピオンは消えずアリーナへ帰還）
  BOSS_ENGAGE_TILES: 30,      // ボス戦の交戦距離: この内でゲージ＆ボスBGMが起動、離脱で解除・再接近で再起動
  CROP_GROW_TICKS: 1400,      // 1段階の成長 tick
  COOK_TICKS: 200,            // 精錬1個あたり tick
  SHIFT_COOLDOWN: 120,        // 世界シフトのクールダウン tick
  SHADOW_AMBIENT: 0.55,       // 影世界の常時暗さ（光源で打ち消す）
  SANITY_MAX: 100,
  SANITY_DRAIN: 0.04,         // 影世界滞在で毎tick減る正気度（護符/光で緩和）
  DEEP_THRESHOLD: 120,        // 影世界でこのタイル距離超えると深層
  BLOOD_MOON_EVERY: 4,        // 何日に一度 血の月（危険な夜）
  BLEED_DPS: 1, POISON_DPS: 1, INFECTION_DPS: 1, COLD_DPS: 1, // 状態異常の毎秒ダメージ目安
  SPOIL_CHANCE: 0.06,         // 一定間隔で生肉が腐る確率
  NG_HP_PER: 0.25,            // NG+1ごとの敵HP/攻撃倍率増
  NG_SANITY_PER: 0.2,         // NG+1ごとの正気消費倍率増
};

// ===== エリア危険度(DANGER ZONE)バンド定義 =====
// 既存地理(初期スポーンアンカーからの距離・バイオーム・世界・ダンジョンテーマ)から決定論的に導出する。
// アンカーは seed から再計算(WorldGen.spawnAnchor)されベッド移動やセーブ状態に依らない。
// worldgen のレイアウト/閾値は一切変更しない(セーブ互換維持)。参照API: Game.World.dangerBandAt(tx, ty)
// | band | 名称   | アンカーからの距離(タイル, チェビシェフ) | 内容 |
// |  0   | 安全圏 | 0-39    | 弱敵のみ・夜も湧き半減・昼は敵なし・精鋭なし(血の月のみ例外) |
// |  1   | 開拓圏 | 40-89   | 従来の標準プール(既存エンカウント不変) |
// |  2   | 辺境   | 90-159  | 強敵混成プール・精鋭2倍・ステータス+12% |
// |  3   | 深域   | 160+    | 最強プール・精鋭3倍/チャンピオン2倍・+24%・初期装備ではほぼ突破不能 |
// |  4   | 深域+  | 補正による上限帯 | 精鋭4倍・+36%(上限=基礎の1.36倍、帯スケールは2倍を大きく下回る) |
// 補正: 雪原/砂漠/火山 +1帯(安全圏0では適用しない) / キノコの森は夜のみ+1 / 影世界 +1(深層の既存強化は別枠で維持) / 宇宙=3固定
// ダンジョン明示ティア: 遺跡=1, 氷窟/墳墓=2, 工房/水晶洞=3, 影世界のダンジョン(影神殿)=4
Game.DANGER = {
  RADII: [40, 90, 160],                       // band 0/1/2 の外縁(タイル)。160+ が band3
  NAMES: ['安全圏', '開拓圏', '辺境', '深域', '深域+'],
  COLORS: ['#7fd0a0', '#cfd6e0', '#ffd24a', '#ff8a4a', '#ff4a6a'], // UI/描画の可視化用
  STAT_PER: 0.45,                             // band1超過1段ごとの hp/dmg 上昇率(非ボス敵対のみ)。序盤(band0-1)は不変、中位以上を相当強く(ユーザー指示)
  STAT_MAX: 2.0,                              // 上限。band2=1.45/band3=1.90/深域band4=約2.35倍。スキル/装備強化前提の歯応え
  XP_PER: 0.25,                               // band1超過1段ごとの XP/バーツ増加率
  ELITE_MULT: [0, 1, 2, 3, 4],                // 精鋭率の帯別倍率(安全圏は精鋭なし)
  CHAMP_MULT: [0, 1, 1, 2, 2],                // チャンピオン率の帯別倍率
  DUNGEON_TIER: { ruin: 1, ice: 2, tomb: 2, forge: 3, crystal: 3 },
  DUNGEON_BOSS: { tomb: 'tomb_king', forge: 'forge_titan', crystal: 'crystal_queen', ice: 'crystal_queen' },
  DUNGEON_POOLS: {
    ruin:    ['zombie', 'zombie', 'skeleton', 'spider', 'slime', 'thornback', 'plague_rat'],
    ice:     ['frost_wisp', 'frost_wisp', 'frost_spider', 'cursed_armor', 'ice_bear', 'frost_lurker'],
    tomb:    ['scorpion', 'scorpion', 'dust_mage', 'sand_wurm', 'cursed_armor', 'sand_stalker'],
    forge:   ['ember_imp', 'salamander', 'golem', 'cursed_armor', 'cinder_hound', 'crag_golem', 'cinder_bomber'],
    crystal: ['frost_wisp', 'frost_spider', 'cursed_armor', 'golem', 'gazer', 'dread_knight'],
    shadow:  ['wraith', 'watcher', 'hex_caster', 'shade_stalker', 'gazer', 'abyss_stalker', 'void_spawnling', 'dread_knight'],
  },
  // 夜の帯別プール(band1 は mobs.js 内の従来プールを維持)
  POOL_NIGHT: {
    0: ['slime', 'slime', 'zombie', 'skeleton', 'bat', 'plague_rat', 'gloom_bat'],
    2: ['zombie', 'skeleton', 'spider', 'leech', 'bat', 'gazer', 'harpy', 'viper', 'charger', 'troll', 'cursed_armor', 'bog_horror', 'thornback', 'wisp_lantern', 'gloom_bat', 'bramble_wretch'],
    3: ['troll', 'troll', 'charger', 'golem', 'cursed_armor', 'mimic', 'bog_horror', 'gazer', 'harpy', 'crag_golem', 'dread_knight', 'storm_roc', 'sand_stalker', 'cinder_hound', 'cinder_bomber'],
  },
  POOL_DAY3: ['troll', 'charger', 'golem', 'crag_golem', 'dread_knight'],   // 深域は昼でも強敵が徘徊
  TOASTS: [null,
    'ここから開拓圏 — 敵が現れる。装備を整えよう',
    '⚠ この先は辺境 — 敵が目に見えて強くなる',
    '⚠⚠ 深域に踏み込んだ — 生半可な装備では生き残れない',
    '☠ 深域の最奥 — 精鋭がひしめく死地。引き返すのも勇気',
  ],
};

// 起動時に付与する初期アイテム（チュートリアル簡略化のため最低限）
Game.STARTER_ITEMS = [
  { id:'apple', count:3 },
];

// アイテム絵文字アイコン（視認性向上）。未定義は色付き四角＋頭文字
Game.ITEM_GLYPH = {
  wood:'🪵', shadow_wood:'🪵', stone:'🪨', stone_block:'🧱', wood_block:'🟫', coal:'⚫', iron_ore:'🪨', iron:'🔩', gold_ore:'🟡', gold_bar:'🟨',
  apple:'🍎', berry:'🫐', cactus:'🌵', raw_meat:'🥩', cooked_meat:'🍖', rotten_meat:'🤢', guts:'🩸', wheat:'🌾', wheat_seeds:'🌱', bread:'🍞', moonleaf:'🍃', fish:'🐟',
  strawberry:'🍓', strawberry_seeds:'🌱', corn:'🌽', corn_seeds:'🌱', watering_can:'🪣', scarecrow:'🎃', fountain:'⛲',
  frog_legs:'🐸', cooked_frog:'🍗', snake_meat:'🐍', cooked_snake:'🍢', swamp_stew:'🍲',
  carrot:'🥕', carrot_seeds:'🌱', pumpkin:'🎃', pumpkin_seeds:'🌱', tomato:'🍅', tomato_seeds:'🌱', veg_salad:'🥗', pumpkin_pie:'🥧', veg_stew:'🍲', hearty_stew:'🍲',
  hide:'🟤', leather:'🟫', bone:'🦴', string:'🧵', slime_ball:'🟢', flower:'🌸', sapling:'🌱', glow_spore:'🍄', obsidian:'⬛', sulfur:'🟡', obsidian_blade:'🗡️', luminous_cap:'🍄', mushroom_soup:'🍲', mire_incense:'🕯️', lava_shard:'🔥', spore_sac:'🟣', flower_tea:'🍵', end_key:'🗝️', endblade:'⚔️', coin_charm:'🪙', shop_bell:'🔔', kokuhen:'🔮',
  wood_pickaxe:'⛏️', stone_pickaxe:'⛏️', iron_pickaxe:'⛏️', shadow_pickaxe:'⛏️', siege_pick:'⛏️',
  wood_axe:'🪓', stone_axe:'🪓', iron_axe:'🪓', shadow_axe:'🪓', wood_hoe:'🌾', stone_hoe:'🌾',
  wood_sword:'🗡️', stone_sword:'🗡️', iron_sword:'⚔️', shadow_blade:'⚔️',
  leather_helmet:'🎩', iron_helmet:'⛑️', shadow_helmet:'🪖', leather_chest:'🦺', iron_chest:'🛡️', shadow_chest:'🛡️', fur_coat:'🧥', lumen_charm:'🔆', sanity_charm:'🔮',
  bandage:'🩹', antidote:'🧪', strength_potion:'🧪', swift_potion:'🧪', iron_potion:'🧪', regen_potion:'🧪', bomb:'💣', molotov:'🍶', poison_flask:'⚗️', flash_bomb:'✨', frost_grenade:'🧊',
  torch:'🔥', campfire:'🔥', lantern:'🏮', lumen_lantern:'💡', crafting_table:'🛠️', furnace:'🔥', chest:'📦', bed:'🛏️', fence:'🚧', door:'🚪', wall:'🧱', window:'🪟', bridge:'🌉', sign:'🪧', bounty_board:'📜', wood_floor:'🟫', stone_floor:'⬜',
  shadow_shard:'🌑', shadow_mirror:'🪞', shadow_crystal:'🔮', lumen:'✨', shadow_steel:'⬛', shadow_core:'💜', unity_core:'⭐', void_heart:'💗', rift_anchor:'🕳️', enchant_table:'✦',
  bullet:'🔸', pistol:'🔫', shadow_rifle:'🔫', car:'🚗', boat:'🛶', plane:'✈️',
  ammo_9mm:'🔸', ammo_556:'🔹', ammo_762:'🟤', shell_12g:'🔴', ammo_50:'🟠', rocket_ammo:'🧨', he_slug:'🔩', missile:'🚀', homing_missile:'🛰️', star_shell:'🌠',
  glock17:'🔫', mp5:'🔫', m4:'🔫', ak47:'🔫', m870:'🔫', barrett:'🎯', rpg7:'🚀',
  rocket:'🚀', star_metal:'🌟', star_core:'💫', cosmic_blade:'🌠', star_cannon:'🔫', gravity_boots:'👢',
  warp_staff:'🪄', flame_staff:'🔥', frost_staff:'❄️', meteor_staff:'☄️', vortex_staff:'🌀', flying_carpet:'🧞', grapple_hook:'🪝', stasis_glass:'⏳',
  healing_totem:'⛲', street_lamp:'🪔', table:'🪑', chair:'🪑', bookshelf:'📚', glass:'🪟', rug:'🟥', banner:'🚩', brazier:'🔥', barrel:'🛢️', powder_keg:'🧨', potted_plant:'🪴',
  chitin:'🦂', bone_club:'🦴', gold_sword:'⚔️', war_hammer:'🔨', crystal_blade:'⚔️', chitin_spear:'🔱',
  gold_helmet:'⛑️', gold_chest:'🛡️', crystal_helmet:'🪖', crystal_chest:'🛡️', star_helmet:'⛑️', chitin_armor:'🦺',
  sand_greatsword:'⚔️', magma_hammer:'🔨', pharaoh_crown:'👑', mind_tome:'📖', wisdom_tome:'📗', xp_orb:'🔮', expand_pouch:'🎒',
  feather:'🪶', wind_crystal:'💠', wind_steel:'🌀', wind_feather:'🪶', wind_sword:'🗡️', sky_cloak:'🧥', cloud_boots:'👢',
  ring_crit:'💍', amulet_swift:'📿', fang_vamp:'🦷', heart_regen:'❤️‍🔥', eye_xp:'👁️', band_power:'💪', crest_guard:'🛡️',
  energy_cell:'🔋', wind_blade:'🗡️', thunder_sword:'⚡', boomerang_axe:'🪃', laser_rifle:'🔫', railgun:'🔫', excalibur:'⚔️', gae_bolg:'🔱', gate_babylon:'⚔️', prism_blade:'⚔️', dragon_fang:'⚔️', colossus_blade:'⚔️', mire_scythe:'⚔️', magma_maul:'🔨', starcore_greatsword:'⚔️', voidcore_blade:'⚔️', spore_scythe:'⚔️', star_aegis:'🛡️', void_helm:'⛑️', thorn_plate:'🥷', tempest_spear:'🔱', sovereign_scepter:'👑', rift_crown:'👑', frostfang_blade:'🗡️', emberfang_axe:'🪓', echoedge:'🗡️', quakehammer:'🔨', flashstep_edge:'⚡', voidrend_edge:'🗡️', thunderguard_hammer:'🔨', cataclysm_hammer:'🔨', graveshatter_hammer:'🔨', runeforge_hammer:'🔨', stormpierce_spear:'🔱', dragoon_spear:'🔱', glacial_spear:'🔱', venomfang_spear:'🔱', thundercleave_axe:'🪓', ragestorm_axe:'🪓', frostbite_axe:'🪓', reaver_axe:'🪓', soulreaper_scythe:'⚔️', deathwind_scythe:'⚔️', plague_scythe:'⚔️', voidharvest_scythe:'⚔️', moonshadow_katana:'🗡️', thunderfang_katana:'🗡️', crimson_katana:'🗡️', iai_kasumi:'🗡️', combat_vest:'🎽', reflect_aegis:'🛡️', iai_mumyo:'🗡️', heavenfall_staff:'☄️', gasoline:'⛽', repair_kit:'🔧', buggy:'🚙', tank:'🛡️', cannon_shell:'💣', battle_mech:'🤖', aqualung:'🤿', moonshard:'🌙', moon_charm:'🔮', fighter_jet:'✈️', bomber:'🛩️', aerial_bomb:'💣', heavy_bomb:'🧨', gunpowder:'⚫', gun_parts:'⚙️', steel_plate:'🔩', rope:'🪢', glass:'🔷', circuit:'🖥️', jerky:'🥓', fruit_salad:'🥗', energy_bar:'🍫', medkit:'🩹', deagle:'🔫', uzi:'🔫', p90:'🔫', scar_h:'🔫', barrett:'🔫', spas12:'🔫', minigun:'🔫', m79:'🧨', he_launcher:'💥', lockon_launcher:'🚀', flamethrower:'🔥', plasma_rifle:'🔫', garage_door:'🚪', landing_pad:'🛬', aircraft_gun:'🔫', nuke_launcher:'☢️', nuke_warhead:'☢️',
};

Game.INV_SIZE = 45;       // 先頭9 = ホットバー。初期から1行多め(ユーザー指示: 36→45)
Game.HOTBAR_SIZE = 9;

// 航空機のミサイルモード(戦闘機/爆撃機で切替可能)。カタパルト射出→その場停留→点火加速の共通プロファイル。
//  normal: 通常ミサイル = 1発・高威力・直進(命中が難しい)  /  homing: 誘導ミサイル = 小型4発・中威力・自動追尾
Game.MISSILE_MODES = {
  // 射出後約1秒(30tick)は超低速で漂い(プシュー)、点火して高速で目標へ(ぱしゅっ)。durはlaunch分を含む
  normal: { label: '通常', ammo: 'missile',        count: 1, homing: false, dmg: 95, explosive: 2.9, speedStart: 9, speedMax: 26, accel: 1.6, dur: 76, cd: 32, launch: 30, ejectSpd: 1.0 },
  // 追尾は通常の2/3ほどの速度(ユーザー指示)。小型4発が各自ロックオンして曲がる
  homing: { label: '追尾', ammo: 'homing_missile', count: 4, homing: true,  dmg: 28, explosive: 1.8, speedStart: 7, speedMax: 17, accel: 1.1, dur: 96, cd: 52, launch: 30, ejectSpd: 1.0, every: 5, spread: 0.42, small: true },
};
Game.DAY_LENGTH = 24000;  // 1日のtick数（昼夜は次波で本格化）

// ===== P34 プロシージャル装備生成（ベース×素材ティア×接頭辞で500種超／ドロップ専用）=====
(function generateGear() {
  const WBASES = [
    { k: 'sword', jp: '剣', atk: 4 }, { k: 'axe', jp: '斧', atk: 5 }, { k: 'hammer', jp: '槌', atk: 6 },
    { k: 'spear', jp: '槍', atk: 4 }, { k: 'dagger', jp: '短剣', atk: 3 },
  ];
  const ABASES = [{ k: 'helmet', jp: '兜', slot: 'head', armor: 1 }, { k: 'chest', jp: '鎧', slot: 'chest', armor: 2 }];
  const TIERS = [
    { k: 'wood', jp: '木', m: 0.8, c: '#9c6b3f', t: 1 }, { k: 'stone', jp: '石', m: 1.0, c: '#888d91', t: 1 },
    { k: 'iron', jp: '鉄', m: 1.4, c: '#d8d8dc', t: 2 }, { k: 'steel', jp: '鋼', m: 1.8, c: '#b8bcc0', t: 3 },
    { k: 'gold', jp: '金', m: 2.0, c: '#e8c54a', t: 3 }, { k: 'shadowsteel', jp: '影鋼', m: 2.4, c: '#6a5a8a', t: 4 },
    { k: 'crystal', jp: '影晶', m: 2.9, c: '#b86ad0', t: 4 }, { k: 'star', jp: '星鋼', m: 3.4, c: '#aee0ff', t: 5 },
    { k: 'void', jp: '虚空', m: 4.0, c: '#5a3a8a', t: 5 },
  ];
  const AFFIX = [
    { k: '', jp: '', atk: 0, armor: 0 }, { k: 'flame', jp: '業火の', atk: 2, c: '#ff7a3c' },
    { k: 'frost', jp: '氷結の', atk: 1, c: '#9fd8ff' }, { k: 'gale', jp: '疾風の', atk: 1, c: '#bfe8d8' },
    { k: 'king', jp: '王の', atk: 3, armor: 1, c: '#e8c54a' }, { k: 'eternal', jp: '不滅の', armor: 2, c: '#cfd6e0' },
    { k: 'moon', jp: '月光の', atk: 1, armor: 1, c: '#cdd8ff' }, { k: 'abyss', jp: '深淵の', atk: 2, armor: 1, c: '#7a4fb0' },
  ];
  Game.GEN_ITEMS = []; Game.GEN_BY_TIER = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  function reg(id, def, t) { if (Game.ITEMS[id]) return; def.gen = true; def.dropOnly = true; def.craftable = false; Game.ITEMS[id] = def; Game.GEN_ITEMS.push(id); Game.GEN_BY_TIER[t].push(id); }
  WBASES.forEach(function (B) {
    TIERS.forEach(function (T) {
      AFFIX.forEach(function (A) {
        const id = 'gen_' + B.k + '_' + T.k + (A.k ? '_' + A.k : '');
        const atk = Math.max(1, Math.round(B.atk * T.m) + (A.atk || 0) + T.t);
        const gdef = { name: (A.jp || '') + T.jp + 'の' + B.jp, stack: 1, color: A.c || T.c, tool: 'sword', tier: Math.min(5, T.t), attack: atk };
        if (A.k === 'flame') gdef.hitDot = 'fire'; else if (A.k === 'frost') gdef.hitDot = 'frost'; // 名前通り炎上/凍えを付与(元素システムに接続)
        reg(id, gdef, T.t);
      });
    });
  });
  ABASES.forEach(function (B) {
    TIERS.forEach(function (T) {
      AFFIX.forEach(function (A) {
        const id = 'gen_' + B.k + '_' + T.k + (A.k ? '_' + A.k : '');
        const arm = Math.max(1, Math.round(B.armor * T.m) + (A.armor || 0));
        reg(id, { name: (A.jp || '') + T.jp + 'の' + B.jp, stack: 1, color: A.c || T.c, armor: arm, slot: B.slot, tier: Math.min(5, T.t) }, T.t);
      });
    });
  });
})();
