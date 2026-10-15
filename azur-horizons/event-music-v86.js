/* AZUR v86 — LA BANDE-SON DE LA VIDÉO pendant l'événement « THE END ».
 * Le son de la vidéo de référence (musique + bruitages de l'événement), calé
 * à la seconde sur l'horloge de l'événement (0 s = premier nuage de fumée) :
 * on recale la lecture dès qu'elle dérive, on la met en pause si le temps de
 * l'événement s'arrête, et on la reprend au bon endroit si l'on rejoint en
 * cours de route. Avant 0 s (bus, compte à rebours), c'est la partition de
 * music75 qui joue ; dès que la bande-son démarre, music75 se tait.
 * v89 : la bande-son sert d'horloge maîtresse à l'événement (voir le séquenceur).
 * NB : cette musique appartient à Epic Games — à remplacer avant toute publication. */
(function (root) {
  'use strict';
  var E = root.AZEvent;
  if (!E || !E.register) return;
  var SRC = './event-end-audio.mp3?v=86', END = 305;
  // la vidéo de référence a le son ~0,17 s en retard sur l'image (+ latence de sortie audio) : on joue le son un peu en avance
  var AV = .2;
  var au = null, on = false, want = false, lastT = -1e9, lastWall = 0, stillFor = 0, hooked = false;

  function VT() { return E.filmVideoTime ? E.filmVideoTime() : E.tTotal; }
  function vol() { var s = root.AZUR && root.AZUR.profile && root.AZUR.profile.settings; var v = s && typeof s.music === 'number' ? s.music : .8; return Math.max(0, Math.min(1, v)); }
  function tryPlay() { if (!au || !want || !au.paused) return; var pr = au.play(); if (pr && pr.catch) pr.catch(function () {}); }
  function ensure() {
    if (au) return au;
    au = new Audio(); au.preload = 'auto'; au.src = SRC; au.loop = false;
    if (!hooked) { hooked = true; ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, tryPlay, { passive: true }); }); }
    return au;
  }
  function init() { on = true; want = false; lastT = -1e9; stillFor = 0; ensure(); }
  function update() {
    if (!on || !E.active) return;
    var a = ensure(), t = VT(), now = (root.performance && performance.now ? performance.now() : Date.now()) / 1000;
    var dt = lastWall ? Math.min(.5, now - lastWall) : 0; lastWall = now;
    // le temps de l'événement est-il figé (menu, pause) ? alors on suspend le son aussi
    if (Math.abs(t - lastT) < 1e-4) stillFor += dt; else stillFor = 0;
    lastT = t;
    var inside = t + AV >= 0 && t + AV < END && stillFor < .3;
    if (!inside) { want = false; if (!a.paused) a.pause(); E.realMusic = false; return; }
    want = true;
    a.volume = vol() * Math.max(0, Math.min(1, (END - t - AV) / 2.5));
    if (a.readyState >= 1 && !a.seeking && Math.abs(a.currentTime - (t + AV)) > (a.paused ? .2 : .7)) { try { a.currentTime = t + AV; } catch (e) {} }
    tryPlay();
    E.realMusic = !a.paused && a.readyState >= 2;
  }
  // horloge maîtresse lue par le séquenceur (null si la bande-son ne joue pas)
  E.musicClock = function () {
    if (!on || !au || au.paused || au.seeking || au.readyState < 3) return null;
    var t = au.currentTime; return t > .05 && t < END - .2 ? t - AV : null;
  };
  function dispose() { on = false; want = false; E.realMusic = false; if (au) { try { au.pause(); } catch (e) {} } }
  E.register('music86', { init: init, update: update, dispose: dispose });
})(window);
