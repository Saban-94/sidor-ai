// api/upload.ts
import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false }, // חובה בשביל העלאת קבצים
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const folderId = Array.isArray(fields.folderId) ? fields.folderId[0] : fields.folderId;

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      const drive = google.drive({ version: 'v3', auth });
      const response = await drive.files.create({
        requestBody: { name: file.originalFilename, parents: [folderId] },
        media: { mimeType: 'application/pdf', body: fs.createReadStream(file.filepath) },
      });

      res.status(200).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });
}
