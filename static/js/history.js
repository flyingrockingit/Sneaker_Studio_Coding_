/* ═══════════════════════════════════════════════════════════
   HISTORY PAGE — search, sort, modal, remix
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Parse the embedded JSON ──────────────────────────────────────
  const dataEl  = document.getElementById('historyData');
  const designs = dataEl ? JSON.parse(dataEl.textContent) : [];

  // ── DOM refs ─────────────────────────────────────────────────────
  const grid      = document.getElementById('historyGrid');
  const searchEl  = document.getElementById('historySearch');
  const noResults = document.getElementById('noResults');
  const cards     = grid ? Array.from(grid.querySelectorAll('.history-card')) : [];
  const sortBtns  = document.querySelectorAll('.sort-btn');

  let currentSort  = 'newest';
  let currentQuery = '';

  // ── Helper ───────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── SEARCH ───────────────────────────────────────────────────────
  searchEl && searchEl.addEventListener('input', () => {
    currentQuery = searchEl.value.trim().toLowerCase();
    applyFilters();
  });

  function applyFilters() {
    let visible = 0;
    cards.forEach(card => {
      const name     = card.dataset.name     || '';
      const tags     = card.dataset.tags     || '';
      const style    = card.dataset.style    || '';
      const material = card.dataset.material || '';
      const occasion = card.dataset.occasion || '';
      const haystack = `${name} ${tags} ${style} ${material} ${occasion}`;
      const matches  = !currentQuery || haystack.includes(currentQuery);
      card.style.display = matches ? '' : 'none';
      if (matches) visible++;
    });

    noResults && noResults.classList.toggle('hidden', visible > 0);
  }

  // ── SORT ─────────────────────────────────────────────────────────
  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      sortCards();
    });
  });

  function sortCards() {
    if (!grid) return;
    const sorted = [...cards].sort((a, b) => {
      if (currentSort === 'oldest') {
        return Number(a.dataset.index) - Number(b.dataset.index);
      }
      if (currentSort === 'price') {
        const pa = parseFloat(a.dataset.price) || 0;
        const pb = parseFloat(b.dataset.price) || 0;
        return pa - pb;
      }
      // newest (default) — data-index 0 = first inserted = newest (we insert at front)
      return Number(a.dataset.index) - Number(b.dataset.index);
    });
    sorted.forEach(card => grid.appendChild(card));
    applyFilters();
  }

  // ── MODAL ────────────────────────────────────────────────────────
  const modal       = document.getElementById('detailModal');
  const modalClose  = document.getElementById('detailModalClose');

  window.openModal = function(index) {
    const d = designs[index];
    if (!d || !modal) return;
    const c = d.concept || {};

    // Header
    document.getElementById('dmTags').textContent     = (c.style_tags || []).join(' · ').toUpperCase();
    document.getElementById('dmName').textContent     = c.name     || '';
    document.getElementById('dmTagline').textContent  = c.tagline  || '';
    document.getElementById('dmPrice').textContent    = c.retail_price    || '';
    document.getElementById('dmAudience').textContent = c.target_audience || '';
    document.getElementById('dmDesc').textContent     = c.description || '';
    document.getElementById('dmSole').textContent     = c.sole_type   || '—';

    // AI image
    const imgWrap = document.getElementById('dmImgWrap');
    const imgEl   = document.getElementById('dmImg');
    if (d.image_url) {
      imgEl.src = d.image_url;
      imgWrap.classList.remove('hidden');
    } else {
      imgWrap.classList.add('hidden');
    }

    // Lists
    document.getElementById('dmMaterials').innerHTML =
      (c.materials || []).map(m => `<li>${escHtml(m)}</li>`).join('');
    document.getElementById('dmFeatures').innerHTML =
      (c.features  || []).map(f => `<li>${escHtml(f)}</li>`).join('');

    // Colorways
    document.getElementById('dmColorways').innerHTML = (c.colorways || []).map(cw => `
      <div class="dm-cw-chip">
        <div class="dm-cw-swatches">
          <span class="dm-swatch" style="background:${escHtml(cw.upper)}"></span>
          <span class="dm-swatch" style="background:${escHtml(cw.accent)}"></span>
          <span class="dm-swatch" style="background:${escHtml(cw.sole)}"></span>
          <span class="dm-swatch" style="background:${escHtml(cw.lace)}"></span>
        </div>
        <span class="dm-cw-name">${escHtml(cw.name || '')}</span>
      </div>
    `).join('');

    // Prefs
    const p = d.prefs || {};
    document.getElementById('dmPrefs').innerHTML = [
      p.style, p.material, p.occasion,
      p.primary_color ? `<span class="dm-color-dot" style="background:${escHtml(p.primary_color)}"></span>${escHtml(p.primary_color)}` : null,
      p.accent_color  ? `<span class="dm-color-dot" style="background:${escHtml(p.accent_color)}"></span>${escHtml(p.accent_color)}`  : null,
    ].filter(Boolean).map(v => `<span class="dm-pref-pill">${v}</span>`).join('');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function closeModal() {
    modal && modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalClose && modalClose.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // ── REMIX: read URL params and pre-fill studio form ───────────────
  // Studio.js reads chip groups on page load; here we support passing
  // ?style=...&material=... etc from the Remix link so the Studio
  // auto-selects the right chips and colors when the page opens.
  if (window.location.pathname === '/studio') {
    const params = new URLSearchParams(window.location.search);
    ['style','material','occasion'].forEach(field => {
      const val = params.get(field);
      if (!val) return;
      const hiddenInput = document.getElementById(field);
      if (hiddenInput) hiddenInput.value = val;
      const group = document.querySelector(`.chip-group[data-field="${field}"]`);
      if (group) {
        group.querySelectorAll('.chip').forEach(c => {
          c.classList.toggle('active', c.dataset.value === val);
        });
      }
    });
    ['primary_color','accent_color'].forEach(field => {
      const val = params.get(field);
      if (!val) return;
      const picker = document.getElementById(field);
      const text   = document.getElementById(field + '_text');
      if (picker) picker.value = val;
      if (text)   text.value  = val;
    });
    const insp = params.get('inspiration');
    if (insp) {
      const ta = document.getElementById('inspiration');
      if (ta) ta.value = insp;
    }
  }

})();
