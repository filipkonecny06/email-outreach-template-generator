(function () {
  const page = document.querySelector('[data-page="history"]');
  if (!page) return;

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-history');
    if (!button) return;

    const card = button.closest('.history-card');
    const subject = card?.querySelector('[data-history-subject]')?.textContent || '';
    const body = card?.querySelector('[data-history-body]')?.textContent || '';

    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    window.toast('History entry copied.', 'success');
  });
})();
