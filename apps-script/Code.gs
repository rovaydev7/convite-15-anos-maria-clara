const SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';
const RESPONSE_SHEET_NAME = 'Respostas';
const RESPONSE_HEADERS = ['Confirmado em', 'Nome', 'Presença', 'Acompanhantes'];
const EVENT_TIME_ZONE = 'America/Sao_Paulo';

function doPost(event) {
  try {
    const parameters = event && event.parameter ? event.parameter : {};
    const action = String(parameters.action || '').trim();

    if (action === 'delete') {
      const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
      if (!name) {
        return jsonResponse_({ ok: false, message: 'Informe um nome válido.' });
      }

      const sheet = getResponseSheet_();
      const values = sheet.getDataRange().getValues();
      let removed = false;

      for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
        if (String(values[rowIndex][1] || '').trim() === name) {
          sheet.deleteRow(rowIndex + 1);
          removed = true;
          break;
        }
      }

      return jsonResponse_({ ok: removed, message: removed ? 'Convidado removido da lista.' : 'Convidado não encontrado.' });
    }

    if (String(parameters.website || '').trim()) {
      return responseFrame_(true, '');
    }

    const name = String(parameters.nome || '').trim().replace(/\s+/g, ' ');
    const attendance = String(parameters.presenca || '');
    let companions = String(parameters.acompanhantes || '0');

    if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new Error('Informe um nome válido.');
    }
    if (attendance !== 'sim' && attendance !== 'nao') {
      throw new Error('Selecione sua resposta de presença.');
    }
    if (!/^[0-6]$/.test(companions)) {
      throw new Error('Selecione uma quantidade válida de acompanhantes.');
    }
    if (attendance === 'nao') {
      companions = '0';
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getResponseSheet_();
      const safeName = /^[=+\-@]/.test(name) ? "'" + name : name;
      sheet.appendRow([new Date(), safeName, attendance === 'sim' ? 'Sim' : 'Não', Number(companions)]);
    } finally {
      lock.releaseLock();
    }

    return responseFrame_(true, '');
  } catch (error) {
    return responseFrame_(false, 'Não foi possível registrar agora. Tente novamente ou fale com a família.');
  }
}

function doGet(event) {
  const callback = String(event && event.parameter && event.parameter.callback || 'callback');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput('/* callback inválido */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  let result;
  try {
    const sheet = getResponseSheet_();
    const lastRow = sheet.getLastRow();
    const values = lastRow > 1
      ? sheet.getRange(2, 1, Math.min(lastRow - 1, 5000), 4).getValues()
      : [];

    const records = values
      .filter((row) => String(row[1] || '').trim())
      .map((row) => {
        let name = String(row[1]).trim();
        if (name.startsWith("'")) name = name.slice(1);
        const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
        return {
          name: name,
          attendance: String(row[2]) === 'Sim' ? 'Sim' : 'Não',
          companions: Number(row[3]) || 0,
          createdAt: Number.isNaN(date.getTime())
            ? ''
            : Utilities.formatDate(date, EVENT_TIME_ZONE, 'dd/MM/yyyy HH:mm'),
          sortKey: Number.isNaN(date.getTime()) ? 0 : date.getTime()
        };
      })
      .sort((first, second) => second.sortKey - first.sortKey)
      .map(({ sortKey, ...record }) => record);

    result = { ok: true, records: records };
  } catch (error) {
    result = { ok: false, error: 'Não foi possível carregar as confirmações.' };
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function setupSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(SPREADSHEET_ID_PROPERTY);
  if (existingId) {
    const existingSpreadsheet = SpreadsheetApp.openById(existingId);
    Logger.log('Planilha de confirmações: ' + existingSpreadsheet.getUrl());
    return existingSpreadsheet.getUrl();
  }

  const spreadsheet = SpreadsheetApp.create('15 anos Maria Clara - Confirmações');
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(RESPONSE_SHEET_NAME);
  sheet.appendRow(RESPONSE_HEADERS);
  sheet.setFrozenRows(1);
  properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  Logger.log('Planilha de confirmações: ' + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

function getResponseSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) {
    throw new Error('Configure a propriedade SPREADSHEET_ID antes de implantar o Apps Script.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(RESPONSE_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(RESPONSE_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function responseFrame_(success, message) {
  const payload = JSON.stringify({ type: 'rsvp-result', ok: success, message: message });
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>' +
    'window.top.postMessage(' + payload + ', "*");' +
    '</script></body></html>';
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
