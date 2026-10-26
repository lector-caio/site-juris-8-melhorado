/* ============================================================
   JURIS8 · MENU EM GAVETA
   Abre e fecha #lp-drawer pelo botão .lp-burger. Usa delegação de eventos no
   document, então funciona também nas páginas montadas pelo runtime DC (home e
   páginas do DET), em que a marcação só existe depois do carregamento.
   ============================================================ */
(function () {
  'use strict';
  var lastFocus = null;
  var closeTimer = null;

  function drawer() { return document.getElementById('lp-drawer'); }
  function isOpen() { var d = drawer(); return !!d && d.classList.contains('is-open'); }
  function reduceMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function setBurger(open) {
    var b = document.querySelector('.lp-burger');
    if (!b) return;
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  function open() {
    var d = drawer();
    if (!d) return;
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    d.classList.add('is-active');
    void d.offsetWidth; // aplica o estado inicial antes da transição
    d.classList.add('is-open');
    document.documentElement.classList.add('lp-menu-open');
    setBurger(true);
    var first = d.querySelector('.lp-drawer__nav a');
    if (first) first.focus({ preventScroll: true });
  }

  function close(restoreFocus) {
    var d = drawer();
    if (!d || !d.classList.contains('is-active')) return;
    d.classList.remove('is-open');
    document.documentElement.classList.remove('lp-menu-open');
    setBurger(false);
    closeTimer = setTimeout(function () { d.classList.remove('is-active'); }, reduceMotion() ? 0 : 350);
    if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.lp-burger')) { e.preventDefault(); if (isOpen()) close(true); else open(); return; }
    if (t.closest('[data-menu-close]')) { e.preventDefault(); close(true); return; }
    // Link da gaveta: fecha antes da navegação para liberar a rolagem da página
    if (t.closest('#lp-drawer a')) close(false);
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key !== 'Tab') return;
    // Mantém o foco do teclado dentro da gaveta enquanto ela está aberta
    var items = Array.prototype.slice.call(drawer().querySelectorAll('.lp-drawer__panel a[href], .lp-drawer__panel button'));
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Se a tela crescer até a barra completa voltar, a gaveta fecha sozinha
  if (window.matchMedia) {
    var wide = window.matchMedia('(min-width: 1061px)');
    var onWide = function (m) { if (m.matches) close(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }
})();
