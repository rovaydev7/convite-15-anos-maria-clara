(() => {
  const calendarDays = document.getElementById('calendar-days');
  const eventMonth = 9;
  const eventDay = 31;
  const eventYear = 2026;
  const today = new Date();
  const firstWeekday = new Date(eventYear, eventMonth, 1).getDay();
  const daysInMonth = new Date(eventYear, eventMonth + 1, 0).getDate();
  for (let blankDay = 0; blankDay < firstWeekday; blankDay++) {
    const emptyCell = document.createElement('span');
    emptyCell.className = 'calendar-day calendar-day-empty';
    emptyCell.setAttribute('aria-hidden', 'true');
    calendarDays.append(emptyCell);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const calendarCell = document.createElement('span');
    calendarCell.className = 'calendar-day';
    calendarCell.textContent = String(day);
    if (day === eventDay) {
      calendarCell.classList.add('calendar-event-day');
      calendarCell.setAttribute('aria-label', '31 de outubro, dia da festa');
    }
    if (today.getFullYear() === eventYear && today.getMonth() === eventMonth && today.getDate() === day) {
      calendarCell.classList.add('calendar-today');
    }
    calendarDays.append(calendarCell);
  }

  function updateCountdown() {
    const currentDate = new Date();
    const todayUtc = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const eventDateUtc = Date.UTC(eventYear, eventMonth, eventDay);
    const daysRemaining = Math.max(0, Math.round((eventDateUtc - todayUtc) / 86400000));
    document.getElementById('countdown-days').textContent = String(daysRemaining).padStart(2, '0');
  }

  updateCountdown();
  window.setInterval(updateCountdown, 60000);

  const form = document.getElementById('rsvp-form');
  const endpoint = String(window.RSVP_CONFIG?.appsScriptUrl || '').trim();
  const status = document.getElementById('rsvp-status');
  const confirmationModal = document.getElementById('confirmation-modal');
  const submitButton = document.getElementById('rsvp-submit');
  const companionsField = document.getElementById('campo-acompanhantes');
  const companionsSelect = document.getElementById('acompanhantes');
  const responseFrame = document.getElementById('rsvp-response');
  let waitingForResponse = false;
  let responseTimeout;

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `form-alert${type ? ` ${type}` : ''}`;
    status.hidden = false;
  }

  function syncCompanions() {
    const attending = document.getElementById('presenca-sim').checked;
    companionsField.hidden = !attending;
    companionsSelect.disabled = !attending;
  }

  document.querySelectorAll('input[name="presenca"]').forEach((input) => input.addEventListener('change', syncCompanions));
  syncCompanions();

  if (!endpoint || endpoint.includes('COLE_AQUI')) {
    submitButton.disabled = true;
    showStatus('O formulário ainda precisa ser conectado ao Apps Script. Veja o README do projeto para concluir a configuração.', 'error');
    return;
  }

  window.addEventListener('message', (event) => {
    const appsScriptOrigin = /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/i.test(event.origin);
    if ((event.source !== responseFrame.contentWindow && !appsScriptOrigin) || event.data?.type !== 'rsvp-result' || !waitingForResponse) return;

    window.clearTimeout(responseTimeout);
    waitingForResponse = false;
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar confirmação';

    if (event.data.ok) {
      form.reset();
      syncCompanions();
      confirmationModal.showModal();
    } else {
      showStatus(event.data.message || 'Não foi possível registrar agora. Tente novamente.', 'error');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.hidden = true;
    status.className = 'form-alert';

    if (!form.reportValidity()) return;

    waitingForResponse = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    form.action = endpoint;
    form.submit();

    responseTimeout = window.setTimeout(() => {
      if (!waitingForResponse) return;
      waitingForResponse = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar confirmação';
      showStatus('O envio demorou mais que o esperado. Confira sua conexão antes de tentar novamente.', 'error');
    }, 30000);
  });

  document.getElementById('close-confirmation').addEventListener('click', () => confirmationModal.close());
})();
