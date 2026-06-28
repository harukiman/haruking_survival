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
Game.TILE = { DEEP_WATER:0, WATER:1, SAND:2, GRASS:3, FOREST:4, DIRT:5, STONE:6, SNOW:7 };

// オブジェクトレイヤー（0=なし、100番台=プレイヤー設置物）
Game.OBJ = {
  NONE:0, TREE:1, ROCK:2, COAL_ORE:3, IRON_ORE:4, GOLD_ORE:5, BUSH:6, FLOWER:7,
  BERRY_BUSH:8, PINE_TREE:9, CACTUS:10,
  WOOD_BLOCK:100, STONE_BLOCK:101, CRAFTING_TABLE:102, FURNACE:103, TORCH:104, CHEST:105,
  FARMLAND:106, WHEAT:107, CAMPFIRE:108, LANTERN:109, FENCE:110, DOOR:111, BED:112, SAPLING:113,
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
  raw_meat:    { name:'生肉', stack:16, color:'#c85a5a', food:10, cookTo:'cooked_meat' },
  cooked_meat: { name:'焼き肉', stack:16, color:'#9c5a2a', food:40 },
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
  iron_helmet: { name:'鉄の兜', stack:1, color:'#d8d8dc', armor:2, slot:'head' },
  iron_chest:  { name:'鉄の鎧', stack:1, color:'#d8d8dc', armor:4, slot:'chest' },
  // 設置物
  campfire:    { name:'焚き火', stack:99, color:'#ff8a3c', place:Game.OBJ.CAMPFIRE },
  lantern:     { name:'ランタン', stack:99, color:'#ffd86b', place:Game.OBJ.LANTERN },
  fence:       { name:'柵', stack:99, color:'#9c6b3f', place:Game.OBJ.FENCE },
  door:        { name:'扉', stack:99, color:'#a9762f', place:Game.OBJ.DOOR },
  bed:         { name:'ベッド', stack:1, color:'#c44', place:Game.OBJ.BED },
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
];

// モブ定義
Game.MOBS = {
  rabbit:   { name:'うさぎ', hostile:false, hp:4,  speed:1.6, color:'#d8cfc0', size:7,  drops:[{item:'raw_meat',n:[1,1]},{item:'hide',n:[0,1]}], flee:true, xp:1 },
  deer:     { name:'鹿', hostile:false, hp:8,  speed:1.4, color:'#a9762f', size:11, drops:[{item:'raw_meat',n:[1,3]},{item:'hide',n:[1,2]}], flee:true, xp:2 },
  sheep:    { name:'羊', hostile:false, hp:6,  speed:1.0, color:'#eee', size:10, drops:[{item:'raw_meat',n:[1,2]},{item:'hide',n:[1,2]}], flee:true, xp:1 },
  slime:    { name:'スライム', hostile:true, hp:6,  speed:1.1, color:'#5fc46b', size:10, drops:[{item:'slime_ball',n:[1,2]}], dmg:2, hop:true, xp:2 },
  zombie:   { name:'ゾンビ', hostile:true, hp:14, speed:1.3, color:'#4a7a4a', size:11, drops:[{item:'raw_meat',n:[0,1]}], dmg:4, xp:3 },
  skeleton: { name:'スケルトン', hostile:true, hp:12, speed:1.5, color:'#dcdcd0', size:10, drops:[{item:'bone',n:[1,3]}], dmg:3, xp:3 },
  spider:   { name:'クモ', hostile:true, hp:10, speed:2.2, color:'#3a2a3a', size:12, drops:[{item:'string',n:[1,2]}], dmg:3, xp:3 },
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
};

// 起動時に付与する初期アイテム（チュートリアル簡略化のため最低限）
Game.STARTER_ITEMS = [
  { id:'apple', count:3 },
];

Game.INV_SIZE = 36;       // 先頭9 = ホットバー
Game.HOTBAR_SIZE = 9;
Game.DAY_LENGTH = 24000;  // 1日のtick数（昼夜は次波で本格化）
