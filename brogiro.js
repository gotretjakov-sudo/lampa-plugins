// brogiro.js — плагин-источник для Lampa: весь набор балансеров через Kinobox
(function () {
  'use strict';

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

  function getJson(url, ok, no) {
    var net = new Lampa.Reguest();
    net.timeout(CFG.timeout);
    net.silent(url, ok, no);
  }

  function map(json) {
    var list = Array.isArray(json) ? json : (json && json.players) || [];
    var out = [];
    var seen = {};

    list.forEach(function (p) {
      var u = p.iframeUrl || p.iframe_url || p.url || '';
      if (!/^https?:/.test(u) || seen[u]) return;
      seen[u] = 1;

      var name = p.name || p.id || 'источник';
      var voice = (p.translation && (p.translation.name || p.translation.title)) || p.translation || '';

      if (CFG.addDomain && CFG.domain && !/[?&]domain=/.test(u)) {
        u += (u.indexOf('?') > -1 ? '&' : '?') + 'domain=' + CFG.domain;
      }

      out.push({
        title: name + (voice ? ' · ' + voice : '') + (CFG.needRuIp.test(name) ? ' (RU IP)' : ''),
        url: CFG.frame + encodeURIComponent(u),
        quality: parseInt(p.quality) || 0,
        balancer: 'brogiro'
      });
    });

    return out.sort(function (a, b) { return b.quality - a.quality; });
  }

  function search(movie, call, cancel) {
    var kp = movie.kinopoisk_id || movie.kp_id || '';
    var imdb = movie.imdb_id || '';
    var title = movie.title || movie.name || '';
    var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);

    var key = kp || imdb || title;
    var stopped = false;

    if (cancel) cancel(function () { stopped = true; });

    if (cache[key] && Date.now() - cache[key].at < CFG.cacheMs) {
      return call(cache[key].data);
    }

    var queries = [];
    if (kp) queries.push('kinopoisk=' + encodeURIComponent(kp));
    if (imdb) queries.push('imdb=' + encodeURIComponent(imdb));
    if (title) queries.push('title=' + encodeURIComponent(title + ' ' + year));

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
