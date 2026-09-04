(function () {
  'use strict';

  function hashText(text) {
    var h = 2166136261;
    var value = String(text || '');
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(list, seed) {
    if (!list || !list.length) return '';
    return list[seed % list.length];
  }

  function closingFor(text, seedText) {
    var source = String(text || '');
    var seed = hashText(seedText || source);

    if (/CONF LOW|資料.{0,8}(薄|少)|分からない|判断できない|不明/.test(source)) {
      return pick([
        '資料はここまでだ。続きはコード本人に聞くしかないな。',
        '推測で埋めたら情報じゃなくなる。ここから先は現物を見な。',
        '分かってるのはここまでだ。薄い情報を厚く見せる商売はしてないんでな。'
      ], seed);
    }

    if (/PPO|SAC|TD3|強化学習|カリキュラム学習|学習済み|報酬/.test(source)) {
      return pick([
        '学習するのは機械だが、待たされるのはこっちだな。',
        '報酬の付け方を間違えると、妙に賢く間違える。そこが面白いところだ。',
        '結果が良くても油断はするな。学習済みってのは、万能って意味じゃない。'
      ], seed);
    }

    if (/ボート|船|水上翼|航法|ウェイポイント|Dubins|航路|漂流/.test(source)) {
      return pick([
        '航路は引ける。水面まで言うことを聞くとは限らないがな。',
        '船は机の上じゃ沈まない。厄介なのは、外へ出してからだ。',
        '制御の筋は見えてる。あとは風と水がどれだけ付き合ってくれるかだな。'
      ], seed);
    }

    if (/GNSS|IMU|BNO|RealSense|T265|VL53|センサ|カメラ|深度|姿勢推定/.test(source)) {
      return pick([
        '数字は出る。あとは、その数字をどこまで信用するかだな。',
        'センサは正直だ。ノイズまで律儀に出してくる。',
        '見えるものが増えるほど、疑う場所も増える。まあ、悪い話じゃない。'
      ], seed);
    }

    if (/リアクションホイール|倒立振子|振り子|数値積分|物理モデル|制御工学|シミュレータ|シミュレーション/.test(source)) {
      return pick([
        '理屈は揃ってる。あとは実機がその理屈を聞いてくれるかだな。',
        '計算は素直だ。現物の方は、たまに話が通じないけどな。',
        '数字の上じゃ筋は通ってる。最後は実機に聞くのが一番早い。'
      ], seed);
    }

    if (/WebUSB|WebHID|WebSocket|GitHub Pages|ブラウザ|Webツール|HTML|JavaScript/.test(source)) {
      return pick([
        'ブラウザで済むなら悪くない。工具箱は軽い方がいい。',
        '動くところまで出てる。あとは触った方が早いな。',
        '面倒な手順を一枚の画面に押し込む。こういう仕事は嫌いじゃない。'
      ], seed);
    }

    if (/ESP32|M5Stack|XIAO|Arduino|Raspberry Pi Pico|RP2040|RP2350|RS-485|RS485|UART|PlatformIO/.test(source)) {
      return pick([
        '配線が合ってりゃ話は早い。合ってなきゃ、まあ長い夜になる。',
        '動けば頼もしい。動かなきゃ、まず配線から疑えって話だ。',
        '小さい基板ほど、機嫌を損ねたときに場所を取らない。それだけは助かるな。'
      ], seed);
    }

    if (/ライブラリ|SDK|API|Arduinoコア|runtime API/.test(source)) {
      return pick([
        '派手さはないが、こういう土台が一番長く働く。',
        '使う側には地味に見える。作る側には、そうでもないんだがな。',
        '土台がしっかりしてりゃ、その上で多少無茶しても何とかなる。'
      ], seed);
    }

    return pick([
      'まあ、筋の通った仕事だ。あとは使いどころ次第だな。',
      'ここまで分かれば十分だろ。残りは触った方が早い。',
      '情報はこんなところだ。面白いかどうかは、使ってから決めな。'
    ], seed);
  }

  if (typeof globalThis !== 'undefined') globalThis.__projectTavernClosingFor = closingFor;
  if (typeof document === 'undefined') return;

  var closing = document.getElementById('keeperClosing');
  var description = document.getElementById('detailDescription');
  var title = document.getElementById('detailTitle');
  var repo = document.getElementById('detailRepo');
  var meta = document.getElementById('detailMeta');
  var features = document.getElementById('featureList');
  var tech = document.getElementById('techList');
  if (!closing || !description) return;

  var sources = [title, repo, description, meta, features, tech].filter(Boolean);
  var busy = false;

  function update() {
    if (busy) return;
    busy = true;

    var source = [
      title && title.textContent,
      repo && repo.textContent,
      description.textContent,
      meta && meta.textContent,
      features && features.textContent,
      tech && tech.textContent
    ].filter(Boolean).join(' ');

    var value = closingFor(source, (repo && repo.textContent) || (title && title.textContent) || source);
    var nextText = value ? '「' + value + '」' : '';
    var nextHidden = !value;

    // Do not rewrite the closing element unless its actual value changed.
    // More importantly, never observe this element itself: that would create
    // a MutationObserver -> textContent write -> MutationObserver feedback loop.
    if (closing.textContent !== nextText) closing.textContent = nextText;
    if (closing.hidden !== nextHidden) closing.hidden = nextHidden;

    busy = false;
  }

  var observer = new MutationObserver(update);
  sources.forEach(function (node) {
    observer.observe(node, {
      childList: true,
      characterData: true,
      subtree: true
    });
  });

  update();
}());
