/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const API_KEY = import.meta.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
const FOLDER_ID = import.meta.env.NEXT_PUBLIC_DRIVE_FOLDER_ID;

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
 * This implementation proxies the request through the server /api/drive/upload
 * to use a Service Account for authentication.
 */
export async function uploadFileToDrive(file: File, folderId: string = FOLDER_ID || ''): Promise<any> {
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
    console.error("Error uploading file to Drive:", error);
    throw error;
  }
}
