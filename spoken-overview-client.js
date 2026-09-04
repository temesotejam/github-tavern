(function () {
  'use strict';

  var target = document.getElementById('detailDescription');
  if (!target) return;

  var suruWords = [
    '検索','並べ替え','実装','管理','解析','制御','通信','記録','接続','起動','停止','入力','出力',
    '測定','計測','推定','学習','評価','送信','受信','同期','復元','書き込み','ビルド','配布','取得',
    '確認','比較','検証','表示','保存','生成','計算','変換','提供','利用','実行','処理','公開','分類',
    '更新','統合','補正','再現','切り替え','変換','照合','観測','調整','設定','監視','記録'
  ];

  function spokenize(text) {
    var value = String(text || '').trim();
    if (!value) return value;

    value = value
      .replace(/^このリポジトリは[、,]?\s*/, 'こいつは、')
      .replace(/^このプロジェクトは[、,]?\s*/, 'こいつは、')
      .replace(/^このツールは[、,]?\s*/, 'こいつは、')
      .replace(/^Project Tavernは[、,]?\s*/, 'Project Tavernってのは、')
      .replace(/ていません/g, 'てない')
      .replace(/ていない/g, 'てない')
      .replace(/ています/g, 'てる')
      .replace(/ている/g, 'てる')
      .replace(/であります/g, 'だ')
      .replace(/である/g, 'だ')
      .replace(/ありません/g, 'ない')
      .replace(/あります/g, 'ある')
      .replace(/できます/g, 'できる')
      .replace(/なります/g, 'なる')
      .replace(/行います/g, '行う')
      .replace(/求めます/g, '求める')
      .replace(/示します/g, '示す')
      .replace(/使います/g, '使う')
      .replace(/扱います/g, '扱う')
      .replace(/比べます/g, '比べる')
      .replace(/読み出します/g, '読み出す')
      .replace(/分けます/g, '分ける')
      .replace(/備えます/g, '備える')
      .replace(/含まれます/g, '含まれる')
      .replace(/使われます/g, '使われる')
      .replace(/行われます/g, '行われる')
      .replace(/されます/g, 'される')
      .replace(/使えます/g, '使える')
      .replace(/扱えます/g, '扱える')
      .replace(/行えます/g, '行える')
      .replace(/分かります/g, '分かる')
      .replace(/分かりません/g, '分からない')
      .replace(/しません/g, 'しない');

    suruWords.forEach(function (word) {
      value = value.replace(new RegExp(word + 'します', 'g'), word + 'する');
    });

    value = value
      .replace(/([^。]+)ことを目的としてる。/g, '$1ためのものだ。')
      .replace(/という構成になってる/g, 'って構成だ')
      .replace(/という仕組みになってる/g, 'って仕組みだ')
      .replace(/可能です/g, '可能だ')
      .replace(/対象外です/g, '対象外だ')
      .replace(/仕組みです/g, '仕組みだ')
      .replace(/構成です/g, '構成だ')
      .replace(/ものです/g, 'ものだ')
      .replace(/ですが/g, 'だが')
      .replace(/です、/g, 'だ、')
      .replace(/です。/g, 'だ。')
      .replace(/でした/g, 'だった');

    return value;
  }

  var busy = false;
  function normalize() {
    if (busy) return;
    var before = target.textContent || '';
    var after = spokenize(before);
    if (after === before) return;
    busy = true;
    target.textContent = after;
    busy = false;
  }

  new MutationObserver(normalize).observe(target, { childList: true, characterData: true, subtree: true });
  normalize();
}());
