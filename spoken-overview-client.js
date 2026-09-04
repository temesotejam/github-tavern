(function () {
  'use strict';

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
      .replace(/できませんでした/g, 'できなかった')
      .replace(/できません/g, 'できない')
      .replace(/できました/g, 'できた')
      .replace(/できます/g, 'できる')
      .replace(/なりませんでした/g, 'ならなかった')
      .replace(/なりません/g, 'ならない')
      .replace(/なりました/g, 'なった')
      .replace(/なります/g, 'なる')
      .replace(/行いました/g, '行った')
      .replace(/行います/g, '行う')
      .replace(/求めました/g, '求めた')
      .replace(/求めます/g, '求める')
      .replace(/示しました/g, '示した')
      .replace(/示します/g, '示す')
      .replace(/使いました/g, '使った')
      .replace(/使います/g, '使う')
      .replace(/扱いました/g, '扱った')
      .replace(/扱います/g, '扱う')
      .replace(/比べました/g, '比べた')
      .replace(/比べます/g, '比べる')
      .replace(/読み出しました/g, '読み出した')
      .replace(/読み出します/g, '読み出す')
      .replace(/分けました/g, '分けた')
      .replace(/分けます/g, '分ける')
      .replace(/備えました/g, '備えた')
      .replace(/備えます/g, '備える')
      .replace(/含まれました/g, '含まれた')
      .replace(/含まれます/g, '含まれる')
      .replace(/使われました/g, '使われた')
      .replace(/使われます/g, '使われる')
      .replace(/行われました/g, '行われた')
      .replace(/行われます/g, '行われる')
      .replace(/されませんでした/g, 'されなかった')
      .replace(/されません/g, 'されない')
      .replace(/されました/g, 'された')
      .replace(/されます/g, 'される')
      .replace(/使えました/g, '使えた')
      .replace(/使えます/g, '使える')
      .replace(/扱えました/g, '扱えた')
      .replace(/扱えます/g, '扱える')
      .replace(/行えました/g, '行えた')
      .replace(/行えます/g, '行える')
      .replace(/分かりませんでした/g, '分からなかった')
      .replace(/分かりません/g, '分からない')
      .replace(/分かりました/g, '分かった')
      .replace(/分かります/g, '分かる');

    // Technical prose frequently uses a kanji/katakana compound + する.
    // Convert that pattern generically so words such as 「数値積分します」 do not slip through.
    value = value
      .replace(/([一-龯々ァ-ヶA-Za-z0-9・／+_-]{2,})しませんでした/g, '$1しなかった')
      .replace(/([一-龯々ァ-ヶA-Za-z0-9・／+_-]{2,})しません/g, '$1しない')
      .replace(/([一-龯々ァ-ヶA-Za-z0-9・／+_-]{2,})しました/g, '$1した')
      .replace(/([一-龯々ァ-ヶA-Za-z0-9・／+_-]{2,})します/g, '$1する');

    value = value
      .replace(/しませんでした/g, 'しなかった')
      .replace(/しません/g, 'しない')
      .replace(/しました/g, 'した')
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

  // Expose the pure transformer so CI can exercise real examples without a browser.
  if (typeof globalThis !== 'undefined') globalThis.__projectTavernSpokenize = spokenize;
  if (typeof document === 'undefined') return;

  var target = document.getElementById('detailDescription');
  if (!target) return;

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
