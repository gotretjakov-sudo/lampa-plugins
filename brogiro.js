(function () {
  'use strict';

  var VERSION = '1.2.1';

  if (window.brogiro_plugin) return;
  window.brogiro_plugin = true;

  var CFG = {
    api: 'https://playcdnfb.top',
    frame: 'https://gotretjakov-sudo.github.io/lampa-plugins/frame.html#',
    domain: 'brogiro.cfd',
    addDomain: true,
    timeout: 8000,
    cacheMs: 10 * 60 * 1000,
    needRuIp: /alloha|stravers|turbo|obrut|veoveo|veo-vo/i,
    debug: true
  };

  var cache = {};
  var ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

  function log(msg) {
    console.log('[brogiro] ' + msg);
  }

  function safe(name, fn) {
    try { fn(); } catch (err) { log(name + ' error: ' + (err && err.message)); }
  }

  /* ---------- данные ---------- */

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
        subtitle: [voice, p.quality || ''].filter(Boolean).join(' · '),
        quality: parseInt(p.quality) || 0,
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
      }, function () {
        log('запрос не прошёл (сеть/CORS): ' + queries[i - 1]);
        next();
      });
    }

    next();
  }

  /* ---------- UI ---------- */

  function play(item, movie) {
    var name = (movie.title || movie.name || '') + ' — ' + item.title;
    var ctrl = Lampa.Controller.enabled().name;

    var isAndroid = Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('android');
    if (isAndroid && Lampa.Android && Lampa.Android.openPlayer && Lampa.Storage.field('player') !== 'inner') {
      Lampa.Android.openPlayer(item.url, { title: name });
      return;
    }

    if (Lampa.Iframe && Lampa.Iframe.show) {
      Lampa.Iframe.show({
        url: item.url,
        onBack: function () {
          if (Lampa.Iframe.close) Lampa.Iframe.close();
          Lampa.Controller.toggle(ctrl);
        }
      });
      return;
    }

    window.open(item.url, '_blank');
  }

  function open(movie) {
    if (!movie) return Lampa.Noty.show('Brogiro: нет данных карточки');

    Lampa.Loading.start(function () { Lampa.Loading.stop(); });

    search(movie, function (items) {
      Lampa.Loading.stop();

      if (!items.length) return Lampa.Noty.show('Brogiro: ничего не найдено');

      var ctrl = Lampa.Controller.enabled().name;

      Lampa.Select.show({
        title: 'Brogiro',
        items: items,
        onSelect: function (item) {
          Lampa.Controller.toggle(ctrl);
          play(item, movie);
        },
        onBack: function () {
          Lampa.Controller.toggle(ctrl);
        }
      });
    });
  }

  function addButton(render, movie) {
    if (!render || !render.find || render.find('.view--brogiro').length) return;

    var btn = $('<div class="full-start__button selector view--brogiro">' + ICON + '<span>Brogiro</span></div>');
    btn.on('hover:enter', function () { open(movie); });

    var anchor = render.find('.view--torrent, .view--online').last();
    if (anchor.length) return anchor.after(btn);

    var box = render.find('.full-start-new__buttons, .full-start__buttons').first();
    if (box.length) return box.append(btn);

    log('контейнер кнопок не найден');
  }

  /* ---------- регистрация ---------- */

  var manifest = {
    type: 'video',
    version: VERSION,
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
    if (window.brogiro_started) return;
    window.brogiro_started = true;

    // 1. Регистрация в списке видео-плагинов (меню «Онлайн»/«Смотреть»)
    safe('manifest', function () { Lampa.Manifest.plugins = manifest; });

    // 2. Кнопка в карточке
    safe('listener', function () {
      Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;
        safe('button', function () {
          var render = e.object.activity.render();
          var movie = e.data && e.data.movie;
          addButton(render, movie);
          setTimeout(function () { addButton(render, movie); }, 300);
        });
      });
    });

    // 3. Если карточка уже открыта на момент загрузки
    safe('active', function () {
      var a = Lampa.Activity.active();
      if (a && a.component === 'full' && a.activity) addButton(a.activity.render(), a.card);
    });

    log('загружен v' + VERSION);
    if (CFG.debug) safe('noty', function () { Lampa.Noty.show('Brogiro v' + VERSION + ' загружен'); });
  }

  function boot() {
    if (!window.Lampa || !Lampa.Listener) return setTimeout(boot, 200);
    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
  }

  boot();
})();
