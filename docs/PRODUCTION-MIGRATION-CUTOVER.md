# Production migration reconciliation runbook

Bu runbook `redesign/dtmmax-v2` commit `701a6e85c8e2dba8b1d391f5be1824951e67f9ae`
uchun 2026-07-29 kuni olingan production inventarizatsiyasi va lokal clone
rehearsal natijasiga bog‘langan. `20260729110000_add_object_deletion_jobs`
additive migrationi shu clone’ning alohida nusxasida qayta tekshirildi. Boshqa
schema yoki migration qo‘shilsa, bu runbookni yana tekshirmasdan ishlatish
mumkin emas.

## Tasdiqlangan holat

- Production `_prisma_migrations` jadvalida faqat
  `20250316000001_add_test_type` bor; u `finished_at = NULL`,
  `rolled_back_at = NULL`, `applied_steps_count = 0` holatida.
- Production real schema’sida dastlabki 10 migration effekti allaqachon mavjud.
- Production’da quyidagi 4 ustun yo‘q:
  - `User.authVersion`
  - `User.googleSubject`
  - `User.passwordConfigured`
  - `AiTestSession.sourceMessageId`
- Quyidagi 6 migration hali real DDL sifatida bajarilishi kerak:
  - `20260718180000_add_auth_version`
  - `20260718181000_add_google_identity`
  - `20260718190000_trust_ai_test_sessions`
  - `20260724183000_add_tts_daily_quota`
  - `20260725120000_remove_tts_daily_quota`
  - `20260729110000_add_object_deletion_jobs`

Production backup lokal clone’ga tiklandi. Reconciliation aynan shu tartibda
bajarildi. Dastlabki 5 migration xatosiz qo‘llandi. Keyin shu tayyor clone’dan
`dtmmax_object_queue_clone` nusxasi olindi va oltinchi migration normal
`prisma migrate deploy` orqali qo‘llandi. Avvalgi 24 biznes jadvalidagi qatorlar
soni o‘zgarmadi, `ObjectDeletionJob` jadvali bo‘sh yaratildi va yakuniy
`migrate diff` `No difference detected` qaytardi.

Rehearsal backup:

- Fayl: `~/Library/Application Support/DTMMax/Backups/production-pre-reconcile-20260729.dump`
- SHA-256: `ae01d870bc7eda43afc7fa12b4406b454315614ab4c1a2de6f2d459fa6d587a8`
- `pg_restore --list`: 178 entry

Backup lokal kompyuterda `0600`, uning papkasi `0700` bo‘lishi kerak. Fayl
repoga commit qilinmaydi.

## Cutover oldidan majburiy shartlar

1. Foydalanuvchi production cutover’ga alohida ruxsat beradi.
2. Paylov yoki boshqa tashqi oqimda faol operatsiya yo‘qligi tekshiriladi.
3. Yangi transaction-consistent backup olinadi va restore bilan tekshiriladi.
4. Quyidagi buyruqlar aynan repo root’idan, `redesign/dtmmax-v2`ning tasdiqlangan
   commitida bajariladi.
5. Buyruqlarda `Postgres` servisi tanlanadi. `main` servisining private
   `DATABASE_URL`ini lokal mashinadan ishlatib bo‘lmaydi.

## 1. Read-only preflight

```sh
git status --short
git rev-parse HEAD

railway run -s Postgres -e production sh -lc '
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  cd backend
  npx prisma migrate status
'
```

`migrate status` hozir xato kod bilan chiqishi kutiladi, chunki production
history reconciled emas. Bu bosqichda hech qanday `resolve` yoki `deploy`
bajarilmaydi.

## 2. Failed migration yozuvini yopish

Quyidagi buyruq faqat inventarizatsiyada ko‘rilgan yarim yozuvni
`rolled_back` sifatida belgilaydi; real schema’ga DDL qo‘llamaydi.

```sh
railway run -s Postgres -e production sh -lc '
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  cd backend
  npx prisma migrate resolve --rolled-back 20250316000001_add_test_type
'
```

## 3. Allaqachon mavjud migrationlarni metadata sifatida belgilash

Quyidagi 10 migration clone’da schema taqqoslash orqali allaqachon mavjud deb
isbotlangan:

```sh
railway run -s Postgres -e production sh -lc '
  set -eu
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  cd backend

  npx prisma migrate resolve --applied 20250316000000_initial_schema
  npx prisma migrate resolve --applied 20250316000001_add_test_type
  npx prisma migrate resolve --applied 20260320103000_add_chat_subject2_and_embeddings
  npx prisma migrate resolve --applied 20260417133000_split_test_scales
  npx prisma migrate resolve --applied 20260417150000_drop_test_type_enum_default
  npx prisma migrate resolve --applied 20260417164500_test_type_text_compat
  npx prisma migrate resolve --applied 20260428120000_add_test_sessions
  npx prisma migrate resolve --applied 20260516120000_add_notification_target
  npx prisma migrate resolve --applied 20260715115900_sync_pre_learning_schema
  npx prisma migrate resolve --applied 20260715120000_add_learning_sessions
'
```

Bu bosqichdan keyin `migrate status` aynan 6 pending migration ko‘rsatishi
kerak. Boshqa natija chiqsa to‘xtash kerak.

## 4. Qolgan additive migrationlarni qo‘llash

```sh
railway run -s Postgres -e production sh -lc '
  set -eu
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  cd backend

  npx prisma migrate deploy
  npx prisma migrate status
  npx prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --exit-code
'
```

Qabul mezoni:

- `All migrations have been successfully applied`
- `Database schema is up to date`
- `No difference detected`
- buyruq exit code `0`

## 5. Ilova smoke-check

Production’ga yangi kod deploy qilinishidan oldin:

- `User.authVersion` mavjud va eski userlar uchun `0`;
- `User.passwordConfigured` mavjud va eski userlar uchun `true`;
- `User.googleSubject` nullable va unique;
- `AiTestSession.sourceMessageId` nullable, unique va `Message(id)`ga foreign key;
- `ObjectDeletionJob` mavjud, deploydan keyin dastlab bo‘sh va worker uchun
  `status/nextAttemptAt`, `status/leaseExpiresAt` indekslari bor;
- login, `/api/auth/me`, public test ochilishi va read-only admin statistika
  so‘rovi ishlashi tekshiriladi.

Schema tasdiqlangachgina gate yoqiladi:

```sh
railway variable set \
  -s main \
  -e production \
  --skip-deploys \
  PRODUCTION_MIGRATION_RECONCILED=true
```

Shundan keyin ham `main`ga merge/deploy uchun foydalanuvchining alohida
tasdig‘i talab qilinadi.

## To‘xtash va rollback qoidasi

- `resolve` migration history metadata’sini o‘zgartiradi; u real jadvallarni
  ortga qaytarmaydi.
- `migrate deploy`da xato chiqsa yangi deploy qilinmaydi va
  `PRODUCTION_MIGRATION_RECONCILED` qo‘yilmaydi.
- Qisman qo‘llangan migration bo‘lsa avval real schema va
  `_prisma_migrations` qayta inventarizatsiya qilinadi. Ko‘r-ko‘rona
  `resolve --applied` yoki `resolve --rolled-back` bajarilmaydi.
- Data yoki schema zarar ko‘rgan bo‘lsa servis maintenance holatida qoladi va
  tekshirilgan backup alohida clone’ga restore qilinadi. Production ustiga
  restore faqat alohida tasdiq bilan bajariladi.
