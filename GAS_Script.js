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
  FIREBASE_BASE_URL: "https://yo-fire-sab-default-rtdb.firebaseio.com/", // Replace with your Firestore REST base if needed
  // Note: For Firestore sync, it's better to use the App's Webhook to push to Firestore
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
 * BlackBox Logging: Records every critical state change
 */
function handleBlackBoxLog(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(ss, 'BlackBox_Logs');
  
  sheet.appendRow([
    new Date(),
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
    data.senderId || ''
  ]);
  
  return createResponse({ status: 'success' });
}

/**
 * Detect manual changes in the spreadsheet and sync back (simulated)
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  // Example: If Order_Tracking status changes, we could trigger a callback
  if(sheetName === 'Order_Tracking' && range.getColumn() === 4) {
    const orderId = sheet.getRange(range.getRow(), 1).getValue();
    const newStatus = range.getValue();
    
    console.log(`Manual Status Sync: Order ${orderId} -> ${newStatus}`);
    // In a real prod environment, you would use UrlFetchApp to notify the App's API
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
      'Chat_History': ['Timestamp', 'Sender', 'Message', 'Priority', 'SenderID']
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
