import { Link } from 'react-router-dom'
import { BrainCircuit, ArrowLeft } from 'lucide-react'

export default function Privacy() {
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
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Maxfiylik siyosati</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
                        Oxirgi yangilanish: 2026 yil 1 mart
                    </p>

                    <div style={{ lineHeight: 1.8, fontSize: '15px', color: 'var(--text-secondary)' }}>

                        <p style={{ marginBottom: '16px' }}>
                            DTMMax sizning maxfiyligingizni qadrlaydi. Ushbu siyosat qanday ma'lumotlar to'planishi, ulardan qanday
                            foydalanilishi va ularni qanday himoya qilishimiz haqida tushuntiradi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            1. Qanday ma'lumotlar to'planadi
                        </h2>
                        <p style={{ marginBottom: '12px' }}>Biz quyidagi ma'lumotlarni to'playmiz:</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Shaxsiy ma'lumotlar:</strong> Ism va email manzil (ro'yxatdan o'tishda kiritiladi).
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>O'quv ma'lumotlari:</strong> Tanlangan fan, imtihon turi, maqsad ball, imtihon sanasi.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Faoliyat ma'lumotlari:</strong> Suhbat tarixi, test natijalari, flashcard ko'rsatkichlari.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Texnik ma'lumotlar:</strong> Kirish vaqti, qurilma turi (faqat xizmat sifatini yaxshilash uchun).
                            </li>
                        </ul>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            2. Ma'lumotlar qanday ishlatiladi
                        </h2>
                        <p style={{ marginBottom: '12px' }}>To'plangan ma'lumotlar quyidagi maqsadlarda ishlatiladi:</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>Shaxsiylashtirilgan o'quv tajribasini taqdim etish.</li>
                            <li style={{ marginBottom: '8px' }}>AI yo'riqnomalarini sizning fanlaringiz va darajangizga moslashtirish.</li>
                            <li style={{ marginBottom: '8px' }}>Test natijalaringiz va o'quv dinamikangizni ko'rsatish.</li>
                            <li style={{ marginBottom: '8px' }}>Xizmat ishlashini yaxshilash va texnik xatolarni bartaraf etish.</li>
                            <li style={{ marginBottom: '8px' }}>Muhim xabarnomalar (email tasdiqlash, parol tiklash) yuborish.</li>
                        </ul>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            3. Uchinchi tomon xizmatlar
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax quyidagi uchinchi tomon xizmatlardan foydalanadi:
                        </p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>DeepSeek AI:</strong> Suhbat va savol-javob xizmati uchun. Yuborilgan savollar DeepSeek serverlarida qayta ishlanadi.
                                DeepSeek maxfiylik siyosati: <a href="https://www.deepseek.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none' }}>deepseek.com/privacy</a>
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Email xizmati:</strong> Email tasdiqlash va parol tiklash xabarnomalarini yuborish uchun.
                            </li>
                        </ul>
                        <p style={{ marginBottom: '16px' }}>
                            Shaxsiy ma'lumotlaringiz (ism, email) hech qachon uchinchi tomonlarga sotilmaydi yoki reklama maqsadida ishlatilmaydi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            4. Ma'lumotlarni saqlash va himoya
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Barcha ma'lumotlar shifrlangan holda xavfsiz serverlarda saqlanadi. Parollar bcrypt algoritmi bilan
                            himoyalangan (hech qachon ochiq shaklda saqlanmaydi). JWT tokenlar 7 kun amal qiladi.
                            Tizimdan chiqqaningizda tokenlar bekor qilinadi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            5. Foydalanuvchi huquqlari
                        </h2>
                        <p style={{ marginBottom: '12px' }}>Siz quyidagi huquqlarga egasiz:</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>O'zingiz haqingizda saqlangan ma'lumotlarni ko'rish va tahrirlash.</li>
                            <li style={{ marginBottom: '8px' }}>Akkauntingizni va barcha ma'lumotlaringizni o'chirish (Settings sahifasidan).</li>
                            <li style={{ marginBottom: '8px' }}>Ma'lumotlaringiz qanday ishlatilishi haqida so'rov yuborish.</li>
                        </ul>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            6. Cookilar va localStorage
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax cookie ishlatmaydi. Faqat brauzer localStorage ishlatiladi: JWT token, mavzu sozlamasi (qorong'i/yorug')
                            va bajarilgan test IDlari saqlanadi. Bu ma'lumotlar faqat qurilmangizda qoladi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            7. Bog'lanish
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Maxfiylik siyosati bo'yicha savollar yoki so'rovlar uchun:
                        </p>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '14px', margin: 0 }}>
                                Email: <a href="mailto:support@dtmmax.pro" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>support@dtmmax.pro</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
