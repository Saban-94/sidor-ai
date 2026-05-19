/**
 * SabanOS Core Pipeline 6.0 - Robust Sync Engine
 * Architect: SabanOS expert Developer
 */

const CONFIG = {
  PROJECT_ID: "saban-ai-drive",
  DATABASE_ID: "ai-studio-cc5d2687-b402-4b97-b808-5ba700689e0e"
};

/**
 * Main Webhook Entry Point
 * Safely handles incoming sync requests from SabanOS App
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ status: 'error', message: 'Empty payload received' });
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (jsonErr) {
      logDetailedError('MANDATORY_WEBHOOK_FAILURE', 'JSON Parse failure', 400, e.postData.contents);
      return createResponse({ status: 'error', message: 'Malformed JSON payload' });
    }

    const action = data.action;
    if (!action) {
      return createResponse({ status: 'error', message: 'Missing action parameter' });
    }

    // Route actions
    switch (action) {
      case 'syncOrder':
        return handleOrderSync(data);
      case 'syncInventory':
        return handleInventorySync(data);
      case 'logBlackBox':
        return handleBlackBoxLog(data);
      case 'logMagicAccess':
        return handleMagicLog(data);
      case 'syncChat':
        return handleChatSync(data);
      case 'createCustomerFolder':
        return createCustomerFolder(data);
      case 'upload':
        return handleUpload(data);
      default:
        return createResponse({ status: 'error', message: `Action [${action}] not implemented` });
    }

  } catch (globalErr) {
    logDetailedError('UNHANDLED_WEBHOOK_EXCEPTION', globalErr.toString(), 500, e ? e.postData.contents : 'No data');
    return createResponse({ status: 'error', message: 'Internal Pipeline Failure', error: globalErr.toString() });
  }
}

/**
 * Robust HTTP Fetcher
 * Wraps UrlFetchApp with detailed error extraction and logging
 */
function safeFetch(url, options, context = "EXTERNAL_API") {
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code >= 200 && code < 300) {
      return { success: true, data: JSON.parse(response.getContentText()), code: code };
    } else {
      const errorText = response.getContentText();
      logDetailedError(context, `Response Code ${code}: ${errorText}`, code, options.payload);
      return { success: false, error: errorText, code: code };
    }
  } catch (fetchErr) {
    const diagnostic = fetchErr.toString();
    logDetailedError(context, `Network/Fetch Failure: ${diagnostic}`, 0, options.payload);
    return { success: false, error: diagnostic, code: 0 };
  }
}

/**
 * Logs detailed diagnostics to 'BlackBox_Logs' sheet
 * Essential for fixing the "GAS Pipeline: שגיאה ❌" error loop
 */
function logDetailedError(action, message, statusCode, payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'BlackBox_Logs');
    
    sheet.appendRow([
      new Date(),
      'PIPELINE_ERROR',
      action,
      message,
      statusCode || 'N/A',
      typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
      'SabanOS_Logic_Brain'
    ]);
    
    console.error(`[PIPELINE_ERROR] Action: ${action} | Msg: ${message}`);
  } catch (logErr) {
    console.error('CRITICAL: Failed to write to BlackBox_Logs:', logErr.toString());
  }
}

/**
 * Order Tracking Sync - Optimized for throughput
 */
function handleOrderSync(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'Order_Tracking');
    const rows = sheet.getDataRange().getValues();
    
    let foundIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.orderId) {
        foundIndex = i + 1;
        break;
      }
    }

    const rowData = [
      data.orderId,
      data.trackingId || 'N/A',
      data.customerName || 'Unknown',
      data.status || 'pending',
      new Date(),
      data.items || '',
      data.driverId || 'Unassigned'
    ];

    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return createResponse({ status: 'success', orderId: data.orderId });
  } catch (err) {
    logDetailedError('ORDER_SYNC_FAILURE', err.toString(), 0, data);
    throw err;
  }
}

/**
 * Inventory Stock Sync
 */
function handleInventorySync(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'Inventory_Stock');
    const rows = sheet.getDataRange().getValues();
    
    let foundIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.sku) {
        foundIndex = i + 1;
        break;
      }
    }

    const rowData = [
      data.sku,
      data.name,
      data.currentStock || 0,
      data.minStock || 0,
      data.unit || 'unit',
      new Date()
    ];

    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return createResponse({ status: 'success', sku: data.sku });
  } catch (err) {
    logDetailedError('INVENTORY_SYNC_FAILURE', err.toString(), 0, data);
    throw err;
  }
}

/**
 * Manual edit trigger - Syncs Sheet back to Firestore
 */
function onEdit(e) {
  if (!e) return;
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    
    if (sheetName === 'Inventory_Stock' || sheetName === 'Sidor-noaa - מלאי') {
      const row = range.getRow();
      if (row <= 1) return; // Header
      
      const rowData = sheet.getRange(row, 1, 1, 5).getValues()[0];
      const sku = rowData[0];
      const currentStock = rowData[2];
      
      if (!sku) return;

      updateFirestoreDocument('inventory', sku, {
        currentStock: { integerValue: parseInt(currentStock) }
      });
    }
  } catch (err) {
    logDetailedError('ON_EDIT_TRIGGER_FAILURE', err.toString(), 0, 'Cell Edit');
  }
}

/**
 * Firestore REST Update with robust error handling
 */
function updateFirestoreDocument(collection, docId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/${CONFIG.DATABASE_ID}/documents/${collection}/${docId}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`;
  
  const payload = {
    name: `projects/${CONFIG.PROJECT_ID}/databases/${CONFIG.DATABASE_ID}/documents/${collection}/${docId}`,
    fields: fields
  };

  const options = {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  return safeFetch(url, options, `FIRESTORE_WRITE_${collection.toUpperCase()}`);
}

/**
 * Magic Link Access Logging
 */
function handleMagicLog(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss, 'User_Magic_Logs');
    sheet.appendRow([new Date(), data.userId, data.userName, data.action || 'ACCESS']);
    return createResponse({ status: 'success' });
  } catch (err) {
    logDetailedError('MAGIC_LOG_FAILURE', err.toString(), 0, data);
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Utility: Create consistent JSON responses
 */
function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utility: Sheet manager with headers
 */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = {
      'BlackBox_Logs': ['Timestamp', 'Level', 'Action', 'Message', 'Code', 'Payload', 'Source'],
      'User_Magic_Logs': ['Timestamp', 'UserID', 'Name', 'Action'],
      'Order_Tracking': ['OrderID', 'TrackingID', 'Customer', 'Status', 'Updated', 'Items', 'Driver'],
      'Inventory_Stock': ['SKU', 'Name', 'Stock', 'Min', 'Unit', 'LastSync'],
      'Chat_History': ['Timestamp', 'Sender', 'Message', 'Priority', 'SenderID', 'RecipientID']
    };
    if (headers[name]) sheet.appendRow(headers[name]);
  }
  return sheet;
}

/**
 * Chat Storage
 */
function handleChatSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'Chat_History');
  sheet.appendRow([new Date(), data.sender, data.text, data.priority || 'normal', data.senderId, data.recipientId]);
  return createResponse({ status: 'success' });
}

/**
 * BlackBox Manual Log
 */
function handleBlackBoxLog(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'BlackBox_Logs');
  sheet.appendRow([
    new Date(), 
    data.level || 'INFO', 
    data.operation || 'GENERAL', 
    data.message || '', 
    200, 
    JSON.stringify(data.context || {}), 
    'External_App'
  ]);
  return createResponse({ status: 'success' });
}

/**
 * Drive Integration: Customer Folder Creation
 */
function createCustomerFolder(data) {
  try {
    const rootId = data.parentFolderId || DriveApp.getRootFolder().getId();
    const root = DriveApp.getFolderById(rootId);
    const customerFolder = root.createFolder(`${data.customerNumber || 'CUST'} - ${data.customerName}`);
    
    ['Orders', 'Delivery Notes', 'Accounting'].forEach(sub => customerFolder.createFolder(sub));
    
    return createResponse({
      status: 'success',
      folderId: customerFolder.getId(),
      webViewLink: customerFolder.getUrl()
    });
  } catch (err) {
    logDetailedError('DRIVE_FOLDER_FAILURE', err.toString(), 0, data);
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Base64 Upload to Drive
 */
function handleUpload(data) {
  try {
    const folderId = data.folderId || DriveApp.getRootFolder().getId();
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64Data), data.mimeType, data.name);
    const file = folder.createFile(blob);
    
    return createResponse({ status: 'success', fileId: file.getId(), webViewLink: file.getUrl() });
  } catch (err) {
    logDetailedError('UPLOAD_FAILURE', err.toString(), 0, data.name);
    return createResponse({ status: 'error', message: err.toString() });
  }
}
