(function () {
  window.toast = function toast(message, type) {
    const region = document.getElementById('toastRegion');
    if (!region) return;

    const el = document.createElement('div');
    el.className = `toast ${type || 'info'}`;
    el.textContent = message;
    region.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 2800);
  };
})();
