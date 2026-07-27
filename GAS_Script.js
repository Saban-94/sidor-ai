/**
 * SBN Logistics & SabanOS Enterprise v6.5 - Google Apps Script (GAS_Script.js)
 * ארכיטקטורה מלאה בעברית - מנוע לוגיסטי חכם, רוטציית מפתחות Gemini API, ניתוח PDF,
 * אימות פקדונות (בלות ומשטחים), הצלבת נתונים וסנכרון מלא.
 * 
 * פיתוח מוחלט ומוכן לשרת (Production-Ready) עבור SBN Logistics | מוח תפעולי: נועה (Noa Engine)
 */

// ==========================================
// 1. קונפיגורציה מרכזית ורשימת מפתחות Gemini
// ==========================================
const CONFIG = {
  PROJECT_ID: "saban-ai-drive",
  DATABASE_ID: "ai-studio-cc5d2687-b402-4b97-b808-5ba700689e0e",
  
  // רוטציית מפתחות API לחיסכון במכסות ומעבר אוטומטי בעת 429 / ResourceExhausted
  API_KEYS: [
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY_1") || "",
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY_2") || "",
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY_3") || "",
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY_DEFAULT") || ""
  ].filter(function(k) { return k && k.length > 5; }),

  // דגמי Gemini - הפרדה בין דגם קל לסריקות ודגם מתקדם לניתוח PDF עמוק
  MODELS: {
    LIGHT: "gemini-1.5-flash",
    ADVANCED: "gemini-1.5-pro"
  },

  // שמות גליונות רשמיים בעברית מלאה
  SHEETS: {
    DASHBOARD: "דשבורד_מנהלים",
    ORDERS_LOG: "לוג_הזמנות_מערכת",
    ORDERS: "הזמנות_מתקבלות",
    INVENTORY: "מלאי_מוצרים",
    CUSTOMERS: "תיק_לקוח_וחשבונות",
    WORK_ORDER: "סידור_עבודה",
    LOGISTICS_DICT: "מילון_לוגיסטי",
    EXCEPTIONS: "חריגות_לוגיסטיות",
    CHAT_LOGS: "יומן_שיחות_ונשואים",
    SYSTEM_LOGS: "לוגים_ומערכת"
  },

  // הגדרות ברירת מחדל לפקדונות (במידה ולא קיימות בגיליון מילון_לוגיסטי)
  DEFAULT_DEPOSITS: {
    BALE: { name: "בלה (שק ענק)", price: 45 },
    PALLET: { name: "משטח עץ תקני", price: 55 }
  }
};

// ==========================================
// 2. נקודות כניסה ראשיות (doPost & doGet)
// ==========================================

/**
 * קבלת בקשות POST (Webhooks מ-SabanOS / SBN Logistics)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ status: 'error', message: 'פיילוד ריק נתקבל במערכת' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    switch (action) {
      case 'initialize_sheets':
      case 'initialize_system':
        return createResponse(initializeSabanOSSheets());

      case 'process_emails':
      case 'run_logistics_scan':
        return createResponse(processIncomingLogisticsEmails());

      case 'verify_deposits':
        return createResponse(verifyDepositsAndLogExceptions(payload.orderId, payload.customerId, payload.itemsList, payload.chargedDeposits));

      case 'create_order':
      case 'sync_order':
        return handleOrderSync(payload);

      case 'upsert_product':
      case 'sync_from_interface':
      case 'sync_stock':
        return handleDynamicUpsert(payload);

      case 'upsert_customer':
      case 'createCustomerFolder':
        return createCustomerFolder(payload);

      case 'sync_siddur':
      case 'sync_work_order':
        return handleWorkOrderSync(payload);

      case 'syncChat':
        return handleChatSync(payload);

      case 'getCustomerCard':
        return createResponse(generateCustomerCardView(payload.customerSkuOrId || payload.sku || payload.customerId));

      case 'applyTheme':
      case 'format_sheets':
        return applyProfessionalDashboardTheme();

      case 'logBlackBox':
        return handleBlackBoxLog(payload);

      default:
        return createResponse({ status: 'error', message: 'פעולה לא מוכרת במערכת סבן: ' + action });
    }
  } catch (err) {
    logDetailedError('DOPOST_CRITICAL_FAILURE', err.toString(), 500, e ? e.postData.contents : 'N/A');
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * נקודת כניסה לבקשות GET (בדיקות תקינות וקבלת דשבורד/הפעלה ידנית)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName(CONFIG.SHEETS.DASHBOARD)) {
    initializeSabanOSSheets();
  }

  var action = e && e.parameter ? e.parameter.action : null;
  if (action === 'get_dashboard_stats') {
    return createResponse(getDashboardStats());
  } else if (action === 'run_email_scan') {
    return createResponse(processIncomingLogisticsEmails());
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'SBN Logistics & SabanOS Enterprise v6.5',
    bot: 'נועה - מוח תפעולי ומנגנון לוגיסטי חכם',
    spreadsheetName: ss.getName(),
    sheets: ss.getSheets().map(function(s) { return s.getName(); }),
    activeKeysCount: CONFIG.API_KEYS.length,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 3. מנוע רוטציית מפתחות API ודגמי Gemini
// ==========================================

/**
 * קריאה חסינה ל-Gemini API הכוללת רוטציה אוטומטית בין מפתחות ומודלים
 */
function callGeminiApiWithRotation(promptText, fileBlob, forceAdvancedModel) {
  var keys = CONFIG.API_KEYS;
  if (!keys || keys.length === 0) {
    // במידה ולא הוגדרו מפתחות ב-ScriptProperties, מנסים לשלוף מפתח סודי ראשי
    var fallbackKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (fallbackKey) {
      keys = [fallbackKey];
    } else {
      throw new Error("לא הוגדרו מפתחות Gemini API במערכת. אנא הגדר GEMINI_API_KEY_1 ב-Script Properties.");
    }
  }

  var chosenModel = forceAdvancedModel ? CONFIG.MODELS.ADVANCED : CONFIG.MODELS.LIGHT;
  var lastError = null;

  for (var k = 0; k < keys.length; k++) {
    var apiKey = keys[k];
    try {
      var result = executeGeminiRequest(apiKey, chosenModel, promptText, fileBlob);
      if (result) {
        return result;
      }
    } catch (err) {
      var errStr = err.toString();
      console.warn("⚠️ שגיאת Gemini במפתח #" + (k + 1) + " (" + chosenModel + "): " + errStr);
      lastError = errStr;

      // בדיקה אם השגיאה הינה שגיאת מכסה (429 / ResourceExhausted)
      if (errStr.indexOf("429") !== -1 || errStr.indexOf("RESOURCE_EXHAUSTED") !== -1 || errStr.indexOf("Quota") !== -1) {
        logDetailedError('GEMINI_KEY_ROTATION', "חריגת מכסה במפתח #" + (k + 1) + ". מעבר אוטומטי למפתח הבא.", 429, { keyIndex: k });
        // מעבר למפתח הבא בלולאה
        continue;
      }

      // אם הדגם המתקדם נכשל בשגיאה שאינה מכסה, ניסיון מעבר לדגם קל במפתח הנוכחי
      if (chosenModel === CONFIG.MODELS.ADVANCED) {
        try {
          console.log("🔄 ניסיון נפילה לדגם קל: " + CONFIG.MODELS.LIGHT);
          var lightResult = executeGeminiRequest(apiKey, CONFIG.MODELS.LIGHT, promptText, fileBlob);
          if (lightResult) return lightResult;
        } catch (fallbackErr) {
          console.warn("⚠️ גם דגם קל נכשל: " + fallbackErr.toString());
        }
      }
    }
  }

  throw new Error("כל מפתחות ה-API והדגמים נכשלו. שגיאה אחרונה: " + lastError);
}

/**
 * ביצוע הקריאה הפיזית ל-API מול Google AI Studio
 */
function executeGeminiRequest(apiKey, model, promptText, fileBlob) {
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

  var contentsParts = [];

  if (fileBlob) {
    var mimeType = fileBlob.getContentType();
    var base64Data = Utilities.base64Encode(fileBlob.getBytes());
    contentsParts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Data
      }
    });
  }

  contentsParts.push({
    text: promptText
  });

  var payload = {
    contents: [
      {
        parts: contentsParts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (responseCode === 429 || responseCode === 403) {
    throw new Error("HTTP " + responseCode + ": RESOURCE_EXHAUSTED - " + responseText);
  }

  if (responseCode !== 200) {
    throw new Error("HTTP " + responseCode + ": " + responseText);
  }

  var json = JSON.parse(responseText);
  if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts) {
    var rawText = json.candidates[0].content.parts[0].text;
    try {
      return JSON.parse(rawText);
    } catch (e) {
      return { raw: rawText };
    }
  }

  throw new Error("תשובת Gemini ריקה או לא תקינה");
}

// ==========================================
// 4. מנוע סריקת מיילים וניתוח מסמכי PDF
// ==========================================

/**
 * אינטגרציית מיילים ו-PDF: סריקת Gmail, חילוץ טקסט מעברית והצלבה מול מאגר הנתונים
 */
function processIncomingLogisticsEmails() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = getOrCreateSheet(ss, CONFIG.SHEETS.SYSTEM_LOGS);

    // חיפוש הודעות לא נקראות הכוללות הזמנה, תעודה, גליה או SBN
    var threads = GmailApp.search('label:inbox subject:(הזמנה OR תעודה OR גליה OR SBN OR סבן) is:unread', 0, 10);
    var processedCount = 0;
    var exceptionsFound = 0;

    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      for (var j = 0; j < messages.length; j++) {
        var msg = messages[j];
        if (!msg.isUnread()) continue;

        var attachments = msg.getAttachments();
        var emailSubject = msg.getSubject();
        var sender = msg.getFrom();

        for (var a = 0; a < attachments.length; a++) {
          var att = attachments[a];
          if (att.getContentType() === "application/pdf" || att.getName().toLowerCase().indexOf(".pdf") !== -1) {
            
            console.log("📄 נמצא קובץ PDF במייל: " + att.getName() + " ממאן: " + sender);

            // ניתוח ה-PDF באמצעות Gemini
            var prompt = "אתה מנוע לוגיסטי של חברת SBN Logistics (ח.סבן חומרי בניין). " +
              "נתח את מסמך ה-PDF המצורף והוצא ממנו אובייקט JSON במבנה הבא בלבד:\n" +
              "{\n" +
              '  "orderId": "מספר ההזמנה/תעודה",\n' +
              '  "customerId": "מזהה לקוח או ח.פ/ת.ז",\n' +
              '  "customerName": "שם הלקוח",\n' +
              '  "items": [\n' +
              '    {"name": "שם המוצר", "quantity": 10, "unit": "שקים/יחידות/בלות", "requiresDepositBale": false, "requiresDepositPallet": false}\n' +
              '  ],\n' +
              '  "chargedBaleDeposits": 0,\n' +
              '  "chargedPalletDeposits": 0,\n' +
              '  "notes": "הערות נוספות"\n' +
              "}\n" +
              "שים לב: חלץ בדיוק את כמות הבלות והמשטחים המוזכרים במסמך.";

            var extractedData = callGeminiApiWithRotation(prompt, att.copyBlob(), true);
            
            if (extractedData) {
              // הצלבה מול מאגר הנתונים
              var verifyResult = verifyAndProcessExtractedDocument(extractedData, att.getName(), sender);
              if (verifyResult.hasException) {
                exceptionsFound++;
              }
              processedCount++;
            }
          }
        }

        msg.markRead(); // סימון המייל כנקרא
      }
    }

    return {
      status: 'success',
      message: 'סריקת מיילים לוגיסטיים הושלמה',
      processedFiles: processedCount,
      exceptionsFound: exceptionsFound
    };

  } catch (err) {
    logDetailedError('EMAIL_SCAN_ERR', err.toString(), 500, {});
    return { status: 'error', message: err.toString() };
  }
}

/**
 * הצלבה מול מאגר הנתונים ואימות פרטי לקוח והזמנה
 */
function verifyAndProcessExtractedDocument(data, fileName, sender) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var orderId = data.orderId || "";
  var customerId = data.customerId || "";
  var customerName = data.customerName || "";
  var items = data.items || [];

  // 1. בדיקת קיום ההזמנה ב-לוג_הזמנות_מערכת או הזמנות_מתקבלות
  var ordersLogSheet = getOrCreateSheet(ss, CONFIG.SHEETS.ORDERS_LOG, [
    'מזהה_הזמנה', 'מזהה_לקוח', 'שם_לקוח', 'תאריך_קליטה', 'פריטים_שחולצו', 'סטטוס_אימות', 'שם_קובץ', 'שולח'
  ]);
  var ordersSheet = getOrCreateSheet(ss, CONFIG.SHEETS.ORDERS);

  var orderExists = false;
  var logRows = ordersLogSheet.getDataRange().getValues();
  for (var r = 1; r < logRows.length; r++) {
    if (logRows[r][0] && logRows[r][0].toString() === orderId.toString()) {
      orderExists = true;
      break;
    }
  }

  // רישום בלוג הזמנות מערכת
  ordersLogSheet.appendRow([
    orderId || 'ללא מזהה',
    customerId || 'לא מזוהה',
    customerName || 'לא מזוהה',
    new Date(),
    JSON.stringify(items),
    orderExists ? 'הזמנה קיימת - אומתה' : 'הזמנה חדשה שנקלטה מ-PDF',
    fileName,
    sender
  ]);

  // 2. אימות מול תיק_לקוח_וחשבונות
  var customersSheet = getOrCreateSheet(ss, CONFIG.SHEETS.CUSTOMERS);
  var custRows = customersSheet.getDataRange().getValues();
  var customerVerified = false;

  for (var c = 1; c < custRows.length; c++) {
    var rowCustId = custRows[c][0] ? custRows[c][0].toString() : "";
    var rowCustName = custRows[c][1] ? custRows[c][1].toString() : "";
    var rowTaxId = custRows[c][2] ? custRows[c][2].toString() : "";

    if ((customerId && (rowCustId === customerId.toString() || rowTaxId === customerId.toString())) ||
        (customerName && rowCustName.indexOf(customerName) !== -1)) {
      customerVerified = true;
      break;
    }
  }

  // 3. בדיקת פקדונות קשיחה מול מילון_לוגיסטי
  var chargedDeposits = {
    bales: data.chargedBaleDeposits || 0,
    pallets: data.chargedPalletDeposits || 0
  };

  var depositCheck = verifyDepositsAndLogExceptions(orderId, customerId || customerName, items, chargedDeposits);

  return {
    orderId: orderId,
    customerVerified: customerVerified,
    hasException: depositCheck.hasException,
    depositCheckDetails: depositCheck
  };
}

// ==========================================
// 5. מנוע בדיקת פקדונות קשיחה וחריגות
// ==========================================

/**
 * בדיקת פקדונות קשיחה: ניתוח הפריטים והשוואתם מול דרישות הפקדונות במילון_לוגיסטי
 */
function verifyDepositsAndLogExceptions(orderId, customerIdentifier, itemsList, chargedDeposits) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // טעינת מילון לוגיסטי
    var dictSheet = getOrCreateSheet(ss, CONFIG.SHEETS.LOGISTICS_DICT, [
      'מקט_או_שם_מוצר', 'דורש_פקדון_בלה', 'דורש_פקדון_משטח', 'מחיר_פקדון_בלה', 'מחיר_פקדון_משטח', 'הערות'
    ]);

    var dictRows = dictSheet.getDataRange().getValues();
    var dictMap = {};

    // בניית מילון דרישות פקדון
    for (var d = 1; d < dictRows.length; d++) {
      var itemKey = dictRows[d][0] ? dictRows[d][0].toString().trim().toLowerCase() : "";
      if (itemKey) {
        dictMap[itemKey] = {
          requiresBale: dictRows[d][1] === true || dictRows[d][1] === "כן" || dictRows[d][1] === "TRUE",
          requiresPallet: dictRows[d][2] === true || dictRows[d][2] === "כן" || dictRows[d][2] === "TRUE",
          balePrice: parseFloat(dictRows[d][3]) || CONFIG.DEFAULT_DEPOSITS.BALE.price,
          palletPrice: parseFloat(dictRows[d][4]) || CONFIG.DEFAULT_DEPOSITS.PALLET.price
        };
      }
    }

    var requiredBales = 0;
    var requiredPallets = 0;

    if (Array.isArray(itemsList)) {
      itemsList.forEach(function(item) {
        var itemName = (item.name || item.productName || "").toString().trim().toLowerCase();
        var qty = parseFloat(item.quantity || item.qty || 1);

        // בדיקה במילון או זיהוי לפי מילות מפתח (בלה, חול בלה, משטח)
        var dictMatch = dictMap[itemName];

        if (dictMatch) {
          if (dictMatch.requiresBale) requiredBales += qty;
          if (dictMatch.requiresPallet) requiredPallets += qty;
        } else {
          // חוקי ברירת מחדל חכמים לחומרי בניין סבן
          if (itemName.indexOf("בלה") !== -1 || itemName.indexOf("שק ענק") !== -1 || item.requiresDepositBale) {
            requiredBales += qty;
          }
          if (itemName.indexOf("משטח") !== -1 || itemName.indexOf("בלוק") !== -1 || itemName.indexOf("ריצוף") !== -1 || item.requiresDepositPallet) {
            requiredPallets += qty;
          }
        }
      });
    }

    var actualChargedBales = chargedDeposits ? (parseFloat(chargedDeposits.bales) || 0) : 0;
    var actualChargedPallets = chargedDeposits ? (parseFloat(chargedDeposits.pallets) || 0) : 0;

    var baleGap = requiredBales - actualChargedBales;
    var palletGap = requiredPallets - actualChargedPallets;

    var hasException = baleGap > 0 || palletGap > 0;

    if (hasException) {
      // תיעוד אוטומטי בגיליון חריגות_לוגיסטיות
      var excSheet = getOrCreateSheet(ss, CONFIG.SHEETS.EXCEPTIONS, [
        'תאריך_חריגה', 'מזהה_הזמנה', 'מזהה_לקוח', 'חוסר_בפקדון_בלות', 'חוסר_בפקדון_משטחים', 'סכום_חיוב_חסר_משוער', 'סטטוס_חריגה', 'פעולה_נדרשת'
      ]);

      var estimatedLoss = (baleGap * CONFIG.DEFAULT_DEPOSITS.BALE.price) + (palletGap * CONFIG.DEFAULT_DEPOSITS.PALLET.price);

      excSheet.appendRow([
        new Date(),
        orderId || 'ללא מזהה',
        customerIdentifier || 'לקוח לא מזוהה',
        baleGap > 0 ? baleGap + " בלות חסרות" : "תקין",
        palletGap > 0 ? palletGap + " משטחים חסרים" : "תקין",
        estimatedLoss + ' ₪',
        'פער פקדונות אותר ⚠️',
        'נדרש להוסיף חיוב פקדון בהזמנה או לעדכן את כרטיס הלקוח'
      ]);

      // עדכון סטטוס הסטטוס בהזמנות
      updateOrderStatusWithException(orderId, "חריגת פקדונות: חסר " + estimatedLoss + " ₪");
    }

    return {
      status: 'completed',
      hasException: hasException,
      requiredBales: requiredBales,
      chargedBales: actualChargedBales,
      requiredPallets: requiredPallets,
      chargedPallets: actualChargedPallets,
      baleGap: baleGap,
      palletGap: palletGap
    };

  } catch (err) {
    logDetailedError('DEPOSIT_CHECK_ERR', err.toString(), 500, { orderId: orderId });
    return { status: 'error', message: err.toString() };
  }
}

/**
 * עדכון סטטוס הזמנה בעת זיהוי חריגה
 */
function updateOrderStatusWithException(orderId, exceptionNote) {
  if (!orderId) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordSheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  if (!ordSheet) return;

  var rows = ordSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString() === orderId.toString()) {
      var currentStatus = rows[i][6] || "";
      ordSheet.getRange(i + 1, 7).setValue(currentStatus + " | " + exceptionNote);
      break;
    }
  }
}

// ==========================================
// 6. ניהול גליונות, נתונים וסנכרון מלא
// ==========================================

/**
 * אתחול מלא של כל הגליונות בעברית + כותרות, עיצובים ונתוני דוגמה
 */
function initializeSabanOSSheets() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. גליון דשבורד
    setupHebrewEnterpriseDashboard(ss);

    // 2. גליון לוג הזמנות מערכת
    getOrCreateSheet(ss, CONFIG.SHEETS.ORDERS_LOG, [
      'מזהה_הזמנה', 'מזהה_לקוח', 'שם_לקוח', 'תאריך_קליטה', 'פריטים_שחולצו', 'סטטוס_אימות', 'שם_קובץ', 'שולח'
    ]);

    // 3. גליון הזמנות מתקבלות
    getOrCreateSheet(ss, CONFIG.SHEETS.ORDERS, [
      'מזהה_הזמנה', 'שם_הלקוח', 'טלפון', 'תאריך_הזמנה', 'פירוט_מוצרים', 'סכום_כולל', 'סטטוס_הזמנה', 'כתובת_אספקה', 'הערות_נהג', 'מזהה_גליה', 'עדכון_אחרון'
    ]);

    // 4. גליון מלאי מוצרים
    getOrCreateSheet(ss, CONFIG.SHEETS.INVENTORY, [
      'מקט', 'שם_המוצר', 'מלאי_נוכחי', 'מלאי_מינימום', 'קטגוריה', 'מחיר_יחידה', 'ספק', 'תאריך_עדכון'
    ]);

    // 5. גליון תיק לקוח וחלק חשבונות
    getOrCreateSheet(ss, CONFIG.SHEETS.CUSTOMERS, [
      'מזהה_לקוח', 'שם_הלקוח', 'חפ_תז', 'טלפון', 'אימייל', 'כתובת', 'יתרת_חוב', 'מסגרת_אשראי', 'קישור_תיקיית_דרייב', 'סטטוס_אשראי', 'תאריך_הצטרפות'
    ]);

    // 6. גליון סידור עבודה
    getOrCreateSheet(ss, CONFIG.SHEETS.WORK_ORDER, [
      'מזהה_סידור', 'תאריך', 'שם_נהג', 'מספר_משאית', 'רשימת_משלוחים', 'סטטוס_סידור', 'שעת_יציאה', 'הערות'
    ]);

    // 7. גליון מילון לוגיסטי
    var dictSheet = getOrCreateSheet(ss, CONFIG.SHEETS.LOGISTICS_DICT, [
      'מקט_או_שם_מוצר', 'דורש_פקדון_בלה', 'דורש_פקדון_משטח', 'מחיר_פקדון_בלה', 'מחיר_פקדון_משטח', 'הערות'
    ]);
    if (dictSheet.getLastRow() <= 1) {
      dictSheet.appendRow(['חול מחצבה שק ענק (בלה)', 'כן', 'לא', 45, 0, 'דורש פקדון בלה תקני']);
      dictSheet.appendRow(['בלוק בטון 20 ס"מ תקני', 'לא', 'כן', 0, 55, 'משטח עץ תקני']);
      dictSheet.appendRow(['מלט פורטלנד 50 ק"ג', 'לא', 'כן', 0, 55, 'ארוז על משטח']);
    }

    // 8. גליון חריגות לוגיסטיות
    getOrCreateSheet(ss, CONFIG.SHEETS.EXCEPTIONS, [
      'תאריך_חריגה', 'מזהה_הזמנה', 'מזהה_לקוח', 'חוסר_בפקדון_בלות', 'חוסר_בפקדון_משטחים', 'סכום_חיוב_חסר_משוער', 'סטטוס_חריגה', 'פעולה_נדרשת'
    ]);

    // 9. יומן שיחות
    getOrCreateSheet(ss, CONFIG.SHEETS.CHAT_LOGS, [
      'תאריך_ושעה', 'שולח', 'הודעה', 'עדיפות', 'מזהה_שולח'
    ]);

    // 10. לוגים ומערכת
    getOrCreateSheet(ss, CONFIG.SHEETS.SYSTEM_LOGS, [
      'תאריך_ושעה', 'משתמש', 'פעולה', 'הודעה', 'קוד_סטטוס', 'פיילוד', 'נתיב'
    ]);

    // הוספת נתוני הדגמה במידה והגליונות ריקים
    seedDefaultHebrewData(ss);

    // החלת עיצוב כהה ומקצועי על כל הגליונות
    applyProfessionalDashboardTheme();

    return {
      status: 'success',
      message: 'כל הגליונות והדשבורד של SBN Logistics & SabanOS הוגדרו והועצבו בהצלחה בעברית מלאה!'
    };
  } catch (err) {
    logDetailedError('INIT_SHEETS_ERR', err.toString(), 500, {});
    return { status: 'error', message: err.toString() };
  }
}

/**
 * עיצוב והקמת דשבורד מנהלים בעברית מלאה עם KPI ונוסחאות חישוב
 */
function setupHebrewEnterpriseDashboard(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("לא נפתח גליון פעיל. אנא פתח גליון Google Sheets והרץ שוב.");
  }
  var dashSheet = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD);
  if (!dashSheet) {
    dashSheet = ss.insertSheet(CONFIG.SHEETS.DASHBOARD, 0);
  }

  dashSheet.setRightToLeft(true);
  dashSheet.clear();

  // כותרת ראשית של הדשבורד
  dashSheet.getRange('A1:F1').merge()
    .setValue('🏗️ SBN Logistics & ח.סבן - דשבורד מנהלים ומנוע לוגיסטי חכם (v6.5)')
    .setBackground('#0f172a')
    .setFontColor('#38bdf8')
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(1, 45);

  // כותרת משנה
  dashSheet.getRange('A2:F2').merge()
    .setValue('באדיבות נועה ❤️ | רוטציית מפתחות API, בדיקת פקדונות קשיחה וסנכרון Gmail')
    .setBackground('#1e293b')
    .setFontColor('#94a3b8')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dashSheet.setRowHeight(2, 25);

  // כרטיסי KPI
  dashSheet.getRange('A4:F4').setValues([
    ['סה"כ הזמנות במערכת', 'הזמנות בטיפול', 'חריגות פקדונות ⚠️', 'מוצרים במלאי נמוך', 'לקוחות פעילים', 'סטטוס מנוע נועה']
  ]).setBackground('#1e293b').setFontColor('#cbd5e1').setFontWeight('bold').setHorizontalAlignment('center');

  dashSheet.getRange('A5:F5').setFormulas([
    ['=COUNTA(\'' + CONFIG.SHEETS.ORDERS + '\'!A2:A1000)',
     '=COUNTIF(\'' + CONFIG.SHEETS.ORDERS + '\'!G2:G1000, "*טיפול*")+COUNTIF(\'' + CONFIG.SHEETS.ORDERS + '\'!G2:G1000, "*חדש*")',
     '=COUNTA(\'' + CONFIG.SHEETS.EXCEPTIONS + '\'!A2:A1000)',
     '=COUNTIF(\'' + CONFIG.SHEETS.INVENTORY + '\'!C2:C1000, "<10")',
     '=COUNTA(\'' + CONFIG.SHEETS.CUSTOMERS + '\'!A2:A1000)',
     '="פעיל ומחובר ✅"']
  ]).setBackground('#0f172a').setFontColor('#38bdf8').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');

  dashSheet.setRowHeight(4, 25);
  dashSheet.setRowHeight(5, 35);

  // טבלת ניווט
  dashSheet.getRange('A8:F8').merge()
    .setValue('📋 ניווט מהיר לגליונות הלוגיסטיים במערכת SBN')
    .setBackground('#334155')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('right');

  var navHeaders = ['שם הטאב', 'תפקיד במערכת', 'סטטוס עדכון'];
  dashSheet.getRange('A9:C9').setValues([navHeaders]).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');

  var navRows = [
    [CONFIG.SHEETS.ORDERS, 'ניהול הזמנות מתקבלות ואישורי גליה', 'זמן אמת'],
    [CONFIG.SHEETS.EXCEPTIONS, 'ניטור חריגות פקדונות (בלות ומשטחים)', 'אוטומטי'],
    [CONFIG.SHEETS.INVENTORY, 'ניהול מלאי חומרי בניין ומקטים', 'סנכרון דו-כיווני'],
    [CONFIG.SHEETS.CUSTOMERS, 'תיק לקוח, חובות, מסגרת אשראי ותיקיות דרייב', 'מקושר ל-Drive'],
    [CONFIG.SHEETS.LOGISTICS_DICT, 'מילון הגדרות פקדונות ומחירונים', 'מוגדר'],
    [CONFIG.SHEETS.WORK_ORDER, 'סידור עבודה יומי לנהגים ולמשאיות', 'סנכרון ווטסאפ']
  ];
  dashSheet.getRange('A10:C15').setValues(navRows).setFontSize(10);

  dashSheet.setColumnWidth(1, 220);
  dashSheet.setColumnWidth(2, 340);
  dashSheet.setColumnWidth(3, 180);
}

/**
 * נתוני ברירת מחדל
 */
function seedDefaultHebrewData(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  var invSheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  if (invSheet && invSheet.getLastRow() <= 1) {
    invSheet.appendRow(['SKU-CEM-001', 'מלט פורטלנד 50 ק"ג - נשר', 250, 30, 'מלט ובטון', 38, 'נשר מפעלי מלט', new Date()]);
    invSheet.appendRow(['SKU-SND-002', 'חול מחצבה שק ענק (בלה)', 85, 10, 'חול וחצץ', 120, 'מחצבות קדומים', new Date()]);
    invSheet.appendRow(['SKU-BLK-003', 'בלוק בטון 20 ס"מ תקני', 1200, 200, 'בלוקים', 4.5, 'בלוקי סבן', new Date()]);
  }

  var ordSheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  if (ordSheet && ordSheet.getLastRow() <= 1) {
    ordSheet.appendRow([
      'ORD-2026-8801', 'קבלני שומרון בע"מ', '050-1234567', new Date(),
      '10x בלת חול, 20x שק מלט', 1960, 'בטיפול - ממתין למשאית', 'אזור תעשייה אריאל', 'להתקשר לחסן', 'GALIA-9921', new Date()
    ]);
  }

  var custSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMERS);
  if (custSheet && custSheet.getLastRow() <= 1) {
    custSheet.appendRow([
      'CUST-101', 'קבלני שומרון בע"מ', '515432109', '050-1234567', 'office@shomron.co.il', 'אריאל', 14200, 50000, '', 'מאושר', new Date()
    ]);
  }
}

/**
 * טיפול בסנכרון הזמנה
 */
function handleOrderSync(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.ORDERS, [
      'מזהה_הזמנה', 'שם_הלקוח', 'טלפון', 'תאריך_הזמנה', 'פירוט_מוצרים', 'סכום_כולל', 'סטטוס_הזמנה', 'כתובת_אספקה', 'הערות_נהג', 'מזהה_גליה', 'עדכון_אחרון'
    ]);

    var orderId = data.orderId || data.id || ('ORD-' + new Date().getTime());
    var rows = sheet.getDataRange().getValues();

    var rowIndex = -1;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == orderId) {
        rowIndex = i + 1;
        break;
      }
    }

    var rowData = [
      orderId,
      data.customerName || data.customer || 'לקוח כללי',
      data.phone || '',
      data.orderDate || new Date(),
      data.products || data.items || (data.itemsList ? JSON.stringify(data.itemsList) : 'מוצרי בנייה'),
      data.totalAmount || data.total || 0,
      data.status || 'הזמנה חדשה - בטיפול',
      data.address || data.deliveryAddress || '',
      data.driverNotes || data.notes || '',
      data.galiaId || data.galiaNoteId || '',
      new Date()
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // בדיקת פקדונות אוטומטית
    if (data.itemsList) {
      verifyDepositsAndLogExceptions(orderId, data.customerId || data.customerName, data.itemsList, data.chargedDeposits);
    }

    logDetailedError('ORDER_SYNC_SUCCESS', "הזמנה " + orderId + " עודכנה בהצלחה", 200, orderId);
    return createResponse({ status: 'success', orderId: orderId, action: rowIndex > 0 ? 'updated' : 'created' });
  } catch (err) {
    logDetailedError('ORDER_SYNC_ERR', err.toString(), 500, data);
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * עדכון מלאי מוצרים
 */
function handleDynamicUpsert(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.INVENTORY, [
    'מקט', 'שם_המוצר', 'מלאי_נוכחי', 'מלאי_מינימום', 'קטגוריה', 'מחיר_יחידה', 'ספק', 'תאריך_עדכון'
  ]);
  
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  var newHeadersFound = false;
  Object.keys(data).forEach(function(key) {
    if (key !== 'action' && headers.indexOf(key) === -1) {
      headers.push(key);
      newHeadersFound = true;
    }
  });

  if (newHeadersFound) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var rows = sheet.getDataRange().getValues();
  var sku = data.sku || data.SKU || data.makaat;
  if (!sku) return createResponse({ status: 'error', message: 'חסר מק"ט מוצר לעדכון' });

  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == sku) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowDataToSet = new Array(headers.length).fill("");
  headers.forEach(function(header, index) {
    var val = data[header];
    if (val === undefined) {
      if (header === 'מקט' || header === 'sku') val = sku;
      else if (header === 'שם_המוצר' || header === 'name') val = data.name || data.productName;
      else if (header === 'מלאי_נוכחי' || header === 'currentStock') val = data.currentStock || data.stock;
      else if (header === 'מלאי_מינימום' || header === 'minStock') val = data.minStock;
      else if (header === 'קטגוריה' || header === 'category') val = data.category;
      else if (header === 'מחיר_יחידה' || header === 'price') val = data.price || data.unitPrice;
      else if (header === 'ספק' || header === 'supplier') val = data.supplier;
    }

    if (val !== undefined) {
      rowDataToSet[index] = val;
    } else if (rowIndex > 0) {
      rowDataToSet[index] = rows[rowIndex-1][index];
    }
  });

  var tsIndex = headers.indexOf('תאריך_עדכון') > -1 ? headers.indexOf('תאריך_עדכון') : headers.indexOf('updatedAt');
  if (tsIndex > -1) rowDataToSet[tsIndex] = new Date();

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowDataToSet]);
  } else {
    sheet.appendRow(rowDataToSet);
  }

  return createResponse({ status: 'success', sku: sku, totalColumns: headers.length });
}

/**
 * ניהול סידור עבודה
 */
function handleWorkOrderSync(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.WORK_ORDER, [
      'מזהה_סידור', 'תאריך', 'שם_נהג', 'מספר_משאית', 'רשימת_משלוחים', 'סטטוס_סידור', 'שעת_יציאה', 'הערות'
    ]);

    var siddurId = data.siddurId || data.id || ('SIDDUR-' + new Date().getTime());
    sheet.appendRow([
      siddurId,
      data.date || new Date(),
      data.driverName || data.driver || 'נהג תורן',
      data.truckNo || data.truck || '',
      data.deliveries || data.orders || '',
      data.status || 'משובץ - ממתין ליציאה',
      data.departureTime || '07:30',
      data.notes || ''
    ]);

    return createResponse({ status: 'success', siddurId: siddurId });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * יצירת תיקיית לקוח ב-Drive
 */
function createCustomerFolder(data) {
  try {
    var root = DriveApp.getRootFolder();
    var customerName = data.customerName || data.name || 'לקוח_חדש';
    
    var customerFolder = root.createFolder("תיק_לקוח_" + customerName);
    var subFolders = ['הזמנות', 'תעודות_משלוח', 'חשבוניות', 'אישורי_אשראי'];
    var folderIds = { main: customerFolder.getId(), url: customerFolder.getUrl() };
    
    subFolders.forEach(function(sub) {
      var subFolder = customerFolder.createFolder(sub);
      folderIds[sub] = subFolder.getId();
    });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.CUSTOMERS, [
      'מזהה_לקוח', 'שם_הלקוח', 'חפ_תז', 'טלפון', 'אימייל', 'כתובת', 'יתרת_חוב', 'מסגרת_אשראי', 'קישור_תיקיית_דרייב', 'סטטוס_אשראי', 'תאריך_הצטרפות'
    ]);

    var customerId = data.customerId || data.id || ('CUST-' + Math.floor(Math.random()*10000));
    var rows = sheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] == customerName || rows[i][0] == customerId) {
        rowIndex = i + 1;
        break;
      }
    }

    var rowData = [
      customerId,
      customerName,
      data.taxId || data.hp || '',
      data.phone || '',
      data.email || '',
      data.address || '',
      data.balance || 0,
      data.creditLimit || 25000,
      customerFolder.getUrl(),
      data.creditStatus || 'מאושר',
      new Date()
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return createResponse({ 
      status: 'success', 
      customerName: customerName,
      customerId: customerId,
      folderId: customerFolder.getId(),
      folderUrl: customerFolder.getUrl(),
      subFolders: folderIds
    });
  } catch (err) {
    logDetailedError('CUSTOMER_FOLDER_ERR', err.toString(), 500, data);
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * עיצוב מקצועי של כל הגליונות
 */
function applyProfessionalDashboardTheme() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    
    sheets.forEach(function(sheet) {
      sheet.setRightToLeft(true);
      
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow === 0 || lastCol === 0) return;
      
      var headerRange = sheet.getRange(1, 1, 1, lastCol);
      headerRange.setBackground('#0f172a'); 
      headerRange.setFontColor('#f8fafc'); 
      headerRange.setFontWeight('bold');
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment('center');
      headerRange.setVerticalAlignment('middle');
      
      sheet.setFrozenRows(1);
      
      if (lastRow > 1) {
        var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
        dataRange.setFontFamily('Arial');
        dataRange.setFontSize(10);
        dataRange.setVerticalAlignment('middle');
        
        for (var i = 2; i <= lastRow; i++) {
          var rowRange = sheet.getRange(i, 1, 1, lastCol);
          if (i % 2 === 0) {
            rowRange.setBackground('#f8fafc');
          } else {
            rowRange.setBackground('#ffffff');
          }
        }
      }

      for (var col = 1; col <= Math.min(lastCol, 12); col++) {
        sheet.autoResizeColumn(col);
      }
    });
    
    logDetailedError('DESIGN_ENGINE', 'הוחל עיצוב מקצועי בעברית על כל הגליונות', 200, 'Success');
    return createResponse({ status: 'success', message: 'עיצוב הדשבורד והגליונות הוחל בהצלחה בעברית מלאה' });
  } catch (err) {
    logDetailedError('DESIGN_ENGINE_ERR', err.toString(), 500, {});
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * שליפת כרטיס לקוח
 */
function generateCustomerCardView(customerSkuOrId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMERS) || ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
    if (!sheet) return { status: 'error', message: 'גליון לא נמצא' };

    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    
    var customerData = null;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == customerSkuOrId || rows[i][1] == customerSkuOrId) {
        customerData = rows[i];
        break;
      }
    }
    
    if (!customerData) {
      return { status: 'error', message: 'לקוח או מוצר לא נמצא' };
    }
    
    var cardMap = {};
    headers.forEach(function(header, index) {
      cardMap[header] = customerData[index];
    });
    
    return {
      status: 'success',
      card: cardMap
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * סטטיסטיקות דשבורד
 */
function getDashboardStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var ordSheet = ss.getSheetByName(CONFIG.SHEETS.ORDERS);
  var invSheet = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  var custSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMERS);
  var excSheet = ss.getSheetByName(CONFIG.SHEETS.EXCEPTIONS);

  return {
    status: 'success',
    stats: {
      totalOrders: ordSheet ? Math.max(0, ordSheet.getLastRow() - 1) : 0,
      totalProducts: invSheet ? Math.max(0, invSheet.getLastRow() - 1) : 0,
      totalCustomers: custSheet ? Math.max(0, custSheet.getLastRow() - 1) : 0,
      totalExceptions: excSheet ? Math.max(0, excSheet.getLastRow() - 1) : 0,
      systemStatus: 'מחובר וסנכרון מלא ✅',
      botName: 'נועה - מוח תפעולי SBN'
    }
  };
}

/**
 * סנכרון יומן שיחות
 */
function handleChatSync(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.CHAT_LOGS, [
    'תאריך_ושעה', 'שולח', 'הודעה', 'עדיפות', 'מזהה_שולח'
  ]);
  sheet.appendRow([new Date(), data.sender || 'נועה', data.text || data.message || '', data.priority || 'רגיל', data.senderId || '']);
  return createResponse({ status: 'success' });
}

/**
 * לוג קופסה שחורה
 */
function handleBlackBoxLog(data) {
  logDetailedError(data.operation || data.action || 'LOG', data.message || 'N/A', 200, data.context || data.payload);
  return createResponse({ status: 'success' });
}

/**
 * רישום לוגים בגליון לוגים ומערכת
 */
function logDetailedError(action, message, statusCode, payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.SYSTEM_LOGS, [
      'תאריך_ושעה', 'משתמש', 'פעולה', 'הודעה', 'קוד_סטטוס', 'פיילוד', 'נתיב'
    ]);
    sheet.appendRow([
      new Date(),
      'נועה_מוח_תפעולי',
      action,
      message,
      statusCode || 200,
      typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
      'SBN_Logistics_Gas_Engine'
    ]);
  } catch (logErr) {
    console.error('Logging failed: ' + logErr.toString());
  }
}

/**
 * שליפת או יצירת גליון
 */
function getOrCreateSheet(ss, name, headersIfNew) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("לא נמצא גליון Google Sheets פעיל.");
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.setRightToLeft(true);
    if (headersIfNew && headersIfNew.length > 0) {
      sheet.appendRow(headersIfNew);
    }
  }
  return sheet;
}

/**
 * יצירת תגובת JSON
 */
function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
