document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('reportsLoginView');
  const inboxView = document.getElementById('reportsInboxView');
  const loginForm = document.getElementById('reportsLoginForm');
  const tokenInput = document.getElementById('reportsTokenInput');
  const loginStatus = document.getElementById('reportsLoginStatus');
  const listStatus = document.getElementById('reportsListStatus');
  const reportsList = document.getElementById('reportsList');
  const pageLabel = document.getElementById('reportsPageLabel');
  const previousBtn = document.getElementById('reportsPreviousBtn');
  const nextBtn = document.getElementById('reportsNextBtn');
  const signOutBtn = document.getElementById('reportsSignOutBtn');
  const pageSize = 50;
  let offset = 0;

  function setAuthenticated(authenticated) {
    loginView.classList.toggle('hidden', authenticated);
    inboxView.classList.toggle('hidden', !authenticated);
    signOutBtn.classList.toggle('hidden', !authenticated);
  }

  function apiRequest(path, options = {}) {
    return fetch(`${window.LEI_API_BASE_URL || ''}/api/reports${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('lei_reports_admin_token') || ''}`,
        ...(options.headers || {})
      }
    });
  }

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function labelForReason(reason) {
    const labels = {
      'false-account': 'Suspected false or misleading account',
      bullying: 'Bullying, harassment, or intimidation',
      eligibility: 'Concern about eligibility for this space',
      'wrong-space': 'May be in the wrong space',
      bug: 'Something is broken',
      account: 'Account or sign-in',
      accessibility: 'Accessibility',
      content: 'Content or community concern',
      other: 'Other concern'
    };
    return labels[reason] || 'Other concern';
  }

  function renderReport(report) {
    const article = document.createElement('article');
    article.className = 'report-item';
    const header = document.createElement('div');
    header.className = 'report-item-header';
    const title = makeTextElement('h2', 'report-item-title', report.report_type === 'member' ? `Member report: ${report.username}` : 'Problem report');
    const time = makeTextElement('time', 'report-item-time', new Date(report.created_at).toLocaleString());
    time.dateTime = report.created_at;
    header.append(title, time);

    const metadata = document.createElement('div');
    metadata.className = 'report-item-meta';
    metadata.append(
      makeTextElement('span', 'report-reason', labelForReason(report.reason)),
      makeTextElement('span', 'report-status-tag', report.status)
    );
    article.append(header, metadata, makeTextElement('p', 'report-item-details', report.details));

    const footer = document.createElement('div');
    footer.className = 'report-item-footer';
    if (report.contact) footer.append(makeTextElement('span', 'report-item-contact', `Follow-up: ${report.contact}`));
    if (report.page_url) {
      const pageLink = document.createElement('a');
      pageLink.href = report.page_url;
      pageLink.target = '_blank';
      pageLink.rel = 'noopener noreferrer';
      pageLink.textContent = 'Open reported page';
      footer.append(pageLink);
    }
    const statusLabel = document.createElement('label');
    statusLabel.className = 'report-status-control';
    statusLabel.append(document.createTextNode('Status'));
    const statusSelect = document.createElement('select');
    statusSelect.setAttribute('aria-label', `Status for ${title.textContent}`);
    for (const status of ['new', 'reviewing', 'resolved']) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      option.selected = report.status === status;
      statusSelect.append(option);
    }
    statusSelect.addEventListener('change', () => updateStatus(report.id, statusSelect.value, statusSelect));
    statusLabel.append(statusSelect);
    footer.append(statusLabel);
    article.append(footer);
    return article;
  }

  async function loadReports() {
    listStatus.textContent = 'Loading reports...';
    reportsList.replaceChildren();
    try {
      const response = await apiRequest(`?limit=${pageSize}&offset=${offset}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load reports.');
      result.reports.forEach(report => reportsList.append(renderReport(report)));
      listStatus.textContent = result.reports.length ? '' : 'No reports on this page.';
      pageLabel.textContent = `Page ${Math.floor(offset / pageSize) + 1}`;
      previousBtn.disabled = offset === 0;
      nextBtn.disabled = !result.hasMore;
    } catch (error) {
      listStatus.textContent = error.message || 'Unable to load reports.';
      if (error.message === 'Unauthorized.') {
        sessionStorage.removeItem('lei_reports_admin_token');
        setAuthenticated(false);
      }
    }
  }

  async function updateStatus(reportId, status, select) {
    select.disabled = true;
    listStatus.textContent = 'Updating report...';
    try {
      const response = await apiRequest('', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update report.');
      listStatus.textContent = 'Report status updated.';
      select.closest('.report-item').querySelector('.report-status-tag').textContent = status;
    } catch (error) {
      listStatus.textContent = error.message || 'Unable to update report.';
      await loadReports();
    } finally {
      select.disabled = false;
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginStatus.textContent = 'Checking access...';
    sessionStorage.setItem('lei_reports_admin_token', tokenInput.value);
    try {
      const response = await apiRequest('?limit=1&offset=0');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open inbox.');
      offset = 0;
      setAuthenticated(true);
      loginStatus.textContent = '';
      tokenInput.value = '';
      await loadReports();
    } catch (error) {
      sessionStorage.removeItem('lei_reports_admin_token');
      loginStatus.textContent = error.message || 'Unable to open inbox.';
    }
  });

  document.getElementById('refreshReportsBtn').addEventListener('click', loadReports);
  previousBtn.addEventListener('click', () => { offset = Math.max(0, offset - pageSize); loadReports(); });
  nextBtn.addEventListener('click', () => { offset += pageSize; loadReports(); });
  signOutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('lei_reports_admin_token');
    reportsList.replaceChildren();
    setAuthenticated(false);
    tokenInput.focus();
  });

  setAuthenticated(false);
});