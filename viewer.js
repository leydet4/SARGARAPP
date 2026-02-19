// viewer.js — full-screen modal viewer (forced overlay)
(function () {
  const modal = document.getElementById('viewerModal');
  const frame = document.getElementById('modalFrame');
  const titleEl = document.getElementById('modalTitle');
  const openNewTabBtn = document.getElementById('openNewTab');

  if (!modal || !frame || !titleEl || !openNewTabBtn) {
    window.openInApp = (name, url) => window.open(url, '_blank', 'noopener');
    return;
  }

  let fallbackTimer = null;

  function toEmbedUrl(url, kind) {
    try {
      const u = new URL(url, location.href);
      if (kind === 'form' && u.hostname.includes('docs.google.com') && u.pathname.includes('/forms/')) {
        u.searchParams.set('embedded', 'true');
      }
      return u.toString();
    } catch { return url; }
  }

  function showModal(name, embedUrl, newTabUrl) {
    titleEl.textContent = name;
    openNewTabBtn.href = newTabUrl || embedUrl || '#';

    clearTimeout(fallbackTimer);
    modal.hidden = false;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Clean reload fixes iOS Safari
    frame.src = '';
    setTimeout(() => { frame.src = embedUrl; }, 30);

    fallbackTimer = setTimeout(() => {
      titleEl.textContent = `${name} (embed may be blocked — use “Open in New Tab”)`;
    }, 5000);
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    frame.src = '';
    clearTimeout(fallbackTimer);
  }

  window.openInApp = function (name, url, kind = 'pdf') {
    const embed = toEmbedUrl(url, kind);
    showModal(name, embed, url);
  };

  frame.addEventListener('load', () => clearTimeout(fallbackTimer));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Click backdrop (not header/iframe) to close
  modal.addEventListener('click', (e) => {
    if (!e.target.closest('.modal-header') && !e.target.closest('.modal-content')) closeModal();
  });

  window.closeModal = closeModal;
})();
