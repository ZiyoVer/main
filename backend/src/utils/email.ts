import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'DTMMax <noreply@dtmmax.uz>'
const BASE_URL = process.env.FRONTEND_URL || 'https://dtmmax.uz'

export async function sendVerificationEmail(to: string, name: string, token: string) {
    const link = `${BASE_URL}/email-tasdiqlash/${token}`
    const year = new Date().getFullYear()
    await resend.emails.send({
        from: FROM,
        to,
        subject: 'DTMMax akkauntingizni faollashtiring',
        text: `DTMMax — Email tasdiqlash\n\nSalom, ${name}!\n\nDTMMax platformasiga xush kelibsiz!\nEmail manzilingizni tasdiqlash uchun quyidagi havolaga o'ting:\n\n${link}\n\nHavola 24 soat davomida amal qiladi.\n\nAgar siz ro'yxatdan o'tmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.\n\n© ${year} DTMMax`,
        html: `
<!DOCTYPE html>
<html lang="uz">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
        <tr><td style="background:#c0392b;padding:28px 32px;text-align:center">
          <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">DTMMax</span>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a">Assalomu alaykum, ${name}!</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6">
            DTMMax platformasiga xush kelibsiz! Email manzilingizni tasdiqlash uchun quyidagi tugmani bosing:
          </p>
          <a href="${link}" style="display:inline-block;background:#c0392b;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;margin-bottom:24px">
            Email manzilni tasdiqlash
          </a>
          <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.5">
            Agar tugma ishlamasa, quyidagi havolani brauzeringizga nusxalang:
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#c0392b;word-break:break-all">
            ${link}
          </p>
          <p style="margin:0;font-size:13px;color:#aaa">
            Havola 24 soat davomida amal qiladi. Agar siz ro'yxatdan o'tmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.
          </p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee;text-align:center">
          <p style="margin:0;font-size:12px;color:#bbb">© ${year} DTMMax. Barcha huquqlar himoyalangan.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        tags: [{ name: 'category', value: 'transactional' }],
        headers: {
            'X-Entity-Ref-ID': token.substring(0, 16),
        }
    })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
    const link = `${BASE_URL}/parol-tiklash/${token}`
    const year = new Date().getFullYear()
    await resend.emails.send({
        from: FROM,
        to,
        subject: 'DTMMax — Parol tiklash so\'rovi',
        text: `DTMMax — Parol tiklash\n\nSalom, ${name}!\n\nDTMMax akkauntingiz uchun parol tiklash so'rovi olindi.\nYangi parol o'rnatish uchun quyidagi havolaga o'ting:\n\n${link}\n\nHavola 1 soat davomida amal qiladi.\nAgar siz so'rov yubormagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.\n\n© ${year} DTMMax`,
        html: `
<!DOCTYPE html>
<html lang="uz">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
        <tr><td style="background:#c0392b;padding:28px 32px;text-align:center">
          <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">DTMMax</span>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a">Parolni tiklash</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#555;line-height:1.6">
            Salom, ${name}!
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6">
            DTMMax akkauntingiz uchun parolni tiklash so'rovi olindi. Quyidagi tugmani bosing:
          </p>
          <a href="${link}" style="display:inline-block;background:#c0392b;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;margin-bottom:24px">
            Yangi parol o'rnatish
          </a>
          <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.5">
            Agar tugma ishlamasa, quyidagi havolani brauzeringizga nusxalang:
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#c0392b;word-break:break-all">
            ${link}
          </p>
          <p style="margin:0;font-size:13px;color:#aaa">
            Havola <strong>1 soat</strong> davomida amal qiladi. Agar siz so'rov yubormagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring — akkauntingiz xavfsiz.
          </p>
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee;text-align:center">
          <p style="margin:0;font-size:12px;color:#bbb">© ${year} DTMMax. Barcha huquqlar himoyalangan.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        tags: [{ name: 'category', value: 'transactional' }],
        headers: {
            'X-Entity-Ref-ID': token.substring(0, 16),
        }
    })
}
