// ============================================================
// CONFIG — tes 3 paramètres. À ne modifier que si les IDs changent.
// ============================================================
var CONFIG = {
  DRIVE_FOLDER_ID:    '1f47R0kPfyhxjtSFArhZmKAvg-gdsBOFE',
  SHEET_ID:           '1aSl7GAdTudK-SXl1OcMe8hEDImJ4XE3LHRrayaoqUJk',
  NOTIFICATION_EMAIL: 'mlg.consult.be@gmail.com',
};


// ============================================================
// POINT D'ENTRÉE — Apps Script appelle doPost() à chaque soumission
// ============================================================
function doPost(e) {
  try {

    // --- 1. Extraire le payload JSON ---
    // MÉTHODE A (prioritaire) : Apps Script parse automatiquement les champs texte
    // d'un FormData dans e.parameter. C'est la méthode la plus fiable pour fetch().
    // MÉTHODE B (fallback) : parser manuellement e.postData.contents si méthode A vide.
    var payloadStr = (e && e.parameter && e.parameter.payload) ? e.parameter.payload : null;
    var fileBlobs  = {};

    // --- 2. Parser le multipart pour les fichiers (et le payload en fallback) ---
    // e.postData peut être null/undefined dans certains contextes Apps Script.
    var hasPostData = e && e.postData && e.postData.type && e.postData.contents;
    if (hasPostData) {
      var boundaryMatch = e.postData.type.match(/boundary=(?:"([^"]+)"|([^;]+))/);
      if (boundaryMatch) {
        var boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
        var parts    = parseMultipart(e.postData.contents, boundary);
        parts.forEach(function(part) {
          if (part.name === 'payload' && !payloadStr) {
            // Fallback : payload récupéré via parsing manuel
            payloadStr = part.data;
          } else if (part.filename) {
            // Fichier (logo_0, photos_0, etc.) → Blob Drive
            var bytes = stringToBytes(part.data);
            var blob  = Utilities.newBlob(bytes, part.contentType || 'application/octet-stream', part.filename);
            if (!fileBlobs[part.name]) fileBlobs[part.name] = [];
            fileBlobs[part.name].push(blob);
          }
        });
      }
    }

    // Si payload toujours absent → logguer le contexte pour diagnostic
    if (!payloadStr) {
      console.error('DIAGNOSTIC — e.parameter : ' + JSON.stringify((e && e.parameter) || {}));
      console.error('DIAGNOSTIC — e.postData  : ' + (hasPostData
        ? JSON.stringify({ type: e.postData.type, length: e.postData.length })
        : 'absent ou null'));
      throw new Error('Payload JSON manquant — consulter les logs Apps Script');
    }

    var payload = JSON.parse(payloadStr);

    // --- 4. Créer le dossier Drive : YYYY-MM-DD_NomBoite_PrenomNom ---
    var dateStr    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var company    = sanitize(payload.company   || 'Unknown');
    var personName = sanitize((payload.firstName || '') + '-' + (payload.lastName || ''));
    var folderName = dateStr + '_' + company + '_' + personName;

    var parentFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var folder       = parentFolder.createFolder(folderName);
    var folderUrl    = folder.getUrl();

    // --- 5. Sauvegarder tous les fichiers reçus dans ce dossier ---
    Object.keys(fileBlobs).forEach(function(key) {
      fileBlobs[key].forEach(function(blob) {
        folder.createFile(blob);
      });
    });

    // --- 6. Écrire une ligne dans la Google Sheet ---
    var spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet       = spreadsheet.getActiveSheet();

    var headers     = ensureHeaders(sheet, payload);
    var submittedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var row         = buildRow(headers, payload, folderUrl, submittedAt);
    sheet.appendRow(row);

    // URL directe vers la nouvelle ligne (pour le lien dans l'email)
    var lastRow  = sheet.getLastRow();
    var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID
                 + '/edit#gid=' + sheet.getSheetId() + '&range=A' + lastRow;

    // --- 7. Email de notification interne → MLG ---
    sendNotificationEmail(payload, folderUrl, sheetUrl);

    // --- 8. Email de confirmation → prospect ---
    if (payload.email) {
      sendProspectEmail(payload);
    }

    // --- 9. Réponse JSON au frontend ---
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, id: folderName }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Logguer côté Apps Script (visible dans Exécutions) + retourner l'erreur au frontend
    console.error('doPost error: ' + err.message + '\n' + (err.stack || ''));
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
// DIAGNOSTIC GET — répond si on ouvre l'URL du script dans un navigateur
// ============================================================
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'MLG Quote Backend is live. Use POST to submit.', ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// PARSING MULTIPART
// Décompose le corps brut de la requête POST en une liste de parties
// (champs texte + fichiers), en préservant le contenu binaire.
// ============================================================
function parseMultipart(rawBody, boundary) {
  var parts     = [];
  var delimiter = '--' + boundary;

  // Découper le corps par le délimiteur de boundary
  var sections = rawBody.split(delimiter);

  for (var i = 1; i < sections.length; i++) {
    var section = sections[i];

    // La section '--\r\n' est le délimiteur de fermeture → fin du parsing
    if (section.indexOf('--') === 0) break;

    // Trouver la séparation entre les en-têtes et les données : \r\n\r\n
    var splitIdx = section.indexOf('\r\n\r\n');
    if (splitIdx === -1) continue;

    // Les en-têtes démarrent après le premier \r\n qui suit le délimiteur
    var headerBlock = section.substring(2, splitIdx);
    var dataStr     = section.substring(splitIdx + 4);

    // Supprimer le \r\n final (il appartient au protocole multipart, pas aux données)
    if (dataStr.length >= 2 && dataStr.charCodeAt(dataStr.length - 2) === 13 && dataStr.charCodeAt(dataStr.length - 1) === 10) {
      dataStr = dataStr.substring(0, dataStr.length - 2);
    }

    // Parser les en-têtes (Content-Disposition, Content-Type…)
    var headers = {};
    headerBlock.split('\r\n').forEach(function(line) {
      var colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        headers[line.substring(0, colonIdx).trim().toLowerCase()] = line.substring(colonIdx + 1).trim();
      }
    });

    var disposition   = headers['content-disposition'] || '';
    var nameMatch     = disposition.match(/\bname="([^"]+)"/);
    var filenameMatch = disposition.match(/\bfilename="([^"]*)"/);

    parts.push({
      name:        nameMatch     ? nameMatch[1]     : '',
      filename:    filenameMatch ? filenameMatch[1] : null,
      contentType: headers['content-type'] || 'application/octet-stream',
      data:        dataStr,
    });
  }

  return parts;
}


// ============================================================
// UTILITAIRES
// ============================================================

// Convertir une chaîne ISO-8859-1 en tableau d'octets (requis pour Utilities.newBlob)
function stringToBytes(str) {
  var bytes = new Array(str.length);
  for (var i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

// Nettoyer un nom pour qu'il soit valide dans un nom de dossier Drive
// Supprime les accents, remplace les caractères spéciaux par des tirets
function sanitize(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // supprimer les accents (é→e, ü→u…)
    .replace(/[^a-zA-Z0-9]/g, '-')                    // remplacer tout ce qui n'est pas alphanumérique
    .replace(/-+/g, '-')                              // fusionner les tirets consécutifs
    .replace(/^-|-$/g, '')                            // supprimer les tirets en début/fin
    .substring(0, 50);                                // limiter la longueur
}

// Sérialiser une valeur du payload pour l'afficher dans une cellule Sheet
function serializeValue(val) {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.join(', ');       // ex : ["SEO","Meta Ads"] → "SEO, Meta Ads"
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}


// ============================================================
// GOOGLE SHEET — gestion des en-têtes et des lignes
// ============================================================

// Si la Sheet est vide, créer les en-têtes depuis les clés du payload.
// Si des champs nouveaux apparaissent lors de soumissions ultérieures,
// les ajouter en colonne à droite sans casser les lignes existantes.
function ensureHeaders(sheet, payload) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    // Première soumission : créer les en-têtes
    var keys    = Object.keys(payload).filter(function(k) { return k !== '_files'; });
    var headers = keys.concat(['Files folder URL', 'Submitted at']);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    return headers;
  }

  // En-têtes existants : les lire
  var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  // Ajouter les clés éventuellement absentes (nouveaux champs apparus après la 1re soumission)
  var payloadKeys = Object.keys(payload).filter(function(k) { return k !== '_files'; });
  payloadKeys.forEach(function(key) {
    if (existingHeaders.indexOf(key) === -1) {
      existingHeaders.push(key);
      sheet.getRange(1, existingHeaders.length).setValue(key).setFontWeight('bold');
    }
  });

  return existingHeaders;
}

// Construire le tableau de valeurs dans l'ordre des en-têtes
function buildRow(headers, payload, folderUrl, submittedAt) {
  return headers.map(function(header) {
    if (header === 'Files folder URL') return folderUrl;
    if (header === 'Submitted at')     return submittedAt;
    return serializeValue(payload[header]);
  });
}


// ============================================================
// EMAILS
// ============================================================

// Libellés lisibles pour chaque type de besoin (valeurs du champ needType)
var NEED_LABELS = {
  A: 'Website / digital presence',
  B: 'Business strategy',
  C: 'Product strategy',
  D: 'Marketing & acquisition',
  E: 'Sales',
  F: 'Full end-to-end project',
  G: 'Other / not sure yet',
};

// Email interne envoyé à MLG à chaque nouvelle soumission
function sendNotificationEmail(payload, folderUrl, sheetUrl) {
  var fullName = ((payload.firstName || '') + ' ' + (payload.lastName || '')).trim();
  var company  = payload.company  || '(unknown)';
  var need     = NEED_LABELS[payload.needType] || payload.needType || '—';

  var subject = 'New quote request — ' + fullName + ' (' + company + ')';

  var body = [
    'New quote request received.',
    '',
    'CONTACT',
    '  Name    : ' + fullName,
    '  Company : ' + company,
    '  Email   : ' + (payload.email    || '—'),
    '  Phone   : ' + (payload.phone    || '—'),
    '  Role    : ' + (payload.role     || '—'),
    '  Team    : ' + (payload.teamSize || '—'),
    '',
    'PROJECT',
    '  Need    : ' + need,
    '  Budget  : ' + (payload.budget || '—'),
    '  Start   : ' + (payload.start  || '—'),
    '',
    'LINKS',
    '  Sheet row : ' + sheetUrl,
    '  Files     : ' + folderUrl,
  ].join('\n');

  MailApp.sendEmail({
    to:      CONFIG.NOTIFICATION_EMAIL,
    subject: subject,
    body:    body,
  });
}

// Email de confirmation envoyé au prospect (en anglais, ton MLG : direct, sans fioritures)
function sendProspectEmail(payload) {
  var firstName = (payload.firstName || 'there').trim();

  var subject = 'Your request has reached MLG';

  var body = [
    'Hi ' + firstName + ',',
    '',
    "Your request is in — we've got it.",
    '',
    "We'll review everything and come back to you within 48 hours.",
    'If anything is unclear or you want to add context in the meantime, just reply to this email.',
    '',
    '—',
    'MLG team',
    'mlg.consult.be@gmail.com',
  ].join('\n');

  MailApp.sendEmail({
    to:      payload.email,
    subject: subject,
    body:    body,
    replyTo: CONFIG.NOTIFICATION_EMAIL,
    name:    'MLG',
  });
}
