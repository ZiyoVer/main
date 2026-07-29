# DTMMax production legal va payment checklist

Sana: 2026-07-29

Holat: production to‘lovini yoqishdan oldingi texnik checklist

Bu hujjat yuridik xulosa emas. Yakuniy oferta, maxfiylik siyosati, fiskal chek
va refund tartibini O‘zbekiston bo‘yicha yurist/buxgalter ko‘rib chiqishi kerak.

## Production paymentni hozir bloklaydigan ma’lumotlar

`frontend/src/pages/Oferta.tsx` hali shablon rekvizitlarga ega. Quyidagi
ma’lumotlar foydalanuvchidan olinmaguncha va tekshirilmaguncha
`PRO_ENFORCED=true` qilinmaydi:

1. LangForge MChJning davlat ro‘yxatidagi to‘liq nomi.
2. STIR (INN).
3. Yuridik manzil.
4. Hisob raqami, bank nomi va MFO.
5. Rasmiy aloqa telefoni.
6. `support@dtmmax.uz` real qabul qilishi tasdig‘i.
7. Refund ko‘rib chiqish muddati va mas’ul aloqa.
8. Fiskal chek/OFD oqimi kim tomonidan va qaysi vaqtda bajarilishi.

Placeholder rekvizitlar bilan pul qabul qilish production-ready hisoblanmaydi.

## Koddan tasdiqlangan billing kontrakti

- Narx: `35 000 UZS`.
- Muddat: `30 kun`.
- Hozir avtomatik recurring yechish yo‘q; foydalanuvchi qayta to‘laydi.
- Provider: Paylov.
- Karta raqami va OTP DTMMax bazasiga yozilmaydi.
- Production entitlement faqat Paylov server tasdig‘idan keyin faollashadi.
- `PRO_ENFORCED=false` vaqtida beta foydalanuvchilar to‘lovsiz ochiq.

## Paylov onboarding

Paylov hujjatiga ko‘ra emaildagi token bir martalik onboarding tokenidir.
U bilan `username` va kuchli `password` o‘rnatilib, faqat bir marta
`consumer_key` va `consumer_secret` olinadi:

<https://developer.paylov.uz/subscribe/authorization>

Secretlar faqat Railway Variables’da saqlanadi. Chatga, repo fayliga yoki
frontend bundle’ga yozilmaydi.

## Privacy uchun qolgan qarorlar

1. PostgreSQL backup retention muddati.
2. Object storage fayllari uchun deletion/retry muddati.
3. Xavfsizlik va audit loglarining retention muddati.
4. AI provayderlariga yuboriladigan kontent bo‘yicha yakuniy data-processing
   bayoni.
5. Voyaga yetmagan foydalanuvchilar uchun rozilik/yosh siyosati.

Bu muddatlar aniqlangach `frontend/src/pages/Privacy.tsx`dagi vaqtinchalik
retention izohi aniq raqamlar bilan almashtiriladi.
