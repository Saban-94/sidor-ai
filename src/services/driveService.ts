// src/services/driveService.ts

const GAS_URL = "https://script.google.com/macros/s/AKfycbwMBz1tnnL-twFuUm87hOkPO-BKU_Bq8DL3mRh0OPyQv094NI87uLAdQl62X0VBcf7D/exec";
// src/services/driveService.ts

export async function uploadFileToDrive(file: File): Promise<any> {
  // שלב א': המרת הקובץ ל-Base64 כדי שנוכל לשלוח אותו ב-JSON
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });

  const payload = {
    fileName: file.name,
    base64Data: base64,
    contentType: file.type
  };

  try {
    // שלב ב': שליחה ישירה ל-Google Apps Script
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', // קריטי עבור Apps Script
      body: JSON.stringify(payload),
    });
    
    // בגלל no-cors לא ניתן לקרוא את ה-JSON בחזרה, אבל הקובץ יעלה
    return { status: "success" }; 
  } catch (error) {
    console.error("Error uploading to GAS:", error);
    throw error;
  }
}
