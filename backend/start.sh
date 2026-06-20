#!/bin/sh
set -e

# XAVFLI: DB_RESET=true faqat mahsus holatlarda (masalan, staging reset)
# Production'da HECH QACHON DB_RESET=true qo'ymang!
if [ "$DB_RESET" = "true" ]; then
    if [ "$NODE_ENV" = "production" ]; then
        echo ">>> XAVF: DB_RESET=true production'da ruxsat etilmagan! O'tkazib yuborilmoqda."
    else
        echo ">>> DB_RESET: schema tozalanmoqda (faqat non-production)..."
        psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;" 2>/dev/null || \
        npx prisma db execute --url "$DATABASE_URL" --file /dev/stdin <<'ENDSQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
ENDSQL
        echo ">>> Schema tozalandi."
    fi
fi

echo ">>> prisma migrate deploy ishlamoqda..."
# migrate deploy mavjud migratsiyalarni qo'llaydi. Bu repoda additiv schema
# o'zgarishlar (User.status, AdminAuditLog) uchun migratsiya fayli YO'Q —
# shuning uchun migrate deploy "muvaffaqiyatli" bo'lsa ham yangi ustun/jadval
# YARATILMAYDI. Buni hal qilish uchun migrate urinishidan KEYIN db push'ni
# SHARTSIZ ishlatamiz: schema'dagi additiv o'zgarishlar jonli DBga aniq
# qo'llanilsin. Additiv bo'lgani uchun bu xavfsiz (data-loss yo'q).
npx prisma migrate deploy || echo ">>> migrate deploy o'tmadi (migratsiya yo'q bo'lishi mumkin) — db push davom etadi..."
echo ">>> prisma db push ishlamoqda (additiv schema'ni jonli DBga qo'llash)..."
npx prisma db push --skip-generate
echo ">>> Server ishga tushmoqda..."
exec node dist/app.js
