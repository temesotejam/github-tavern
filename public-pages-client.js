(function () {
  'use strict';

  var OWNER = 'temesotejam';
  var DATA_URL = './data/public-pages.json';
  var pages = {};

  function id(name) { return document.getElementById(name); }

  function validEntry(entry) {
    if (!entry || !entry.url) return null;
    try {
      var url = new URL(entry.url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return entry;
    } catch (_) {
      return null;
    }
  }

  function currentRepoName() {
    var repo = id('detailRepo');
    if (!repo) return '';
    var text = String(repo.textContent || '').trim();
    var prefix = OWNER + '/';
    return text.indexOf(prefix) === 0 ? text.slice(prefix.length) : '';
  }

  function hideLink(link) {
    link.hidden = true;
    link.setAttribute('aria-hidden', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.setProperty('display', 'none', 'important');
    link.removeAttribute('href');
  }

  function showLink(link, entry) {
    link.hidden = false;
    link.removeAttribute('aria-hidden');
    link.removeAttribute('tabindex');
    link.style.removeProperty('display');
    link.href = entry.url;
    link.textContent = '公開ページを開く ↗';
    link.title = entry.source === 'github-pages'
      ? '動作確認済みのGitHub Pagesを開く'
      : '動作確認済みの公開ページを開く';
  }

  function apply() {
    var link = id('pagesLink');
    if (!link) return;
    var entry = validEntry(pages[currentRepoName()]);
    if (entry) showLink(link, entry);
    else hideLink(link);
  }

  function load() {
    fetch(DATA_URL + '?v=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('public pages ' + response.status);
        return response.json();
      })
      .then(function (data) {
        pages = data && data.pages ? data.pages : {};
        apply();
      })
      .catch(function () {
        pages = {};
        apply();
      });
  }

  function init() {
    var link = id('pagesLink');
    var repo = id('detailRepo');
    var stage = id('detailStage');
    if (!link || !repo || !stage) return;

    hideLink(link);

    var observer = new MutationObserver(apply);
    observer.observe(repo, { childList: true, characterData: true, subtree: true });
    observer.observe(stage, { attributes: true, attributeFilter: ['hidden'] });

    link.addEventListener('click', function (event) {
      var entry = validEntry(pages[currentRepoName()]);
      if (!entry) {
        event.preventDefault();
        hideLink(link);
      }
    }, true);

    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
