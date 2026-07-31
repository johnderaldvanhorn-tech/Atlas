(() => {
  function setupHorizontalSlider({targetId, topId, innerId, leftId, rightId}) {
    const target = document.getElementById(targetId);
    const top = document.getElementById(topId);
    const inner = document.getElementById(innerId);
    const left = document.getElementById(leftId);
    const right = document.getElementById(rightId);
    if (!target || !top || !inner) return;

    let syncing = false;
    const refresh = () => {
      inner.style.width = `${Math.max(target.scrollWidth, target.clientWidth)}px`;
      if (left) left.disabled = target.scrollLeft <= 1;
      if (right) right.disabled = target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;
    };
    target.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = target.scrollLeft;
      refresh();
      requestAnimationFrame(() => { syncing = false; });
    });
    top.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      target.scrollLeft = top.scrollLeft;
      refresh();
      requestAnimationFrame(() => { syncing = false; });
    });
    left?.addEventListener('click', () => target.scrollBy({left: -500, behavior: 'smooth'}));
    right?.addEventListener('click', () => target.scrollBy({left: 500, behavior: 'smooth'}));
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(target);
    if (typeof MutationObserver !== 'undefined') new MutationObserver(() => requestAnimationFrame(refresh)).observe(target, {childList:true, subtree:true, attributes:true});
    window.addEventListener('resize', refresh);
    requestAnimationFrame(refresh);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupHorizontalSlider({targetId:'projectTableScroll',topId:'projectTopScroll',innerId:'projectTopScrollInner',leftId:'projectScrollLeft',rightId:'projectScrollRight'});
    setupHorizontalSlider({targetId:'roadmapGrid',topId:'roadmapTopScroll',innerId:'roadmapTopScrollInner',leftId:'roadmapScrollLeft',rightId:'roadmapScrollRight'});
  });
})();
