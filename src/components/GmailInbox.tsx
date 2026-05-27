import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Inbox, 
  Send as SendIcon, 
  Search, 
  RotateCw, 
  Sparkles, 
  ChevronRight, 
  CornerUpLeft, 
  Check, 
  ChevronLeft, 
  Loader2, 
  Trash, 
  FileText,
  AlertCircle,
  Clock,
  User,
  ExternalLink,
  Brain,
  X,
  Plus
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface GmailInboxProps {
  onAddToast: (title: string, msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface EmailThread {
  id: string;
  snippet: string;
  historyId: string;
  messages?: any[];
}

interface MailItem {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  unread: boolean;
}

export const GmailInbox: React.FC<GmailInboxProps> = ({ onAddToast }) => {
  // Auth state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Email state
  const [emails, setEmails] = useState<MailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MailItem | null>(null);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailTab, setEmailTab] = useState<'inbox' | 'sent' | 'unread'>('inbox');
  
  // Compose state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // AI draft state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Auto-refresh timer
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // UTF-8 base64url decoder
  function decodeBase64Utf8(base64UrlStr: string) {
    try {
      const base64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      console.error("Failed to decode base64:", error);
      return "";
    }
  }

  // Parse nested email parts recursively
  function getMessageBody(payload: any): string {
    if (!payload) return "";
    if (payload.body && payload.body.data) {
      return decodeBase64Utf8(payload.body.data);
    }
    if (payload.parts) {
      // 1. Prefer html body
      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        return decodeBase64Utf8(htmlPart.body.data);
      }
      // 2. Fallback to normal text/plain
      const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (plainPart && plainPart.body && plainPart.body.data) {
        const txt = decodeBase64Utf8(plainPart.body.data);
        return `<pre style="font-family: Inter, sans-serif; white-space: pre-wrap; word-break: break-all; color: #1e293b; padding: 4px;">${txt}</pre>`;
      }
      // 3. Fallback to nested part search
      for (const part of payload.parts) {
        const body = getMessageBody(part);
        if (body) return body;
      }
    }
    return "";
  }

  // Find header by name
  const getHeader = (headers: { name: string; value: string }[], name: string) => {
    return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  };

  // Extract cleanest email & name
  const parseSender = (fromLine: string) => {
    if (!fromLine) return { name: 'לא ידוע', email: '' };
    const match = fromLine.match(/^(.*?)\s*<([^>]+)>/);
    if (match) {
      return { name: match[1].replace(/['"]/g, '').trim(), email: match[2].trim() };
    }
    return { name: fromLine.trim(), email: fromLine.trim() };
  };

  // Monitor Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Keep state aligned
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Request Access Token popup trigger
  const handleAuthorizeGmail = async () => {
    setIsAuthorizing(true);
    try {
      // Setup Gmail read & send scopes
      googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        onAddToast('החיבור הצליח!', 'תיבת Gmail של ח.סבן חוברה בהצלחה.', 'success');
      } else {
        throw new Error('Access token not found in Google credential');
      }
    } catch (error: any) {
      console.error('Gmail scope confirmation error:', error);
      onAddToast('שגיאה בחיבור', error.message || 'החיבור ל-Gmail בוטל או נכשל', 'error');
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Fetch Emails
  const fetchGmailList = async () => {
    if (!accessToken) return;
    setIsLoadingEmails(true);
    try {
      let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15';
      
      // Handle simple filters
      if (emailTab === 'sent') {
        url += `&q=${encodeURIComponent('from:me')}`;
      } else if (emailTab === 'unread') {
        url += `&q=${encodeURIComponent('label:UNREAD')}`;
      } else {
        url += `&q=${encodeURIComponent('label:INBOX')}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          setAccessToken(null);
          throw new Error('פג תוקף האסימון של Google. אנא התחבר שוב.');
        }
        throw new Error(`שגיאה בטעינת הודעות (${res.status})`);
      }

      const data = await res.json();
      const rawMessages = data.messages || [];
      
      // Fetch details of each individual message
      const detailedMessages = await Promise.all(
        rawMessages.map(async (msg: any) => {
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!detailRes.ok) return null;
            const detail = await detailRes.json();
            
            const headers = detail.payload?.headers || [];
            const subject = getHeader(headers, 'Subject') || '(ללא נושא)';
            const fromLine = getHeader(headers, 'From');
            const to = getHeader(headers, 'To');
            const dateStr = getHeader(headers, 'Date');
            const labels = detail.labelIds || [];
            const unread = labels.includes('UNREAD');

            const { name: fromName, email: fromEmail } = parseSender(fromLine);
            const body = getMessageBody(detail.payload);

            return {
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || '',
              from: fromName || fromEmail,
              fromEmail,
              to,
              subject,
              date: dateStr,
              body,
              unread
            } as MailItem;
          } catch (err) {
            console.error(`Error loading detail for ${msg.id}:`, err);
            return null;
          }
        })
      );

      // Clean null values and sort by date/ID
      setEmails(detailedMessages.filter(m => m !== null) as MailItem[]);
    } catch (err: any) {
      console.error(err);
      onAddToast('שגיאה', err.message || 'לא הצלחנו למשוך הודעות מ-Gmail', 'error');
    } finally {
      setIsLoadingEmails(false);
    }
  };

  // Trigger loading on setting tokens/tabs
  useEffect(() => {
    if (accessToken) {
      fetchGmailList();
      // Set automatic poll every 30 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchGmailList();
      }, 30000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [accessToken, emailTab]);

  // Handle Search Submission
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const performSearch = async () => {
    if (!accessToken) return;
    setIsLoadingEmails(true);
    try {
      const q = searchQuery.trim();
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15${q ? `&q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      const messages = data.messages || [];
      
      const detailed = await Promise.all(
        messages.map(async (msg: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const { name: fromName, email: fromEmail } = parseSender(getHeader(headers, 'From'));
          return {
            id: detail.id,
            threadId: detail.threadId,
            snippet: detail.snippet || '',
            from: fromName,
            fromEmail,
            to: getHeader(headers, 'To'),
            subject: getHeader(headers, 'Subject') || '(ללא נושא)',
            date: getHeader(headers, 'Date'),
            body: getMessageBody(detail.payload),
            unread: detail.labelIds?.includes('UNREAD') || false
          };
        })
      );
      setEmails(detailed.filter(m => m !== null) as MailItem[]);
    } catch (error) {
      onAddToast('חיפוש נכשל', 'לא הצלחנו לבצע חיפוש הודעות בתיבה', 'error');
    } finally {
      setIsLoadingEmails(false);
    }
  };

  // Mark Mail as Read
  const markAsRead = async (mailId: string) => {
    if (!accessToken) return;
    try {
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${mailId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });
      // Locally update
      setEmails(prev => prev.map(m => m.id === mailId ? { ...m, unread: false } : m));
    } catch (err) {
      console.error(err);
    }
  };

  // Select mail
  const handleSelectMail = (mail: MailItem) => {
    setSelectedEmail(mail);
    if (mail.unread) {
      markAsRead(mail.id);
    }
  };

  // Send composing mail
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !composeTo || !composeSubject || !composeBody) {
      onAddToast('שדות חסרים', 'נא למלא את כל שדות חובה (נמען, נושא, תוכן).', 'error');
      return;
    }

    setIsSending(true);
    try {
      // Build MIME standard message safely converting to Base64 in UTF-8
      const emailString = [
        `To: ${composeTo}`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(composeSubject)))}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        btoa(unescape(encodeURIComponent(composeBody)))
      ].join('\r\n');

      const raw = btoa(unescape(encodeURIComponent(emailString)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });

      if (!response.ok) {
        throw new Error(`שגיאה בשליחה: ${response.statusText}`);
      }

      onAddToast('המייל נשלח!', `המייל אל ${composeTo} נשלח בהצלחה דרך Gmail.`, 'success');
      setIsComposeOpen(false);
      
      // Reset fields
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (err: any) {
      console.error(err);
      onAddToast('כשל בשליחת מייל', err.message || 'שליחת המייל דרך Gmail נכשלה.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Smart Predefined Email Templates for Saban Logistics
  const handleApplyTemplate = (type: string) => {
    switch (type) {
      case 'delivery_update':
        setComposeTo('hsaban2025@gmail.com');
        setComposeSubject('עדכון סידור עבודה ומשלוחי יום - ח.סבן חומרי בניין');
        setComposeBody(`
          <div style="font-family: sans-serif; direction: rtl; text-align: right; color: #1e293b;">
            <h2 style="color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">עדכון סידור עבודה יומי - ח.סבן</h2>
            <p>שלום רב,</p>
            <p>רצ"ב סידור עבודה מעודכן למשלוחי היום.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">נהג</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">סטטוס מסירה</th>
                  <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">יעד</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #cbd5e1; padding: 8px;">ראמי - נהג ראשי</td>
                  <td style="border: 1px solid #cbd5e1; padding: 8px; color: #10b981; font-weight: bold;">בביצוע סופי</td>
                  <td style="border: 1px solid #cbd5e1; padding: 8px;">סניף בית שמש</td>
                </tr>
              </tbody>
            </table>
            <p style="margin-top: 20px;">בברכה,<br/><strong>נועה | המוח התפעולי של ח.סבן</strong> ❤️</p>
          </div>
        `);
        break;
      case 'inventory_shortage':
        setComposeSubject('חוסרי מלאי לאספקה דחופה - ח.סבן חומרי בניין');
        setComposeBody(`
          <div style="font-family: sans-serif; direction: rtl; text-align: right; color: #1e293b;">
            <p>שלום רב,</p>
            <p>נא לשלוח הצעת מחיר וזמן אספקה לחומרים הבאים החסרים במלאי שלנו:</p>
            <ul>
              <li><strong>קבוצת מלט שחור נשר:</strong> 50 שקים (25 ק"ג)</li>
              <li><strong>חול ים שטוף:</strong> 15 בלות גדולות</li>
              <li><strong>טיט מוכן לטיוח:</strong> 10 בלות</li>
            </ul>
            <p>נא לאשר קבלה של הזמנה זו בהקדם.</p>
            <p>בברכה,<br/><strong>מחלקת רכש | ח.סבן</strong></p>
          </div>
        `);
        break;
      case 'customer_receipt':
        setComposeSubject('אישור קליטת הזמנה מספר #SB-2026 - ח.סבן חומרי בניין');
        setComposeBody(`
          <div style="font-family: sans-serif; direction: rtl; text-align: right; color: #1e293b;">
            <h3 style="color: #c5a059;">שלום רב,</h3>
            <p>אנו שמחים לאשר כי הזמנתך התקבלה בהצלחה במערכת LogiSaban של ח.סבן חומרי בניין.</p>
            <p>מספר סימוכין: <strong>SB-2026</strong></p>
            <p>פרטי ההזמנה וזמני הספקה יישלחו אליך בהמשך היום ע"י משאיות החלוקה של ראמי.</p>
            <p>תודה שבחרת בנו!</p>
            <p>בברכה,<br/><strong>צוות ח.סבן חומרי בניין</strong></p>
          </div>
        `);
        break;
      default:
        break;
    }
  };

  // Mock-AI assistant composition using standard template heuristics for Noa-Precision
  const handleAiDraft = () => {
    if (!aiPrompt) return;
    setIsGeneratingAi(true);
    setTimeout(() => {
      // Simulate highly customized response from Noa based on user prompt
      const generatedText = `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #1e293b;">
          <p>שלום,</p>
          <p>בהתייחס לפנייתך בנושא <strong>"${aiPrompt}"</strong>:</p>
          <p>אצלנו בחברת ח. סבן חומרי בניין אנו עובדים במקסימום דיוק מבצעי. הנושא הועבר ישירות לטיפול של המפקד ראמי וצוות הלוגיסטיקה.</p>
          <p>נציג מטעמנו ייצור קשר איתך בתוך שעה אחת לכל היותר על מנת לסגור את פרטי האספקה.</p>
          <p>נשמח לעמוד לשירותך בכל עת!</p>
          <hr style="border:0; border-top:1px solid #cbd5e1; margin:15px 0;">
          <p style="color: #0c4a6e;"><strong>באדיבות נועה ❤️ | המערכת המבצעית של ח.סבן חומרי בניין</strong></p>
        </div>
      `;
      setComposeBody(generatedText);
      setIsGeneratingAi(false);
      setAiPrompt('');
      onAddToast('נועה המליצה על טיוטה!', 'הטיוטה החכמה של נועה הוחדרה לחלון ההרכבה.', 'info');
    }, 1200);
  };

  // Reply inline
  const handleReplyMail = () => {
    if (!selectedEmail) return;
    setComposeTo(selectedEmail.fromEmail || selectedEmail.from);
    setComposeSubject(`Re: ${selectedEmail.subject}`);
    setComposeBody(`
      <br/><br/>
      <div style="border-right: 3px solid #cbd5e1; padding-right: 15px; margin-right: 5px; color: #64748b;">
        <p>בתאריך ${selectedEmail.date}, נכתב על ידי ${selectedEmail.from}:</p>
        <div>${selectedEmail.body}</div>
      </div>
    `);
    setIsComposeOpen(true);
  };

  // Header section or loading view
  if (isLoadingAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 min-h-[500px]">
        <Loader2 className="animate-spin text-sky-600 mb-2" size={32} />
        <p className="text-sm text-slate-900 font-bold">מעלה הגדרות Gmail...</p>
      </div>
    );
  }

  // Not signed-in or workspace token not obtained
  if (!accessToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-[500px] text-center">
        <div className="bg-sky-600/10 p-6 rounded-[2.5rem] mb-6">
          <Mail className="text-sky-600 animate-bounce" size={56} />
        </div>
        <h2 className="text-2xl font-black text-slate-950 mb-2">חיבור מנהל הדואר (Gmail) של ח.סבן</h2>
        <p className="max-w-md text-slate-950 text-sm mb-6 leading-relaxed">
          על מנת לאפשר לנועה לעדכן את הלקוחות, לשלוח דו"חות וסידורי עבודה לראמי ולנהל את החברות דרך תיבת ה-Gmail הרשמית, יש לספק הרשאת גישה מאושרת.
        </p>

        {/* Material-GSI compliant Custom Button */}
        <button 
          onClick={handleAuthorizeGmail}
          disabled={isAuthorizing}
          className="bg-slate-950 text-white flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold shadow-lg hover:bg-sky-700 active:scale-95 transition-all outline-none"
        >
          {isAuthorizing ? (
            <>
              <Loader2 className="animate-spin text-white" size={20} />
              <span>מתחבר...</span>
            </>
          ) : (
            <>
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 flex-shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span>חבר את Gmail לחשבון</span>
            </>
          )}
        </button>

        <div className="signature mt-12 text-xs text-slate-900 font-bold">באדיבות נועה ❤️</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden" dir="rtl">
      
      {/* MAIL SUITE HEADER */}
      <div className="bg-slate-950 p-3 flex flex-wrap items-center justify-between border-b border-slate-800 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059] flex items-center justify-center text-slate-950">
            <Mail size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-md font-extrabold text-[#FFFFFF] tracking-tight leading-none mb-1">נועה | מנהלת הדואר המבצעית</h2>
            <p className="text-[10px] text-[#C5A059] font-black uppercase">סנכרון סביבת עבודה Gmail מחובר ✅</p>
          </div>
        </div>
        
        {/* ACTION RAIL */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#C5A059] hover:bg-[#C5A059]/90 text-slate-950 font-bold text-xs rounded-xl active:scale-95 transition-all"
          >
            <Plus size={14} strokeWidth={3} />
            <span>הלחן מייל</span>
          </button>
          
          <button 
            onClick={fetchGmailList}
            disabled={isLoadingEmails}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl active:scale-90 transition-all disabled:opacity-50"
            title="רענן תיבת דואר"
          >
            <RotateCw size={14} className={isLoadingEmails ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* FILTER SEARCH SUB-HEADER */}
      <div className="bg-white px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
          <button 
            onClick={() => setEmailTab('inbox')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${emailTab === 'inbox' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
          >
            דואר נכנס
          </button>
          <button 
            onClick={() => setEmailTab('unread')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${emailTab === 'unread' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
          >
            לא נקרא
          </button>
          <button 
            onClick={() => setEmailTab('sent')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${emailTab === 'sent' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
          >
            נשלח
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="flex items-center bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:max-w-xs">
          <input 
            type="text"
            placeholder="חפש מיילים ב-SabanOS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="bg-transparent border-none text-xs text-slate-950 focus:outline-none w-full font-sans"
          />
          <button onClick={performSearch} className="text-slate-600 hover:text-slate-950 transition-colors">
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* WORKSPACE CORE CLIENT GRID */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200">
        
        {/* EMAIL LIST PANELS - DENSE */}
        <div className="w-full md:w-80 flex flex-col min-h-0 bg-white">
          {isLoadingEmails ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <Loader2 className="animate-spin text-slate-950 mb-2" size={24} />
              <p className="text-xs text-slate-950 font-bold">נועה סורקת תיבת Gmail...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-950">
              <Mail className="text-slate-300 mb-2" size={32} />
              <h4 className="text-xs font-black">אין הודעות להצגה</h4>
              <p className="text-[10px] text-slate-500 mt-1">תיבת הדואר הזו נקייה ומוזנת.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectMail(email)}
                    className={`p-2.5 cursor-pointer hover:bg-slate-50 transition-all relative ${isSelected ? 'bg-sky-50/75 border-r-4 border-[#C5A059]' : ''} ${email.unread ? 'bg-[#C5A059]/5' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {email.unread && (
                          <span className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0" />
                        )}
                        <span className={`text-xs font-black text-slate-950 truncate max-w-[140px]`}>
                          {email.from}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                        {email.date ? email.date.split(',')[0] : ''}
                      </span>
                    </div>
                    
                    <h4 className={`text-xs ${email.unread ? 'font-black text-slate-950' : 'font-semibold text-slate-800'} truncate mb-0.5`}>
                      {email.subject}
                    </h4>
                    
                    <p className="text-[10px] text-slate-600 line-clamp-1">
                      {email.snippet}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAILED MESSAGE VIEWER - STUNNING ACCENTS */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
          {selectedEmail ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* MESSAGE METADATA */}
              <div className="bg-white p-3 border-b border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-950 leading-tight mb-1">{selectedEmail.subject}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-950 font-bold">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">מאת: {selectedEmail.from} ({selectedEmail.fromEmail})</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">נמען: {selectedEmail.to}</span>
                    </div>
                  </div>
                  
                  {/* REPLY & METRIC ACTS */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleReplyMail}
                      className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-lg active:scale-95 transition-all flex items-center gap-1"
                    >
                      <CornerUpLeft size={12} strokeWidth={2.5} />
                      <span>השב</span>
                    </button>
                    <button 
                      onClick={() => setSelectedEmail(null)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-black mt-2 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1"><Clock size={10} /> {selectedEmail.date}</span>
                  <span className="text-[#C5A059] uppercase tracking-wider">מזהה אסימון: {selectedEmail.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* READABLE IFRAME SANDBOX BODY */}
              <div className="flex-1 overflow-y-auto p-4 bg-white/50">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-h-[300px]">
                  {selectedEmail.body ? (
                    <div 
                      className="email-content text-slate-900 text-xs leading-relaxed overflow-x-auto select-text font-sans"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                    />
                  ) : (
                    <div className="text-slate-500 text-xs italic">{selectedEmail.snippet}</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-950 text-center">
              <Mail className="text-slate-300 animate-pulse mb-2" size={40} />
              <h3 className="text-sm font-black">לא נבחר מייל להצגה</h3>
              <p className="text-[10px] text-slate-500">בחר פריט דואר מהרשימה הימנית כדי לקרוא את תוכנו המלא.</p>
            </div>
          )}
        </div>

      </div>

      {/* OUTSIDE COMPOSE COMPOSE DRAWER */}
      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 z-[250] bg-slate-950/60 flex items-center justify-center p-3 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-2xl border border-slate-300 shadow-2xl flex flex-col min-h-0 overflow-hidden font-sans"
            >
              
              {/* MODAL HEADER */}
              <div className="bg-slate-950 p-3 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-[#C5A059]" />
                  <span className="text-xs font-black">הלחנת הודעה חדשה ב-Gmail</span>
                </div>
                <button 
                  onClick={() => setIsComposeOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ACTION COMPOSER FORM */}
              <form onSubmit={handleSendEmail} className="flex-1 flex flex-col min-h-0 p-3.5 space-y-2.5">
                
                {/* PRESETS BUTTON STRIP */}
                <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-950 font-black block mb-1">תבניות מהירות של נועה:</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate('delivery_update')}
                      className="bg-slate-950 text-white font-bold text-[10px] p-1 px-2.5 rounded-lg border border-slate-800 hover:bg-[#C5A059]/10 hover:text-slate-950 transition-all"
                    >
                      עדכון משלוחים יומי לספק
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate('inventory_shortage')}
                      className="bg-slate-950 text-white font-bold text-[10px] p-1 px-2.5 rounded-lg border border-slate-800 hover:bg-[#C5A059]/10 hover:text-slate-950 transition-all"
                    >
                      דוח חוסרי מלאי למחסנים
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate('customer_receipt')}
                      className="bg-slate-950 text-white font-bold text-[10px] p-1 px-2.5 rounded-lg border border-slate-800 hover:bg-[#C5A059]/10 hover:text-slate-950 transition-all"
                    >
                      אישור קבלת הזמנה ללקוח
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* NEMA'AN */}
                  <div>
                    <label className="text-[10px] text-slate-950 font-black mb-1 block">אל (כתובת נמען) *</label>
                    <input 
                      type="email"
                      required
                      placeholder="driver@gmail.com"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      className="w-full bg-slate-50 p-2 text-xs rounded-xl border border-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-sky-600 text-slate-950"
                    />
                  </div>
                  {/* SUBJECT */}
                  <div>
                    <label className="text-[10px] text-slate-950 font-black mb-1 block">נושא המכתב *</label>
                    <input 
                      type="text"
                      required
                      placeholder="הקלד כאן את נושא המייל..."
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      className="w-full bg-slate-50 p-2 text-xs rounded-xl border border-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-sky-600 text-slate-950"
                    />
                  </div>
                </div>

                {/* AI SMART COMPOSER ASSISTANCE */}
                <div className="bg-[#C5A059]/10 p-2 rounded-xl border border-[#C5A059]/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Brain size={14} className="text-[#C5A059] flex-shrink-0 animate-pulse" />
                    <input 
                      type="text"
                      placeholder="שאל את נועה לנסח טיוטה: 'תודה ללקוח', 'בקשת ריקול ספקים'..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="bg-transparent border-none text-[11px] text-slate-950 focus:outline-none w-full font-sans"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={isGeneratingAi || !aiPrompt}
                    className="p-1 px-3 bg-slate-950 hover:bg-[#C5A059] hover:text-slate-950 text-white font-bold text-[10px] rounded-lg active:scale-95 transition-all whitespace-nowrap"
                  >
                    {isGeneratingAi ? 'מנסחת...' : 'נסח עם נועה'}
                  </button>
                </div>

                {/* BODY INPUT */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-[10px] text-slate-950 font-black mb-1 block">תוכן המייל (HTML או טקסט פשוט) *</label>
                  <textarea
                    required
                    rows={8}
                    placeholder="הקלד את הודעת המייל כאן..."
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full flex-1 bg-slate-50 p-2 text-xs rounded-xl border border-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-sky-600 text-slate-950 resize-none min-h-[160px]"
                  />
                </div>

                {/* MODAL FOOTER */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold">הודעות נשלחות בשידור חי תחת הפרוטוקול המאושר.</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsComposeOpen(false)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isSending}
                      className="px-4 py-1.5 bg-slate-950 hover:bg-[#C5A059] hover:text-slate-950 text-[#FFFFFF] font-black text-xs rounded-xl active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="animate-spin" size={12} />
                          <span>שולח...</span>
                        </>
                      ) : (
                        <>
                          <SendIcon size={12} />
                          <span>שלח מייל</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </form>
              
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="signature text-center py-2 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-900 font-bold">
        באדיבות נועה ❤️
      </div>
    </div>
  );
};
