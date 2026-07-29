import { Resend, type ErrorResponse } from 'resend'
import { AUTH_ERROR_CODES } from './authErrors'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'DTMMax <noreply@dtmmax.uz>'
// Fallback jonli www xost (apex dtmmax.uz hali sozlanmagan). FRONTEND_URL Railway'da o'rnatilsin.
const BASE_URL = process.env.FRONTEND_URL || 'https://www.dtmmax.uz'

export type EmailDeliveryKind = 'verification' | 'password_reset'

export class EmailDeliveryError extends Error {
    readonly code = AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED
    readonly provider = 'resend' as const
    readonly kind: EmailDeliveryKind
    readonly providerErrorName: string
    readonly statusCode: number | null

    constructor(kind: EmailDeliveryKind, providerError: ErrorResponse) {
        super('Email yetkazib berish xizmati so\'rovni qabul qilmadi')
        this.name = 'EmailDeliveryError'
        this.kind = kind
        this.providerErrorName = providerError.name
        this.statusCode = providerError.statusCode
    }

    toSafeLog() {
        return {
            code: this.code,
            provider: this.provider,
            kind: this.kind,
            providerErrorName: this.providerErrorName,
            statusCode: this.statusCode,
        }
    }
}

function assertDelivered(kind: EmailDeliveryKind, error: ErrorResponse | null): void {
    if (error) throw new EmailDeliveryError(kind, error)
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }
        return entities[char]
    })
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
    const link = `${BASE_URL}/email-tasdiqlash/${token}`
    const safeName = escapeHtml(name)
    const safeLink = escapeHtml(link)
    const year = new Date().getFullYear()
    const result = await resend.emails.send({
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
                Salom, ${safeName}! DtmMax akkauntingizni ishga tushirish uchun email manzilingizni tasdiqlang.
              </p>
              <!-- Green button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#16A34A" style="border-radius:10px">
                    <a href="${safeLink}" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
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
                <a href="${safeLink}" target="_blank" style="color:#16A34A;text-decoration:none">${safeLink}</a>
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
    assertDelivered('verification', result.error)
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
    const link = `${BASE_URL}/parol-tiklash/${token}`
    const safeName = escapeHtml(name)
    const safeLink = escapeHtml(link)
    const year = new Date().getFullYear()
    const result = await resend.emails.send({
        from: FROM,
        to,
        subject: 'Parolni tiklash — DtmMax',
        text: `DtmMax — Parolni tiklash\n\nSalom, ${name}!\n\nDtmMax akkauntingiz uchun parolni tiklash so'rovi olindi.\nYangi parol o'rnatish uchun quyidagi havolaga o'ting:\n\n${link}\n\nTugma ishlamasa, ushbu havolani brauzeringizga joylang.\nHavola 1 soat davomida amal qiladi.\n\nAgar siz so'ramagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.\n\n© ${year} DtmMax`,
        html: `
<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Parolni tiklash</title>
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
              <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">Parolni tiklash</h1>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                Salom, ${safeName}! DtmMax akkauntingiz uchun parolni tiklash so'rovi olindi. Yangi parol o'rnatish uchun quyidagi tugmani bosing.
              </p>
              <!-- Orange button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#F15A24" style="border-radius:10px">
                    <a href="${safeLink}" target="_blank" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                      Parolni tiklash
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
              <p style="margin:0;font-size:13px;line-height:1.5;color:#F15A24;word-break:break-all;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                <a href="${safeLink}" target="_blank" style="color:#F15A24;text-decoration:none">${safeLink}</a>
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
                Havola 1 soat davomida amal qiladi. Agar siz so'ramagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.
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
    assertDelivered('password_reset', result.error)
}
