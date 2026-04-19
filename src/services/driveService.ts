/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// שימוש ב-import.meta.env - הדרך הנכונה ב-Vite להזרקת משתנים לדפדפן
// וודא שב-Vercel המשתנים מוגדרים בדיוק בשמות האלו
const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || import.meta.env.VITE_NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID || import.meta.env.VITE_NEXT_PUBLIC_DRIVE_FOLDER_ID;
const GAS_URL = import.meta.env.VITE_GAS_URL;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

/**
 * שליפת רשימת קבצים מהדרייב (קריאה בלבד - עובד עם API Key)
 */
export async function listDriveFiles(folderId: string = FOLDER_ID || ''): Promise<DriveFile[]> {
  if (!API_KEY) {
    console.error("קריטי: API_KEY חסר במערכת");
    return [];
  }

  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Drive API Error: ${response.statusText}`);
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
}


export async function getFileBase64(fileId: string): Promise<string> {
  const GAS_URL = import.meta.env.VITE_GAS_URL;

  if (!GAS_URL) {
    throw new Error("VITE_GAS_URL חסר. לא ניתן למשוך את תוכן הקובץ.");
  }

  try {
    // פנייה ל-Bridge כדי שימשוך עבורנו את ה-Blob של הקובץ
    // אנחנו שולחים fileId כ-Query Parameter (GET)
    const response = await fetch(`${GAS_URL}?fileId=${fileId}`);
    
    if (!response.ok) {
      throw new Error(`שגיאה במשיכת קובץ מה-Bridge: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(`שגיאת GAS: ${data.message}`);
    }
    
    // החזרת ה-Base64 שחזר מהסקריפט בגוגל
    return data.base64Data; 
  } catch (error) {
    console.error("Error in getFileBase64 via Bridge:", error);
    throw error;
  }
}
/**
 * העלאת קובץ לדרייב דרך Google Apps Script Bridge
 */
export async function uploadFileToDrive(file: File, folderId: string = FOLDER_ID || ''): Promise<any> {
  // בדיקה בזמן אמת אם המשתנה קיים
  if (!GAS_URL) {
    console.error("Missing GAS_URL. Current ENV:", import.meta.env);
    throw new Error("אחי, VITE_GAS_URL חסר. תבדוק שהגדרת אותו ב-Vercel ועשית Redeploy.");
  }

  try {
    // המרה ל-Base64
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error("Failed to read file as string"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const payload = {
      fileName: file.name,
      contentType: file.type,
      base64Data: base64Content,
      folderId: folderId
    };

    // שליחה ל-GAS ללא mode: no-cors כדי שנוכל לקרוא את ה-fileId
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });

    if (!response.ok) {
      throw new Error(`העלאה נכשלה בשרת גוגל: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || "שגיאה פנימית ב-Apps Script");
    }

    if (!result.fileId) {
      throw new Error("הקובץ עלה אבל לא התקבל מזהה (File ID) חזרה.");
    }

    return result;
  } catch (error) {
    console.error("Error uploading file to GAS bridge:", error);
    throw error;
  }
}
