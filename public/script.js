'use strict';
const COUNTS = [1, 3, 10, 30, 56];
const COLORS = ['#f9dd68', '#d6b2ff', '#80caff', '#92dec9', '#b8bfdc'];
const KEY = 'lucky-draw-v1';
const $ = id => document.getElementById(id);
let selected = null, saving = true;
function randomInt(max) {
  const a = new Uint32Array(1), limit = Math.floor(4294967296 / max) * max;
  do { crypto.getRandomValues(a); } while (a[0] >= limit);
  return a[0] % max;
}
function fresh() {
  const tickets = COUNTS.flatMap((n, i) => Array(n).fill(i + 1));
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
  }
  return { version: 1, tickets, drawn: [], pending: null };
}
function valid(s) {
  return s && s.version === 1 && Array.isArray(s.tickets) && s.tickets.length === 100 &&
    s.tickets.every(r => Number.isInteger(r) && r >= 1 && r <= 5) &&
    COUNTS.every((n, i) => s.tickets.filter(r => r === i + 1).length === n) &&
    Array.isArray(s.drawn) && new Set(s.drawn).size === s.drawn.length &&
    s.drawn.every(i => Number.isInteger(i) && i >= 0 && i < 100) &&
    (s.pending === null || s.drawn.includes(s.pending));
}
function restore() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (valid(s)) return s; }
  catch { saving = false; }
  return fresh();
}
let state = restore();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); saving = true; }
  catch { saving = false; }
  $('save-status').textContent = saving ? '' : '저장할 수 없습니다. 창을 닫으면 진행 상황이 사라질 수 있습니다.';
}
function render() {
  const remaining = 100 - state.drawn.length;
  $('remaining').textContent = remaining;
  $('prizes').replaceChildren(...COUNTS.map((total, i) => {
    const n = total - state.drawn.filter(k => state.tickets[k] === i + 1).length;
    const el = document.createElement('div'); el.className = 'prize'; el.style.setProperty('--rank', COLORS[i]);
    el.innerHTML = `<div><span class="rank">${i + 1}등</span><small>남은 상품</small></div><div><b>${n}</b><span class="total"> / ${total}</span></div>`;
    return el;
  }));
  $('board').replaceChildren(...state.tickets.map((rank, i) => {
    const drawn = state.drawn.includes(i), b = document.createElement('button');
    b.className = 'ticket' + (drawn ? ' drawn' : '') + (selected === i ? ' selected' : '');
    b.style.setProperty('--rank', COLORS[rank - 1]); b.disabled = drawn || state.pending !== null;
    b.setAttribute('aria-label', `${i + 1}번 티켓${drawn ? `, ${rank}등, 뽑기 완료` : ''}`);
    b.setAttribute('aria-pressed', String(selected === i));
    b.innerHTML = `${drawn ? `<strong>${rank}등</strong>` : '<span class="star">✦</span>'}<span class="num">${String(i + 1).padStart(3, '0')}</span>`;
    b.onclick = () => { selected = selected === i ? null : i; render(); };
    return b;
  }));
  $('start').disabled = selected === null || state.pending !== null;
  $('random').disabled = remaining === 0 || state.pending !== null;
  $('status').textContent = remaining === 0 ? '모든 티켓을 뽑았습니다. 새 뽑기판을 시작해보세요!' : selected === null ? '한 번에 한 장씩 뽑을 수 있어요.' : `${selected + 1}번 티켓을 선택했습니다.`;
  $('history').replaceChildren(...state.drawn.slice(-10).reverse().map(i => {
    const el = document.createElement('span'); el.style.setProperty('--rank', COLORS[state.tickets[i] - 1]);
    el.innerHTML = `${String(i + 1).padStart(3, '0')}번 <b>${state.tickets[i]}등</b>`; return el;
  }));
  if (!state.drawn.length) $('history').textContent = '첫 번째 행운의 주인공을 기다리고 있어요.';
}
function showCoupon() {
  $('ticket-label').textContent = `TICKET No. ${String(state.pending + 1).padStart(3, '0')}`;
  $('result').textContent = '?'; $('result-message').textContent = '당신의 행운을 열어보세요';
  $('modal-title').textContent = '어떤 행운이 기다릴까요?'; $('modal-help').textContent = '아래 쿠폰 열기 버튼을 눌러주세요.';
  $('open').hidden = false; $('close').hidden = true; $('coupon').classList.remove('revealed');
  if (!$('draw-dialog').open) $('draw-dialog').showModal();
}
$('random').onclick = () => {
  const available = state.tickets.map((_, i) => i).filter(i => !state.drawn.includes(i));
  if (available.length && state.pending === null) { selected = available[randomInt(available.length)]; render(); }
};
$('start').onclick = () => {
  if (selected === null || state.drawn.includes(selected) || state.pending !== null) return;
  state.pending = selected; state.drawn.push(selected); selected = null; save(); render(); showCoupon();
};
$('open').onclick = () => {
  if (state.pending === null) return;
  const rank = state.tickets[state.pending];
  $('result').textContent = `${rank}등`; $('result-message').textContent = '축하합니다! 당신의 행운이에요.';
  $('modal-title').textContent = rank === 1 ? '최고의 행운, 1등 당첨!' : `${rank}등에 당첨되었어요!`;
  $('modal-help').textContent = `${state.pending + 1}번 티켓의 결과입니다.`;
  $('coupon').classList.add('revealed'); $('open').hidden = true; $('close').hidden = false;
};
$('close').onclick = () => { state.pending = null; save(); $('draw-dialog').close(); render(); $('random').focus(); };
$('draw-dialog').addEventListener('cancel', e => e.preventDefault());
$('reset').onclick = () => $('reset-dialog').showModal();
$('confirm-reset').onclick = () => { state = fresh(); selected = null; save(); render(); $('reset-dialog').close(); };
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { $('status').textContent = '이 브라우저에서는 전체 화면 버튼을 사용할 수 없습니다. PC에서는 F11을 눌러주세요.'; }
};
// 다른 탭에서 진행한 결과를 반영해 같은 브라우저의 중복 사용을 줄입니다.
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  try { const s = JSON.parse(e.newValue); if (!valid(s)) return; state = s; selected = null;
    $('draw-dialog').close(); render(); if (state.pending !== null) showCoupon();
  } catch { /* 잘못된 저장 데이터는 무시합니다. */ }
});
save(); render(); if (state.pending !== null) showCoupon();
