/**
 * SabanOS Enterprise v6.5 - Dynamic Schema Engine
 * Architect: SabanOS Elite Architect (via Noa)
 * 
 * Features: 
 * 1. Bi-directional Real-time Sync
 * 2. Automated Dynamic Column Header Creation
 * 3. Atomic Firestore Patch logic (updateMask)
 * 4. OAuth2 Permission Bypass Protocol
 */

const CONFIG = {
  PROJECT_ID: "saban-ai-drive",
  DATABASE_ID: "ai-studio-cc5d2687-b402-4b97-b808-5ba700689e0e",
  COLLECTION: "inventory",
  MAIN_SHEET: "Inventory_Stock"
};

/**
 * Main Webhook Entry Point (doPost)
 * Enhanced with Dynamic Schema Logic (upsert_product)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ status: 'error', message: 'Empty payload' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    switch (action) {
      case 'upsert_product':
        return handleDynamicUpsert(payload);
      case 'sync_from_interface': // Legacy support
        return handleDynamicUpsert(payload);
      case 'logBlackBox':
        return handleBlackBoxLog(payload);
      case 'syncChat':
        return handleChatSync(payload);
      case 'createCustomerFolder':
        return createCustomerFolder(payload);
      default:
        return createResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    logDetailedError('DOPPOST_CRITICAL_FAILURE', err.toString(), 500, e ? e.postData.contents : 'N/A');
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Dynamic Schema Upsert Logic
 * Automatically expands sheet headers based on payload keys
 */
function handleDynamicUpsert(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, CONFIG.MAIN_SHEET);
  
  // 1. Identify Existing Headers
  let lastCol = Math.max(1, sheet.getLastColumn());
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // 2. Scan Payload for New Keys
  let newHeadersFound = false;
  Object.keys(data).forEach(key => {
    if (key !== 'action' && headers.indexOf(key) === -1) {
      headers.push(key);
      newHeadersFound = true;
    }
  });

  // 3. Update Sheet Headers if needed
  if (newHeadersFound) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    logDetailedError('SCHEMA_UPDATE', 'Added new columns to matching payload', 200, headers.join(', '));
  }

  // 4. Locate SKU Row (Column A)
  const rows = sheet.getDataRange().getValues();
  const sku = data.sku || data.SKU;
  if (!sku) return createResponse({ status: 'error', message: 'Missing SKU for upsert' });

  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == sku) {
      rowIndex = i + 1;
      break;
    }
  }

  // 5. Construct Row Data Map
  const rowDataToSet = new Array(headers.length).fill("");
  headers.forEach((header, index) => {
    if (data[header] !== undefined) {
      rowDataToSet[index] = data[header];
    } else if (rowIndex > 0) {
      rowDataToSet[index] = rows[rowIndex-1][index]; // Preserve existing data
    }
  });

  // Always update Timestamp
  const tsIndex = headers.indexOf('updatedAt');
  if (tsIndex > -1) rowDataToSet[tsIndex] = new Date();
  else if (headers.indexOf('LastSync') > -1) rowDataToSet[headers.indexOf('LastSync')] = new Date();

  // 6. Apply Write
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowDataToSet]);
  } else {
    sheet.appendRow(rowDataToSet);
  }

  return createResponse({ status: 'success', sku: sku, schema_version: headers.length });
}

/**
 * onEdit Trigger (Dynamic Sync back to Firestore)
 * MUST be set as an INSTALLABLE trigger in the GAS Editor
 */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  
  if (sheetName !== CONFIG.MAIN_SHEET) return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row <= 1) return; // Skip headers

  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const sku = sheet.getRange(row, 1).getValue();
    const headerName = headers[col - 1];
    const newValue = e.value;

    if (!sku || !headerName) return;

    // Construct Firestore Update
    const fields = {};
    const type = typeof newValue;
    
    if (type === 'number') fields[headerName] = { doubleValue: newValue };
    else if (type === 'boolean') fields[headerName] = { booleanValue: newValue };
    else fields[headerName] = { stringValue: String(newValue) };

    updateFirestoreDocumentDynamic(CONFIG.COLLECTION, sku, fields, headerName);

  } catch (err) {
    logDetailedError('ON_EDIT_FAIL', err.toString(), 0, 'Row: ' + row);
  }
}

/**
 * Dynamic Firestore PATCH with Permissions Bypass
 */
function updateFirestoreDocumentDynamic(collection, docId, fields, headerName) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/${CONFIG.DATABASE_ID}/documents/${collection}/${docId}?updateMask.fieldPaths=${headerName}`;
  
  const payload = { fields: fields };
  const options = {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      "Authorization": "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  
  if (code < 400) {
    logDetailedError('FIRESTORE_SYNC', `Updated ${headerName} for SKU ${docId}`, code, 'OK');
  } else {
    logDetailedError('FIRESTORE_ERR', response.getContentText(), code, docId);
  }
}

/**
 * Utility: Logger 
 */
function logDetailedError(action, message, statusCode, payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'BlackBox_Logs');
    sheet.appendRow([
      new Date(),
      'PIPELINE_SYSTEM',
      action,
      message,
      statusCode || 'N/A',
      typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
      'SabanOS_Logic_Brain'
    ]);
  } catch (logErr) {
    console.error('Logging failed: ' + logErr.toString());
  }
}

/**
 * Utility: Sheet Manager
 */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'BlackBox_Logs') {
      sheet.appendRow(['Timestamp', 'User', 'Action', 'Message', 'Status', 'Payload', 'Path']);
    } else if (name === CONFIG.MAIN_SHEET) {
      sheet.appendRow(['sku', 'name', 'currentStock', 'minStock', 'category', 'updatedAt']);
    }
  }
  return sheet;
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Debug Function 
 */
function debugPipelineMechanics() {
  const testSku = "DEBUG_TEST_" + Math.floor(Math.random()*1000);
  console.log("Starting Debug for SKU: " + testSku);
  
  const res = handleDynamicUpsert({
    action: 'upsert_product',
    sku: testSku,
    name: "Debug Product",
    currentStock: 10,
    noaInsight: "Generated during test",
    demandTrend: "Stable"
  });
  
  console.log("Upsert Result: " + res.getContent());
}

/**
 * Chat Support
 */
function handleChatSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'Chat_History');
  sheet.appendRow([new Date(), data.sender, data.text, data.priority || 'normal', data.senderId]);
  return createResponse({ status: 'success' });
}

/**
 * Legacy/Standard Log Support
 */
function handleBlackBoxLog(data) {
  logDetailedError(data.operation || 'LOG', data.message || 'N/A', 200, data.context);
  return createResponse({ status: 'success' });
}

/**
 * Drive Integration
 */
function createCustomerFolder(data) {
  try {
    const root = DriveApp.getRootFolder();
    const customerFolder = root.createFolder(data.customerName);
    ['Orders', 'Delivery Notes'].forEach(sub => customerFolder.createFolder(sub));
    return createResponse({ status: 'success', folderId: customerFolder.getId() });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}
