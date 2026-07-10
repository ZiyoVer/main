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
# P0-06: Schema drift oldini olish. Ilgari `db push` HAR deployda SHARTSIZ ishlardi —
# u migration tarixini chetlab schema'ni majburan o'rnatardi (drift manbai) va jonli
# DB hech qachon to'liq migration-managed bo'lmasdi.
#
# Endi migration bilan boshqaramiz: migrate deploy MUVAFFAQIYATLI bo'lsa, `db push`
# butunlay o'tkazib yuboriladi (drift yo'q). `db push` faqat FALLBACK — migrate deploy
# fail bo'lgan oraliq davr uchun (jonli DB hali baseline-resolve qilinmagan bo'lsa).
# Fallback additiv-only (--skip-generate, data-loss'siz). Worst case = eski xatti-harakat.
#
# MUHIM: to'liq migration rejimida HAR schema o'zgarishi uchun migration yaratish shart
# (aks holda deploy'da jimgina qo'llanmaydi). Jonli DB'ni migration-managed qilish va
# workflow — backend/MIGRATIONS.md ga qarang.
if npx prisma migrate deploy; then
    echo ">>> migrate deploy muvaffaqiyatli — db push o'tkazib yuborildi (drift oldini olish)"
else
    echo ">>> migrate deploy o'tmadi — additiv db push fallback (oraliq davr)"
    npx prisma db push --skip-generate
fi
echo ">>> Server ishga tushmoqda..."
exec node dist/app.js
