# DTMMax account lifecycle audit

Sana: 2026-07-29  
Branch: `redesign/dtmmax-v2`  
Scope: register, email verification, login/logout, password recovery, account
deletion, local/browser data and account recovery.

Bu hujjat kod auditi. Mahalliy yoki xalqaro qonunlarga muvofiqlik bo‘yicha
yuridik xulosa emas.

## Xulosa

DTMMax’ning asosiy auth va password-recovery oqimi production darajasiga yaqin:
email tasdiqlash, enumeration’ga chidamli forgot-password javobi, cheklangan
reset token, xavfli amalda parolni qayta so‘rash va JWT revocation mavjud.

Account lifecycle to‘liq emas. Auditda topilgan eng katta xavf — `TEACHER`
self-delete oqimining boshqa o‘quvchilar natijasini cascade orqali o‘chirishi —
shu branchda guard bilan yopildi. User-scoped browser keshini tozalash va
parol bilan qayta tasdiqlanadigan JSON data export ham qo‘shildi. Auth
javoblariga `no-store`, muvaffaqiyatli hard-delete javobiga esa
`Clear-Site-Data` qo‘shildi. Account/test/document bilan bog‘langan S3
obyektlari durable deletion outbox orqali retry qilinadi. Upload yaratilishi
bilan 48 soatlik unclaimed-cleanup job ham yoziladi: DB reference paydo bo‘lsa
obyekt saqlanadi, paydo bo‘lmasa avtomatik o‘chiriladi. Email change va alohida
device/session boshqaruvi hali qolgan.

Joriy baho:

- Auth va password recovery: **8/10**
- Session lifecycle: **7/10**
- Account deletion va data lifecycle: **7/10**
- Umumiy account lifecycle: **8/10**

## Nima mavjud

| Oqim | Holat | Kod dalili |
|---|---|---|
| Email tasdiqlash | Bor | `backend/src/routes/auth.ts` |
| Forgot-password anti-enumeration | Bor | Mavjud/mavjud emas emailga bir xil javob |
| Reset token expiry va single-use | Bor | Token hash bilan saqlanadi, 1 soatlik, ishlatilgach tozalanadi |
| Password change’da re-auth | Bor | Joriy parol qayta tekshiriladi |
| Eski JWT’larni bekor qilish | Bor | `User.authVersion` oshiriladi |
| Server-side logout | Bor | Token Redis blacklist’ga qo‘shiladi |
| Barcha qurilmalardan chiqish | Bor | `authVersion` atomik oshiriladi; barcha eski JWT’lar bekor bo‘ladi |
| Auth response cache himoyasi | Bor | Barcha `/api/auth/*` javoblari `Cache-Control: no-store` qaytaradi |
| Self-service account delete | Bor | `DELETE /api/auth/account`, parol talab qilinadi |
| Adminni self-delete’dan himoya | Bor | `ADMIN` uchun `403` |
| Google-only account himoyasi | Bor | O‘chirishdan oldin parol yaratish talab qilinadi |

## Kritik topilmalar

### AC-01 — Teacher self-delete collateral data yo‘qotishi — tuzatildi

**Oldingi fakt.** Admin user-delete oqimida o‘qituvchining testlari va boshqa
foydalanuvchilarning urinishlari borligi tekshirilgan, self-delete oqimida esa
bu guard yo‘q edi. `Test.creator` `onDelete: Cascade`.

**Joriy holat.** `getTeacherDeletionImpact()` boshqa userning urinishlari va
test sessiyalarini sanaydi. Self-delete kollateral ma’lumot bo‘lsa `409
ACCOUNT_DELETE_SHARED_TEST_DATA` qaytaradi. Admin delete ham endi urinish bilan
birga tugallanmagan sessiyalarni hisoblaydi. Policy uchun uchta regression test
bor.

Keyingi bosqichda admin uchun testlarni platforma egasiga transfer qilish yoki
teacher akkauntini anonymize/deactivate qilish oqimi qo‘shilishi mumkin.

### AC-02 — Object storage cleanup — asosiy oqimlar tuzatildi

**Oldingi fakt.** Account/test delete transaction DB yozuvlarini o‘chirgan,
lekin S3 objectlari uchun ishonchli cleanup bo‘lmagan. Document delete esa S3
xatosini yutib yuborib, DB yozuvini baribir o‘chirgan.

**Joriy holat.** Chat rasmlari DB’da `s3key:` stable ref bilan saqlanadi; eski
signed URL’dan key querysiz ajratiladi. Account, test va RAG document
o‘chirishda object keylar DB delete bilan bitta transaction ichida
`ObjectDeletionJob` outbox’iga yoziladi. Worker lease, exponential backoff va
reference-check bilan qayta urinadi; boshqa yozuv hali shu keyni ishlatsa
obyekt o‘chirilmaydi.

**Unclaimed upload guard.** Chat/test/document upload endpointlari yangi
obyektni darhol 48 soatlik delayed deletion job bilan ro‘yxatdan o‘tkazadi.
Worker muddat kelganda Message/TestQuestion/Document reference’larini
tekshiradi: reference bo‘lsa faqat job yopiladi, bo‘lmasa S3 obyekt o‘chiriladi.
Queue yozilmasa endpoint objectni qaytarib o‘chiradi va uploadni muvaffaqiyatli
deb ko‘rsatmaydi.

### AC-03 — Browser storage to‘liq tozalanmaydi — asosiy qismi tuzatildi

**Oldingi fakt.** Logout faqat `token` va `user`ni o‘chirgan. Account-delete UI
bundan tashqari faqat joriy essay draft’ni o‘chirgan.

**Joriy holat.** `clearUserLocalArtifacts(userId)` user-scoped test javoblari,
natijalar, reja, essay va teacher draft keshlarini logout/account-switch/delete
oqimlarida tozalaydi. Theme va onboarding kabi qurilma sozlamalari oddiy
logoutda saqlanadi. Account hard-delete muvaffaqiyatli bo‘lsa server
`Clear-Site-Data: "cache", "storage"` ham qaytaradi.

## Muhim bo‘shliqlar

| Imkoniyat | Joriy holat | Izoh |
|---|---|---|
| O‘chirishni bekor qilish / restore | Yo‘q | Hard-delete qaytarilmaydi; bu universal majburiy talab emas |
| Data export | Bor (JSON) | Parol qayta tekshiriladi; sirlar va server-only answer-keylar chiqarilmaydi |
| Emailni almashtirish + qayta tasdiqlash | Yo‘q | Account recovery uchun muhim |
| Faol sessiyalar/qurilmalar ro‘yxati | Yo‘q | Barchasini birdan tugatish bor, alohida qurilmalar ko‘rinmaydi |
| Bitta qurilmani masofadan chiqarish | Yo‘q | JWT per-device registry yo‘q |
| MFA | Yo‘q | Kamida `ADMIN` va `TEACHER` uchun tavsiya etiladi |
| Delete confirmation email | Yo‘q | Noto‘g‘ri o‘chirishni aniqlashga yordam beradi |
| Retention/backup deletion oynasi | Hujjatlanmagan | Privacy policy aniq muddat bermaydi |

## Privacy policy tekshiruvi

Quyidagi oldingi nomuvofiqliklar tuzatildi:

- aloqa manzili mahsulot domenidagi `support@dtmmax.uz`ga keltirildi;
- isbotlanmagan “barcha ma’lumotlar shifrlangan” da’vosi o‘rniga HTTPS,
  bcrypt, token muddati va role-based access kabi tekshiriladigan himoyalar
  yozildi;
- hard-delete’dan keyingi object storage/backup retentioni alohida texnik
  jarayon bo‘lishi ochiq aytildi;
- localStorage’da token bilan birga test javoblari, natijalar, o‘quv rejalari
  va draftlar bo‘lishi mumkinligi sanaldi.

Qolgan tashqi qaror: production backup’lari uchun aniq retention muddati
infratuzilma siyosati sifatida belgilanib, Privacy sahifasiga kiritilishi kerak.

## Tavsiya etilgan 3 batch

### Batch 1 — Data-loss va privacy guard

1. ~~Teacher self-delete collision guard.~~
2. ~~Account/test/document object inventory va retryable S3 cleanup.~~
3. ~~User-scoped browser storage’ni yagona funksiyada tozalash.~~
4. Endpoint-level regression test: boshqa studentning natijasi teacher delete
   bilan yo‘qolmasligi. Policy unit testlari qo‘shildi; route integration testi
   hali kerak.

### Batch 2 — Account recovery va nazorat

1. Email change + yangi emailni tasdiqlash + eski emailga security notice.
2. ~~“Barcha sessiyalardan chiqish” tugmasi.~~
3. Aktiv sessiyalar/devices modeli va bitta sessiyani bekor qilish.
4. Admin/teacher uchun MFA.

### Batch 3 — User data lifecycle

1. ~~User uchun JSON data export.~~
2. Mahsulot qaroriga ko‘ra 14 kunlik deletion grace yoki hard-delete’ni
   saqlab, ikki bosqichli tasdiq va email xabarnoma.
3. Retention, backup va object deletion muddatlarini privacy policy’da aniq
   yozish.
4. Delete holati uchun minimal, PII’siz operatsion audit.

## Qabul mezonlari

- Teacher akkaunti o‘chirilganda boshqa user natijasi yo‘qolmaydi.
- Account delete’dan keyin userga tegishli DB qatorlari, object storage
  fayllari va browser keshlar uchun tekshiriladigan deletion report bor.
- Password reset/change’dan keyin eski token bilan protected API `401`
  qaytaradi.
- Logout server tokenini bekor qiladi va lokal user-scoped ma’lumotlar
  siyosatga muvofiq tozalanadi.
- Privacy policy real kod va infratuzilma holatidan kuchliroq va’da bermaydi.
