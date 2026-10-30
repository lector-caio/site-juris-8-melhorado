/* ============================================================
   JURIS8 · COMPORTAMENTOS DAS PÁGINAS DE SOLUÇÃO
   Mesma lógica da home (index.html), em forma reaproveitável.
   Cada página chama J8.mount({...}) no componentDidMount e
   guarda o retorno para chamar .destroy() no componentWillUnmount.

   J8.mount({
     form: { interest, source, segment },   // formulário #lp-form (opcional)
     extra: (api) => {}                      // comportamento próprio da página
   })
   ============================================================ */
(function () {
  'use strict';

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduceMotion = function () { return mq('(prefers-reduced-motion: reduce)'); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Analytics: sem identificadores de usuário nem dados do formulário */
  function track(name, ctx) {
    var data = { event: name, context: ctx || '', page: window.location.pathname, timestamp: new Date().toISOString() };
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(data);
    if (typeof window.gtag === 'function') window.gtag('event', name, { event_category: 'juris8_lp', event_label: ctx || '' });
    if (window.console) console.log('[juris8 Track]', name, ctx || '');
  }

  function icons(n) {
    n = n || 0;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    else if (n < 25) setTimeout(function () { icons(n + 1); }, 120);
  }

  /* UTMs e origem: guardados na entrada e reaproveitados no envio */
  function captureUtms() {
    try {
      var p = new URLSearchParams(window.location.search);
      var hasUtm = UTM_KEYS.some(function (k) { return p.has(k); });
      UTM_KEYS.forEach(function (k) { if (p.has(k)) sessionStorage.setItem(k, p.get(k)); });
      if (hasUtm || !sessionStorage.getItem('lp_origin_url')) sessionStorage.setItem('lp_origin_url', window.location.href);
    } catch (e) {}
  }
  function utms() {
    var out = {};
    try {
      UTM_KEYS.forEach(function (k) { out[k] = sessionStorage.getItem(k) || ''; });
      out.origin_url = sessionStorage.getItem('lp_origin_url') || window.location.href;
    } catch (e) {
      UTM_KEYS.forEach(function (k) { out[k] = ''; });
      out.origin_url = window.location.href;
    }
    return out;
  }

  /* Chegada com âncora: a página é montada depois do load, o navegador não rola sozinho */
  function scrollToHash() {
    var id = '';
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (e) {}
    var el = id && document.getElementById(id);
    if (!el) return;
    var root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    el.scrollIntoView();
    root.style.scrollBehavior = '';
  }

  function mount(cfg) {
    cfg = cfg || {};
    var offs = [];
    var on = function (target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      offs.push(function () { target.removeEventListener(ev, fn, opts); });
    };
    var later = function (fn, ms) { var t = setTimeout(fn, ms); offs.push(function () { clearTimeout(t); }); return t; };
    var api = { track: track, icons: icons, on: on, offs: offs, later: later, $: $, $$: $$, reduceMotion: reduceMotion };

    captureUtms();
    wireHeader(on);
    wireHeroStage(on, offs);
    on(document, 'click', function (e) {
      var a = e.target.closest && e.target.closest('[data-track]');
      if (a) track(a.getAttribute('data-track'), a.getAttribute('data-track-ctx'));
    });
    if (cfg.form !== false) wireForm(cfg.form || {});
    wireFaq();
    wireWords(on);
    wireSpotlight(on);
    wireTabs(on, offs);
    wireFlows(offs);
    wireScrolly(on, offs);
    wireCounters(offs);
    if (typeof cfg.extra === 'function') {
      try { cfg.extra(api); } catch (err) { console.error('[juris8]', err); }
    }
    wireReveal(offs);
    icons(0);
    scrollToHash();
    return { destroy: function () { offs.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); } };
  }

  /* Header: sombra ao rolar + scroll spy nas abas (indicador desliza até a seção atual) */
  function wireHeader(on) {
    var header = document.getElementById('lp-header');
    if (!header) return;
    var nav = header.querySelector('.lp-nav');
    var ind = nav && nav.querySelector('.lp-nav__ind');
    var links = nav ? $$('a[href^="#"]', nav) : [];
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var cur = -1, ticking = false;
    var place = function () {
      if (!ind || cur < 0) return;
      var a = links[cur];
      ind.style.width = a.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + (a.offsetLeft - 4) + 'px)';
    };
    var spy = function () {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 12);
      var line = window.innerHeight * 0.35;
      var i = -1;
      secs.forEach(function (sec, k) { if (sec && sec.getBoundingClientRect().top <= line) i = k; });
      if (i === cur) return;
      cur = i;
      links.forEach(function (a, k) {
        a.classList.toggle('is-active', k === i);
        if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      if (nav) nav.classList.toggle('has-active', i >= 0);
      place();
    };
    on(window, 'scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    on(window, 'resize', place);
    spy();
    setTimeout(place, 600);
  }

  /* Foto do hero = cover de uma arte 2200x910 (área do texto clara à esquerda); o card acompanha a mesma escala */
  function wireHeroStage(on, offs) {
    var hero = document.getElementById('inicio');
    var visual = hero && hero.querySelector('.lp-hero__visual');
    var lead = hero && hero.querySelector('.lp-hero__lead');
    if (!visual || !lead) return;
    var RW = 2200, RH = 910;
    var update = function () {
      var w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;
      var stacked = mq('(max-width: 960px)');
      var sw = Math.max(w, h * RW / RH), sh = sw * RH / RW;
      var fx = stacked ? 0.56 : 0;
      hero.style.setProperty('--stage-w', sw + 'px');
      hero.style.setProperty('--stage-h', sh + 'px');
      hero.style.setProperty('--stage-x', ((w - sw) * fx) + 'px');
      hero.style.setProperty('--stage-y', ((h - sh) * 0.12) + 'px');
      hero.style.setProperty('--stage-s', String(sw / RW));
      if (stacked) return;
      hero.style.setProperty('--card-dx', '0px');
      var left = visual.offsetLeft;
      var dx = Math.max(0, lead.getBoundingClientRect().right - hero.getBoundingClientRect().left + 24 - left);
      var fit = (w - 20 - left - dx) / visual.offsetWidth;
      hero.style.setProperty('--card-dx', dx + 'px');
      hero.style.setProperty('--card-s', String(Math.min(sw / RW, fit)));
    };
    update();
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(update);
      ro.observe(hero);
      offs.push(function () { ro.disconnect(); });
    } else {
      on(window, 'resize', update);
    }
  }

  /* FAQ: uma pergunta aberta por vez */
  function wireFaq() {
    var items = $$('#faq .fq-item');
    items.forEach(function (it) {
      var btn = it.querySelector('.fq-btn');
      btn.addEventListener('click', function () {
        var open = !it.classList.contains('is-open');
        items.forEach(function (o) { o.classList.remove('is-open'); o.querySelector('.fq-btn').setAttribute('aria-expanded', 'false'); });
        if (open) { it.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); track('faq_open', btn.id); }
      });
    });
  }

  /* Formulário genérico (#lp-form). Campos com name = nome, email, telefone, empresa vão
     direto para api/contact.js; os demais seguem em "extras" com o rótulo do campo. */
  function wireForm(opts) {
    var form = document.getElementById('lp-form');
    if (!form) return;
    var submitBtn = document.getElementById('lp-submit');
    var submitLabel = document.getElementById('lp-submit-label');
    var idleLabel = submitLabel.textContent;
    var alertEl = document.getElementById('lp-alert');
    var started = false;
    var interest = opts.interest || 'Demonstração Juris8';
    var source = opts.source || 'lp_juris8';
    var segment = opts.segment || 'juris8';

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', source);
    });

    // Máscara do telefone: (11) 99999-0000
    $$('input[type="tel"]', form).forEach(function (tel) {
      tel.addEventListener('input', function () {
        var d = tel.value.replace(/\D/g, '').slice(0, 11);
        var v = d;
        if (d.length > 2) v = '(' + d.slice(0, 2) + ') ' + d.slice(2);
        if (d.length > 6) v = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(d.length - 4);
        tel.value = v;
      });
    });

    // Campo obrigatório = .lp-field com mensagem de erro. (O runtime DC passa required=""
    // ao React, que descarta o atributo; por isso a regra não depende de [required].)
    var fields = $$('.lp-field', form).filter(function (w) { return w.querySelector('.lp-field__error'); }).map(function (w) {
      return { w: w, inp: w.querySelector('input, select, textarea') };
    }).filter(function (f) { return f.inp; });

    var validate = function (f) {
      var inp = f.inp;
      var v = (inp.value || '').trim();
      var ok = v.length > 0;
      if (inp.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (inp.type === 'tel') ok = v.replace(/\D/g, '').length >= 10;
      if (inp.type === 'checkbox') ok = inp.checked;
      f.w.classList.toggle('is-error', !ok);
      inp.setAttribute('aria-invalid', ok ? 'false' : 'true');
      return ok;
    };
    fields.forEach(function (f) {
      var ev = f.inp.type === 'checkbox' || f.inp.tagName === 'SELECT' ? 'change' : 'blur';
      f.inp.addEventListener(ev, function () { validate(f); });
      f.inp.addEventListener('input', function () { if (f.w.classList.contains('is-error')) validate(f); });
    });

    var setLoading = function (on) {
      submitBtn.disabled = on;
      submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
      if (on) {
        submitLabel.textContent = 'Enviando…';
        if (!submitBtn.querySelector('.lp-spinner')) {
          var s = document.createElement('span');
          s.className = 'lp-spinner';
          s.setAttribute('aria-hidden', 'true');
          submitBtn.insertBefore(s, submitLabel);
        }
      } else {
        submitLabel.textContent = idleLabel;
        var sp = submitBtn.querySelector('.lp-spinner');
        if (sp) sp.remove();
      }
    };

    var again = document.getElementById('lp-again');
    if (again) again.addEventListener('click', function () {
      form.reset();
      document.getElementById('lp-success').classList.remove('is-visible');
      document.getElementById('lp-form-view').style.display = '';
      var first = form.querySelector('input:not([type="hidden"]):not(.lp-hp)');
      if (first) first.focus();
    });

    var labelOf = function (el) {
      var l = el.id && form.querySelector('label[for="' + el.id + '"]');
      var t = l ? l.textContent : (el.getAttribute('aria-label') || el.name);
      return t.replace(/\(opcional\)/i, '').replace(/opcional$/i, '').replace(/\s+/g, ' ').trim();
    };
    var valueOf = function (el) {
      if (el.tagName === 'SELECT') return el.selectedIndex > 0 ? el.options[el.selectedIndex].text : '';
      return (el.value || '').trim();
    };

    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) || /\.(localhost|test)$/.test(window.location.hostname);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alertEl.classList.remove('is-visible');
      var valid = fields.reduce(function (acc, f) { return validate(f) && acc; }, true);
      if (!valid) {
        track('form_validation_error', source);
        var first = form.querySelector('.is-error input, .is-error select, .is-error textarea');
        if (first) first.focus();
        return;
      }
      if (form.elements.website && form.elements.website.value.trim()) return; // honeypot

      var core = { nome: '', email: '', telefone: '', empresa: '', mensagem: '' };
      var extras = [];
      $$('input, select, textarea', form).forEach(function (el) {
        if (!el.name || el.name === 'website' || el.type === 'checkbox' || el.type === 'submit') return;
        var v = valueOf(el);
        if (Object.prototype.hasOwnProperty.call(core, el.name)) core[el.name] = v;
        else if (v) extras.push({ name: el.name, label: labelOf(el), value: v });
      });
      var u = utms();
      var submittedAt = new Date().toISOString();
      var lines = extras.map(function (x) { return x.label + ': ' + x.value; });
      lines.push('Mensagem: ' + (core.mensagem || '—'), '', 'Página: ' + window.location.pathname, 'Segmento: ' + segment, 'Fonte do lead: ' + source, 'Enviado em: ' + submittedAt, 'URL de origem: ' + u.origin_url);
      UTM_KEYS.forEach(function (k) { lines.push(k + ': ' + (u[k] || '—')); });

      var body = {
        nome: core.nome,
        email: core.email,
        telefone: core.telefone,
        empresa: core.empresa,
        interesse: interest,
        origem: source + (u.utm_source ? ' · ' + u.utm_source : '') + (u.utm_campaign ? ' · ' + u.utm_campaign : ''),
        mensagem: lines.join('\n'),
        extras: extras,
        porte: (extras.find(function (x) { return x.name === 'processos'; }) || extras[0] || {}).value || '',
        consentimento_lgpd: true,
        segment: segment,
        lead_source: source,
        page: window.location.pathname,
        submitted_at: submittedAt,
        origin_url: u.origin_url,
        utm_source: u.utm_source, utm_medium: u.utm_medium, utm_campaign: u.utm_campaign, utm_content: u.utm_content, utm_term: u.utm_term,
        website: ''
      };

      setLoading(true);
      var endpoint = opts.endpoint === undefined ? '/api/contact' : opts.endpoint;
      if (!endpoint) {
        if (isLocal) {
          console.log('[juris8 LP] Envio simulado (endpoint não configurado):', body);
          setTimeout(function () { setLoading(false); onSuccess(); }, 700);
        } else {
          track('form_submit_error', 'endpoint_not_configured');
          setLoading(false);
          alertEl.classList.add('is-visible');
        }
        return;
      }
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
        .then(function () { setLoading(false); onSuccess(); })
        .catch(function (err) {
          console.error('[juris8 LP]', err);
          track('form_submit_error', source);
          setLoading(false);
          alertEl.classList.add('is-visible');
        });
    });

    function onSuccess() {
      track('form_submit_success', source);
      document.getElementById('lp-form-view').style.display = 'none';
      var success = document.getElementById('lp-success');
      if (success) success.classList.add('is-visible');
      var h = document.getElementById('lp-success-title');
      if (h) h.focus();
      icons(0);
    }
  }

  /* Títulos .lp-words: acendem palavra por palavra conforme sobem na tela */
  function wireWords(on) {
    var titles = $$('.lp-words');
    if (!titles.length) return;
    var groups = titles.map(function (title) {
      var words = [];
      var split = function (node, accent) {
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
          if (ch.nodeType === 3) {
            var frag = document.createDocumentFragment();
            ch.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement('span');
              w.className = 'w' + (accent ? ' is-accent' : '');
              w.textContent = part;
              frag.appendChild(w);
              words.push(w);
            });
            ch.replaceWith(frag);
          } else if (ch.nodeType === 1) {
            split(ch, accent || ch.classList.contains('lp-accent'));
          }
        });
      };
      split(title, false);
      title.classList.add('js-words');
      return { title: title, words: words };
    });
    if (reduceMotion() || document.visibilityState === 'hidden') {
      groups.forEach(function (g) { g.words.forEach(function (w) { w.classList.add('is-lit'); }); });
      return;
    }
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = window.innerHeight;
      groups.forEach(function (g) {
        var top = g.title.getBoundingClientRect().top;
        var p = Math.min(1, Math.max(0, (vh * 0.9 - top) / (vh * 0.5)));
        var n = Math.round(p * g.words.length);
        g.words.forEach(function (w, i) { w.classList.toggle('is-lit', i < n); });
      });
    };
    on(window, 'scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* Brilho que segue o cursor nos cards */
  function wireSpotlight(on) {
    if (!mq('(hover: hover)')) return;
    $$('.lp-bc, .pl-card, .gn-card, .fc').forEach(function (card) {
      on(card, 'pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* Abas: [data-tabs] com botões [role=tab] (aria-controls) e painéis [role=tabpanel].
     data-auto="6000" avança sozinho enquanto visível; para no hover/foco e de vez após um clique. */
  function wireTabs(on, offs) {
    $$('[data-tabs]').forEach(function (root) {
      var tabs = $$('[role="tab"]', root);
      if (!tabs.length) return;
      var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
      var dur = Number(root.getAttribute('data-auto')) || 0;
      var cur = -1, timer = null, manual = false, hover = false, visible = false;
      root.style.setProperty('--tp-dur', (dur / 1000 || 6) + 's');
      var set = function (i, focus) {
        if (i === cur) return;
        cur = i;
        tabs.forEach(function (t, k) {
          var sel = k === i;
          t.setAttribute('aria-selected', sel ? 'true' : 'false');
          t.setAttribute('tabindex', sel ? '0' : '-1');
          var bar = t.querySelector('.tp__bar');
          if (bar && sel) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
        });
        panels.forEach(function (p, k) { if (p) p.classList.toggle('is-active', k === i); });
        if (focus) tabs[i].focus();
        root.dispatchEvent(new CustomEvent('j8:tab', { detail: { index: i } }));
        icons(0);
      };
      var stop = function () { if (timer) { clearTimeout(timer); timer = null; } };
      var tick = function () {
        stop();
        if (!dur || manual || hover || !visible || reduceMotion()) return;
        timer = setTimeout(function () { set((cur + 1) % tabs.length); tick(); }, dur);
      };
      offs.push(stop);
      tabs.forEach(function (t, k) {
        on(t, 'click', function () {
          manual = true; root.classList.add('is-manual'); stop(); set(k);
          track('tab_click', (root.id || 'tabs') + ':' + (k + 1));
        });
        on(t, 'keydown', function (e) {
          var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
          if (!d) return;
          e.preventDefault();
          manual = true; root.classList.add('is-manual'); stop();
          set((cur + d + tabs.length) % tabs.length, true);
        });
      });
      on(root, 'pointerenter', function () { hover = true; root.classList.add('is-paused'); stop(); });
      on(root, 'pointerleave', function () { hover = false; root.classList.remove('is-paused'); tick(); });
      var start = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
      cur = -1;
      set(start >= 0 ? start : 0);
      if (dur && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          visible = en.some(function (x) { return x.isIntersecting; });
          if (visible) tick(); else stop();
        }, { threshold: 0.35 });
        io.observe(root);
        offs.push(function () { io.disconnect(); });
      }
    });
  }

  /* Fluxo (.fl): as etapas "rodam" em sequência quando a seção aparece; clique para numa etapa */
  function wireFlows(offs) {
    $$('.fl').forEach(function (sec) {
      var list = sec.querySelector('.fl-steps');
      if (!list) return;
      var steps = Array.prototype.slice.call(list.children);
      var cards = steps.map(function (li) { return li.querySelector('.fl-card'); });
      var replay = sec.querySelector('.fl-replay');
      var stepLbl = sec.querySelector('.fl-st-step');
      var reduce = reduceMotion();
      var timers = [], auto = !reduce, inView = false;
      sec.classList.add('js');
      var clear = function () { timers.forEach(clearTimeout); timers = []; };
      var at = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
      offs.push(clear);
      var paint = function (done, active, focus) {
        steps.forEach(function (li, k) {
          li.classList.toggle('is-done', k < done);
          li.classList.toggle('is-active', k === active);
          li.classList.toggle('is-focus', k === focus);
          cards[k].setAttribute('aria-pressed', k === focus ? 'true' : 'false');
        });
        var last = active >= 0 ? active : done - 1;
        list.style.setProperty('--p', Math.max(0, last / (steps.length - 1)).toFixed(3));
        sec.classList.toggle('is-complete', done === steps.length && focus < 0);
        sec.classList.toggle('is-paused', focus >= 0);
        if (focus >= 0 && stepLbl) stepLbl.textContent = 'Etapa ' + (focus + 1) + ' de ' + steps.length;
      };
      var run = function () {
        clear();
        paint(0, -1, -1);
        var t = 350;
        steps.forEach(function (_, k) {
          at(function () { paint(k, k, -1); }, t);
          t += 1300;
          at(function () { paint(k + 1, -1, -1); }, t);
          t += 650;
        });
        at(function () { if (auto && inView) run(); }, t + 7000);
      };
      cards.forEach(function (c, k) { c.addEventListener('click', function () { auto = false; clear(); paint(k + 1, -1, k); }); });
      if (replay) replay.addEventListener('click', function () { auto = !reduce; if (reduce) paint(steps.length, -1, -1); else run(); });
      if (reduce || !('IntersectionObserver' in window)) { auto = false; paint(steps.length, -1, -1); return; }
      paint(0, -1, -1);
      var started = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView && auto && !started) { started = true; run(); }
          if (!inView && auto && started) { clear(); started = false; paint(0, -1, -1); }
        });
      }, { threshold: 0.3 });
      io.observe(list);
      offs.push(function () { io.disconnect(); });
    });
  }

  /* Scrollytelling (.ft): a tela fica fixa e troca de cena conforme o item passa pelo centro */
  function wireScrolly(on, offs) {
    $$('.ft').forEach(function (sec) {
      var items = $$('.ft__item', sec);
      if (!items.length) return;
      var scenes = $$('.fx-scene', sec);
      var dots = $$('.ft-dots button', sec);
      var list = sec.querySelector('.ft__list');
      var rail = sec.querySelector('.ft__rail span');
      var fitBox = sec.querySelector('.ft-fit');
      var win = sec.querySelector('.ft-win');
      var designW = win ? Number(win.getAttribute('data-w')) || 560 : 560;
      var cur = -1;
      var setActive = function (i) {
        if (i === cur) return;
        cur = i;
        sec.setAttribute('data-active', String(i + 1));
        items.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
        scenes.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
        dots.forEach(function (el, k) { el.setAttribute('aria-current', k === i ? 'true' : 'false'); });
        var bar = dots[i] && dots[i].parentElement;
        if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: dots[i].offsetLeft - (bar.clientWidth - dots[i].offsetWidth) / 2, behavior: 'smooth' });
      };
      var fit = function () {
        if (!fitBox || !win) return;
        var s = Math.min(1.12, fitBox.clientWidth / designW);
        win.style.setProperty('--ft-s', s.toFixed(4));
      };
      var ticking = false;
      var update = function () {
        ticking = false;
        var vh = window.innerHeight;
        var focus = vh * 0.5;
        if (mq('(max-width: 960px)')) {
          var st = sec.querySelector('.ft__stage').getBoundingClientRect();
          focus = st.bottom + (vh - st.bottom) * 0.4;
        }
        var best = 0, bestD = Infinity;
        items.forEach(function (el, k) {
          var r = el.getBoundingClientRect();
          var d = Math.abs(r.top + Math.min(r.height, 260) / 2 - focus);
          if (d < bestD) { bestD = d; best = k; }
        });
        setActive(best);
        if (list && rail) {
          var lr = list.getBoundingClientRect();
          var p = Math.min(1, Math.max(0, (focus - lr.top) / lr.height));
          rail.style.transform = 'scaleY(' + p.toFixed(4) + ')';
        }
      };
      dots.forEach(function (d, k) {
        on(d, 'click', function () {
          var r = items[k].getBoundingClientRect();
          var vh = window.innerHeight;
          var target = mq('(max-width: 960px)') ? vh * 0.62 : vh * 0.5;
          window.scrollBy({ top: r.top + Math.min(r.height, 260) / 2 - target, behavior: 'smooth' });
          setActive(k);
        });
      });
      on(window, 'scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      on(window, 'resize', function () { fit(); update(); });
      if ('ResizeObserver' in window && fitBox) {
        var ro = new ResizeObserver(fit);
        ro.observe(fitBox);
        offs.push(function () { ro.disconnect(); });
      }
      fit();
      setActive(0);
      update();
    });
  }

  /* Números que contam até o valor: data-count="50.6" data-dec="1" data-pre="R$ " data-suf=" bi" */
  function fmt(n, dec) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function wireCounters(offs) {
    var els = $$('[data-count]');
    if (!els.length) return;
    var paint = function (el, v) {
      el.textContent = (el.getAttribute('data-pre') || '') + fmt(v, Number(el.getAttribute('data-dec')) || 0) + (el.getAttribute('data-suf') || '');
    };
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { paint(el, Number(el.getAttribute('data-count'))); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, to = Number(el.getAttribute('data-count')), t0 = performance.now(), dur = 1300;
        var step = function (now) {
          var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          paint(el, to * e);
          if (p < 1) requestAnimationFrame(step); else paint(el, to);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
    offs.push(function () { io.disconnect(); });
  }

  /* Reveal ao rolar (igual à home): ao entrar, o elemento ganha .is-in */
  function wireReveal(offs) {
    var items = $$('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduceMotion() || document.visibilityState === 'hidden') {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var show = function (el) {
      var delay = Number(el.getAttribute('data-reveal-delay')) || 0;
      el.style.transitionDelay = delay + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'none';
      setTimeout(function () { el.classList.add('is-in'); }, delay + 150);
      setTimeout(function () { el.style.transition = ''; el.style.transitionDelay = ''; el.style.opacity = ''; el.style.transform = ''; }, delay + 900);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        show(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    items.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px)';
      el.style.transition = 'opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1)';
      io.observe(el);
    });
    offs.push(function () { io.disconnect(); });
  }

  window.J8 = { mount: mount, track: track, icons: icons, fmt: fmt };
})();
