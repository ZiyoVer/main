import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Privacy() {
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
                        <img src="/dtmmax-logo.png" alt="DTMMax" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
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
                        Oxirgi yangilanish: 2026 yil 29 iyul
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
                                <strong style={{ color: 'var(--text-primary)' }}>Yuklangan kontent:</strong> Tahlil yoki test yaratish uchun yuborilgan rasm va hujjatlar.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>To'lov ma'lumotlari:</strong> Obuna rejasi, summa, holat va to'lov vaqti. Karta raqami va OTP DTMMax bazasida saqlanmaydi.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Texnik ma'lumotlar:</strong> Kirish va foydalanish vaqti, IP manzil va xavfsizlik hodisalari.
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
                                <strong style={{ color: 'var(--text-primary)' }}>Google Gemini:</strong> Rasm va hujjatlarni tahlil qilish hamda AI zaxira xizmati uchun.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Infratuzilma xizmatlari:</strong> Ilova hostingi, ma'lumotlar bazasi, kesh, fayl saqlash va email yetkazib berish uchun.
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Paylov:</strong> Pullik obuna yoqilganda karta va OTP to'lovni bajarish uchun Paylov'ga yuboriladi; DTMMax ularni baza yoki loglarda saqlamaydi va faqat to'lov holati hamda buyurtma ma'lumotini saqlaydi.
                            </li>
                        </ul>
                        <p style={{ marginBottom: '16px' }}>
                            Shaxsiy ma'lumotlaringiz (ism, email) hech qachon uchinchi tomonlarga sotilmaydi yoki reklama maqsadida ishlatilmaydi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            4. Ma'lumotlarni saqlash va himoya
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Sayt bilan aloqa HTTPS orqali himoyalanadi. Parollar bcrypt algoritmi bilan
                            xeshlanadi va ochiq shaklda saqlanmaydi. Kirish tokenlari 7 kungacha amal qiladi;
                            oddiy chiqishda joriy token, “Barcha qurilmalardan chiqish” yoki parolni
                            almashtirishda esa barcha eski tokenlar bekor qilinadi. Ma'lumotlarga kirish
                            rol va akkaunt egasi bo'yicha cheklanadi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            5. Foydalanuvchi huquqlari
                        </h2>
                        <p style={{ marginBottom: '12px' }}>Siz quyidagi huquqlarga egasiz:</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                            <li style={{ marginBottom: '8px' }}>O'zingiz haqingizda saqlangan ma'lumotlarni ko'rish va tahrirlash.</li>
                            <li style={{ marginBottom: '8px' }}>Profil, chat, o'quv natijalari va to'lov tarixingizning JSON nusxasini yuklab olish.</li>
                            <li style={{ marginBottom: '8px' }}>Akkauntingizni va unga bog'langan asosiy ma'lumotlarni Settings sahifasidan o'chirish.</li>
                            <li style={{ marginBottom: '8px' }}>Ma'lumotlaringiz qanday ishlatilishi haqida so'rov yuborish.</li>
                        </ul>
                        <p style={{ marginBottom: '16px' }}>
                            Akkaunt o'chirilganda asosiy ilova bazasidagi yozuvlar o'chiriladi. Xavfsizlik
                            nusxalari va fayl saqlash tizimidagi texnik nusxalar alohida retention jarayoniga
                            muvofiq o'chirilishi mumkin; aniq muddatlar production to'lovi ishga tushishidan
                            oldin ushbu siyosatda e'lon qilinadi.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            6. Cookilar va localStorage
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            DTMMax'ning o'z kirish sessiyasi brauzer localStorage'ida saqlanadi. Unda JWT
                            token, akkauntning qisqa keshi, mavzu ko'rinishi, onboarding holati, test
                            javoblari va natijalari, o'quv rejalari hamda tugallanmagan draftlar bo'lishi
                            mumkin. Userga bog'langan keshlar chiqish, akkaunt almashtirish va akkauntni
                            o'chirishda tozalanadi; tema va onboarding kabi qurilma sozlamalari qolishi
                            mumkin. Google orqali kirish sahifasi o'z cookie siyosatidan foydalanishi mumkin.
                        </p>

                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '28px', marginBottom: '12px' }}>
                            7. Bog'lanish
                        </h2>
                        <p style={{ marginBottom: '16px' }}>
                            Maxfiylik siyosati bo'yicha savollar yoki so'rovlar uchun:
                        </p>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '14px', margin: 0 }}>
                                Email: <a href="mailto:support@dtmmax.uz" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>support@dtmmax.uz</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
