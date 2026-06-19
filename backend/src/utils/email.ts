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
        subject: 'Emailingizni tasdiqlang — DtmMax',
        text: `DtmMax — Emailingizni tasdiqlang\n\nSalom, ${name}!\n\nEmail manzilingizni tasdiqlash uchun quyidagi havolaga o'ting:\n\n${link}\n\nTugma ishlamasa, ushbu havolani brauzeringizga joylang.\nHavola 24 soat davomida amal qiladi.\n\nAgar siz ro'yxatdan o'tmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.\n\n© ${year} DtmMax`,
        html: `
<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Emailingizni tasdiqlang</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #ececec;border-radius:16px">
          <!-- Wordmark -->
          <tr>
            <td style="padding:36px 40px 8px 40px">
              <span style="font-size:20px;font-weight:700;letter-spacing:-0.4px;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">Dtm<span style="color:#F15A24">Max</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 8px 40px">
              <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">Emailingizni tasdiqlang</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                Salom, ${name}! DtmMax akkauntingizni ishga tushirish uchun email manzilingizni tasdiqlang.
              </p>
              <!-- Green button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#16A34A" style="border-radius:10px">
                    <a href="${link}" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                      Emailni tasdiqlash
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding:28px 40px 8px 40px">
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                Tugma ishlamasa, quyidagi havolani brauzerga joylang:
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#16A34A;word-break:break-all;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                <a href="${link}" target="_blank" style="color:#16A34A;text-decoration:none">${link}</a>
              </p>
            </td>
          </tr>
          <!-- Hairline divider -->
          <tr>
            <td style="padding:24px 40px 0 40px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #ececec;font-size:0;line-height:0">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <!-- Note -->
          <tr>
            <td style="padding:16px 40px 36px 40px">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                Havola 24 soat davomida amal qiladi. Agar siz ro'yxatdan o'tmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.
              </p>
            </td>
          </tr>
        </table>
        <!-- Footer wordmark -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%">
          <tr>
            <td align="center" style="padding:20px 40px 0 40px">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#b8bcc4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                © ${year} DtmMax
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
