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
        title: name + (CFG.needRuIp.test(name) ? ' (RU IP)' : ''),
        subtitle: [voice, p.quality ? p.quality : ''].filter(Boolean).join(' · '),
        quality: parseInt(p.quality) || 0,
        src: u,
        url: CFG.frame + encodeURIComponent(u)
      });
    });

    return out.sort(function (a, b) { return b.quality - a.quality; });
  }

  function search(movie, call) {
    var kp = movie.kinopoisk_id || movie.kp_id || '';
    var imdb = movie.imdb_id || '';
    var title = movie.title || movie.name || '';
    var orig = movie.original_title || movie.original_name || '';
    var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    var key = kp || imdb || (title + year);

    if (cache[key] && Date.now() - cache[key].at < CFG.cacheMs) return call(cache[key].data);

    var queries = [];
    if (kp) queries.push('kinopoisk=' + encodeURIComponent(kp));
    if (imdb) queries.push('imdb=' + encodeURIComponent(imdb));
    if (title) queries.push('title=' + encodeURIComponent(title) + (year ? '&year=' + year : ''));
    if (orig && orig !== title) queries.push('title=' + encodeURIComponent(orig) + (year ? '&year=' + year : ''));

    var i = 0;

    function next() {
      if (i >= queries.length) return call([]);
      getJson(CFG.api + '/api/players?' + queries[i++], function (json) {
        var items = map(json);
        if (!items.length) return next();
        cache[key] = { at: Date.now(), data: items };
        call(items);
      }, next);
    }

    next();
  }

  function play(item, movie) {
    var name = (movie.title || movie.name || '') + ' — ' + item.title;
    var enabled = Lampa.Controller.enabled().name;

    if (Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('android') && Lampa.Android && Lampa.Android.openPlayer && Lampa.Storage.field('player') !== 'inner') {
      Lampa.Android.openPlayer(item.url, { title: name });
      return;
    }

    if (Lampa.Iframe && Lampa.Iframe.show) {
      Lampa.Iframe.show({
        url: item.url,
        onBack: function () {
          Lampa.Iframe.close && Lampa.Iframe.close();
          Lampa.Controller.toggle(enabled);
        }
      });
      return;
    }

    window.open(item.url, '_blank');
  }

  function open(movie) {
    Lampa.Loading.start(function () {
      Lampa.Loading.stop();
    });

    search(movie, function (items) {
      Lampa.Loading.stop();

      if (!items.length) {
        Lampa.Noty.show('Brogiro: ничего не найдено');
        return;
      }

      var enabled = Lampa.Controller.enabled().name;

      Lampa.Select.show({
        title: 'Brogiro',
        items: items,
        onSelect: function (item) {
          Lampa.Controller.toggle(enabled);
          play(item, movie);
        },
        onBack: function () {
          Lampa.Controller.toggle(enabled);
        }
      });
    });
  }

  function addButton(e) {
    var render = e.object.activity.render();
    if (render.find('.view--brogiro').length) return;

    var btn = $('<div class="full-start__button selector view--brogiro">' + ICON + '<span>Brogiro</span></div>');

    btn.on('hover:enter', function () {
      open(e.data.movie);
    });

    var anchor = render.find('.view--torrent');
    if (anchor.length) anchor.after(btn);
    else render.find('.full-start-new__buttons, .full-start__buttons').first().append(btn);
  }

  var manifest = {
    type: 'video',
    version: '1.1.0',
    name: 'Brogiro',
    description: 'Онлайн-просмотр через балансеры Kinobox (iframe-плеер)',
    component: 'brogiro',
    onContextMenu: function () {
      return { name: 'Смотреть в Brogiro', description: 'Балансеры Kinobox' };
    },
    onContextLauch: function (object) {
      open(object);
    }
  };

  function start() {
    Lampa.Manifest.plugins = manifest;

    Lampa.Listener.follow('full', function (e) {
      if (e.type === 'complite') addButton(e);
    });

    console.log('[brogiro] загружен');
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') start();
  });
})();
