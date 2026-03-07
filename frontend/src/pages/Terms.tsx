import { Link } from 'react-router-dom'
import { BrainCircuit, ArrowLeft } from 'lucide-react'

export default function Terms() {
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
                    <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', textDecoration: 'none' }}>
                        <ArrowLeft style={{ width: '16px', height: '16px' }} />
                        Orqaga
                    </Link>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BrainCircuit style={{ width: '16px', height: '16px', color: 'white' }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '16px' }}>DTMMax</span>
                    </div>
                    <div style={{ width: '60px' }} />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-5 py-12">
                <div className="card" style={{ padding: '2.5rem' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Foydalanish shartlari</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
                        Oxirgi yangilanish: 2026 yil 1 mart
                    </p>

                    <div style={{ lineHeight: 1.8, fontSize: '15px', color: 'var(--text-secondary)' }}>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            DTMMax haqida
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax — DTM (Davlat Test Markazi) va Milliy Sertifikat imtihonlariga tayyorlanadigan bepul ta'lim platformasi.
                            Platforma sun'iy intellekt (AI) yordamida shaxsiy o'qitish, testlar va o'quv natijalarini kuzatish imkoniyatini taqdim etadi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            1. Xizmatdan foydalanish
                        </h2>
                        <p style={{ marginBottom: '12px' }}>
                            DTMMax platformasidan foydalanish uchun siz:
                        </p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>Haqiqiy email manzilingiz bilan ro'yxatdan o'tishingiz kerak.</li>
                            <li style={{ marginBottom: '8px' }}>To'g'ri va to'liq ma'lumot kiritishingiz shart.</li>
                            <li style={{ marginBottom: '8px' }}>Akkaunt ma'lumotlarini (parol) maxfiy saqlashingiz kerak.</li>
                            <li style={{ marginBottom: '8px' }}>Platformadan faqat ta'lim maqsadlarida foydalanishingiz lozim.</li>
                        </ul>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            2. Taqiqlangan harakatlar
                        </h2>
                        <p style={{ marginBottom: '12px' }}>Quyidagi harakatlar qat'iyan taqiqlanadi:</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>Platformani zararli maqsadlarda yoki spam tarqatish uchun ishlatish.</li>
                            <li style={{ marginBottom: '8px' }}>Boshqa foydalanuvchilarning ma'lumotlariga ruxsatsiz kirish.</li>
                            <li style={{ marginBottom: '8px' }}>Avtomatlashtirilgan vositalar (botlar) yordamida platforma resurslarini haddan ziyod iste'mol qilish.</li>
                            <li style={{ marginBottom: '8px' }}>Platformani teskari muhandislik qilish yoki nusxalashga urinish.</li>
                            <li style={{ marginBottom: '8px' }}>Noqonuniy, haqoratli yoki zararli kontent tarqatish.</li>
                        </ul>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            3. Hisob va xavfsizlik
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Foydalanuvchi o'z akkauntining xavfsizligi uchun to'liq javobgar. Akkauntingizga ruxsatsiz kirish aniqlansa,
                            darhol support@dtmmax.pro manziliga xabar bering. Shubhali faoliyat aniqlanganda DTMMax akkauntni bloklash yoki
                            o'chirish huquqini o'zida saqlab qoladi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            4. Intellektual mulk
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax platforma dizayni, logotipi, dasturiy kodi va barcha original kontenti DTMMax jamoasiga tegishli.
                            Foydalanuvchi tomonidan kiritilgan ma'lumotlar (savollar, javoblar) foydalanuvchiga tegishli bo'lib,
                            ulardan xizmat sifatini yaxshilash uchun foydalanilishi mumkin.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            5. Xizmat mavjudligi
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax platformani 7/24 ishlashga harakat qiladi, lekin texnik ishlar, yangilanishlar yoki kutilmagan vaziyatlar
                            sababli qisqa muddatli uzilishlar yuz berishi mumkin. Biz xizmatning uzluksiz va xatosiz ishlashiga kafolat bermayiz.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            6. Mas'uliyat chegarasi
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax ta'lim maqsadida ma'lumot beradi, lekin imtihon natijalaringizni kafolatlamaydi. AI javoblari
                            har doim ham to'liq aniq bo'lmasligi mumkin — muhim masalalar bo'yicha rasmiy manbalarni tekshiring.
                            DTMMax platforma orqali yetkazilgan bilvosita yo'qotishlar uchun mas'ul emas.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            7. Shartlar o'zgarishi
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax ushbu shartlarni istalgan vaqtda yangilash huquqini o'zida saqlab qoladi. Muhim o'zgarishlar haqida
                            foydalanuvchilar email orqali xabardor qilinadi. Platformadan foydalanishni davom ettirish yangi shartlarga
                            rozilik sifatida qabul qilinadi.
                        </p>

                        <div style={{ marginTop: '32px', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                Savollar uchun: <a href="mailto:support@dtmmax.pro" style={{ color: 'var(--brand)', textDecoration: 'none' }}>support@dtmmax.pro</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
