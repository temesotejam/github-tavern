(function () {
  'use strict';

  var OWNER = 'temesotejam';
  var API = 'https://api.github.com';
  var SUMMARY_URL = './data/summaries.json';
  var TIMEOUT = 8000;

  function id(name) { return document.getElementById(name); }
  var els = {
    search: id('searchInput'), sort: id('sortSelect'), filters: id('categoryFilters'),
    grid: id('repoGrid'), count: id('repoCount'), notice: id('notice'), noticeText: id('noticeText'),
    empty: id('emptyState'), clear: id('clearFilters'), locationTag: id('locationTag'), dialog: id('detailDialog'),
    closeDialog: id('closeDialog'), confirmStage: id('confirmStage'), confirmCategory: id('confirmCategory'),
    confirmText: id('confirmText'), confirmTitle: id('confirmTitle'), confirmYes: id('confirmYes'), confirmNo: id('confirmNo'),
    detailStage: id('detailStage'), detailBreadcrumb: id('detailBreadcrumb'), detailNumber: id('detailNumber'),
    detailTitle: id('detailTitle'), detailRepo: id('detailRepo'), keeperText: id('keeperText'), detailMeta: id('detailMeta'),
    detailDescription: id('detailDescription'), featureSection: id('featureSection'), featureList: id('featureList'),
    techSection: id('techSection'), techList: id('techList'), repoLink: id('repoLink'), pagesLink: id('pagesLink'),
    summarySource: id('summarySource')
  };

  var state = { repos: [], summaries: {}, category: 'all', query: '', sort: 'updated', selectedRow: 0, pendingRepo: null, liveApi: false };

  var RULES = [
    { id: 'learning', label: '学習・AI', words: ['reinforcement','learning','ppo','sac','td3','acrobot','cartpole','強化学習','機械学習',' ai '] },
    { id: 'control', label: '制御・ロボット', words: ['reaction-wheel','control','robot','waypoint','copter','boat','ackermann','pendulum','制御','ロボティクス','航法','振り子','船舶'] },
    { id: 'sensing', label: 'センサ・組込み', words: ['esp32','m5','xiao','arduino','pico','gnss','imu','bno','realsense','t265','vl53','sensor','センサ','組込み','マイコン'] },
    { id: 'vision', label: '画像・映像', words: ['camera','video','marker','mediapipe','vision','image','映像','画像','カメラ','動画'] },
    { id: 'web', label: 'Web・ツール', words: [' web','web-','viewer','tool','builder','inspector','diagnostic','toolkit','frontend','ブラウザ','静的サイト','webアプリ'] }
  ];
  var ALL = { id: 'all', label: 'すべて' };
  var OTHER = { id: 'other', label: 'その他' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function fmtDate(v) {
    if (!v) return '不明';
    try { return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(v)); }
    catch (_) { return String(v); }
  }
  function relDate(v) {
    if (!v) return '';
    var d = Math.round((new Date(v).getTime() - Date.now()) / 86400000);
    if (Math.abs(d) < 31 && Intl.RelativeTimeFormat) return new Intl.RelativeTimeFormat('ja',{numeric:'auto'}).format(d,'day');
    return fmtDate(v);
  }
  function withTimeout(url, options, ms) {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, ms || TIMEOUT);
    var opts = Object.assign({}, options || {}, {signal: controller.signal});
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  }
  function summaryFor(repo) { return state.summaries[repo.name] || null; }
  function textFor(repo) {
    var s = summaryFor(repo) || {};
    return [repo.name, repo.description, repo.language].concat(repo.topics || [], [s.title,s.summary,s.detail], s.technologies || [], s.categories || []).filter(Boolean).join(' ').toLowerCase();
  }
  function categoryOf(repo) {
    var text = ' ' + textFor(repo) + ' ';
    for (var i=0;i<RULES.length;i++) for (var j=0;j<RULES[i].words.length;j++) if (text.indexOf(RULES[i].words[j]) >= 0) return RULES[i];
    return OTHER;
  }
  function categoryById(value) {
    if (value === 'all') return ALL;
    if (value === 'other') return OTHER;
    for (var i=0;i<RULES.length;i++) if (RULES[i].id === value) return RULES[i];
    return ALL;
  }
  function applyTheme(value) {
    var c = categoryById(value);
    document.body.setAttribute('data-theme', c.id);
    els.locationTag.textContent = 'ARCHIVE / ' + c.label.toUpperCase();
  }
  function renderFilters() {
    var list = [ALL].concat(RULES,[OTHER]);
    els.filters.innerHTML = list.map(function(c,i){
      return '<button class="category-tab" type="button" data-category="'+esc(c.id)+'" aria-pressed="'+(state.category===c.id?'true':'false')+'">'+
        '<span class="category-tab__no">'+String(i).padStart(2,'0')+'</span><span class="category-tab__label">'+esc(c.label)+'</span></button>';
    }).join('');
  }
  function matches(repo) {
    if (state.category !== 'all' && categoryOf(repo).id !== state.category) return false;
    if (!state.query) return true;
    var t = textFor(repo);
    return state.query.split(/\s+/).filter(Boolean).every(function(q){ return t.indexOf(q)>=0; });
  }
  function visibleRepos() {
    var r = state.repos.filter(matches).slice();
    r.sort(function(a,b){
      if (state.sort === 'name') return a.name.localeCompare(b.name,'ja',{numeric:true});
      if (state.sort === 'stars') return (b.stargazers_count||0)-(a.stargazers_count||0) || new Date(b.pushed_at||0)-new Date(a.pushed_at||0);
      return new Date(b.pushed_at||b.updated_at||0)-new Date(a.pushed_at||a.updated_at||0);
    });
    return r;
  }
  function renderRepos() {
    var list = visibleRepos();
    state.selectedRow = Math.max(0, Math.min(state.selectedRow, Math.max(list.length-1,0)));
    els.count.textContent = list.length + ' / ' + state.repos.length + ' RECORDS';
    els.empty.hidden = list.length > 0;
    els.grid.hidden = list.length === 0;
    els.grid.innerHTML = list.map(function(repo,index){
      var s = summaryFor(repo) || {};
      var c = categoryOf(repo);
      var selected = index === state.selectedRow;
      var title = s.title || repo.name;
      var desc = s.summary || repo.description || (repo.name + ' に関する公開記録。');
      return '<button class="record-row'+(selected?' is-selected':'')+'" type="button" role="option" aria-selected="'+(selected?'true':'false')+'" data-repo="'+esc(repo.name)+'" data-index="'+index+'">'+
        '<span class="record-no"><span class="record-pointer" aria-hidden="true">☞</span><span>'+String(index+1).padStart(2,'0')+'</span></span>'+
        '<span class="record-main"><span class="record-titleline"><span class="record-title">'+esc(title)+'</span><span class="record-repo">'+esc(repo.name)+'</span></span><span class="record-summary">'+esc(desc)+'</span></span>'+
        '<span class="record-side"><span class="ai-mark">'+(s.summary?'COPILOT':'RAW')+'</span><strong>'+esc(c.label)+'</strong><span>'+esc(repo.language||'—')+' / '+esc(relDate(repo.pushed_at))+'</span></span></button>';
    }).join('');
  }
  function selectRow(n, focus) {
    var rows = Array.prototype.slice.call(els.grid.querySelectorAll('.record-row'));
    if (!rows.length) return;
    state.selectedRow = Math.max(0,Math.min(n,rows.length-1));
    rows.forEach(function(row,i){ var on=i===state.selectedRow; row.classList.toggle('is-selected',on); row.setAttribute('aria-selected',on?'true':'false'); });
    var current = rows[state.selectedRow];
    current.scrollIntoView({block:'nearest'});
    if (focus) current.focus({preventScroll:true});
  }
  function meta(repo,s) {
    var a=[];
    if (repo.language) a.push('LANG '+repo.language);
    a.push('UPDATED '+fmtDate(repo.pushed_at));
    if (state.liveApi) a.push('STAR '+(repo.stargazers_count||0));
    a.push(repo.fork?'FORK':'ORIGINAL');
    if (repo.archived) a.push('ARCHIVED');
    if (s.status) a.push('STATUS '+s.status);
    if (s.confidence) a.push('CONF '+String(s.confidence).toUpperCase());
    els.detailMeta.innerHTML = a.map(function(x){return '<span class="meta-pill">'+esc(x)+'</span>';}).join('');
  }
  function features(items) {
    var a=(items||[]).filter(Boolean).slice(0,6);
    els.featureSection.hidden = !a.length;
    els.featureList.innerHTML = a.map(function(x){return '<li>'+esc(x)+'</li>';}).join('');
  }
  function tech(repo,s) {
    var a=(s.technologies||[]).concat(repo.topics||[],repo.language?[repo.language]:[]), seen={}, out=[];
    a.forEach(function(x){ if (x && !seen[x] && out.length<14){ seen[x]=1; out.push(x); } });
    els.techSection.hidden = !out.length;
    els.techList.innerHTML = out.map(function(x){return '<span class="tag">'+esc(x)+'</span>';}).join('');
  }
  var typingTimer=null;
  function typeText(text) {
    if (typingTimer) clearInterval(typingTimer);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){ els.keeperText.textContent=text; return; }
    els.keeperText.textContent=''; var i=0;
    typingTimer=setInterval(function(){ i+=2; els.keeperText.textContent=text.slice(0,i); if(i>=text.length) clearInterval(typingTimer); },10);
  }
  function openPrompt(repo) {
    var s=summaryFor(repo)||{}, c=categoryOf(repo), title=s.title||repo.name;
    state.pendingRepo=repo; applyTheme(c.id);
    els.confirmCategory.textContent='ARCHIVE / '+c.label;
    els.confirmTitle.textContent=title;
    els.confirmText.textContent=s.confidence==='low'
      ? '「'+title+'か。資料は少ない。分かってる範囲なら話せる。」'
      : '「'+title+'か。その情報ならある。」';
    els.confirmStage.hidden=false; els.detailStage.hidden=true;
    if (!els.dialog.open) els.dialog.showModal();
    setTimeout(function(){els.confirmYes.focus();},0);
  }
  function keeperDetail(repo,s) {
    if (s.confidence==='low') return '「資料が少ない。分かってる範囲だけ話す。」';
    var leads=['調べた限りじゃ、こういう記録だ。','要点だけ言うと、こうだ。','資料を追うと、こういう話になる。'];
    return '「'+leads[String(repo.name||'').length%leads.length]+'」';
  }
  function detailText(repo,s) {
    return s.detail||s.summary||repo.description||'この件は、まだ説明に使える資料がほとんどない。';
  }
  function showDetail(repo) {
    var s=summaryFor(repo)||{}, c=categoryOf(repo), idx=state.repos.findIndex(function(x){return x.id===repo.id;})+1;
    els.confirmStage.hidden=true; els.detailStage.hidden=false;
    els.detailBreadcrumb.textContent='ARCHIVE / '+c.label+' / RECORD';
    els.detailNumber.textContent='RECORD No.'+String(Math.max(idx,1)).padStart(3,'0');
    els.detailTitle.textContent=s.title||repo.name; els.detailRepo.textContent=OWNER+'/'+repo.name;
    els.repoLink.href=repo.html_url||('https://github.com/'+OWNER+'/'+repo.name);
    els.pagesLink.hidden=true;
    els.pagesLink.removeAttribute('href');
    els.detailDescription.textContent=detailText(repo,s);
    meta(repo,s); features(s.features); tech(repo,s);
    els.summarySource.textContent=s.summary ? 'COPILOT ANALYSIS / '+fmtDate(s.generatedAt) : 'REPOSITORY METADATA';
    typeText(keeperDetail(repo,s));
  }
  function closeDialog() {
    if (typingTimer) clearInterval(typingTimer);
    state.pendingRepo=null; if(els.dialog.open) els.dialog.close(); applyTheme(state.category);
  }
  function status(label) {
    var ai=state.repos.filter(function(r){return state.summaries[r.name]&&state.summaries[r.name].summary;}).length;
    els.notice.classList.remove('is-error');
    els.noticeText.textContent=state.repos.length+'件の公開記録を確認 / COPILOT解析 '+ai+'件 / '+label;
  }
  function reposFromCache(data) {
    var dict=data&&data.repositories?data.repositories:{};
    return Object.keys(dict).map(function(name,i){
      var s=dict[name]||{}, m=s.sourceMetadata||{};
      return {id:s.sourceRepositoryId||('cache-'+i),name:name,html_url:'https://github.com/'+OWNER+'/'+encodeURIComponent(name),description:m.description||s.summary||'',homepage:m.homepage||'',language:m.language||'',topics:m.topics||[],pushed_at:m.pushedAt||s.sourcePushedAt||s.generatedAt||'',updated_at:m.pushedAt||s.sourcePushedAt||s.generatedAt||'',default_branch:m.defaultBranch||s.sourceDefaultBranch||'main',archived:!!m.archived,fork:!!m.fork,private:false,stargazers_count:0};
    });
  }
  function fetchCache() {
    return withTimeout(SUMMARY_URL+'?v='+Date.now(),{cache:'no-store'},6000).then(function(r){if(!r.ok)throw new Error('summary '+r.status);return r.json();});
  }
  function fetchLive() {
    var url=API+'/users/'+OWNER+'/repos?type=owner&sort=updated&direction=desc&per_page=100&page=1';
    return withTimeout(url,{headers:{Accept:'application/vnd.github+json'}},TIMEOUT).then(function(r){if(!r.ok)throw new Error(r.status+' '+r.statusText);return r.json();}).then(function(a){return (a||[]).filter(function(r){return !r.private;});});
  }
  function bind() {
    els.search.addEventListener('input',function(e){state.query=e.target.value.trim().toLowerCase();state.selectedRow=0;renderRepos();});
    els.sort.addEventListener('change',function(e){state.sort=e.target.value;state.selectedRow=0;renderRepos();});
    els.filters.addEventListener('click',function(e){var b=e.target.closest('[data-category]');if(!b)return;state.category=b.getAttribute('data-category');state.selectedRow=0;applyTheme(state.category);renderFilters();renderRepos();});
    els.grid.addEventListener('mousemove',function(e){var r=e.target.closest('.record-row');if(r)selectRow(Number(r.getAttribute('data-index')),false);});
    els.grid.addEventListener('focusin',function(e){var r=e.target.closest('.record-row');if(r)selectRow(Number(r.getAttribute('data-index')),false);});
    els.grid.addEventListener('click',function(e){var r=e.target.closest('[data-repo]');if(!r)return;var name=r.getAttribute('data-repo'),repo=state.repos.find(function(x){return x.name===name;});if(repo)openPrompt(repo);});
    els.confirmYes.addEventListener('click',function(){if(state.pendingRepo)showDetail(state.pendingRepo);});
    els.confirmNo.addEventListener('click',closeDialog); els.closeDialog.addEventListener('click',closeDialog);
    els.dialog.addEventListener('click',function(e){if(e.target===els.dialog)closeDialog();});
    els.clear.addEventListener('click',function(){state.category='all';state.query='';state.selectedRow=0;els.search.value='';applyTheme('all');renderFilters();renderRepos();});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&els.dialog.open){e.preventDefault();closeDialog();return;} if(els.dialog.open)return;
      if(e.key==='/'&&document.activeElement!==els.search){e.preventDefault();els.search.focus();return;}
      if(document.activeElement===els.search||document.activeElement===els.sort)return;
      if(e.key==='ArrowDown'){e.preventDefault();selectRow(state.selectedRow+1,true);} else if(e.key==='ArrowUp'){e.preventDefault();selectRow(state.selectedRow-1,true);} else if(e.key==='Enter'){e.preventDefault();var r=visibleRepos()[state.selectedRow];if(r)openPrompt(r);}
    });
  }
  function validate() {
    var missing=Object.keys(els).filter(function(k){return !els[k];});
    if(missing.length)throw new Error('Missing DOM: '+missing.join(','));
  }
  function init() {
    try { validate(); document.documentElement.setAttribute('data-app-loaded','1'); applyTheme('all'); renderFilters(); els.grid.innerHTML='<div class="loading-row"></div>'.repeat(8); bind(); }
    catch(err){ if(els.notice)els.notice.classList.add('is-error'); if(els.noticeText)els.noticeText.textContent='端末初期化エラー: '+err.message; return; }

    var liveError=null;
    var livePromise=fetchLive().catch(function(e){liveError=e;return null;});
    fetchCache().then(function(data){
      state.summaries=data.repositories||{}; state.repos=reposFromCache(data); status('CACHE'); renderRepos();
      return livePromise;
    }).then(function(live){
      if(live&&live.length){state.repos=live;state.liveApi=true;status('LIVE API');renderRepos();}
      else if(state.repos.length){status(liveError&&liveError.name==='AbortError'?'API TIMEOUT / CACHE':'API UNAVAILABLE / CACHE');}
    }).catch(function(err){
      livePromise.then(function(live){
        if(live&&live.length){state.repos=live;state.liveApi=true;status('LIVE API / SUMMARY unavailable');renderRepos();}
        else {els.notice.classList.add('is-error');els.noticeText.textContent='記録を取得できませんでした: '+err.message;els.count.textContent='0 RECORDS';els.grid.innerHTML='';}
      });
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}());
