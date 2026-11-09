const apiOrigin = 'https://praktika-mentorship-demo.metricheron.chatgpt.site';
const byId = (id) => document.getElementById(id);
const select = byId('plan');
const leadForm = byId('lead-form');
const formStatus = byId('form-status');
const submitButton = leadForm.querySelector('[type="submit"]');
const analyticsKey = 'praktika-analytics-off';
const configured = { telegram: false, whatsapp: false };
let online = false;
let attempt;
let analyticsOff = false;

try { analyticsOff = localStorage.getItem(analyticsKey) === '1'; } catch {}
const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';

function count(type) {
  if (!online || analyticsOff || privacySignal) return;
  void fetch(apiOrigin + '/api/events', {
    credentials: 'omit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => {});
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function renderPlans(plans) {
  const grid = byId('plan-grid');
  grid.replaceChildren();
  select.length = 1;
  plans.forEach((plan, index) => {
    select.add(new Option(plan.name, plan.name));
    const card = node('article', index === 1 ? 'plan featured' : 'plan');
    const list = node('ul');
    plan.features.forEach((feature) => list.append(node('li', '', feature)));
    const link = node('a', 'button primary', 'Выбрать формат');
    const arrow = node('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    link.href = '#apply';
    link.dataset.apply = '';
    link.addEventListener('click', () => {
      select.value = plan.name;
      attempt = undefined;
      formStatus.textContent = '';
    });
    const number = String(index + 1).padStart(2, '0');
    card.append(node('span', 'plan-label', number + ' / Демо-тариф'),
      node('h3', '', plan.name), node('p', 'plan-price', plan.price),
      node('p', 'plan-description', plan.description), list, link);
    grid.append(card);
  });
}

function setContacts({ telegram, whatsapp }) {
  const channels = {
    telegram: /^[A-Za-z0-9_]{5,32}$/.test(telegram || '') ? 'https://t.me/' + telegram : '',
    whatsapp: /^[1-9][0-9]{7,14}$/.test(whatsapp || '') ? 'https://wa.me/' + whatsapp : '',
  };
  for (const [channel, url] of Object.entries(channels)) {
    if (!url) continue;
    configured[channel] = true;
    const link = byId(channel);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  if (configured.telegram && configured.whatsapp) {
    byId('channel-note').textContent = 'Мессенджеры откроются в новой вкладке.';
  } else if (configured.telegram || configured.whatsapp) {
    byId('channel-note').textContent = 'Один из каналов пока работает в деморежиме.';
  }
}

async function loadContent() {
  let content;
  try {
    const response = await fetch(apiOrigin + '/api/content', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error();
    content = await response.json();
    if (!Array.isArray(content.plans)) throw new Error();
    online = true;
  } catch {
    try {
      const response = await fetch('./content.json');
      if (response.ok) content = await response.json();
    } catch {}
  }
  if (content) {
    if (content.headline !== 'Упакуйте знания в сильный продукт') byId('headline').textContent = content.headline;
    byId('intro').textContent = content.intro;
    renderPlans(content.plans);
    setContacts(content);
  }
  if (!online) {
    showStatus('В этом просмотре заявки не сохраняются. Для отправки откройте сайт с сервером.', true);
    submitButton.disabled = true;
  }
  count('view');
}

function showStatus(message, error = false) {
  formStatus.textContent = message;
  formStatus.dataset.error = String(error);
}

leadForm.addEventListener('input', () => {
  attempt = undefined;
  if (online) showStatus('');
});
leadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!online || submitButton.disabled) return;
  const data = new FormData(leadForm);
  const payload = JSON.stringify({
    plan: data.get('plan'),
    goal: data.get('goal'),
    consent: data.has('consent'),
    analytics: !analyticsOff && !privacySignal,
    website: data.get('website') || '',
  });
  if (attempt?.payload !== payload) {
    attempt = { payload, key: globalThis.crypto?.randomUUID?.() };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (attempt.key) headers['Idempotency-Key'] = attempt.key;
  const controls = Array.from(leadForm.elements);
  controls.forEach((control) => { control.disabled = true; });
  showStatus('Отправляем заявку…');
  try {
    const response = await fetch(apiOrigin + '/api/leads', { method: 'POST', headers, body: payload, credentials: 'omit' });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      showStatus(result.error || 'Отправка не удалась. Попробуйте ещё раз.', true);
      return;
    }
    leadForm.reset();
    attempt = undefined;
    showStatus('Демо-заявка сохранена. Она доступна администратору проекта.');
  } catch {
    showStatus('Не удалось связаться с сервером. Попробуйте ещё раз.', true);
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-apply]')) count('apply_click');
  const channel = event.target.closest('[data-channel]')?.dataset.channel;
  if (!channel) return;
  count(channel + '_click');
  if (configured[channel]) return;
  event.preventDefault();
  const label = channel === 'telegram' ? 'Telegram' : 'WhatsApp';
  byId('channel-note').textContent = label + ' пока не подключён. Для проверки используйте форму заявки.';
});

const nav = byId('navigation');
const toggle = document.querySelector('.menu-toggle');
function menu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('span').textContent = open ? '−' : '+';
  nav.classList.toggle('open', open);
}
toggle.addEventListener('click', () => menu(toggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) menu(false); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    menu(false);
    toggle.focus();
  }
});

const track = document.querySelector('.slides');
const slides = Array.from(track.querySelectorAll('.slide'));
const previousSlide = byId('prev');
const nextSlide = byId('next');

function updateCarousel() {
  const view = track.getBoundingClientRect();
  const shown = slides.flatMap((slide, index) => {
    const card = slide.getBoundingClientRect();
    const visible = Math.min(card.right, view.right) - Math.max(card.left, view.left);
    return visible >= card.width * 0.6 ? [index + 1] : [];
  });
  const first = shown[0] ?? 1;
  const last = shown.at(-1) ?? first;
  const twoDigits = (number) => String(number).padStart(2, '0');
  const range = first === last ? twoDigits(first) : twoDigits(first) + '–' + twoDigits(last);
  const label = range + ' / ' + twoDigits(slides.length);
  if (byId('slide-count').textContent !== label) byId('slide-count').textContent = label;
  previousSlide.disabled = track.scrollLeft <= 2;
  nextSlide.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
}

function stepCarousel(direction) {
  const distance = slides[1].offsetLeft - slides[0].offsetLeft;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  track.scrollBy({ left: distance * direction, behavior: reducedMotion ? 'instant' : 'smooth' });
}

previousSlide.addEventListener('click', () => stepCarousel(-1));
nextSlide.addEventListener('click', () => stepCarousel(1));
track.addEventListener('scroll', updateCarousel, { passive: true });
document.querySelector('.carousel').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  stepCarousel(event.key === 'ArrowLeft' ? -1 : 1);
});
window.addEventListener('resize', updateCarousel);
updateCarousel();
const privacy = byId('privacy');
byId('privacy-open').addEventListener('click', () => privacy.showModal());
const optout = byId('analytics-optout');
optout.checked = analyticsOff || privacySignal;
optout.disabled = privacySignal;
optout.addEventListener('change', () => {
  analyticsOff = optout.checked;
  try { localStorage.setItem(analyticsKey, analyticsOff ? '1' : '0'); } catch {}
});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((section) => reveal.observe(section));
}
void loadContent();
