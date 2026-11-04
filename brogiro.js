(function () {
  'use strict';

  if (window.brogiro_plugin) return;
  window.brogiro_plugin = true;

  var CFG = {
    api: 'https://playcdnfb.top',
    frame: 'https://cdn.jsdelivr.net/gh/gotretjakov-sudo/lampa-plugins@main/frame.html#',
    domain: 'brogiro.cfd',
    addDomain: true,
    timeout: 8000,
    cacheMs: 10 * 60 * 1000,
    needRuIp: /alloha|stravers|turbo|obrut|veoveo|veo-vo/i
  };

  var cache = {};

  var ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

  function getJson(url, ok, no) {
    var net = new Lampa.Reguest();
    net.timeout(CFG.timeout);
    net.silent(url, ok, no);
  }

  function map(json) {
    var list = Array.isArray(json) ? json : (json && (json.players || json.data)) || [];
    var out = [];
    var seen = {};

    list.forEach(function (p) {
      if (!p) return;
      var u = p.iframeUrl || p.iframe_url || p.url || p.iframe || '';
      if (u.indexOf('//') === 0) u = 'https:' + u;
      if (!/^https?:/.test(u) || seen[u]) return;
      seen[u] = 1;

      var name = String(p.name || p.type || p.id || 'источник');
      var tr = p.translation;
      var voice = tr ? (typeof tr === 'object' ? (tr.name || tr.title || '') : String(tr)) : '';

      if (CFG.addDomain && CFG.domain && !/[?&]domain=/.test(u)) {
        u += (u.indexOf('?') > -1 ? '&' : '?') + 'domain=' + CFG.domain;
      }

      out.push({
        title: name + (voice ? ' · ' + voice : '') + (CFG.needRuIp.test(name) ? ' (RU IP)' : ''),
        quality: parseInt(p.quality) || 0,
        url: CFG.frame + encodeURIComponent(u),
        balancer: 'brogiro'
      });
    });

    return out.sort(function (a, b) { return b.quality - a.quality; });
  }

  function search(movie, call, cancel) {
    var kp = movie.kinopoisk_id || movie.kp_id || '';
    var imdb = movie.imdb_id || '';
    var title = movie.title || movie.name || '';
    var orig = movie.original_title || movie.original_name || '';
    var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    var key = kp || imdb || (title + year);
    var stopped = false;

    if (cancel) cancel(function () { stopped = true; });

    if (cache[key] && Date.now() - cache[key].at < CFG.cacheMs) {
      return call(cache[key].data);
    }

    var queries = [];
    if (kp) queries.push('kinopoisk=' + encodeURIComponent(kp));
    if (imdb) queries.push('imdb=' + encodeURIComponent(imdb));
    if (title) queries.push('title=' + encodeURIComponent(title) + (year ? '&year=' + year : ''));
    if (orig && orig !== title) queries.push('title=' + encodeURIComponent(orig) + (year ? '&year=' + year : ''));

    var i = 0;

    function finish(items) {
      if (stopped) return;
      if (items.length) cache[key] = { at: Date.now(), data: items };
      call(items);
    }

    function next() {
      if (stopped) return;
      if (i >= queries.length) return finish([]);

      getJson(CFG.api + '/api/players?' + queries[i++], function (json) {
        var items = map(json);
        if (items.length) return finish(items);
        next();
      }, next);
    }

    next();
  }

  function start() {
    if (window.brogiro_ready) return;
    window.brogiro_ready = true;

    if (!Lampa.Source || !Lampa.Source.add) {
      console.log('[brogiro] нет Lampa.Source — старая версия Lampa');
      return;
    }

    Lampa.Source.add({
      id: 'brogiro',
      name: 'Brogiro',
      weight: 95,
      onSearch: search,
      onCancel: function () {}
    });

    console.log('[brogiro] загружен');
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') start();
  });
})();
