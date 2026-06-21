import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/* =========================================================================
   DtmMax — Ommaviy oferta (public offer).
   O'zbekiston FK 367/369-moddalariga muvofiq: to'lovni amalga oshirish =
   ushbu oferta shartlarini to'liq qabul qilish (akzept).

   MUHIM: bu — SHABLON. Pul yig'ishdan OLDIN «...» ichidagi rekvizitlarni
   (yuridik shaxs/YaTT nomi, STIR, manzil, bank, karta) to'ldiring va
   imkon bo'lsa yurist/buxgalter bilan tekshiring.
   ========================================================================= */

function H2({ children }: { children: React.ReactNode }) {
    return (
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
            {children}
        </h2>
    )
}

export default function Oferta() {
    return (
        <div className="kelviq min-h-screen" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
                    <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', textDecoration: 'none' }}>
                        <ArrowLeft style={{ width: '16px', height: '16px' }} />
                        Orqaga
                    </Link>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <img src="/dtmmax-logo.png" alt="DtmMax" style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
                        <span style={{ fontWeight: 700, fontSize: '16px' }}>DtmMax</span>
                    </div>
                    <div style={{ width: '60px' }} />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-5 py-12">
                <div className="card" style={{ padding: '2.5rem' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Ommaviy oferta</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
                        DtmMax Pro obunasi uchun ommaviy shartnoma · Oxirgi yangilanish: «sana»
                    </p>

                    <div style={{ marginBottom: '24px', padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.7 }}>
                            Ushbu ommaviy oferta (keyingi o'rinlarda — «Oferta») O'zbekiston Respublikasi
                            Fuqarolik kodeksining 367 va 369-moddalariga muvofiq, noma'lum doiradagi
                            shaxslarga DtmMax Pro xizmatidan foydalanish bo'yicha rasmiy taklifdir.
                            Xizmat haqini to'lash — Oferta shartlarini to'liq va so'zsiz qabul qilish (akzept) hisoblanadi.
                        </p>
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '15px', color: 'var(--text-secondary)' }}>
                        <H2>1. Atamalar</H2>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}><b>Ijrochi</b> — «MChJ/YaTT nomi», STIR «STIR», xizmatni taqdim etuvchi.</li>
                            <li style={{ marginBottom: '8px' }}><b>Foydalanuvchi</b> — xizmatdan foydalanuvchi va to'lovni amalga oshirgan jismoniy shaxs.</li>
                            <li style={{ marginBottom: '8px' }}><b>Xizmat</b> — DtmMax platformasidagi Pro obuna (kengaytirilgan imkoniyatlar).</li>
                            <li style={{ marginBottom: '8px' }}><b>Sayt</b> — https://dtmmax.uz va uning subdomenlari.</li>
                        </ul>

                        <H2>2. Shartnoma predmeti</H2>
                        <p style={{ marginBottom: '16px' }}>
                            Ijrochi Foydalanuvchiga DtmMax Pro obunasi doirasidagi raqamli ta'lim
                            xizmatidan (AI repetitor, kengaytirilgan tahlil va boshqa Pro imkoniyatlar)
                            obuna muddati davomida foydalanish huquqini taqdim etadi. Asosiy (bepul)
                            imkoniyatlar barcha foydalanuvchilar uchun ochiq qoladi.
                        </p>

                        <H2>3. Xizmat narxi va to'lov tartibi</H2>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>Pro obuna narxi: <b>35 000 so'm / oy</b> (yoki Saytda ko'rsatilgan amaldagi narx).</li>
                            <li style={{ marginBottom: '8px' }}>To'lov O'zbekiston to'lov tizimlari (Payme, Click, Uzum) orqali, to'lov agregatori vositasida amalga oshiriladi.</li>
                            <li style={{ marginBottom: '8px' }}>Obuna to'lov amalga oshirilган paytdan boshlab faollashadi va to'langan muddat tugaguncha amal qiladi.</li>
                            <li style={{ marginBottom: '8px' }}>Narx Ijrochi tomonidan o'zgartirilishi mumkin; o'zgarish faqat keyingi to'lov davriga taalluqli bo'ladi.</li>
                        </ul>

                        <H2>4. Pulni qaytarish</H2>
                        <p style={{ marginBottom: '16px' }}>
                            Xizmat raqamli ko'rinishda darhol taqdim etilgani sababli, faollashtirilgan
                            obuna uchun to'lov, qoida tariqasida, qaytarilmaydi. Texnik nosozlik tufayli
                            xizmatdan umuman foydalanib bo'lmagan hollarda Foydalanuvchi «email»
                            manziliga murojaat qilishi mumkin; ariza qonun hujjatlariga muvofiq
                            ko'rib chiqiladi.
                        </p>

                        <H2>5. Tomonlarning huquq va majburiyatlari</H2>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>Ijrochi xizmatni uzluksiz taqdim etishga harakat qiladi, lekin texnik ishlar tufayli qisqa uzilishlar bo'lishi mumkin.</li>
                            <li style={{ marginBottom: '8px' }}>Foydalanuvchi to'g'ri ma'lumot kiritadi va akkaunt xavfsizligi uchun javobgar bo'ladi.</li>
                            <li style={{ marginBottom: '8px' }}>Ijrochi xizmat sifatini yaxshilash maqsadida imkoniyatlarni o'zgartirishi mumkin.</li>
                        </ul>

                        <H2>6. Mas'uliyat</H2>
                        <p style={{ marginBottom: '16px' }}>
                            Xizmat ta'lim maqsadida taqdim etiladi va imtihon natijasini kafolatlamaydi.
                            AI javoblari har doim ham to'liq aniq bo'lmasligi mumkin — muhim masalalarda
                            rasmiy manbalarga tayaning. Ijrochi bilvosita zararlar uchun javobgar emas.
                        </p>

                        <H2>7. Nizolarni hal qilish</H2>
                        <p style={{ marginBottom: '16px' }}>
                            Nizolar muzokaralar yo'li bilan hal etiladi. Kelishuvga erishilmasa, nizo
                            O'zbekiston Respublikasi amaldagi qonunchiligiga muvofiq ko'rib chiqiladi.
                        </p>

                        <H2>8. Ijrochi rekvizitlari</H2>
                        <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: '8px' }}>
                            <p style={{ margin: 0, lineHeight: 1.9, fontSize: '14px' }}>
                                Nomi: «MChJ / YaTT to'liq nomi»<br />
                                STIR (INN): «STIR»<br />
                                Manzil: «yuridik manzil»<br />
                                H/r: «hisob raqami», bank: «bank nomi», MFO: «MFO»<br />
                                Telefon: «telefon» · Email: «email»
                            </p>
                        </div>

                        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                Aloqa: <a href="mailto:support@dtmmax.uz" style={{ color: 'var(--brand)', textDecoration: 'none' }}>support@dtmmax.uz</a> ·
                                Shuningdek: <Link to="/shartlar" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Foydalanish shartlari</Link>,{' '}
                                <Link to="/maxfiylik" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Maxfiylik</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
