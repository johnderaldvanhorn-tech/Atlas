(() => {
  'use strict';

  const sidebar = document.getElementById('appSidebar');
  const button = document.getElementById('mobileMenuButton');
  const backdrop = document.getElementById('mobileNavBackdrop');
  const desktopBadge = document.getElementById('connectionBadge');
  const mobileBadge = document.getElementById('mobileConnectionBadge');

  if (!sidebar || !button || !backdrop) return;

  const isMobile = () => window.matchMedia('(max-width: 1180px)').matches;

  function openMenu() {
    if (!isMobile()) return;
    sidebar.classList.add('mobile-open');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('visible'));
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Close navigation');
    document.body.classList.add('mobile-nav-open');
  }

  function closeMenu() {
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('visible');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open navigation');
    document.body.classList.remove('mobile-nav-open');
    window.setTimeout(() => {
      if (!backdrop.classList.contains('visible')) backdrop.hidden = true;
    }, 220);
  }

  button.addEventListener('click', () => {
    sidebar.classList.contains('mobile-open') ? closeMenu() : openMenu();
  });
  backdrop.addEventListener('click', closeMenu);
  sidebar.querySelectorAll('nav button').forEach((navButton) => navButton.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
  window.addEventListener('resize', () => {
    if (!isMobile()) closeMenu();
  });

  // Mirror the desktop connection state into the always-visible mobile header.
  if (desktopBadge && mobileBadge) {
    const syncBadge = () => {
      mobileBadge.textContent = desktopBadge.textContent.trim() || 'Local';
      mobileBadge.className = `mobileConnectionBadge ${desktopBadge.classList.contains('online') ? 'online' : desktopBadge.classList.contains('error') ? 'error' : 'offline'}`;
    };
    syncBadge();
    new MutationObserver(syncBadge).observe(desktopBadge, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // Add table labels so narrow layouts remain understandable.
  document.querySelectorAll('table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (!cell.dataset.label && headers[index]) cell.dataset.label = headers[index];
      });
    });
  });
})();
