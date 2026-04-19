export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      // חובה להוסיף את השורה הזו כדי ש-process.env יעבוד בדפדפן
      'process.env.VITE_GAS_URL': JSON.stringify(env.VITE_GAS_URL),
      'process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY': JSON.stringify(env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY),
      'process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID': JSON.stringify(env.NEXT_PUBLIC_DRIVE_FOLDER_ID),
    },

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
    console.warn("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY is missing");
    return [];
  }

  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
}

/**
 * הורדת תוכן קובץ כ-Base64
 * מעודכן לעבוד דרך ה-GAS Bridge כדי למנוע שגיאות 404/401 של API Key
 */
export async function getFileBase64(fileId: string): Promise<string> {
  if (!GAS_URL) {
    throw new Error("VITE_GAS_URL is missing");
  }

  try {
    // פנייה ל-GAS כדי למשוך את תוכן הקובץ בבטחה
    const response = await fetch(`${GAS_URL}?fileId=${fileId}`);
    
    if (!response.ok) {
      throw new Error(`שגיאה בהורדת הקובץ מה-Bridge: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    
    return data.base64Data;
  } catch (error) {
    console.error("Error downloading file via GAS bridge:", error);
    throw error;
  }
}

/**
 * העלאת קובץ לדרייב דרך Google Apps Script Bridge
 * פותר את בעיית ה-CORS ומחזיר fileId אמיתי במקום PENDING_SCAN
 */
export async function uploadFileToDrive(file: File, folderId: string = FOLDER_ID || ''): Promise<any> {
  if (!GAS_URL) {
    throw new Error("VITE_GAS_URL חסר בכתובות המערכת אחי.");
  }

  try {
    // המרה ל-Base64
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
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

    // שליחה ל-GAS
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`העלאה נכשלה: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || "שגיאה פנימית ב-Apps Script");
    }

    if (!result.fileId) {
      throw new Error("לא התקבל מזהה קובץ (File ID) מהדרייב.");
    }

    return result; // מחזיר { status: 'success', fileId: '...', url: '...' }
  } catch (error) {
    console.error("Error uploading file to GAS bridge:", error);
    throw error;
  }
}
