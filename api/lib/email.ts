import nodemailer from 'nodemailer';

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function sendWelcomeEmail(to: string, name: string, username: string, password: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return; // Email not configured — skip silently

  await transporter.sendMail({
    from: `"חברותא – ניהול חדרים" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'ברוך הבא – פרטי כניסה למערכת חברותא',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">ברוך הבא, ${name}!</h2>
        <p>נוצר עבורך חשבון במערכת ניהול החדרים של חברותא.</p>
        <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>שם משתמש:</strong> ${username}</p>
          <p style="margin: 0;"><strong>סיסמה:</strong> ${password}</p>
        </div>
        <p>כנס לאפליקציה בכתובת: <a href="https://hevrutah-rooms.vercel.app">hevrutah-rooms.vercel.app</a></p>
        <p style="color: #64748b; font-size: 13px;">לשינוי סיסמה פנה למנהל המערכת.</p>
      </div>
    `,
  });
}

export async function sendPasswordEmail(to: string, name: string, newPassword: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  await transporter.sendMail({
    from: `"חברותא – ניהול חדרים" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'איפוס סיסמה – מערכת חברותא',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e3a5f;">שלום, ${name}</h2>
        <p>קיבלנו בקשה לאיפוס הסיסמה שלך.</p>
        <div style="background: #f0f4ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0;"><strong>הסיסמה החדשה שלך:</strong> ${newPassword}</p>
        </div>
        <p>כנס לאפליקציה בכתובת: <a href="https://hevrutah-rooms.vercel.app">hevrutah-rooms.vercel.app</a></p>
        <p style="color: #64748b; font-size: 13px;">אם לא ביקשת איפוס סיסמה, פנה למנהל המערכת.</p>
      </div>
    `,
  });
}
