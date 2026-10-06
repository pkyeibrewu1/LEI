const searchInput = document.getElementById('helpSearch');
const searchStatus = document.getElementById('helpSearchStatus');
const noResults = document.getElementById('helpNoResults');
const faqGroups = [...document.querySelectorAll('.help-faq-group')];
const questions = [...document.querySelectorAll('.help-question')];
const supportForm = document.getElementById('supportForm');
const supportStatus = document.getElementById('supportFormStatus');

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visibleCount = 0;

  for (const question of questions) {
    const matches = question.textContent.toLocaleLowerCase().includes(query);
    question.hidden = !matches;
    if (matches) visibleCount += 1;
  }

  for (const group of faqGroups) {
    group.hidden = !group.querySelector('.help-question:not([hidden])');
  }

  noResults.hidden = visibleCount !== 0;
  searchStatus.textContent = query
    ? `${visibleCount} ${visibleCount === 1 ? 'answer' : 'answers'} found.`
    : 'Browse answers by topic below.';
});

document.querySelector('.help-topic-grid').addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#faq-"]');
  if (!link) return;

  const question = document.querySelector(link.hash);
  if (!question) return;

  if (searchInput.value) {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
  }

  question.open = true;
});

supportForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(supportForm);
  const attachment = formData.get('attachment');
  const lines = [
    `Name: ${formData.get('name')}`,
    `Reply email: ${formData.get('email')}`,
    `Phone: ${formData.get('phone') || 'Not provided'}`,
    `Category: ${formData.get('category')}`,
    '',
    formData.get('description')
  ];

  if (attachment && attachment.name) {
    lines.push('', `Screenshot selected: ${attachment.name}`, 'Please attach this file to the email draft before sending.');
  }

  const subject = `[Lèi support] ${formData.get('subject')}`;
  const body = lines.join('\n');
  window.location.href = `mailto:contact@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  supportStatus.textContent = 'Your email app should open with a draft. Review it, attach any screenshot, and press Send. Nothing is sent until you send the email.';
});