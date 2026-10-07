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
