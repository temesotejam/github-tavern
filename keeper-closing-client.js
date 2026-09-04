(function () {
  'use strict';

  var SUMMARY_URL = './data/summaries.json';
  var closing = document.getElementById('keeperClosing');
  var repoNode = document.getElementById('detailRepo');
  if (!closing || !repoNode) return;

  var summaries = {};

  function currentRepoName() {
    var text = String(repoNode.textContent || '').trim();
    if (!text) return '';
    var slash = text.indexOf('/');
    return slash >= 0 ? text.slice(slash + 1) : text;
  }

  function render() {
    var name = currentRepoName();
    var entry = name ? summaries[name] : null;
    var value = entry && entry.closingRemark ? String(entry.closingRemark).trim() : '';
    var nextText = value ? '「' + value + '」' : '';

    if (closing.textContent !== nextText) closing.textContent = nextText;
    closing.hidden = !value;
  }

  new MutationObserver(render).observe(repoNode, {
    childList: true,
    characterData: true,
    subtree: true
  });

  fetch(SUMMARY_URL + '?v=' + Date.now(), { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('summary ' + response.status);
      return response.json();
    })
    .then(function (data) {
      summaries = data && data.repositories ? data.repositories : {};
      render();
    })
    .catch(function () {
      summaries = {};
      render();
    });
}());
