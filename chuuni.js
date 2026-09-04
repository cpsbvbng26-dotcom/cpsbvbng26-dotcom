/*!
 * 厨二病ジェネレーター - 生成エンジン
 *
 * 出力テキストは 〖漢字|カナ〗 というマーカーを含む「マークアップ文字列」で表現する。
 * render.plain() でプレーンテキスト（漢字（カナ））、render.html() で <ruby> に変換する。
 */
var CHUUNI = (function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 語彙辞書  [漢字, カタカナ読み, ラテン表記]
   * ---------------------------------------------------------------- */

  var PREFIX = [
    ['終焉', 'エンド', 'End'],
    ['禁忌', 'フォビドゥン', 'Forbidden'],
    ['断罪', 'ジャッジメント', 'Judgment'],
    ['虚無', 'ニヒル', 'Nihil'],
    ['深淵', 'アビス', 'Abyss'],
    ['永劫', 'エターナル', 'Eternal'],
    ['堕天', 'フォールン', 'Fallen'],
    ['慟哭', 'ラメント', 'Lament'],
    ['静寂', 'サイレンス', 'Silence'],
    ['背徳', 'インモラル', 'Immoral'],
    ['逆理', 'パラドクス', 'Paradox'],
    ['極夜', 'ポーラーナイト', 'Polar Night'],
    ['残響', 'レゾナンス', 'Resonance'],
    ['絶対零度', 'アブソリュートゼロ', 'Absolute Zero'],
    ['無窮', 'インフィニティ', 'Infinity'],
    ['神託', 'オラクル', 'Oracle'],
    ['黙示', 'アポカリプス', 'Apocalypse'],
    ['混沌', 'カオス', 'Chaos'],
    ['崩壊', 'コラプス', 'Collapse'],
    ['覚醒', 'アウェイクン', 'Awaken'],
    ['輪廻', 'サムサラ', 'Samsara'],
    ['贖罪', 'アトーンメント', 'Atonement'],
    ['顕現', 'マニフェスト', 'Manifest'],
    ['天啓', 'レベレーション', 'Revelation'],
    ['血盟', 'ブラッドパクト', 'Blood Pact'],
    ['冒涜', 'ブラスフェミー', 'Blasphemy'],
    ['終末', 'ラグナロク', 'Ragnarok'],
    ['原初', 'プライマル', 'Primal'],
    ['超越', 'トランセンド', 'Transcend'],
    ['因果律', 'カウザリティ', 'Causality'],
    ['最果て', 'ラストホライズン', 'Last Horizon'],
    ['不可逆', 'イレヴァーシブル', 'Irreversible']
  ];

  var ELEMENT = [
    ['蒼焔', 'アズールフレイム', 'Azure Flame'],
    ['紅蓮', 'クリムゾン', 'Crimson'],
    ['漆黒', 'ジェットブラック', 'Jet Black'],
    ['白銀', 'アルジェント', 'Argent'],
    ['黄昏', 'トワイライト', 'Twilight'],
    ['暁光', 'ドーン', 'Dawn'],
    ['雷霆', 'トニトルス', 'Tonitrus'],
    ['氷獄', 'コキュートス', 'Cocytus'],
    ['業火', 'インフェルノ', 'Inferno'],
    ['星辰', 'アストラル', 'Astral'],
    ['虚空', 'ヴォイド', 'Void'],
    ['月蝕', 'エクリプス', 'Eclipse'],
    ['血晶', 'ブラッドクリスタル', 'Blood Crystal'],
    ['劫火', 'カルパファイア', 'Kalpa Fire'],
    ['幽幻', 'ファンタズム', 'Phantasm'],
    ['天穹', 'フィルマメント', 'Firmament'],
    ['冥闇', 'ネザー', 'Nether'],
    ['銀嶺', 'シルヴァリッジ', 'Silver Ridge'],
    ['翠緑', 'ヴェルダン', 'Verdant'],
    ['灰燼', 'アッシェン', 'Ashen'],
    ['深海', 'アビサル', 'Abyssal'],
    ['烈風', 'テンペスト', 'Tempest'],
    ['重力', 'グラビティ', 'Gravity'],
    ['時空', 'クロノス', 'Chronos'],
    ['聖光', 'ホーリーレイ', 'Holy Ray'],
    ['瘴気', 'ミアズマ', 'Miasma'],
    ['砂塵', 'サンドストーム', 'Sandstorm'],
    ['深緋', 'スカーレット', 'Scarlet'],
    ['白夜', 'ホワイトナイト', 'White Night'],
    ['焦土', 'スコーチ', 'Scorch']
  ];

  var NOUN = [
    ['剣', 'ブレイド', 'Blade'],
    ['戟', 'ハルバード', 'Halberd'],
    ['翼', 'ウィング', 'Wing'],
    ['瞳', 'アイズ', 'Eyes'],
    ['鎖', 'チェイン', 'Chain'],
    ['棺', 'コフィン', 'Coffin'],
    ['円環', 'サークル', 'Circle'],
    ['楔', 'ステイク', 'Stake'],
    ['牙', 'ファング', 'Fang'],
    ['爪', 'クロウ', 'Claw'],
    ['王冠', 'クラウン', 'Crown'],
    ['聖典', 'コーデックス', 'Codex'],
    ['讃歌', 'アンセム', 'Anthem'],
    ['咆哮', 'ロア', 'Roar'],
    ['葬送曲', 'レクイエム', 'Requiem'],
    ['槍', 'ランス', 'Lance'],
    ['盾', 'イージス', 'Aegis'],
    ['砲', 'カノン', 'Cannon'],
    ['鎌', 'サイズ', 'Scythe'],
    ['律', 'ロウ', 'Law'],
    ['刻印', 'シギル', 'Sigil'],
    ['封印', 'シール', 'Seal'],
    ['渦', 'メイルシュトローム', 'Maelstrom'],
    ['柱', 'ピラー', 'Pillar'],
    ['書', 'グリモワール', 'Grimoire'],
    ['歯車', 'コグ', 'Cog'],
    ['方陣', 'マトリクス', 'Matrix'],
    ['祭壇', 'アルター', 'Altar'],
    ['迷宮', 'ラビリンス', 'Labyrinth'],
    ['羅針', 'コンパス', 'Compass'],
    ['楽園', 'エデン', 'Eden'],
    ['墓標', 'エピタフ', 'Epitaph']
  ];

  var BEAST = [
    ['竜', 'ドラゴン', 'Dragon'],
    ['龍神', 'ドラゴンゴッド', 'Dragon God'],
    ['蛇', 'サーペント', 'Serpent'],
    ['獣', 'ビースト', 'Beast'],
    ['熾天使', 'セラフィム', 'Seraphim'],
    ['堕天使', 'フォールンエンジェル', 'Fallen Angel'],
    ['魔王', 'デモンロード', 'Demon Lord'],
    ['巨人', 'タイタン', 'Titan'],
    ['狼', 'フェンリル', 'Fenrir'],
    ['鴉', 'レイヴン', 'Raven'],
    ['蝶', 'パピヨン', 'Papillon'],
    ['麒麟', 'キリン', 'Qilin'],
    ['不死鳥', 'フェニックス', 'Phoenix'],
    ['骸', 'レヴナント', 'Revenant'],
    ['幻獣', 'キマイラ', 'Chimaera'],
    ['死神', 'レイス', 'Wraith'],
    ['海魔', 'クラーケン', 'Kraken'],
    ['妖精', 'ピクシー', 'Pixie']
  ];

  var ROLE = [
    ['支配者', 'ルーラー', 'Ruler'],
    ['観測者', 'オブザーバー', 'Observer'],
    ['継承者', 'サクセサー', 'Successor'],
    ['処刑人', 'エクスキューショナー', 'Executioner'],
    ['放浪者', 'ワンダラー', 'Wanderer'],
    ['審問官', 'インクイジター', 'Inquisitor'],
    ['守護者', 'ガーディアン', 'Guardian'],
    ['簒奪者', 'ユーサーパー', 'Usurper'],
    ['改竄者', 'ファルシファイア', 'Falsifier'],
    ['歌い手', 'カンタトーレ', 'Cantator'],
    ['咎人', 'シナー', 'Sinner'],
    ['伝道者', 'ヘラルド', 'Herald'],
    ['調律者', 'チューナー', 'Tuner'],
    ['剪定者', 'プルーナー', 'Pruner'],
    ['編纂者', 'コンパイラ', 'Compiler'],
    ['亡霊', 'ファントム', 'Phantom'],
    ['開闢者', 'クリエイター', 'Creator'],
    ['番人', 'ウォーデン', 'Warden'],
    ['狩人', 'ハンター', 'Hunter'],
    ['異端者', 'ヘレティック', 'Heretic']
  ];

  var ORG = [
    ['機関', 'オルド', 'Ordo'],
    ['教団', 'カルト', 'Cult'],
    ['騎士団', 'オーダー', 'Order'],
    ['結社', 'ソサエティ', 'Society'],
    ['評議会', 'カウンシル', 'Council'],
    ['学園', 'アカデミー', 'Academy'],
    ['部隊', 'バタリオン', 'Battalion'],
    ['財団', 'ファウンデーション', 'Foundation'],
    ['塔', 'タワー', 'Tower'],
    ['聖堂', 'カテドラル', 'Cathedral'],
    ['監獄', 'プリズン', 'Prison'],
    ['方舟', 'アーク', 'Ark']
  ];

  var NUM = [
    ['零', 'ゼロ', 'Zero'],
    ['壱', 'ファースト', 'First'],
    ['弐', 'セカンド', 'Second'],
    ['参', 'サード', 'Third'],
    ['肆', 'フォース', 'Fourth'],
    ['伍', 'フィフス', 'Fifth'],
    ['陸', 'シックス', 'Sixth'],
    ['漆', 'セブンス', 'Seventh'],
    ['捌', 'エイス', 'Eighth'],
    ['玖', 'ナインス', 'Ninth'],
    ['拾参', 'サーティーンス', 'Thirteenth']
  ];

  /* 「〜を」に続く連体形 */
  var VERB_WO = ['纏いし', '喰らいし', '統べし', '屠りし', '穿ちし', '焼き尽くす', '断ち切りし', '奏でし', '識りし', '砕きし'];
  /* 単独で名詞を修飾する連体形 */
  var VERB_NO = ['呪われし', '選ばれし', '見捨てられし', '封ぜられし', '忘れられし', '堕ちたる', '還りし'];
  /* 詠唱の結び */
  var VERB_END = ['断ち切らん', '焼き尽くさん', '貫かん', '喰らわん', '沈めん', '裁かん', '紡がん', '鎖さん'];

  var NAME_A = ['アルヴィス', 'ゼクス', 'ルシフェル', 'カイン', 'ヴェルナ', 'ノクス', 'エレボス', 'リヒト',
    'シュヴァルツ', 'ヴィルヘルム', 'ディルク', 'オルフェ', 'ザイン', 'アズラエル', 'ヴァイス', 'クロウ',
    'レイン', 'ユーディット', 'グレン', 'ミカエラ'];
  var NAME_MID = ['・', '・ヴァン・', '・フォン・', '・エル・', '・ド・', '・アル・'];
  var NAME_B = ['クロイツェル', 'ヴァルハラ', 'ノスフェラトゥ', 'グランツ', 'ローエングリン', 'ヴァイスハイト',
    'フィンブル', 'ヴィンターベルク', 'オーヴェルニュ', 'ブラウンシュヴァイク', 'テンペスタ', 'ロートリンゲン',
    'シュタインベルク', 'アークライト', 'ヴェルフェゴール', 'ナイトハルト'];

  var ORIGIN = [
    '異界より流れ着いた記憶の残滓',
    '滅びた古代王国の最後の血脈',
    '観測されなかった並行世界の生き残り',
    '神々が破棄した設計図から生まれた存在',
    '誰にも祈られなかった神の成れの果て',
    '三度の転生を経て記憶だけが継承された器',
    '封印されし遺跡の最下層で目覚めた個体',
    '契約によって寿命を担保に入れた元人間'
  ];

  var CONSTRAINT = [
    '月光の下でしか真価を発揮できない',
    '発動の度に記憶を一つ失う',
    '三度目の行使で心臓が止まる',
    '真名を知る者にしか効果が届かない',
    '日没から夜明けまでしか維持できない',
    '対価として左目の視力を捧げ続けている',
    '同じ相手には二度と通用しない',
    '半径十歩の内側でしか展開できない'
  ];

  var TABOO = [
    '真名を口にすること',
    '同じ技を二度使うこと',
    '契約者以外に右腕を見せること',
    '鏡を直視すること',
    '血族の者に刃を向けること',
    '満月の夜に眠ること',
    '自らの墓標に触れること'
  ];

  var QUOTE = [
    '……フッ、面白い。',
    'この右腕が疼く……鎮まれ。',
    '終わりだと? 笑わせるな。',
    '愚問だな。',
    '我が刃に、慈悲はない。',
    '封印を、解け。',
    'ククク……気づいたか。',
    '因果は巡る。逃れられんよ。',
    '対価なき力など、この世に存在しない。',
    '……行くぞ、相棒。',
    '嗤うがいい。それが貴様の最期の声だ。',
    '力が、抑えきれない……!'
  ];

  /* ------------------------------------------------------------------
   * 乱数（シード固定 = 同じシードなら同じ結果）
   * ---------------------------------------------------------------- */

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    var r = mulberry32(hashSeed(String(seed)));
    return {
      next: r,
      int: function (n) { return Math.floor(r() * n); },
      pick: function (arr) { return arr[Math.floor(r() * arr.length)]; },
      chance: function (p) { return r() < p; }
    };
  }

  /* ------------------------------------------------------------------
   * マークアップ
   * ---------------------------------------------------------------- */

  var MARK_RE = /〖([^|〗]*)\|([^〗]*)〗/g;

  /** 漢字とカナからルビ用マーカーを作る */
  function mk(kanji, kana) { return '〖' + kanji + '|' + kana + '〗'; }

  function toPlain(markup) {
    return String(markup).replace(MARK_RE, '$1（$2）');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toHtml(markup) {
    return escapeHtml(markup)
      .replace(MARK_RE, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/\n/g, '<br>');
  }

  function latinOf(parts, level) {
    var s = parts.map(function (w) { return w[2]; }).join(' ');
    return level >= 5 ? s.toUpperCase() : s;
  }

  /* ------------------------------------------------------------------
   * 各種ジェネレーター
   * ---------------------------------------------------------------- */

  function genName(rng) {
    var a = rng.pick(NAME_A);
    if (rng.chance(0.35)) return a;
    return a + rng.pick(NAME_MID) + rng.pick(NAME_B);
  }

  /** 技名 */
  function genSkill(rng, level) {
    var P = rng.pick(PREFIX), E = rng.pick(ELEMENT), N = rng.pick(NOUN),
      B = rng.pick(BEAST), n = rng.pick(NUM);
    var v = rng.pick(VERB_WO);
    var t = level <= 2 ? rng.int(3) : (level <= 4 ? 3 + rng.int(4) : 7 + rng.int(5));
    var head, parts;

    switch (t) {
      case 0:
        head = mk(E[0] + N[0], E[1] + N[1]); parts = [E, N]; break;
      case 1:
        head = mk(B[0] + 'の' + N[0], B[1] + N[1]); parts = [B, N]; break;
      case 2:
        head = mk(P[0] + N[0], P[1] + N[1]); parts = [P, N]; break;
      case 3:
        head = mk(P[0] + 'の' + E[0] + N[0], P[1] + E[1] + N[1]); parts = [P, E, N]; break;
      case 4:
        head = mk(E[0] + 'を' + v + N[0], E[1] + N[1]); parts = [E, N]; break;
      case 5:
        head = mk(P[0] + '之' + N[0], P[1] + N[1]); parts = [P, N]; break;
      case 6:
        head = mk(B[0] + 'の' + E[0] + N[0], B[1] + E[1] + N[1]); parts = [B, E, N]; break;
      case 7:
        head = '【' + P[0] + '】' + mk(E[0] + '之' + N[0], E[1] + N[1]); parts = [P, E, N]; break;
      case 8:
        head = '第' + n[0] + '位階・' + mk(P[0] + E[0] + N[0], P[1] + E[1] + N[1]);
        parts = [n, P, E, N]; break;
      case 9:
        head = '†' + mk(P[0] + E[0] + N[0], P[1] + E[1] + N[1]) + '†'; parts = [P, E, N]; break;
      case 10:
        head = mk(P[0] + E[0] + B[0] + N[0], P[1] + E[1] + B[1] + N[1]); parts = [P, E, B, N]; break;
      default:
        head = mk(E[0] + N[0], E[1] + N[1]) + '・' + mk(P[0] + '形態', P[1] + 'フォーム');
        parts = [E, N, P]; break;
    }
    return { kind: 'skill', label: '技名', head: head, latin: latinOf(parts, level), body: '' };
  }

  /** 二つ名・称号 */
  function genTitle(rng, level) {
    var P = rng.pick(PREFIX), E = rng.pick(ELEMENT), R = rng.pick(ROLE), N = rng.pick(NOUN);
    var t = level <= 2 ? rng.int(2) : (level <= 4 ? 2 + rng.int(3) : 5 + rng.int(3));
    var head, parts;

    switch (t) {
      case 0:
        head = mk(E[0] + 'の' + R[0], E[1] + R[1]); parts = [E, R]; break;
      case 1:
        head = mk(rng.pick(VERB_NO) + R[0], P[1] + R[1]); parts = [P, R]; break;
      case 2:
        head = mk(P[0] + 'の' + R[0], P[1] + R[1]); parts = [P, R]; break;
      case 3:
        head = mk(E[0] + 'を' + rng.pick(VERB_WO) + R[0], E[1] + R[1]); parts = [E, R]; break;
      case 4:
        head = mk(P[0] + '之' + N[0] + 'を持つ' + R[0], P[1] + N[1] + R[1]); parts = [P, N, R]; break;
      case 5:
        head = mk(P[0] + 'にして' + E[0] + 'の' + R[0], P[1] + E[1] + R[1]); parts = [P, E, R]; break;
      case 6:
        head = '最後の' + mk(E[0] + R[0], E[1] + R[1]) + '——' + mk(P[0] + '之' + N[0], P[1] + N[1]);
        parts = [E, R, P, N]; break;
      default:
        head = '【' + mk(P[0] + E[0] + R[0], P[1] + E[1] + R[1]) + '】'; parts = [P, E, R]; break;
    }
    var latin = 'The ' + latinOf(parts, level);
    return { kind: 'title', label: '二つ名', head: head, latin: level >= 5 ? latin.toUpperCase() : latin, body: '' };
  }

  /** 組織名 */
  function genOrg(rng, level) {
    var P = rng.pick(PREFIX), E = rng.pick(ELEMENT), O = rng.pick(ORG), N = rng.pick(NOUN);
    var t = level <= 3 ? rng.int(2) : 2 + rng.int(3);
    var head, parts;

    switch (t) {
      case 0:
        head = mk(P[0] + O[0], P[1] + O[1]); parts = [P, O]; break;
      case 1:
        head = mk(E[0] + O[0], E[1] + O[1]); parts = [E, O]; break;
      case 2:
        head = mk(P[0] + E[0] + O[0], P[1] + E[1] + O[1]); parts = [P, E, O]; break;
      case 3:
        head = mk(P[0] + '之' + N[0] + O[0], P[1] + N[1] + O[1]); parts = [P, N, O]; break;
      default:
        head = '第' + rng.pick(NUM)[0] + '' + mk(E[0] + O[0], E[1] + O[1]); parts = [E, O]; break;
    }
    return { kind: 'org', label: '組織名', head: head, latin: latinOf(parts, level), body: '' };
  }

  /** 詠唱 */
  function genChant(rng, level) {
    var name = genName(rng);
    var E = rng.pick(ELEMENT), P = rng.pick(PREFIX), N = rng.pick(NOUN),
      B = rng.pick(BEAST), R = rng.pick(ROLE), n = rng.pick(NUM);
    var skill = genSkill(rng, level);

    var pool = [
      '我が名は' + name + '——' + mk(E[0], E[1]) + 'を統べし' + mk(R[0], R[1]) + 'なり',
      mk(P[0], P[1]) + 'の理に従い、汝の' + mk(N[0], N[1]) + 'を' + rng.pick(VERB_END),
      '来たれ、' + mk(B[0], B[1]) + '。我が' + mk(N[0], N[1]) + 'に応え、顕現せよ',
      '契約は既に成された。ならば示せ、その' + mk(N[0], N[1]) + 'を',
      mk('第' + n[0] + '封印', n[1] + 'シール') + '、解除——',
      '刻限だ。' + mk(E[0], E[1]) + 'よ、我が声に応え' + rng.pick(VERB_END),
      '我が右腕に宿りし' + mk(B[0], B[1]) + 'よ、今こそ目覚めの時',
      '闇より出でて闇より黒く、' + mk(E[0], E[1]) + 'の彼方へ',
      '忘却の淵に沈め。' + mk(P[0], P[1]) + 'の名において命ずる'
    ];

    var lineCount = Math.min(pool.length, 2 + Math.ceil(level / 2) + rng.int(2));
    var used = {}, lines = [];
    while (lines.length < lineCount) {
      var i = rng.int(pool.length);
      if (used[i]) continue;
      used[i] = true;
      lines.push(pool[i]);
    }
    lines.push('——' + mk('顕現', 'マニフェスト') + 'せよ、' + skill.head + '!!');

    return {
      kind: 'chant',
      label: '詠唱',
      head: skill.head,
      latin: skill.latin,
      body: lines.join('\n')
    };
  }

  /** キャラ設定書 */
  function genProfile(rng, level) {
    var name = genName(rng);
    var title = genTitle(rng, level);
    var org = genOrg(rng, level);
    var skill = genSkill(rng, level);
    var lines = [
      '真名  : ' + name,
      '異名  : ' + title.head,
      '所属  : ' + org.head,
      '起源  : ' + rng.pick(ORIGIN),
      '権能  : ' + skill.head,
      '制約  : ' + rng.pick(CONSTRAINT),
      '禁忌  : ' + rng.pick(TABOO),
      '口癖  : 「' + rng.pick(QUOTE) + '」'
    ];
    return {
      kind: 'profile',
      label: '設定書',
      head: name,
      latin: title.latin,
      body: lines.join('\n')
    };
  }

  var GENERATORS = {
    skill: genSkill,
    title: genTitle,
    org: genOrg,
    chant: genChant,
    profile: genProfile
  };

  var KINDS = [
    { id: 'skill', label: '技名' },
    { id: 'title', label: '二つ名' },
    { id: 'org', label: '組織名' },
    { id: 'chant', label: '詠唱' },
    { id: 'profile', label: '設定書' },
    { id: 'mix', label: 'ごちゃまぜ' }
  ];

  var MIX_KINDS = ['skill', 'title', 'org', 'chant', 'profile'];

  /**
   * まとめて生成する。
   * @param {{kind?:string, count?:number, level?:number, seed?:(string|number)}} opts
   */
  function generate(opts) {
    opts = opts || {};
    var kind = opts.kind || 'skill';
    var count = Math.max(1, Math.min(1000, opts.count || 20));
    var level = Math.max(1, Math.min(5, opts.level || 3));
    var seed = opts.seed === undefined || opts.seed === null || opts.seed === ''
      ? randomSeed() : opts.seed;
    var rng = makeRng(seed);
    var out = [];
    for (var i = 0; i < count; i++) {
      var k = kind === 'mix' ? MIX_KINDS[rng.int(MIX_KINDS.length)] : kind;
      var gen = GENERATORS[k];
      if (!gen) throw new Error('unknown kind: ' + k);
      out.push(gen(rng, level));
    }
    return { seed: String(seed), level: level, kind: kind, items: out };
  }

  function randomSeed() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  /** 1件をプレーンテキストへ */
  function itemToText(item) {
    var s = toPlain(item.head);
    if (item.latin) s += '\n' + item.latin;
    if (item.body) s += '\n' + toPlain(item.body);
    return s;
  }

  /** 生成結果まるごとをプレーンテキストへ */
  function resultToText(result) {
    return result.items.map(function (it, i) {
      return '【' + (i + 1) + '. ' + it.label + '】\n' + itemToText(it);
    }).join('\n\n');
  }

  var api = {
    generate: generate,
    randomSeed: randomSeed,
    itemToText: itemToText,
    resultToText: resultToText,
    toPlain: toPlain,
    toHtml: toHtml,
    KINDS: KINDS,
    DICT: {
      PREFIX: PREFIX, ELEMENT: ELEMENT, NOUN: NOUN, BEAST: BEAST,
      ROLE: ROLE, ORG: ORG, NUM: NUM
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
