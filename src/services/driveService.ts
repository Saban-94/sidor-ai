/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// משתנים לצד הלקוח (קריאה בלבד)
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

/**
 * שליפת רשימת קבצים - נשאר עם API Key כי זו פעולת קריאה
 */
export async function listDriveFiles(folderId: string = FOLDER_ID || ''): Promise<DriveFile[]> {
  if (!API_KEY) {
    console.warn("GOOGLE_DRIVE_API_KEY is missing");
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
 * העלאת קובץ לדרייב - עוברת דרך ה-Backend שלנו
 */
export async function uploadFileToDrive(file: File, folderId: string = FOLDER_ID || ''): Promise<any> {
  // אנחנו שולחים את הקובץ ל-API Route פנימי שיצרנו בווירסל
  // ה-API הזה יחזיק את מפתח ה-Service Account שהעלית (saban-ai-drive-aa2cd6d3c571.json)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folderId', folderId);

  try {
    const response = await fetch('/api/drive/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Upload failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Error uploading file to Drive via Backend:", error);
    throw error;
  }
}

/**
 * הורדת תוכן קובץ כ-Base64
 */
export async function getFileBase64(fileId: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("GOOGLE_DRIVE_API_KEY is missing");
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error downloading file from Drive:", error);
    throw error;
  }
}
