# DB Migratsiyalar — P0-06 (schema drift oldini olish)

## Muammo (eski holat)
`start.sh` har deployda `prisma db push`ni **shartsiz** ishlatardi. `db push`
migration tarixini chetlab schema'ni jonli DBga majburan o'rnatadi — bu:
- **drift** yaratadi (jonli DB va migration tarixi bir-biriga mos kelmaydi),
- jonli DBni hech qachon to'liq migration-managed qilmaydi,
- ba'zan kutilmagan ustun/jadval o'zgarishlari (data xavfi) olib keladi.

## Yangi holat (`start.sh`)
```sh
if npx prisma migrate deploy; then
    # muvaffaqiyatli -> db push O'TKAZIB YUBORILADI (drift yo'q)
else
    npx prisma db push --skip-generate   # faqat FALLBACK (oraliq davr)
fi
```

**Bu o'zgarish orqaga-mos va xavfsiz:** agar jonli DB hali baseline-resolve
qilinmagan bo'lsa, `migrate deploy` fail bo'ladi va `db push` fallback ishlaydi —
ya'ni worst case = eski xatti-harakat. Hech narsa buzilmaydi.

---

## ⚠️ MUHIM workflow o'zgarishi
To'liq migration rejimiga o'tgandan keyin **har schema o'zgarishi uchun migration
yaratish SHART**. Aks holda `migrate deploy` "no pending" deb o'tadi, `db push`
skip bo'ladi va o'zgarish jonli DBga **jimgina qo'llanmaydi**.

```bash
# Har schema.prisma o'zgarishidan keyin (local Postgres bilan):
npx prisma migrate dev --name <ozgarish_nomi>
git add prisma/migrations && git commit
```

---

## Jonli DBni to'liq migration-managed qilish (BIR MARTALIK)

> Bu qadamlar ixtiyoriy va shoshilinch emas — start.sh allaqachon xavfsiz
> fallback bilan ishlaydi. Lekin drift'ni butunlay to'xtatish uchun bir marta
> bajarilishi kerak. **Avval jonli DB backup oling.**

Hozir jonli DBda schema `db push` orqali to'liq mavjud, lekin ba'zi o'zgarishlar
(`User.status`, `AdminAuditLog`, `AiDailyUsage`, `AiSubmitDedup`, `Payment`,
`Subscription`, `AiTestSession` va h.k.) uchun migration fayli **yo'q**.

### 1-qadam — yetishmayotgan migration'ni yaratish (local shadow DB)
```bash
# Docker bilan vaqtinchalik Postgres:
docker run --name dtmmax-shadow -e POSTGRES_PASSWORD=pass \
  -e POSTGRES_DB=dtmmax -p 5433:5432 -d postgres:16

export DATABASE_URL="postgresql://postgres:pass@localhost:5433/dtmmax"
cd backend
# Mavjud 6 migrationni qo'llaydi + schema bilan farqni yangi migration qiladi:
npx prisma migrate dev --name sync_current_schema
git add prisma/migrations && git commit -m "migration: sync current schema"

docker rm -f dtmmax-shadow
```

### 2-qadam — jonli DBni baseline-resolve qilish (Railway shell / DATABASE_URL)
Jonli DBda schema allaqachon mavjud (db push qo'ygan), shuning uchun migration
SQL'larini **qayta ishlatmasdan**, ularni "applied" deb belgilaymiz:

```bash
# Jonli DATABASE_URL bilan. Har bir migration uchun (6 ta + sync_current_schema):
npx prisma migrate resolve --applied 20250316000001_add_test_type
npx prisma migrate resolve --applied 20260320103000_add_chat_subject2_and_embeddings
npx prisma migrate resolve --applied 20260417133000_split_test_scales
npx prisma migrate resolve --applied 20260417164500_test_type_text_compat
npx prisma migrate resolve --applied 20260428120000_add_test_sessions
npx prisma migrate resolve --applied 20260516120000_add_notification_target
npx prisma migrate resolve --applied <sync_current_schema_nomi>
```

> Agar `_prisma_migrations` jadvali allaqachon bu migrationlarni "applied" deb
> bilsa (oldin `migrate deploy` ishlagan bo'lsa), faqat yangi
> `sync_current_schema`ni resolve qilish kifoya. Har `resolve`dan oldin
> `npx prisma migrate status` bilan holatni tekshiring.

### 3-qadam — tekshirish
```bash
npx prisma migrate status   # "Database schema is up to date!" bo'lishi kerak
```
Shundan keyin deploylarda `migrate deploy` muvaffaqiyatli o'tadi va `db push`
umuman ishlamaydi — drift to'liq to'xtaydi.
