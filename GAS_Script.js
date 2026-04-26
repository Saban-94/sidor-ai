/**
 * SabanOS - Bi-Directional Sync & BlackBox Logging System
 * 
 * Instructions:
 * 1. Open Google Sheets.
 * 2. Go to Extensions > Apps Script.
 * 3. Replace all code with this script.
 * 4. Deploy > New Deployment > Web App (Set "Who has access" to "Anyone").
 * 5. Copy the Web App URL and paste it into VITE_GAS_URL in AI Studio.
 */

const CONFIG = {
  PROJECT_ID: "saban-ai-drive",
  DATABASE_ID: "ai-studio-cc5d2687-b402-4b97-b808-5ba700689e0e"
};

/**
 * Handle incoming POST requests from the SabanOS App
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      case 'logBlackBox':
        return handleBlackBoxLog(data);
      case 'logMagicAccess':
        return handleMagicLog(data);
      case 'syncOrder':
        return handleOrderSync(data);
      case 'syncChat':
        return handleChatSync(data);
      case 'syncInventory':
        return handleInventorySync(data);
      case 'createCustomerFolder':
        return createCustomerFolder(data);
      case 'upload':
        return handleUpload(data);
      default:
        return createResponse({ status: 'error', message: 'Unknown action' });
    }
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Inventory Sync
 */
function handleInventorySync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'Inventory_Stock'); // User might rename this to 'Sidor-noaa - מלאי'
  
  const rows = sheet.getDataRange().getValues();
  let foundIndex = -1;
  for(let i = 1; i < rows.length; i++) {
    if(rows[i][0] === data.sku) {
      foundIndex = i + 1;
      break;
    }
  }
  
  const rowData = [
    data.sku,
    data.name,
    data.currentStock,
    data.minStock,
    data.unit,
    new Date()
  ];
  
  if(foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return createResponse({ status: 'success' });
}

/**
 * BlackBox Logging: Records every critical state change
 */
function handleBlackBoxLog(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'BlackBox_Logs');
  
  sheet.appendRow([
    new Date(),
    data.origin || 'App',
    data.operation || 'UPDATE',
    data.user || 'System',
    data.collection || 'General',
    JSON.stringify(data.oldValue || {}),
    JSON.stringify(data.newValue || {}),
    data.path || ''
  ]);
  
  return createResponse({ status: 'success' });
}

/**
 * Magic Link Access Logging
 */
function handleMagicLog(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'User_Magic_Logs');
  
  sheet.appendRow([
    new Date(),
    data.userId,
    data.userName,
    data.action || 'ACCESS'
  ]);
  
  return createResponse({ status: 'success' });
}

/**
 * Order Tracking Sync
 */
function handleOrderSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'Order_Tracking');
  
  // Find existing row or append
  const rows = sheet.getDataRange().getValues();
  let foundIndex = -1;
  for(let i = 1; i < rows.length; i++) {
    if(rows[i][0] === data.orderId) {
      foundIndex = i + 1;
      break;
    }
  }
  
  const rowData = [
    data.orderId,
    data.trackingId,
    data.customerName,
    data.status,
    new Date(),
    data.items || ''
  ];
  
  if(foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return createResponse({ status: 'success' });
}

/**
 * Chat History Sync
 */
function handleChatSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'Chat_History');
  
  sheet.appendRow([
    new Date(),
    data.sender,
    data.text,
    data.priority || 'normal',
    data.senderId || '',
    data.recipientId || 'global'
  ]);
  
  return createResponse({ status: 'success' });
}

/**
 * Sync manual edits from Sheet back to Firestore
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  // Handle Inventory Edits
  if(sheetName === 'Inventory_Stock' || sheetName === 'Sidor-noaa - מלאי') {
    const row = range.getRow();
    if(row <= 1) return; // Skip header
    
    const rowData = sheet.getRange(row, 1, 1, 5).getValues()[0];
    const sku = rowData[0];
    const currentStock = rowData[2];
    
    if(!sku) return;

    console.log(`Syncing Inventory back to Firestore: ${sku} -> ${currentStock}`);
    
    // We need to find the document by SKU or use SKU as ID
    // Simplest: use a lookup via REST or assuming ID = SKU
    updateFirestoreDocument('inventory', sku, {
      currentStock: { integerValue: parseInt(currentStock) }
    });

    handleBlackBoxLog({
      origin: 'Sheet',
      operation: 'UPDATE',
      user: 'Google Sheets Editor',
      collection: 'inventory',
      newValue: { sku, currentStock },
      path: `inventory/${sku}`
    });
  }
}

/**
 * Helper to update Firestore via REST API
 */
function updateFirestoreDocument(collection, docId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/${CONFIG.DATABASE_ID}/documents/${collection}/${docId}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`;
  
  const payload = {
    name: `projects/${CONFIG.PROJECT_ID}/databases/${CONFIG.DATABASE_ID}/documents/${collection}/${docId}`,
    fields: fields
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    console.error('Firestore REST Error:', e.toString());
  }
}

/**
 * Helper to get or create a sheet with headers
 */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = {
      'BlackBox_Logs': ['Timestamp', 'Action', 'User', 'Collection', 'OldValue', 'NewValue', 'Path'],
      'User_Magic_Logs': ['Timestamp', 'UserID', 'Name', 'Action'],
      'Order_Tracking': ['OrderID', 'TrackingID', 'Customer', 'Status', 'LastUpdated', 'Items'],
      'Chat_History': ['Timestamp', 'Sender', 'Message', 'Priority', 'SenderID', 'RecipientID']
    };
    if(headers[name]) sheet.appendRow(headers[name]);
  }
  return sheet;
}

function handleUpload(data) {
  const folderId = data.folderId || DriveApp.getRootFolder().getId();
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.base64Data), data.mimeType, data.name);
  const file = folder.createFile(blob);
  
  return createResponse({
    id: file.getId(),
    fileId: file.getId(),
    webViewLink: file.getUrl()
  });
}

function createCustomerFolder(data) {
  const rootId = data.parentFolderId || DriveApp.getRootFolder().getId();
  const root = DriveApp.getFolderById(rootId);
  
  const customerFolder = root.createFolder(`${data.customerNumber} - ${data.customerName}`);
  customerFolder.createFolder('Orders');
  customerFolder.createFolder('Delivery Notes');
  customerFolder.createFolder('Accounting');
  
  const infoFile = customerFolder.createFile('info.txt', `
    Customer: ${data.customerName}
    ID: ${data.customerNumber}
    Contact: ${data.contactPerson}
    Phone: ${data.phoneNumber}
    Created: ${new Date().toISOString()}
  `);
  
  return createResponse({
    status: 'success',
    folderId: customerFolder.getId(),
    webViewLink: customerFolder.getUrl()
  });
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
