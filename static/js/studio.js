/* ═══════════════════════════════════════════════════════════
   LESSON 1 — Structuring the Interface
   GOAL: Wire up the form UI — chips, color pickers, button.
   ═══════════════════════════════════════════════════════════ */


(function () {
  'use strict';

  const generateBtn = document.getElementById('generateBtn');
  const formError   = document.getElementById('formError');
  const emptyState  = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const result      = document.getElementById('result');
  const captchaModal = document.getElementById('captchaModal');
  const captchaCancel = document.getElementById('captchaCancel');
  const colorwayTabs = document.getElementById('colorwayTabs');
  const sneakerSvg = document.querySelector('.sneaker-svg');
  const colorwayInfo = document.getElementById('colorwayInfo');
  const aiImage = document.getElementById('aiImage');
  const imgFrame = document.getElementById('imgFrame');
  const imgLoading = document.getElementById('imgLoading');
  const imgError = document.getElementById('imgError');

  let currentColorways = [];
  let activeColorwayIndex = 0;

  // hCaptcha integration state
  // The previous version sent /generate requests directly with user preferences,
  // so there was no captcha token and the backend could not enforce bot protection.
  // Now we store the rendered widget ID and the one-time token returned by hCaptcha.
  let hcaptchaWidgetId = null;
  let hcaptchaToken = '';

  // ── Chip selection ──────────────────────────────────────────────
  document.querySelectorAll('.chip-group').forEach(group => {
    const hiddenInput = document.getElementById(group.dataset.field);
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (hiddenInput) hiddenInput.value = chip.dataset.value;
      });
    });
  });

  // ── Color pickers ───────────────────────────────────────────────
  function syncColorPair(pickerId, textId) {
    const picker = document.getElementById(pickerId);
    const text   = document.getElementById(textId);
    if (!picker || !text) return;
    picker.addEventListener('input', () => { text.value = picker.value; });
    text.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
    });
  }
  syncColorPair('primary_color', 'primary_color_text');
  syncColorPair('accent_color',  'accent_color_text');

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function applyColorway(colorway) {
    if (!sneakerSvg || !colorway) return;

    // When a design is generated, apply the selected colorway to the inline SVG.
    // This updates the sneaker preview in real time as users switch between
    // generated colorway options.
    sneakerSvg.style.setProperty('--upper-color', colorway.upper || '#00C3FF');
    sneakerSvg.style.setProperty('--accent-color', colorway.accent || '#EBC9A0');
    sneakerSvg.style.setProperty('--lace-color', colorway.lace || '#FAEBC8');
    sneakerSvg.style.setProperty('--tongue-color', colorway.tongue || '#FAEBC8');
    sneakerSvg.style.setProperty('--panel-color', colorway.accent || '#0096DC');
    sneakerSvg.style.setProperty('--toe-color', colorway.upper || '#00AAF0');
    sneakerSvg.style.setProperty('--midsole-color', colorway.midsole || '#FAEBC8');
  }

  function updateColorwayInfo(colorway) {
    if (!colorwayInfo || !colorway) return;
    colorwayInfo.innerHTML = `
      <div class="colorway-summary">
        <strong>${escHtml(colorway.name || 'Colorway')}</strong>
        <p>${escHtml(colorway.description || 'Generated colorway details.')}</p>
        <ul class="colorway-swatch-list">
          <li><span class="swatch" style="background:${escHtml(colorway.upper || '#00C3FF')}"></span> Upper</li>
          <li><span class="swatch" style="background:${escHtml(colorway.accent || '#EBC9A0')}"></span> Accent</li>
          <li><span class="swatch" style="background:${escHtml(colorway.lace || '#FAEBC8')}"></span> Lace</li>
          <li><span class="swatch" style="background:${escHtml(colorway.tongue || '#FAEBC8')}"></span> Tongue</li>
        </ul>
      </div>
    `;
  }

  function renderColorwayTabs(colorways) {
    if (!colorwayTabs) return;
    colorwayTabs.innerHTML = '';
    currentColorways = Array.isArray(colorways) ? colorways : [];
    activeColorwayIndex = 0;

    if (!currentColorways.length) {
      colorwayTabs.innerHTML = '<div class="colorway-placeholder">No colorways available yet.</div>';
      colorwayInfo && (colorwayInfo.innerHTML = 'Generate a concept to preview colorway options.');
      return;
    }

    currentColorways.forEach((colorway, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'colorway-chip' + (index === 0 ? ' active' : '');
      button.textContent = colorway.name || `Colorway ${index + 1}`;
      button.addEventListener('click', () => {
        currentColorways.forEach((_, i) => {
          colorwayTabs.children[i].classList.toggle('active', i === index);
        });
        activeColorwayIndex = index;
        applyColorway(currentColorways[index]);
        updateColorwayInfo(currentColorways[index]);
      });
      colorwayTabs.appendChild(button);
    });

    applyColorway(currentColorways[0]);
    updateColorwayInfo(currentColorways[0]);
  }

  function setImageLoadingState(isLoading) {
    if (imgLoading) imgLoading.classList.toggle('hidden', !isLoading);
    if (imgFrame) imgFrame.classList.toggle('hidden', isLoading);
    if (imgError) imgError.classList.add('hidden');
  }

  function setImageError(message) {
    if (imgError) {
      imgError.classList.remove('hidden');
      const textEl = document.getElementById('imgErrorText');
      if (textEl) textEl.textContent = message;
    }
    if (imgFrame) imgFrame.classList.add('hidden');
    if (imgLoading) imgLoading.classList.add('hidden');
  }

  function setImageSource(url) {
    if (!aiImage || !url) return;
    aiImage.src = url;
    aiImage.onload = () => {
      if (imgFrame) imgFrame.classList.remove('hidden');
      if (imgLoading) imgLoading.classList.add('hidden');
    };
    aiImage.onerror = () => {
      setImageError('Unable to load generated image.');
    };
  }

  function ensureCaptchaWidget() {
    if (hcaptchaWidgetId !== null) return true;
    if (typeof hcaptcha === 'undefined' || !window.HCAPTCHA_SITE_KEY) return false;

    // Render the invisible hCaptcha widget on demand. This lets us execute the
    // challenge only when the user clicks Generate, while still providing a token
    // the backend can verify before performing the AI request.
    hcaptchaWidgetId = hcaptcha.render('hcaptchaWidget', {
      sitekey: window.HCAPTCHA_SITE_KEY,
      size: 'invisible',
      callback: onCaptchaSuccess,
      'error-callback': onCaptchaError,
      'expired-callback': onCaptchaExpired,
    });

    return true;
  }

  // Note: the hCaptcha script is loaded in head, but the page-level
  // initialization happens lazily when the user clicks Generate.
  // We avoid relying on the hCaptcha onload callback because the page
  // script may not have defined it yet when the script finishes loading.
  function resetCaptcha() {
    if (hcaptchaWidgetId !== null && typeof hcaptcha !== 'undefined') {
      hcaptcha.reset(hcaptchaWidgetId);
    }
    hcaptchaToken = '';
  }

  function showCaptchaModal() {
    captchaModal && captchaModal.classList.remove('hidden');
  }

  function hideCaptchaModal() {
    captchaModal && captchaModal.classList.add('hidden');
  }

  function onCaptchaSuccess(token) {
    hcaptchaToken = token;
    hideCaptchaModal();
    submitGenerateRequest();
  }

  function onCaptchaError() {
    hideCaptchaModal();
    formError.textContent = 'Captcha verification failed. Please try again.';
    generateBtn.disabled = false;
  }

  function onCaptchaExpired() {
    hcaptchaToken = '';
    formError.textContent = 'Captcha expired. Please try again.';
    generateBtn.disabled = false;
  }

  captchaCancel && captchaCancel.addEventListener('click', () => {
    hideCaptchaModal();
    resetCaptcha();
    generateBtn.disabled = false;
  });

  async function submitGenerateRequest() {
    const prefs = {
      style:         document.getElementById('style').value,
      material:      document.getElementById('material').value,
      occasion:      document.getElementById('occasion').value,
      primary_color: document.getElementById('primary_color').value,
      accent_color:  document.getElementById('accent_color').value,
      inspiration:   document.getElementById('inspiration').value.trim(),
      hcaptcha_token: hcaptchaToken,
    };

    try {
      loadingState && loadingState.classList.remove('hidden');
      emptyState  && emptyState.classList.add('hidden');
      result      && result.classList.add('hidden');

      const resp = await fetch('/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(prefs),
      });
      const data = await resp.json();

      loadingState && loadingState.classList.add('hidden');

      if (data.error) {
        emptyState && emptyState.classList.remove('hidden');
        formError.textContent = data.error;
      } else {
        const c = data.concept;
        result && result.classList.remove('hidden');
        document.getElementById('resultName').textContent     = c.name || '';
        document.getElementById('resultTagline').textContent  = c.tagline || '';
        document.getElementById('resultDesc').textContent     = c.description || '';
        document.getElementById('resultPrice').textContent    = c.retail_price || '';
        document.getElementById('resultAudience').textContent = c.target_audience || '';
        document.getElementById('resultTags').textContent     = (c.style_tags || []).join(' · ');
        document.getElementById('materialsList').innerHTML    = (c.materials || []).map(m => `<li>${escHtml(m)}</li>`).join('');
        document.getElementById('featuresList').innerHTML     = (c.features  || []).map(f => `<li>${escHtml(f)}</li>`).join('');
        document.getElementById('soleText').textContent       = c.sole_type || '—';

        // Populate the generated colorway explorer from the AI response.
        // If the concept includes a colorways array, we render tabs and apply
        // the first colorway immediately.
        renderColorwayTabs(c.colorways || []);

        if (data.image_url){
          setImageLoadingState(true);
          setImageSource(data.image_url);
        }else{
          setImageLoadingState(false)
          setImageError("No image generated!!")  
        }
      }
    } catch (err) {
      loadingState && loadingState.classList.add('hidden');
      emptyState   && emptyState.classList.remove('hidden');
      formError.textContent = 'Network error: ' + err.message;
    } finally {
      generateBtn.disabled = false;
      resetCaptcha();
    }
  }

  generateBtn && generateBtn.addEventListener('click', () => {
    formError.textContent = '';
    generateBtn.disabled = true;

    // Start the captcha flow before sending any request to /generate.
    // Previously the UI would skip this step, so the backend had no token to validate.
    if (!ensureCaptchaWidget()) {
      formError.textContent = 'hCaptcha is not ready yet. Please refresh the page.';
      generateBtn.disabled = false;
      return;
    }

    showCaptchaModal();
    hcaptcha.execute(hcaptchaWidgetId);
  });

  document.getElementById('regenBtn') && document.getElementById('regenBtn').addEventListener('click', () => {
    result     && result.classList.add('hidden');
    emptyState && emptyState.classList.remove('hidden');
    formError.textContent = '';
  });

})();
