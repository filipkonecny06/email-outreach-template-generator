(function () {
  const page = document.querySelector('[data-page="history"]');
  if (!page) return;

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-history');
    if (!button) return;

    const subject = button.getAttribute('data-subject') || '';
    const body = button.getAttribute('data-body') || '';

    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    window.toast('History entry copied.', 'success');
  });
})();
