// achievements.js — 実績トラッキング（トースト＋永続化）
window.Game = window.Game || {};

Game.Achievements = (function () {
  Game.ACHIEVEMENTS = {
    first_wood:    { name:'最初の一歩', desc:'木材を手に入れた' },
    first_craft:   { name:'職人の目覚め', desc:'初めてクラフトした' },
    first_night:   { name:'夜を越えて', desc:'夜の敵を倒した' },
    first_mirror:  { name:'鏡の向こう', desc:'影鏡を作った' },
    first_shift:   { name:'影渡り', desc:'影の世界へ渡った' },
    shadow_gear:   { name:'闇を纏う', desc:'影鋼の装備を作った' },
    lumen:         { name:'光を掲げて', desc:'光素を採取した' },
    deep_sanity:   { name:'正気の淵', desc:'正気度が尽きかけた' },
    level5:        { name:'歴戦', desc:'レベル5に到達' },
    madness_sight: { name:'狂気の視界', desc:'幻影鉱脈を掘り当てた' },
    boss_slain:    { name:'影を統べし者', desc:'影の主を打ち倒した' },
    lore_complete: { name:'碑文の蒐集家', desc:'全ての石碑を読んだ' },
    resonance:     { name:'共鳴', desc:'二相を繋ぎ封印を解いた' },
    reunified:     { name:'世界を還せし者', desc:'光と影をひとつに還した' },
    magic_user:    { name:'魔を操る', desc:'魔法武器を手に入れた' },
    legendary:     { name:'伝説を手に', desc:'レジェンダリ装備を手に入れた' },
    space_traveler:{ name:'星の海へ', desc:'宇宙へ旅立った' },
    dungeon_boss:  { name:'迷宮の覇者', desc:'ダンジョンの主を打ち倒した' },
    explorer:      { name:'大いなる探究者', desc:'ランドマークを5つ発見した' },
    // 各ボス討伐
    slay_tomb_king:   { name:'砂塵を制す', desc:'墳墓の王を打ち倒した' },
    slay_forge_titan: { name:'溶炉を鎮めし者', desc:'溶炉の巨人を打ち倒した' },
    slay_star_guardian:{ name:'星を超えて', desc:'星の守護者を打ち倒した' },
    slay_crystal_queen:{ name:'氷晶の終焉', desc:'水晶の女王を打ち倒した' },
    slay_hunger_beast: { name:'渇望を断つ', desc:'飢餓の獣を打ち倒した' },
    slay_abyss_dragon: { name:'屠竜', desc:'深淵の竜を打ち倒した' },
    slay_twilight_colossus: { name:'黄昏を砕く', desc:'黄昏の巨像を打ち倒した' },
    slay_swamp_lord: { name:'澱みを断つ', desc:'沼の主を打ち倒した' },
    slay_lava_lord: { name:'灼熱を制す', desc:'溶岩の王を打ち倒した' },
    slay_spore_queen: { name:'菌糸の終焉', desc:'胞子の女王を打ち倒した' },
    // マイルストーン
    level20:       { name:'熟達者', desc:'レベル20に到達' },
    level50:       { name:'達人', desc:'レベル50に到達' },
    gun_user:      { name:'ガンスリンガー', desc:'銃を手に入れた' },
    potion_master: { name:'錬金の心得', desc:'バフ薬を使った' },
    elite_hunter:  { name:'エリートハンター', desc:'精鋭個体を討伐した' },
    champion_slayer:{ name:'チャンピオンスレイヤー', desc:'ネームド・チャンピオンを討伐した' },
    bounty_king:   { name:'賞金稼ぎの王', desc:'賞金首の大物を討ち取った' },
    // 新コンテンツ実績
    visit_swamp:   { name:'澱みへ踏み入る', desc:'毒の沼地に足を踏み入れた' },
    visit_volcanic:{ name:'灼熱の地へ', desc:'火山地帯に足を踏み入れた' },
    biome_master:  { name:'全地踏破', desc:'草原・森・砂漠・雪原・沼地・火山を踏破した' },
    pack_rat:      { name:'大荷物', desc:'インベントリ上限を100まで拡張した' },
    stargazer:     { name:'星を掴む者', desc:'流星群で星のかけらを手にした' },
    dual_relic:    { name:'二つの遺物', desc:'遺物を2つ同時に装備した' },
    elite_veteran: { name:'精鋭狩りの達人', desc:'精鋭個体を25体討伐した' },
    champion_master:{ name:'チャンピオンの覇者', desc:'チャンピオンを10体討伐した' },
    bounty_veteran:{ name:'凄腕の賞金稼ぎ', desc:'賞金を10回受け取った' },
    endgame_smith: { name:'星と虚無の鍛冶', desc:'エンドゲーム装備を作製した' },
    relic_hoarder: { name:'遺物収集家', desc:'遺物を手に入れた' },
  };
  // ボス種別→実績ID
  Game.BOSS_ACH = { tomb_king:'slay_tomb_king', forge_titan:'slay_forge_titan', star_guardian:'slay_star_guardian', crystal_queen:'slay_crystal_queen', hunger_beast:'slay_hunger_beast', abyss_dragon:'slay_abyss_dragon', twilight_colossus:'slay_twilight_colossus', swamp_lord:'slay_swamp_lord', lava_lord:'slay_lava_lord', spore_queen:'slay_spore_queen' };

  // 種別判定用（手に入れた時の実績）
  Game.MAGIC_ITEMS = ['warp_staff', 'flame_staff', 'frost_staff', 'flying_carpet'];
  Game.LEGENDARY_ITEMS = ['sand_greatsword', 'magma_hammer', 'pharaoh_crown', 'cosmic_blade', 'star_cannon', 'excalibur', 'gae_bolg', 'gate_babylon', 'prism_blade', 'dragon_fang', 'colossus_blade', 'mire_scythe', 'magma_maul', 'starcore_greatsword', 'voidcore_blade', 'spore_scythe'];

  Game.ENDGAME_ITEMS = ['starcore_greatsword', 'voidcore_blade', 'star_aegis', 'void_helm'];

  function set() { return Game.state.achievements || (Game.state.achievements = {}); }

  function has(id) { return !!set()[id]; }

  function unlock(id) {
    if (!id) return;
    if (!Game.ACHIEVEMENTS[id] || has(id)) return;
    set()[id] = 1;
    const a = Game.ACHIEVEMENTS[id];
    Game.UI.toast('🏆 実績: ' + a.name + ' — ' + a.desc);
    Game.Audio.play('levelup');
  }

  // バイオーム到達の記録＋実績
  function visitBiome(tile) {
    if (!Game.state) return; const T = Game.TILE;
    const map = {}; map[T.GRASS] = 'grass'; map[T.FOREST] = 'forest'; map[T.SAND] = 'sand'; map[T.SNOW] = 'snow'; map[T.SWAMP] = 'swamp'; map[T.VOLCANIC] = 'volcanic';
    const key = map[tile]; if (!key) return;
    const vb = Game.state.visitedBiomes || (Game.state.visitedBiomes = {});
    if (vb[key]) return;
    vb[key] = 1;
    if (key === 'swamp') unlock('visit_swamp');
    if (key === 'volcanic') unlock('visit_volcanic');
    if (['grass', 'forest', 'sand', 'snow', 'swamp', 'volcanic'].every(function (k) { return vb[k]; })) unlock('biome_master');
  }

  function count() { return Object.keys(set()).length; }
  function total() { return Object.keys(Game.ACHIEVEMENTS).length; }

  return { unlock, has, count, total, visitBiome };
})();
