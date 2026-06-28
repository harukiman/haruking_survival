// config.js — 全定数とゲームデータ（ロジック無し）
window.Game = window.Game || {};

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
Game.TILE = { DEEP_WATER:0, WATER:1, SAND:2, GRASS:3, FOREST:4, DIRT:5, STONE:6, SNOW:7, DUNGEON_FLOOR:8 };

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
  TOMB_WALL:136, FORGE_WALL:137,
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
};

Game.SOLID_TILE = {
  [Game.TILE.DEEP_WATER]: true,  // 移動不可
  [Game.TILE.WATER]: false,      // 浅瀬は通れる（減速は今回省略）
};

// 発光オブジェクトの光量（lighting で使用）
Game.LIGHT_LEVEL = {
  [Game.OBJ.TORCH]: 7,
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
  [Game.OBJ.ROCKET]: 6,
  [Game.OBJ.STAR_ORE]: 4,
  [Game.OBJ.HEALING_TOTEM]: 7,
  [Game.OBJ.STREET_LAMP]: 11,
};

// オブジェクトのメタ情報。solid=移動阻害, drops=破壊時ドロップ
Game.OBJ_META = {
  [Game.OBJ.TREE]:      { name:'木', solid:true,  mineable:true, tool:'axe',     tier:0, hp:6,  drops:[{item:'wood', n:[2,4]}], render:'tree' },
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
  [Game.OBJ.PINE_TREE]: { name:'松', solid:true, mineable:true, tool:'axe', tier:0, hp:7, drops:[{item:'wood', n:[2,4]}], render:'pine' },
  [Game.OBJ.CACTUS]:    { name:'サボテン', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'cactus', n:[1,2]}], render:'cactus', touchDamage:1 },
  [Game.OBJ.FARMLAND]:  { name:'畑', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[], render:'farmland' },
  [Game.OBJ.WHEAT]:     { name:'小麦', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[], render:'wheat', crop:true },
  [Game.OBJ.CAMPFIRE]:  { name:'焚き火', solid:false, mineable:true, tool:null, tier:0, hp:3, light:9, drops:[{item:'campfire', n:[1,1]}], render:'campfire', cook:true },
  [Game.OBJ.LANTERN]:   { name:'ランタン', solid:false, mineable:true, tool:null, tier:0, hp:2, light:10, drops:[{item:'lantern', n:[1,1]}], render:'lantern' },
  [Game.OBJ.FENCE]:     { name:'柵', solid:true, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'fence', n:[1,1]}], render:'fence' },
  [Game.OBJ.DOOR]:      { name:'扉', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'door', n:[1,1]}], render:'door' },
  [Game.OBJ.BED]:       { name:'ベッド', solid:false, mineable:true, tool:null, tier:0, hp:3, drops:[{item:'bed', n:[1,1]}], render:'bed', bed:true },
  [Game.OBJ.SAPLING]:   { name:'苗木', solid:false, mineable:true, tool:null, tier:0, hp:1, drops:[{item:'sapling', n:[1,1]}], render:'sapling', sapling:true },
  // 影世界固有オブジェクト
  [Game.OBJ.SHADOW_TREE]:  { name:'影樹', solid:true, mineable:true, tool:'axe', tier:0, hp:8, drops:[{item:'shadow_wood', n:[2,4]}], render:'shadowtree', shadowOnly:true },
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
  [Game.OBJ.ENCHANT_TABLE]:{ name:'エンチャント台', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:8, light:5, drops:[{item:'enchant_table', n:[1,1]}], render:'enchant', enchant:true },
  // ダンジョン
  [Game.OBJ.DUNGEON_WALL]:{ name:'遺跡の壁', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:20, drops:[{item:'stone', n:[1,2]}], render:'dwall' },
  [Game.OBJ.ICE_WALL]:   { name:'氷壁', solid:true, mineable:true, tool:'pickaxe', tier:1, hp:14, drops:[{item:'stone', n:[0,1]}], render:'icewall' },
  [Game.OBJ.TOMB_WALL]:  { name:'砂岩の壁', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:18, drops:[{item:'stone', n:[1,2]},{item:'gold_ore', n:[0,1]}], render:'twall' },
  [Game.OBJ.FORGE_WALL]: { name:'溶岩岩の壁', solid:true, mineable:true, tool:'pickaxe', tier:3, hp:24, drops:[{item:'stone', n:[1,2]},{item:'iron_ore', n:[0,1]}], render:'fwall' },
  [Game.OBJ.SPAWNER]:    { name:'魔物の巣', solid:true, mineable:true, tool:'pickaxe', tier:2, hp:16, light:3, drops:[{item:'bone', n:[1,3]},{item:'shadow_shard', n:[0,1]}], render:'spawner', spawner:true },
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
  wood_pickaxe:{ name:'木のツルハシ', stack:1, color:'#9c6b3f', tool:'pickaxe', tier:1 },
  stone_pickaxe:{ name:'石のツルハシ', stack:1, color:'#888d91', tool:'pickaxe', tier:2 },
  iron_pickaxe:{ name:'鉄のツルハシ', stack:1, color:'#d8d8dc', tool:'pickaxe', tier:3 },
  wood_axe:    { name:'木の斧', stack:1, color:'#9c6b3f', tool:'axe', tier:1 },
  stone_axe:   { name:'石の斧', stack:1, color:'#888d91', tool:'axe', tier:2 },
  wood_block:  { name:'木ブロック', stack:99, color:'#9c6b3f', place:Game.OBJ.WOOD_BLOCK },
  stone_block: { name:'石ブロック', stack:99, color:'#888d91', place:Game.OBJ.STONE_BLOCK },
  crafting_table:{ name:'作業台', stack:99, color:'#b5803f', place:Game.OBJ.CRAFTING_TABLE },
  furnace:     { name:'かまど', stack:99, color:'#5a5a5e', place:Game.OBJ.FURNACE },
  torch:       { name:'たいまつ', stack:99, color:'#ffcf6b', place:Game.OBJ.TORCH },
  chest:       { name:'チェスト', stack:99, color:'#a9762f', place:Game.OBJ.CHEST },
  // 食料・素材
  berry:       { name:'木の実', stack:32, color:'#c0307a', food:12 },
  cactus:      { name:'サボテン', stack:32, color:'#3b8a3b', food:6 },
  raw_meat:    { name:'生肉', stack:16, color:'#c85a5a', food:10, cookTo:'cooked_meat', spoils:true },
  cooked_meat: { name:'焼き肉', stack:16, color:'#9c5a2a', food:40 },
  rotten_meat: { name:'腐肉', stack:16, color:'#6b7a3a', food:6, sick:true },
  guts:        { name:'臓物', stack:16, color:'#8a2a3a' },
  hide:        { name:'毛皮', stack:99, color:'#b08858' },
  leather:     { name:'なめし革', stack:99, color:'#8a5a30' },
  bone:        { name:'骨', stack:99, color:'#e8e4d0' },
  string:      { name:'糸', stack:99, color:'#dadada' },
  slime_ball:  { name:'スライム玉', stack:99, color:'#5fc46b' },
  wheat:       { name:'小麦', stack:99, color:'#d9b84a' },
  wheat_seeds: { name:'小麦の種', stack:99, color:'#9ab84a', plant:Game.OBJ.WHEAT },
  bread:       { name:'パン', stack:16, color:'#c79a4a', food:35 },
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
  window:        { name:'窓', stack:99, color:'#a8d8e8', place:Game.OBJ.WINDOW },
  bridge:        { name:'橋', stack:99, color:'#9c6b3f', place:Game.OBJ.BRIDGE },
  sign:          { name:'立て札', stack:16, color:'#a9762f', place:Game.OBJ.SIGN },
  enchant_table: { name:'エンチャント台', stack:4, color:'#5a3a8a', place:Game.OBJ.ENCHANT_TABLE },
  void_heart:    { name:'虚の心臓', stack:16, color:'#d040b0', flavor:'飢餓の獣の核。喰らうほどに飢える、終わりなき渇望の結晶。' },
  // 上位武器（銃）
  bullet:        { name:'弾丸', stack:99, color:'#caa86a' },
  pistol:        { name:'拳銃', stack:1, color:'#5a5a5e', tool:'gun', ammo:'bullet', fireDmg:7, flavor:'狭間に流れ着いた、火を吐く鋼。' },
  shadow_rifle:  { name:'影のライフル', stack:1, color:'#6a4f9a', tool:'gun', ammo:'bullet', fireDmg:14, flavor:'影鋼で鍛えた連射銃。闇さえ撃ち抜く。' },
  // 乗り物
  car:           { name:'車', stack:1, color:'#c0444a', vehicle:'car', flavor:'大地を駆ける鉄の馬。' },
  boat:          { name:'ボート', stack:1, color:'#9c6b3f', vehicle:'boat', flavor:'水を越えるための小舟。' },
  plane:         { name:'飛行機', stack:1, color:'#8a96c0', vehicle:'plane', flavor:'空を行く翼。すべての境界を越えて。' },
  // ロケット/宇宙
  rocket:        { name:'ロケット', stack:1, color:'#d8d8e0', place:Game.OBJ.ROCKET, flavor:'空の果て、星々の海へ。全ての貴き素材を束ねて。' },
  star_metal:    { name:'星鋼', stack:99, color:'#aee0ff', flavor:'星の核から採れる金属。地上のどんな鋼より硬く、軽い。' },
  star_core:     { name:'星核', stack:16, color:'#ffe9ff', flavor:'小さな星そのもの。無限の力が秘められている。' },
  cosmic_blade:  { name:'コズミックブレード', stack:1, color:'#aee0ff', tool:'sword', tier:5, attack:18, flavor:'星鋼で鍛えし剣。一閃が闇を裂く。' },
  star_cannon:   { name:'スターキャノン', stack:1, color:'#aee0ff', tool:'gun', ammo:'bullet', fireDmg:22, flavor:'星の力を撃ち放つ砲。' },
  gravity_boots: { name:'重力ブーツ', stack:1, color:'#88a', armor:4, slot:'chest', flavor:'星の重力を御す靴。' },
  // 家具・家作り
  healing_totem: { name:'癒しの祭壇', stack:16, color:'#7fd0a0', place:Game.OBJ.HEALING_TOTEM, flavor:'傍にいる者の傷を癒す祭壇。' },
  street_lamp:   { name:'街灯', stack:16, color:'#ffe9a0', place:Game.OBJ.STREET_LAMP },
  table:         { name:'テーブル', stack:16, color:'#9c6b3f', place:Game.OBJ.TABLE },
  chair:         { name:'椅子', stack:16, color:'#9c6b3f', place:Game.OBJ.CHAIR },
  bookshelf:     { name:'本棚', stack:16, color:'#7a5230', place:Game.OBJ.BOOKSHELF },
  glass:         { name:'ガラス', stack:99, color:'#a8d8e8', place:Game.OBJ.GLASS },
  rug:           { name:'絨毯', stack:99, color:'#b04a6a', place:Game.OBJ.RUG },
  // 魔法武器（ボスドロップのレア）
  warp_staff:    { name:'ワープの杖', stack:1, color:'#b06ad0', tool:'warp', flavor:'空間を歪め、一瞬で間合いを詰める/離す。' },
  flame_staff:   { name:'炎の杖', stack:1, color:'#ff7a3c', tool:'staff', fireDmg:16, magic:'fire', flavor:'業火の弾を放つ。弾は要らぬ、己が魔力で。' },
  frost_staff:   { name:'氷結の杖', stack:1, color:'#9fd8ff', tool:'staff', fireDmg:12, magic:'frost', flavor:'凍てつく弾で敵を縛る。' },
  flying_carpet: { name:'空飛ぶ絨毯', stack:1, color:'#c0407a', vehicle:'carpet', flavor:'古の魔法で織られた絨毯。空を自在に駆ける。' },
  shadow_altar:  { name:'影の祭壇', stack:4, color:'#3a2050', place:Game.OBJ.SHADOW_ALTAR },
  // ボス報酬
  shadow_core:   { name:'影核', stack:16, color:'#c060ff', flavor:'影の主の心臓。世界を裂いた最初の祈りが、結晶となって残ったもの。' },
  sanity_charm:  { name:'影核のお守り', stack:1, color:'#c060ff', armor:2, slot:'head', lumen:true, immuneSanity:true },
  // エンディング
  unity_core:    { name:'統合の核', stack:1, color:'#ffffff', ending:true, flavor:'光と影、ふたつの祈りを束ねる核。掲げれば、割れた世界はひとつに還る。' },
  // ===== P25 コンテンツ拡張: 素材 =====
  gold_bar:      { name:'金塊', stack:99, color:'#e8c54a', flavor:'精錬された黄金。装飾にも、刃にも。' },
  chitin:        { name:'甲殻', stack:99, color:'#b07030', flavor:'砂漠の蟲の硬い殻。軽く、しなやかな防具になる。' },
  // ===== P25: 武器 =====
  bone_club:     { name:'骨の棍棒', stack:1, color:'#dcdcd0', tool:'sword', tier:1, attack:4, flavor:'打ち倒した者の骨で。原始の暴力。' },
  gold_sword:    { name:'金の剣', stack:1, color:'#e8c54a', tool:'sword', tier:2, attack:6, flavor:'美しき黄金の刃。見栄えは一流、実用も悪くない。' },
  war_hammer:    { name:'戦鎚', stack:1, color:'#b8bcc0', tool:'sword', tier:3, attack:10, flavor:'振り抜けば鎧ごと砕く重鎚。' },
  crystal_blade: { name:'影晶の刃', stack:1, color:'#b86ad0', tool:'sword', tier:4, attack:13, voidBonus:true, flavor:'影晶を研ぎ澄ました刃。虚ろなものほどよく斬れる。' },
  chitin_spear:  { name:'甲殻の槍', stack:1, color:'#c08040', tool:'sword', tier:2, attack:7, flavor:'砂漠の蟲の殻を束ねた槍。間合いに優れる。' },
  // ===== P25: 防具・セット素材 =====
  gold_helmet:   { name:'金の兜', stack:1, color:'#e8c54a', armor:2, slot:'head' },
  gold_chest:    { name:'金の鎧', stack:1, color:'#e8c54a', armor:3, slot:'chest' },
  crystal_helmet:{ name:'影晶の兜', stack:1, color:'#b86ad0', armor:3, slot:'head' },
  crystal_chest: { name:'影晶の鎧', stack:1, color:'#b86ad0', armor:5, slot:'chest' },
  star_helmet:   { name:'星鋼の兜', stack:1, color:'#aee0ff', armor:4, slot:'head' },
  chitin_armor:  { name:'甲殻の鎧', stack:1, color:'#c08040', armor:3, slot:'chest' },
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
  { out:{id:'bread', n:1}, in:{wheat:3}, station:'crafting_table' },
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
  // 銃・弾・乗り物
  { out:{id:'bullet', n:8}, in:{iron:1, coal:1}, station:'crafting_table' },
  { out:{id:'pistol', n:1}, in:{iron:5, wood:1}, station:'crafting_table' },
  { out:{id:'shadow_rifle', n:1}, in:{shadow_steel:4, lumen:2}, station:'crafting_table' },
  { out:{id:'boat', n:1}, in:{wood:8}, station:'crafting_table' },
  { out:{id:'car', n:1}, in:{iron:8, coal:4}, station:'crafting_table' },
  { out:{id:'plane', n:1}, in:{shadow_steel:6, iron:6, lumen:4}, station:'crafting_table' },
  // ロケット(高コスト)・宇宙装備
  { out:{id:'rocket', n:1}, in:{iron:20, shadow_steel:10, lumen:10, shadow_core:3}, station:'crafting_table' },
  { out:{id:'cosmic_blade', n:1}, in:{star_metal:5, shadow_steel:3}, station:'crafting_table' },
  { out:{id:'star_cannon', n:1}, in:{star_metal:4, lumen:5}, station:'crafting_table' },
  { out:{id:'gravity_boots', n:1}, in:{star_metal:4}, station:'crafting_table' },
  // 家具・家作り
  { out:{id:'healing_totem', n:1}, in:{lumen:3, wood:4}, station:'crafting_table' },
  { out:{id:'street_lamp', n:2}, in:{iron:1, coal:1}, station:'crafting_table' },
  { out:{id:'table', n:1}, in:{wood:4}, station:'crafting_table' },
  { out:{id:'chair', n:1}, in:{wood:3}, station:'crafting_table' },
  { out:{id:'bookshelf', n:1}, in:{wood:6}, station:'crafting_table' },
  { out:{id:'glass', n:4}, in:{stone:2}, station:'furnace' },
  { out:{id:'rug', n:2}, in:{hide:2}, station:'crafting_table' },
  { out:{id:'unity_core', n:1}, in:{shadow_core:3, lumen:10, shadow_crystal:10}, station:'crafting_table' }, // 世界統合
  // 建築・自由度
  { out:{id:'wood_floor', n:4}, in:{wood:1}, station:null },
  { out:{id:'stone_floor', n:4}, in:{stone:1}, station:null },
  { out:{id:'wall', n:2}, in:{wood:2}, station:null },
  { out:{id:'window', n:2}, in:{wood:1, stone:1}, station:'crafting_table' },
  { out:{id:'bridge', n:4}, in:{wood:2}, station:null },
  { out:{id:'sign', n:1}, in:{wood:2}, station:null },
  // 治療・防寒
  { out:{id:'bandage', n:2}, in:{string:2}, station:null },
  { out:{id:'antidote', n:1}, in:{moonleaf:2, flower:1}, station:null },
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
];

// 装備セット効果（head+chest が同セットで発動）
Game.SETS = {
  leather: { name:'革装束', items:['leather_helmet','leather_chest'], hungerSlow:0.5 },
  iron:    { name:'鉄装束', items:['iron_helmet','iron_chest'], armor:2 },
  shadow:  { name:'影鋼装束', items:['shadow_helmet','shadow_chest'], armor:1, sanityResist:true },
  gold:    { name:'黄金装束', items:['gold_helmet','gold_chest'], armor:1, hungerSlow:0.3 },
  crystal: { name:'影晶装束', items:['crystal_helmet','crystal_chest'], armor:2, sanityResist:true },
  star:    { name:'星鋼装束', items:['star_helmet','gravity_boots'], armor:3 },
};

// 難易度（自由度: のんびり建築〜高難度）
Game.DIFFICULTIES = {
  peaceful: { name:'のんびり', desc:'敵が出ず、正気では死なない。建築と探索を満喫', spawnHostiles:false, sanityKill:false, dmgMult:0 },
  normal:   { name:'ふつう', desc:'標準のサバイバル', spawnHostiles:true, sanityKill:true, dmgMult:1 },
  hard:     { name:'ハード', desc:'敵は手強く正気も削れやすい', spawnHostiles:true, sanityKill:true, dmgMult:1.4 },
};

// モブ定義
Game.MOBS = {
  rabbit:   { name:'うさぎ', hostile:false, hp:4,  speed:1.6, color:'#d8cfc0', size:7,  drops:[{item:'raw_meat',n:[1,1]},{item:'hide',n:[0,1]}], flee:true, xp:1 },
  deer:     { name:'鹿', hostile:false, hp:8,  speed:1.4, color:'#a9762f', size:11, drops:[{item:'raw_meat',n:[1,3]},{item:'hide',n:[1,2]}], flee:true, xp:2 },
  sheep:    { name:'羊', hostile:false, hp:6,  speed:1.0, color:'#eee', size:10, drops:[{item:'raw_meat',n:[1,2]},{item:'hide',n:[1,2]}], flee:true, xp:1 },
  slime:    { name:'スライム', hostile:true, hp:6,  speed:1.1, color:'#5fc46b', size:10, drops:[{item:'slime_ball',n:[1,2]},{item:'shadow_shard',n:[0,1]}], dmg:2, hop:true, xp:2 },
  zombie:   { name:'ゾンビ', hostile:true, hp:14, speed:1.3, color:'#4a7a4a', size:11, drops:[{item:'raw_meat',n:[0,1]},{item:'guts',n:[0,1]},{item:'shadow_shard',n:[0,1]}], dmg:4, xp:3, inflict:{infection:200} },
  skeleton: { name:'スケルトン', hostile:true, hp:12, speed:1.5, color:'#dcdcd0', size:10, drops:[{item:'bone',n:[1,3]},{item:'shadow_shard',n:[0,1]}], dmg:3, xp:3 },
  spider:   { name:'クモ', hostile:true, hp:10, speed:2.2, color:'#3a2a3a', size:12, drops:[{item:'string',n:[1,2]},{item:'shadow_shard',n:[0,1]}], dmg:3, xp:3 },
  // 影世界固有モブ
  wraith:   { name:'影霊', hostile:true, hp:16, speed:2.0, color:'#6a4f9a', size:11, drops:[{item:'shadow_shard',n:[1,2]}], dmg:5, xp:4, shadow:true, ghost:true },
  watcher:  { name:'見張り目', hostile:true, hp:24, speed:0.8, color:'#241a3a', size:13, drops:[{item:'shadow_crystal',n:[0,2]},{item:'shadow_shard',n:[1,1]}], dmg:6, xp:5, shadow:true },
  // ボスと手下
  sovereign:{ name:'影の主', hostile:true, hp:260, speed:1.4, color:'#7a30c0', size:30, drops:[{item:'shadow_core',n:[2,4]},{item:'shadow_steel',n:[4,8]},{item:'shadow_crystal',n:[5,10]},{item:'warp_staff',n:[0,1]}], dmg:10, xp:60, shadow:true, boss:true },
  shadow_spawn:{ name:'影の落とし子', hostile:true, hp:6, speed:2.4, color:'#5a3a8a', size:8, drops:[{item:'shadow_shard',n:[0,1]}], dmg:3, xp:1, shadow:true, ghost:true },
  // 深層の徘徊者（影の深層でのみ出現）
  abyss_stalker:{ name:'深淵の徘徊者', hostile:true, hp:34, speed:2.0, color:'#48206a', size:15, drops:[{item:'shadow_crystal',n:[1,3]},{item:'lumen',n:[0,2]},{item:'shadow_core',n:[0,1]}], dmg:8, xp:8, shadow:true },
  // グロ: 蛭（出血+感染）
  leech:    { name:'蛭', hostile:true, hp:5, speed:2.3, color:'#5a2030', size:7, drops:[{item:'guts',n:[1,2]}], dmg:2, xp:2, inflict:{bleed:240, infection:300} },
  // 深層の徘徊ボス
  hunger_beast:{ name:'飢餓の獣', hostile:true, hp:140, speed:1.7, color:'#7a1840', size:26, drops:[{item:'void_heart',n:[1,2]},{item:'shadow_core',n:[1,3]},{item:'shadow_crystal',n:[3,6]},{item:'guts',n:[2,4]},{item:'flame_staff',n:[0,1]}], dmg:9, xp:35, shadow:true, big:true, inflict:{bleed:300} },
  // ダンジョン系
  frost_wisp:{ name:'氷霊', hostile:true, hp:10, speed:1.6, color:'#9fd8ff', size:9, drops:[{item:'lumen',n:[0,1]},{item:'bone',n:[0,1]}], dmg:3, xp:3, inflict:{cold:240} },
  cursed_armor:{ name:'呪鎧', hostile:true, hp:30, speed:0.9, color:'#7a7a86', size:13, drops:[{item:'iron',n:[1,3]},{item:'iron_ore',n:[1,2]}], dmg:6, xp:5 },
  // 宇宙
  void_drone:{ name:'虚空ドローン', hostile:true, hp:18, speed:2.2, color:'#7fa0d0', size:10, drops:[{item:'star_metal',n:[0,2]},{item:'lumen',n:[0,1]}], dmg:5, xp:5, space:true, ghost:true },
  star_guardian:{ name:'星の守護者', hostile:true, hp:320, speed:1.4, color:'#cfe0ff', size:30, drops:[{item:'star_core',n:[2,4]},{item:'star_metal',n:[6,12]},{item:'flying_carpet',n:[0,1]},{item:'frost_staff',n:[0,1]}], dmg:11, xp:80, space:true, big:true },
  // 友好NPC: 謎の旅人
  wanderer: { name:'謎の旅人', hostile:false, hp:20, speed:1.0, color:'#caa84a', size:11, drops:[], xp:0, friendly:true, npc:true },
  // ===== P25 コンテンツ拡張: 新モブ =====
  boar:     { name:'猪', hostile:true, hp:18, speed:1.8, color:'#8a6a4a', size:12, drops:[{item:'raw_meat',n:[1,3]},{item:'hide',n:[1,2]}], dmg:5, xp:4 },
  bat:      { name:'コウモリ', hostile:true, hp:6, speed:2.6, color:'#4a3a4a', size:7, drops:[{item:'guts',n:[0,1]},{item:'string',n:[0,1]}], dmg:2, xp:2, ghost:true },
  bandit:   { name:'山賊', hostile:true, hp:22, speed:1.6, color:'#7a5a3a', size:11, drops:[{item:'gold_bar',n:[0,2]},{item:'iron',n:[0,2]},{item:'bone',n:[0,1]}], dmg:6, xp:6 },
  golem:    { name:'岩ゴーレム', hostile:true, hp:48, speed:0.7, color:'#8a8d91', size:15, drops:[{item:'stone',n:[2,5]},{item:'iron_ore',n:[1,2]},{item:'gold_ore',n:[0,1]}], dmg:8, xp:9, big:true },
  scorpion: { name:'サソリ', hostile:true, hp:14, speed:1.9, color:'#b07030', size:9, drops:[{item:'chitin',n:[1,2]}], dmg:4, xp:4, inflict:{poison:240} },
  ice_bear: { name:'白熊', hostile:true, hp:40, speed:1.4, color:'#e8eef2', size:16, drops:[{item:'raw_meat',n:[2,4]},{item:'hide',n:[2,3]}], dmg:7, xp:8, inflict:{cold:240}, big:true },
  astral_serpent:{ name:'宇宙の大蛇', hostile:true, hp:60, speed:2.0, color:'#b0a0ff', size:16, drops:[{item:'star_metal',n:[1,3]},{item:'star_core',n:[0,1]}], dmg:8, xp:14, space:true, ghost:true, big:true },
};

// 防具スロット
Game.ARMOR_SLOTS = ['head', 'chest'];

// チューニング
Game.TUNE = {
  ATTACK_COOLDOWN: 14,        // tick
  ATTACK_RANGE: 1.6,          // tile
  MOB_CAP: 36,
  SPAWN_INTERVAL: 60,         // tick ごとにスポーン試行
  DESPAWN_TILES: 28,          // この距離超で消滅
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

// 起動時に付与する初期アイテム（チュートリアル簡略化のため最低限）
Game.STARTER_ITEMS = [
  { id:'apple', count:3 },
];

// アイテム絵文字アイコン（視認性向上）。未定義は色付き四角＋頭文字
Game.ITEM_GLYPH = {
  wood:'🪵', shadow_wood:'🪵', stone:'🪨', stone_block:'🧱', wood_block:'🟫', coal:'⚫', iron_ore:'🪨', iron:'🔩', gold_ore:'🟡', gold_bar:'🟨',
  apple:'🍎', berry:'🫐', cactus:'🌵', raw_meat:'🥩', cooked_meat:'🍖', rotten_meat:'🤢', guts:'🩸', wheat:'🌾', wheat_seeds:'🌱', bread:'🍞', moonleaf:'🍃', fish:'🐟',
  hide:'🟤', leather:'🟫', bone:'🦴', string:'🧵', slime_ball:'🟢', flower:'🌸', sapling:'🌱',
  wood_pickaxe:'⛏️', stone_pickaxe:'⛏️', iron_pickaxe:'⛏️', shadow_pickaxe:'⛏️',
  wood_axe:'🪓', stone_axe:'🪓', iron_axe:'🪓', shadow_axe:'🪓', wood_hoe:'🌾', stone_hoe:'🌾',
  wood_sword:'🗡️', stone_sword:'🗡️', iron_sword:'⚔️', shadow_blade:'⚔️',
  leather_helmet:'🎩', iron_helmet:'⛑️', shadow_helmet:'🪖', leather_chest:'🦺', iron_chest:'🛡️', shadow_chest:'🛡️', fur_coat:'🧥', lumen_charm:'🔆', sanity_charm:'🔮',
  bandage:'🩹', antidote:'🧪',
  torch:'🔥', campfire:'🔥', lantern:'🏮', lumen_lantern:'💡', crafting_table:'🛠️', furnace:'🔥', chest:'📦', bed:'🛏️', fence:'🚧', door:'🚪', wall:'🧱', window:'🪟', bridge:'🌉', sign:'🪧', wood_floor:'🟫', stone_floor:'⬜',
  shadow_shard:'🌑', shadow_mirror:'🪞', shadow_crystal:'🔮', lumen:'✨', shadow_steel:'⬛', shadow_core:'💜', unity_core:'⭐', void_heart:'💗', rift_anchor:'🕳️', enchant_table:'✦',
  bullet:'🔸', pistol:'🔫', shadow_rifle:'🔫', car:'🚗', boat:'🛶', plane:'✈️',
  rocket:'🚀', star_metal:'🌟', star_core:'💫', cosmic_blade:'🌠', star_cannon:'🔫', gravity_boots:'👢',
  warp_staff:'🪄', flame_staff:'🔥', frost_staff:'❄️', flying_carpet:'🧞',
  healing_totem:'⛲', street_lamp:'🪔', table:'🪑', chair:'🪑', bookshelf:'📚', glass:'🪟', rug:'🟥',
  chitin:'🦂', bone_club:'🦴', gold_sword:'⚔️', war_hammer:'🔨', crystal_blade:'⚔️', chitin_spear:'🔱',
  gold_helmet:'⛑️', gold_chest:'🛡️', crystal_helmet:'🪖', crystal_chest:'🛡️', star_helmet:'⛑️', chitin_armor:'🦺',
};

Game.INV_SIZE = 36;       // 先頭9 = ホットバー
Game.HOTBAR_SIZE = 9;
Game.DAY_LENGTH = 24000;  // 1日のtick数（昼夜は次波で本格化）
