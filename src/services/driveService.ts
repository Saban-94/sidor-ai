/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API_KEY = import.meta.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = import.meta.env.NEXT_PUBLIC_DRIVE_FOLDER_ID;

const GAS_URL = import.meta.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbwMBz1tnnL-twFuUm87hOkPO-BKU_Bq8DL3mRh0OPyQv094NI87uLAdQl62X0VBcf7D/exec';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

/**
 * List files in the specified Drive folder.
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
 * Get the content of a file as a base64 string.
 * Note: For PDFs, we need to download the file data.
 */
export async function getFileBase64(fileId: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY is missing");
  }

  // To download file content using an API key, we use the 'alt=media' parameter.
  // Note: This only works for files that are publicly accessible or shared with the API Key/Identity.
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`קובץ עם מזהה ${fileId} לא נמצא בדרייב. וודא שזה ה-ID הנכון אחי.`);
      }
      throw new Error(`שגיאה בהורדת הקובץ: ${response.statusText} (${response.status})`);
    }
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

/**
 * Upload a file to the specified Drive folder.
 * Uses a Google Apps Script (GAS) bridge to bypass client-side CORS and API key restrictions.
 */
export async function uploadFileToDrive(file: File, folderId: string = FOLDER_ID || ''): Promise<any> {
  try {
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
      filename: file.name,
      mimeType: file.type,
      base64Data: base64Content, // GAS script expects this specific key
      data: base64Content,       // Keep for backward compatibility
      folderId: folderId
    };

    // Using mode: 'cors' so we can read the response body. 
    // GAS bridge must return a JSON response with the fileId.
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Standard practice for GAS POST
      },
      body: JSON.stringify(payload)
    });

    console.log("GAS Bridge Response Status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("GAS Bridge Error Response:", errorText);
      throw new Error(`Upload failed: ${response.statusText} (${response.status})`);
    }

    const result = await response.json();
    console.log("GAS Bridge Raw Result:", result);
    
    // Some GAS scripts might return 'id' or 'fileId'
    const finalId = result?.fileId || result?.id;
    if (finalId) {
      return { ...result, fileId: finalId };
    }
    
    return result; 
  } catch (error) {
    console.error("Error uploading file to GAS bridge:", error);
    throw error;
  }
}
