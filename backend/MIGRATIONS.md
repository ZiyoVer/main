# DTMMax database migration siyosati

## Runtime qoidasi

Deploy faqat quyidagi deterministik oqim bilan ishga tushadi:

```sh
npx prisma migrate deploy
node dist/app.js
```

`prisma db push`, avtomatik schema reset va migration fallback runtime’da
ishlatilmaydi. Migration bajarilmasa servis fail-closed holatda to‘xtaydi.

## Noldan tiklanadigan zanjir

Tarixiy repo’da boshlang‘ich migration bo‘lmagan. Shu sabab bo‘sh PostgreSQL
bazasida birinchi eski migration `Test` jadvalini topa olmay yiqilgan. Zanjir
quyidagi immutable repair migrationlar bilan tiklandi:

- `20250316000000_initial_schema` — birinchi eski migrationdan oldingi schema;
- `20260417150000_drop_test_type_enum_default` — eski enum/text conversion uchun bridge;
- `20260715115900_sync_pre_learning_schema` — learning-session migrationidan oldingi catch-up;
- `20260718180000_add_auth_version` — password/security o‘zgarishida JWT revocation epoch’i.

Repair migrationlar bilan barcha migrationlar disposable PostgreSQL schema’da
noldan replay qilingan. `prisma migrate status` up-to-date va joriy
`schema.prisma` bilan diff `No difference detected` bo‘lishi shart.

## Har bir schema o‘zgarishi

1. `schema.prisma`ni o‘zgartiring.
2. Yangi, forward-only migration yarating.
3. Bo‘sh disposable DB’da butun zanjirni replay qiling.
4. Joriy schema bilan zero-diff tekshiring.
5. Faqat shundan keyin branch/preview’ga deploy qiling.

Mavjud migration faylini tahrirlash taqiqlanadi: production checksum tarixi
buziladi. Data-loss SQL alohida backup va rollback rejasisiz qabul qilinmaydi.

## Preview muhiti

Preview DB production’dan alohida ekanligi isbotlangandan keyingina reset qilish
mumkin. Reset deploy scriptiga yoki environment variable’ga yashirilmaydi; u
bir martalik, ko‘rinadigan operator amali bo‘lishi kerak.

## Production cutover — avtomatik emas

Production schema ilgari `db push` bilan yaratilgan bo‘lishi mumkin. Oldingi
sanali repair migrationlarni production’da oddiy `migrate deploy` bilan ishga
tushirish mavjud jadvallar ustida qayta `CREATE/ALTER` qilishga urinish bo‘ladi.
Railway `production` muhitida `start.sh` shu sabab
`PRODUCTION_MIGRATION_RECONCILED=true` bo‘lmaguncha deployni migrationdan oldin
fail-closed to‘xtatadi. Bu flag faqat quyidagi jarayon to‘liq tugagach qo‘yiladi.

Merge/deploy’dan oldin alohida tasdiqlangan operatsion jarayon talab qilinadi:

1. DB backup yoki production clone olish.
2. `_prisma_migrations` va real schema’ni read-only inventarizatsiya qilish.
3. Clone’da migration history reconciliation’ni sinash.
4. Repair migration effektlari real schema’da allaqachon borligini diff bilan isbotlash.
5. Faqat shundan keyin tegishli repair migrationlarni `prisma migrate resolve --applied`
   orqali metadata sifatida belgilash.
6. `migrate status`, schema diff va smoke testlar muvaffaqiyatli bo‘lgach strict
   deployga o‘tish.

Qaysi migrationni `resolve` qilish inventarizatsiya natijasiga bog‘liq. Shu sabab
production uchun ko‘r-ko‘rona ko‘chiriladigan `resolve` komandalar bu hujjatda
berilmaydi.
