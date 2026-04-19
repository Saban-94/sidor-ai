// src/services/driveService.ts

const GAS_URL = "https://script.google.com/macros/s/AKfycbwMBz1tnnL-twFuUm87hOkPO-BKU_Bq8DL3mRh0OPyQv094NI87uLAdQl62X0VBcf7D/exec";

export async function uploadFileToDrive(file: File): Promise<any> {
  // המרת הקובץ ל-Base64 כדי שנוכל לשלוח אותו ב-JSON
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
    const response = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script דורש לעיתים no-cors או טיפול בהפניה
      body: JSON.stringify(payload),
    });
    
    // הערה: בגלל no-cors לא תמיד ניתן לקרוא את התשובה, 
    // אבל הקובץ יעלה לדרייב תוך שניות.
    return { status: "sent" };
  } catch (error) {
    console.error("GAS Upload Error:", error);
    throw error;
  }
}
