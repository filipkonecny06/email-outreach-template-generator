(function () {
  const page = document.querySelector('[data-page="generator"]');
  if (!page) return;

  const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  const form = document.getElementById('generatorForm');
  const templateList = document.getElementById('templateList');
  const templateIdInput = document.getElementById('templateId');
  const subjectPreview = document.getElementById('subjectPreview');
  const bodyPreview = document.getElementById('bodyPreview');
  const formError = document.getElementById('formError');
  const followUpContainer = document.getElementById('followUpContainer');

  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput = document.getElementById('templateSearch');
  const favoritesOnly = document.getElementById('favoritesOnly');

  const copySubjectBtn = document.getElementById('copySubjectBtn');
  const copyBodyBtn = document.getElementById('copyBodyBtn');
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const saveHistoryBtn = document.getElementById('saveHistoryBtn');

  const state = {
    subject: '',
    body: '',
    followUps: []
  };

  const debounce = (fn, delay) => {
    let id;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), delay);
    };
  };

  const serializeForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    data.includeFollowUps = Boolean(document.getElementById('includeFollowUps').checked);
    return data;
  };

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const highlightTokens = (text) =>
    escapeHtml(text).replace(/\{[a-zA-Z0-9_]+\}/g, (token) => `<mark>${token}</mark>`);

  const toCsvCell = (value) => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };

  const renderPreview = () => {
    subjectPreview.innerHTML = highlightTokens(state.subject || 'No subject generated yet.');
    bodyPreview.innerHTML = highlightTokens(state.body || 'No body generated yet.');

    followUpContainer.innerHTML = state.followUps
      .map(
        (f) =>
          `<div class="preview-block"><h3>Follow-up #${f.sequence}</h3><pre class="preview-text">${highlightTokens(`Subject: ${f.subject}\n\n${f.body}`)}</pre></div>`
      )
      .join('');
  };

  const fetchPreview = async () => {
    if (!templateIdInput.value) {
      formError.textContent = 'Choose a template from the library.';
      return;
    }

    formError.textContent = '';

    const payload = serializeForm();
    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.errors
            ? data.errors.map((e) => e.msg).join(' ')
            : data.message || 'Failed to generate preview.'
        );
      }

      state.subject = data.subject;
      state.body = data.body;
      state.followUps = data.followUps || [];
      renderPreview();
    } catch (error) {
      formError.textContent = error.message;
    }
  };

  const debouncedPreview = debounce(fetchPreview, 280);

  templateList.addEventListener('click', (event) => {
    const btn = event.target.closest('.template-item');
    if (!btn) return;

    templateList.querySelectorAll('.template-item').forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    templateIdInput.value = btn.getAttribute('data-template-id');
    debouncedPreview();
  });

  templateList.addEventListener('click', async (event) => {
    const favoriteToggle = event.target.closest('.favorite-toggle');
    if (!favoriteToggle) return;

    event.preventDefault();
    event.stopPropagation();

    const templateId = favoriteToggle.getAttribute('data-favorite-id');

    try {
      const response = await fetch(`/api/favorite/${templateId}`, {
        method: 'POST',
        headers: { 'CSRF-Token': csrfToken }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Favorite action failed.');
      favoriteToggle.classList.toggle('active', data.favorited);
      favoriteToggle.setAttribute('aria-pressed', String(data.favorited));
      window.toast(`Template ${data.favorited ? 'favorited' : 'unfavorited'}.`, 'success');
    } catch (error) {
      window.toast(error.message, 'error');
    }
  });

  const refreshTemplates = async () => {
    const q = new URLSearchParams({
      search: searchInput.value,
      category: categoryFilter.value,
      favorites: favoritesOnly.checked ? 'true' : 'false'
    });

    const response = await fetch(`/api/templates?${q.toString()}`);
    const data = await response.json();

    templateList.innerHTML = data
      .map(
        (template) => `<li class="template-row">
          <button type="button" class="template-item" data-template-id="${template.id}" aria-label="Select ${template.name}">
            <span><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.category)}</small></span>
          </button>${template.isFavorite !== undefined ? `<button class="favorite-toggle ${template.isFavorite ? 'active' : ''}" type="button" data-favorite-id="${template.id}" aria-pressed="${template.isFavorite ? 'true' : 'false'}" aria-label="Toggle favorite for ${escapeHtml(template.name)}">&#9733;</button>` : ''}
        </li>`
      )
      .join('');
  };

  searchInput.addEventListener('input', debounce(refreshTemplates, 220));
  categoryFilter.addEventListener('change', refreshTemplates);
  favoritesOnly.addEventListener('change', refreshTemplates);

  form.addEventListener('input', debouncedPreview);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchPreview();
  });

  copySubjectBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.subject || '');
    window.toast('Subject copied.', 'success');
  });

  copyBodyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.body || '');
    window.toast('Body copied.', 'success');
  });

  downloadTxtBtn.addEventListener('click', () => {
    const txt = `Subject: ${state.subject}\n\n${state.body}`;
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outreach-email.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  exportCsvBtn.addEventListener('click', () => {
    const row =
      ['subject', 'body'].join(',') + '\n' + [state.subject, state.body].map(toCsvCell).join(',');
    const blob = new Blob([row], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outreach-email.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  saveHistoryBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        },
        body: JSON.stringify(serializeForm())
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save history.');
      window.toast('Saved to history.', 'success');
    } catch (error) {
      window.toast(error.message, 'error');
    }
  });

  if (templateIdInput.value) {
    fetchPreview();
  }
})();
