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

Account lifecycle to‘liq emas. Eng katta xavf — `TEACHER` self-delete oqimi
test o‘chirishdagi mavjud collision guard’ni chetlab o‘tishi. Shu sabab
o‘qituvchi akkauntini o‘chirganda uning testlari va boshqa o‘quvchilarning
natijalari foreign-key cascade orqali o‘chishi mumkin.

Joriy baho:

- Auth va password recovery: **8/10**
- Session lifecycle: **7/10**
- Account deletion va data lifecycle: **5/10**
- Umumiy account lifecycle: **7/10**

## Nima mavjud

| Oqim | Holat | Kod dalili |
|---|---|---|
| Email tasdiqlash | Bor | `backend/src/routes/auth.ts` |
| Forgot-password anti-enumeration | Bor | Mavjud/mavjud emas emailga bir xil javob |
| Reset token expiry va single-use | Bor | Token hash bilan saqlanadi, 1 soatlik, ishlatilgach tozalanadi |
| Password change’da re-auth | Bor | Joriy parol qayta tekshiriladi |
| Eski JWT’larni bekor qilish | Bor | `User.authVersion` oshiriladi |
| Server-side logout | Bor | Token Redis blacklist’ga qo‘shiladi |
| Self-service account delete | Bor | `DELETE /api/auth/account`, parol talab qilinadi |
| Adminni self-delete’dan himoya | Bor | `ADMIN` uchun `403` |
| Google-only account himoyasi | Bor | O‘chirishdan oldin parol yaratish talab qilinadi |

## Kritik topilmalar

### AC-01 — Teacher self-delete collateral data yo‘qotishi

**Fakt.** Admin user-delete oqimida o‘qituvchining testlari va boshqa
foydalanuvchilarning urinishlari borligi tekshiriladi. Self-delete oqimida bu
guard yo‘q. `Test.creator` esa `onDelete: Cascade`.

Natijada teacher self-delete testlarni, test savollarini, sessiyalarni va
boshqa o‘quvchilarning natijalarini ham cascade orqali o‘chirishi mumkin.

**Tavsiya:** self-delete’da admin oqimidagi collision guard’ni qayta ishlatish.
Bog‘langan student natijasi bo‘lsa testlarni platforma egasiga transfer qilish
yoki akkauntni anonymize/deactivate qilish; cascade delete qilmaslik.

### AC-02 — Object storage cleanup isbotlanmagan

**Fakt.** Account-delete transaction DB yozuvlarini o‘chiradi, lekin S3
objectlari uchun `deleteFromS3` chaqiruvi yo‘q. Test delete route’da ham object
cleanup topilmadi.

**Taxmin.** Chat fayllari yoki savol rasmlari DB qatori o‘chgandan keyin S3’da
orphan bo‘lib qolishi mumkin. Aniq sonni object-key inventarizatsiyasisiz
aytib bo‘lmaydi.

**Tavsiya:** deletion manifest tuzish, transactiondan oldin object keylarni
yig‘ish, DB commitdan keyin retryable cleanup job ishlatish va yakuniy cleanup
holatini audit qilish.

### AC-03 — Browser storage to‘liq tozalanmaydi

**Fakt.** Logout faqat `token` va `user`ni o‘chiradi. Account-delete UI bundan
tashqari faqat joriy essay draft’ni o‘chiradi. User-scoped
`dtmmax_done_*`, `dtmmax_test_result_*`, `dtmmax_todo_*` va boshqa keshlar
qurilmada qolishi mumkin.

**Tavsiya:** bitta `clearUserLocalArtifacts(userId)` funksiyasi va logout,
account-delete, account-switch oqimlarida yagona chaqiriq. Server logout
javobiga ehtiyotkor `Clear-Site-Data` siyosatini alohida baholash.

## Muhim bo‘shliqlar

| Imkoniyat | Joriy holat | Izoh |
|---|---|---|
| O‘chirishni bekor qilish / restore | Yo‘q | Hard-delete qaytarilmaydi; bu universal majburiy talab emas |
| Data export | Faqat admin | User o‘z ma’lumotini yuklab ololmaydi |
| Emailni almashtirish + qayta tasdiqlash | Yo‘q | Account recovery uchun muhim |
| Faol sessiyalar/qurilmalar ro‘yxati | Yo‘q | Faqat password change/reset hammasini bekor qiladi |
| Bitta qurilmani masofadan chiqarish | Yo‘q | JWT per-device registry yo‘q |
| MFA | Yo‘q | Kamida `ADMIN` va `TEACHER` uchun tavsiya etiladi |
| Delete confirmation email | Yo‘q | Noto‘g‘ri o‘chirishni aniqlashga yordam beradi |
| Retention/backup deletion oynasi | Hujjatlanmagan | Privacy policy aniq muddat bermaydi |

## Privacy policy nomuvofiqliklari

- `support@dtmmax.pro` domeni mahsulotning `dtmmax.uz` domeniga mos emas.
- “Barcha ma’lumotlar shifrlangan holda saqlanadi” da’vosi ilova kodidan
  to‘liq isbotlanmaydi; hosting va backup konfiguratsiyasi bilan tasdiqlash
  kerak.
- “Akkaunt va barcha ma’lumotlar o‘chiriladi” da’vosi object storage va backup
  retention tasdiqlanmaguncha haddan tashqari qat’iy.
- LocalStorage’da siyosatda sanalganlardan ko‘proq o‘quv/test holati saqlanadi.

## Tavsiya etilgan 3 batch

### Batch 1 — Data-loss va privacy guard

1. Teacher self-delete collision guard.
2. Test/chat file object inventory va retryable S3 cleanup.
3. User-scoped browser storage’ni yagona funksiyada tozalash.
4. Regression test: boshqa studentning natijasi teacher delete bilan
   yo‘qolmasligi.

### Batch 2 — Account recovery va nazorat

1. Email change + yangi emailni tasdiqlash + eski emailga security notice.
2. “Barcha sessiyalardan chiqish” tugmasi.
3. Aktiv sessiyalar/devices modeli va bitta sessiyani bekor qilish.
4. Admin/teacher uchun MFA.

### Batch 3 — User data lifecycle

1. User uchun JSON/ZIP data export.
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
