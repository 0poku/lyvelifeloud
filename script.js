'use strict';

document.documentElement.classList.add('js-enabled');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('main-navigation');
const siteHeader = document.querySelector('.site-header');

function closeNavigation(returnFocus = false) {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  navigation.classList.remove('open');
  document.body.classList.remove('menu-open');
  if (returnFocus) menuButton.focus();
}

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
});

navigation.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => closeNavigation());
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeNavigation(true);
});

document.addEventListener('click', event => {
  if (!event.target.closest('.site-header') && menuButton.getAttribute('aria-expanded') === 'true') closeNavigation();
});

siteHeader.addEventListener('focusout', event => {
  if (event.relatedTarget && !siteHeader.contains(event.relatedTarget) && menuButton.getAttribute('aria-expanded') === 'true') {
    closeNavigation();
  }
});

window.matchMedia('(min-width: 701px)').addEventListener('change', event => {
  if (event.matches) closeNavigation();
});

document.getElementById('year').textContent = String(new Date().getFullYear());

// Content remains visible without JavaScript. Entrance motion is an enhancement.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-arriving');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });

  document.querySelectorAll('h1, h2, .section-photo, .hero-visual, .about-visual, .connect-portrait, .workshop-banner, .workshop-moment, .calling-photo')
    .forEach(element => observer.observe(element));

  reducedMotion.addEventListener('change', event => {
    if (event.matches) observer.disconnect();
  });
}

// Optional background music. Nothing loads or plays until a visitor asks for it.
const musicPlayer = document.querySelector('.music-player');
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

if (musicPlayer && AudioContextClass) {
  const musicToggle = musicPlayer.querySelector('.music-toggle');
  const musicLabel = musicPlayer.querySelector('.music-label');
  const musicVolume = musicPlayer.querySelector('.music-volume');
  const musicStatus = musicPlayer.querySelector('.music-status');
  const MUSIC_SRC = 'assets/audio/calm-piano-avec-soin.mp3';
  // The file carries one second of wrap-around audio on each side of the loop.
  const LOOP_START = 1;
  const LOOP_END = LOOP_START + 135.884082;
  const FADE_IN = 3;
  const FADE_OUT = 1.2;

  let context, fader, volume, buffer, bufferRequest, source, pauseTimer;
  let state = 'idle';
  let wantsMusic = false;

  const labels = { idle: 'Play calming music', loading: 'Loading music…', playing: 'Pause music', paused: 'Play calming music', error: 'Music unavailable — try again' };

  function setState(next, message = '') {
    state = next;
    musicPlayer.dataset.state = next;
    musicLabel.textContent = labels[next];
    musicToggle.setAttribute('aria-busy', String(next === 'loading'));
    musicStatus.textContent = message;
  }

  function volumeLevel() {
    const value = Number(musicVolume.value) / 100;
    return value * value * 0.6; // gentle curve with a quiet ceiling
  }

  function updateVolume() {
    musicVolume.setAttribute('aria-valuetext', `${musicVolume.value}%`);
    musicVolume.style.setProperty('--level', `${musicVolume.value}%`);
    if (volume) volume.gain.setTargetAtTime(volumeLevel(), context.currentTime, 0.08);
  }

  function rampTo(value, seconds) {
    const now = context.currentTime;
    fader.gain.cancelScheduledValues(now);
    fader.gain.setValueAtTime(fader.gain.value, now);
    fader.gain.linearRampToValueAtTime(value, now + seconds);
  }

  function loadMusic() {
    bufferRequest = bufferRequest || fetch(MUSIC_SRC)
      .then(response => {
        if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject)))
      .catch(error => {
        bufferRequest = null;
        throw error;
      });
    return bufferRequest;
  }

  async function play() {
    wantsMusic = true;
    clearTimeout(pauseTimer);
    try {
      if (!context) {
        context = new AudioContextClass();
        fader = context.createGain();
        volume = context.createGain();
        fader.gain.value = 0;
        volume.gain.value = volumeLevel();
        fader.connect(volume);
        volume.connect(context.destination);
        // The system can interrupt audio (a phone call, for example); show it as paused.
        context.addEventListener('statechange', () => {
          if (context.state === 'running' || state !== 'playing') return;
          wantsMusic = false;
          fader.gain.cancelScheduledValues(context.currentTime);
          fader.gain.value = 0;
          setState('paused', 'Music paused.');
        });
      }
      // Resume inside the click so browsers treat playback as user-initiated.
      const resuming = context.resume();
      if (!buffer) {
        setState('loading', 'Loading music.');
        buffer = await loadMusic();
      }
      await resuming;
      if (!wantsMusic) {
        if (state !== 'playing') context.suspend();
        return;
      }
      if (context.state !== 'running') throw new Error('Playback was blocked');
      if (!source) {
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = LOOP_START;
        source.loopEnd = LOOP_END;
        source.connect(fader);
        source.start(0, LOOP_START);
      }
      rampTo(1, FADE_IN);
      musicVolume.hidden = false;
      setState('playing', 'Calming music playing.');
    } catch (error) {
      wantsMusic = false;
      if (!buffer) {
        setState('error', 'The music could not be loaded. Please try again.');
      } else {
        setState('paused', 'Your browser blocked playback. Select Play calming music to try again.');
      }
    }
  }

  function pause(fadeSeconds = FADE_OUT) {
    wantsMusic = false;
    if (state === 'loading') {
      setState(buffer ? 'paused' : 'idle', 'Music stopped.');
      return;
    }
    if (state !== 'playing') return;
    setState('paused', 'Music paused.');
    rampTo(0, fadeSeconds);
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      if (!wantsMusic) context.suspend();
    }, fadeSeconds * 1000 + 60);
  }

  musicToggle.addEventListener('click', () => {
    if (state === 'playing' || state === 'loading') pause();
    else play();
  });

  musicVolume.addEventListener('input', updateVolume);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(0.4);
  });

  updateVolume();
  musicPlayer.hidden = false;
  document.documentElement.classList.add('has-music-player');
}
