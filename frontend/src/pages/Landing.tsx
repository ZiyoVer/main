import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LineChart,
  LockKeyhole,
  MessageSquareText,
  Sparkles,
  Target,
  Upload,
  Users,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import './landing.css'

const ROUTE_REGISTER = '/royxat'
const ROUTE_LOGIN = '/kirish'

type ButtonVariant = 'dark' | 'light' | 'outline'

function Button({
  children,
  to,
  variant = 'dark',
  arrow = false,
}: {
  children: ReactNode
  to: string
  variant?: ButtonVariant
  arrow?: boolean
}) {
  return (
    <Link className={`lp-button lp-button--${variant}`} to={to}>
      <span>{children}</span>
      {arrow && <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />}
    </Link>
  )
}

function Brand() {
  return (
    <span className="lp-brand">
      <img src="/dtmmax-logo.png" alt="" width={42} height={42} />
      <strong>DTMMax</strong>
    </span>
  )
}

const NAV_ITEMS = [
  ['Abituriyent uchun', '#imkoniyatlar'],
  ['AI oqimi', '#ai-oqim'],
  ['O‘qituvchi', '#oqituvchi'],
  ['Narxlar', '#narxlar'],
] as const

function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const closeAtDesktop = () => {
      if (window.innerWidth > 860) setMobileOpen(false)
    }
    if (!mobileOpen) return
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeAtDesktop)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeAtDesktop)
    }
  }, [mobileOpen])

  return (
    <nav className="lp-nav" aria-label="Asosiy navigatsiya">
      <div className="lp-shell lp-nav__inner">
        <a className="lp-nav__brand" href="#main" aria-label="DTMMax bosh sahifasi">
          <Brand />
        </a>

        <div className="lp-nav__links">
          {NAV_ITEMS.map(([label, href]) => (
            <a href={href} key={href}>{label}</a>
          ))}
        </div>

        <div className="lp-nav__actions">
          <Link className="lp-login-link" to={ROUTE_LOGIN}>Kirish</Link>
          <Button to={ROUTE_REGISTER}>Bepul boshlash</Button>
          <button
            className="lp-menu-button"
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="lp-mobile-menu"
            aria-label={mobileOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lp-mobile-menu" id="lp-mobile-menu">
          <div className="lp-shell">
            {NAV_ITEMS.map(([label, href]) => (
              <a href={href} key={href} onClick={() => setMobileOpen(false)}>{label}</a>
            ))}
            <Link to={ROUTE_LOGIN} onClick={() => setMobileOpen(false)}>Kirish</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

function AnswerRailPreview() {
  return (
    <figure className="lp-answer-preview" aria-labelledby="answer-preview-title">
      <div className="lp-answer-preview__topline">
        <span>Diagnostika</span>
        <strong>Matematika · 12/30</strong>
      </div>
      <div className="lp-answer-preview__body">
        <ol className="lp-answer-rail" aria-label="Savollar holati">
          {['09', '10', '11', '12', '13', '14'].map((number) => (
            <li
              className={number === '12' ? 'is-current' : number < '12' ? 'is-done' : ''}
              key={number}
              aria-current={number === '12' ? 'step' : undefined}
              aria-label={`${number}-savol${number === '12' ? ', hozirgi savol' : number < '12' ? ', bajarildi' : ', bajarilmagan'}`}
            >
              {number}
            </li>
          ))}
        </ol>

        <div className="lp-answer-question">
          <div className="lp-answer-question__meta">
            <span>Algebra</span>
            <span>01:42</span>
          </div>
          <h2 id="answer-preview-title">x² − 5x + 6 = 0 tenglamaning ildizlarini toping.</h2>
          <div className="lp-answer-options" aria-label="Javob variantlari">
            <span><b>A</b> 1 va 6</span>
            <span className="is-selected" aria-label="B varianti tanlangan: 2 va 3"><b>B</b> 2 va 3</span>
            <span><b>C</b> −2 va −3</span>
            <span><b>D</b> 0 va 5</span>
          </div>
          <div className="lp-answer-status">
            <span><CheckCircle2 aria-hidden="true" size={17} /> Javob saqlandi</span>
            <strong>Keyingi savol <ArrowRight aria-hidden="true" size={17} /></strong>
          </div>
        </div>
      </div>
      <figcaption>Bu bezak emas — DTMMax diagnostika oqimining soddalashtirilgan mahsulot ko‘rinishi.</figcaption>
    </figure>
  )
}

function Hero() {
  return (
    <header className="lp-hero">
      <div className="lp-shell lp-hero__grid">
        <div className="lp-hero__copy">
          <p className="lp-hero__signal"><Zap aria-hidden="true" size={18} fill="currentColor" /> O‘zbek abituriyenti uchun AI tayyorgarlik tizimi</p>
          <h1>DTMni taxmin bilan emas, <span>tizim bilan</span> yeng.</h1>
          <p className="lp-hero__lede">
            DTMMax bilim darajangni aniqlaydi, zaif mavzuni topadi va har kuni darsdan testgacha bo‘lgan aniq yo‘lni beradi.
          </p>
          <div className="lp-hero__actions">
            <Button to={ROUTE_REGISTER} variant="dark" arrow>Bepul diagnostikani boshlash</Button>
            <a className="lp-text-link" href="#ai-oqim">Qanday ishlaydi <ArrowRight aria-hidden="true" size={17} /></a>
          </div>
          <p className="lp-hero__truth"><LockKeyhole aria-hidden="true" size={16} /> Bepul rejada karta kerak emas. Pro — ixtiyoriy.</p>
        </div>
        <AnswerRailPreview />
      </div>
    </header>
  )
}

function ProofStrip() {
  return (
    <section className="lp-proof-strip" aria-label="Platforma qisqacha">
      <div className="lp-shell lp-proof-strip__inner">
        <div><strong>DTM + MS</strong><span>ikkala imtihon formati</span></div>
        <div><strong>8+ fan</strong><span>bitta o‘quv muhiti</span></div>
        <div><strong>AI ustoz</strong><span>savoldan mashqqacha</span></div>
        <div><strong>30 AI so‘rov</strong><span>bepul rejada har kuni</span></div>
      </div>
    </section>
  )
}

type ValueItem = {
  icon: LucideIcon
  title: string
  body: string
  detail: string
}

const STUDENT_VALUES: ValueItem[] = [
  {
    icon: BrainCircuit,
    title: 'Savolga javob emas, tushunishga yo‘l',
    body: 'AI ustoz mavzuni darajangga mos tushuntiradi, misol ko‘rsatadi va darhol o‘zlashtirganingni tekshiradi.',
    detail: 'Dars → misol → mustahkamlash',
  },
  {
    icon: Target,
    title: 'Har mashq zaif joyingga tegadi',
    body: 'Tasodifiy test o‘rniga xatolaring va maqsad balling asosida keyingi eng foydali vazifa tanlanadi.',
    detail: 'Xato → izoh → qayta mashq',
  },
  {
    icon: LineChart,
    title: 'Progress shunchaki foiz emas',
    body: 'Fan, mavzu va vaqt bo‘yicha o‘sishni ko‘rasan. Qaysi joy ballni ushlab turgani ochiq ko‘rinadi.',
    detail: 'Mavzu kesimi → ball prognozi',
  },
]

function ProgressPanel() {
  const progress = [
    ['Algebra', 78, '+12%'],
    ['Geometriya', 61, '+8%'],
    ['Trigonometriya', 43, 'Fokus'],
  ] as const

  return (
    <div className="lp-progress-panel" aria-label="O‘quvchi progressi namunasi">
      <div className="lp-progress-panel__heading">
        <div>
          <span>Haftalik progress</span>
          <strong>+18 ball</strong>
        </div>
        <BarChart3 aria-hidden="true" size={28} />
      </div>
      <div className="lp-progress-panel__score">
        <strong>142.6</strong>
        <span>maqsad: 170 ball</span>
      </div>
      <div className="lp-progress-list">
        {progress.map(([label, value, change]) => (
          <div key={label}>
            <span>{label}</span>
            <div className="lp-progress-track" role="progressbar" aria-label={`${label} progressi`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
              <i style={{ '--lp-progress': `${value}%` } as CSSProperties} />
            </div>
            <b>{change}</b>
          </div>
        ))}
      </div>
      <p><Sparkles aria-hidden="true" size={16} /> Bugungi fokus: trigonometriyadan 10 ta maqsadli savol.</p>
    </div>
  )
}

function StudentValue() {
  return (
    <section className="lp-section lp-student" id="imkoniyatlar">
      <div className="lp-shell">
        <div className="lp-section-heading lp-section-heading--split">
          <div>
            <p className="lp-section-label">Abituriyent uchun</p>
            <h2>Bugun nima qilishni o‘ylama. <span>DTMMax aytadi.</span></h2>
          </div>
          <p>Bir nechta ilova, tarqoq PDF va taxminiy reja o‘rniga bitta yakuniy maqsadga ulangan o‘quv oqimi.</p>
        </div>

        <div className="lp-student__layout">
          <div className="lp-value-list">
            {STUDENT_VALUES.map((item) => {
              const Icon = item.icon
              return (
                <article className="lp-value-row" key={item.title}>
                  <Icon aria-hidden="true" size={25} strokeWidth={2.2} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <span>{item.detail}</span>
                  </div>
                </article>
              )
            })}
          </div>
          <ProgressPanel />
        </div>
      </div>
    </section>
  )
}

const AI_STEPS = [
  ['01', 'Diagnostika', 'Boshlang‘ich daraja va mavzu bo‘shliqlari aniqlanadi.'],
  ['02', 'Shaxsiy reja', 'Maqsad ball va qolgan vaqtga mos kunlik yo‘l tuziladi.'],
  ['03', 'Qisqa dars', 'AI mavzuni soddalashtirib, kerakli misol bilan ochadi.'],
  ['04', 'Maqsadli mashq', 'Aynan xato qilgan nuqtang bo‘yicha savollar beriladi.'],
  ['05', 'Nazorat testi', 'Natija qayta o‘lchanadi va reja avtomatik yangilanadi.'],
] as const

function AiWorkflow() {
  return (
    <section className="lp-section lp-ai-flow" id="ai-oqim">
      <div className="lp-shell">
        <div className="lp-section-heading lp-section-heading--on-dark">
          <p className="lp-section-label">DTMMax AI oqimi</p>
          <h2>Bitta savoldan <span>yopiq o‘quv sikligacha.</span></h2>
          <p>AI suhbat bilan tugamaydi. Har bir javob keyingi o‘quv qarorini yaxshilaydi.</p>
        </div>

        <ol className="lp-ai-steps">
          {AI_STEPS.map(([number, title, body], index) => (
            <li key={title}>
              <div className="lp-ai-step__head">
                <span>{number}</span>
                {index < AI_STEPS.length - 1 && <ArrowRight aria-hidden="true" size={19} />}
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>

        <div className="lp-ai-callout">
          <MessageSquareText aria-hidden="true" size={22} />
          <p><strong>“Nega B javob to‘g‘ri?”</strong> — AI yechimni bosqichma-bosqich ko‘rsatadi, keyin shu xatoga o‘xshash yangi mashq beradi.</p>
          <span>Izoh → mustahkamlash</span>
        </div>
      </div>
    </section>
  )
}

function PdfToTest() {
  return (
    <section className="lp-section lp-pdf">
      <div className="lp-shell lp-pdf__layout">
        <div className="lp-pdf__copy">
          <p className="lp-section-label">PDF → test loyihasi</p>
          <h2>Materialni yukla. <span>Savollar loyihasini ol.</span></h2>
          <p>Konspekt yoki o‘qituvchi materiali asosida savollar loyihasi yaratiladi. O‘qituvchi uni tekshiradi, tahrirlaydi va shundan keyin nashr qiladi.</p>
          <ul>
            <li><Check aria-hidden="true" size={18} /> Savol soni va qiyinlikni tanlash</li>
            <li><Check aria-hidden="true" size={18} /> Savol va javoblarni tekshirib tahrirlash</li>
            <li><Check aria-hidden="true" size={18} /> Tasdiqlangandan keyin o‘quvchiga ulashish</li>
          </ul>
        </div>

        <div className="lp-pdf-flow" aria-label="PDFdan test yaratish oqimi">
          <div className="lp-pdf-file">
            <span><FileText aria-hidden="true" size={27} /></span>
            <div><strong>Algebra_10-sinf.pdf</strong><small>24 sahifa · yuklandi</small></div>
            <CheckCircle2 aria-hidden="true" size={20} />
          </div>
          <div className="lp-pdf-connector"><span /><b>Savollar loyihasi yaratildi</b><span /></div>
          <div className="lp-pdf-result">
            <div><ClipboardCheck aria-hidden="true" size={26} /><span>Yangi test</span></div>
            <strong>Kvadrat tenglamalar</strong>
            <p>20 savol · aralash qiyinlik · tekshirishga tayyor</p>
            <span className="lp-pdf-result__status">Ko‘rib chiqish <ArrowRight aria-hidden="true" size={16} /></span>
          </div>
        </div>
      </div>
    </section>
  )
}

function TeacherSection() {
  return (
    <section className="lp-section lp-teacher" id="oqituvchi">
      <div className="lp-shell lp-teacher__layout">
        <div className="lp-teacher__copy">
          <p className="lp-section-label">O‘qituvchi uchun</p>
          <h2>Test tuzishga emas, <span>o‘quvchiga vaqt ajrating.</span></h2>
          <p>Materialni yuklang, testni tayyorlang va guruh natijasini mavzular kesimida kuzating. O‘quvchi qayerda to‘xtaganini bitta ekranda ko‘ring.</p>
          <div className="lp-teacher__points">
            <span><Upload aria-hidden="true" size={19} /> PDF va mavzudan test</span>
            <span><Users aria-hidden="true" size={19} /> Guruhga ulashish</span>
            <span><BarChart3 aria-hidden="true" size={19} /> Natija tahlili</span>
          </div>
          <Button to={ROUTE_REGISTER} variant="light" arrow>O‘qituvchi sifatida boshlash</Button>
        </div>

        <div className="lp-teacher-board" aria-label="O‘qituvchi guruhi tahlili namunasi">
          <div className="lp-teacher-board__top">
            <div><span>11-A guruh</span><strong>Haftalik nazorat</strong></div>
            <span>24 o‘quvchi</span>
          </div>
          <div className="lp-teacher-board__summary">
            <div><span>O‘rtacha natija</span><strong>72%</strong></div>
            <div><span>Topshirganlar</span><strong>21/24</strong></div>
          </div>
          <div className="lp-teacher-board__topics">
            <p><span>Kvadrat tenglama</span><b className="is-good">84%</b></p>
            <p><span>Viyet teoremasi</span><b>67%</b></p>
            <p><span>Diskriminant</span><b className="is-focus">48%</b></p>
          </div>
          <p className="lp-teacher-board__note"><BrainCircuit aria-hidden="true" size={17} /> AI tavsiya: diskriminant bo‘yicha qayta mashq bering.</p>
        </div>
      </div>
    </section>
  )
}

type Plan = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  pro?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Bepul',
    price: '0',
    period: 'so‘m',
    description: 'Tizimli tayyorgarlikni boshlash uchun asosiy imkoniyatlar.',
    features: [
      'AI ustoz — kuniga 30 ta so‘rov',
      'Tayyor DTM testlari — cheksiz',
      'Natija va progress kuzatuvi',
      'Flashcardlar bilan mustahkamlash',
    ],
  },
  {
    name: 'Pro',
    price: '35 000',
    period: 'so‘m / oy',
    description: 'Ko‘proq AI yordami va chuqurroq tahlil kerak bo‘lganlar uchun.',
    features: [
      'Cheksiz AI so‘rovlari',
      'Murakkab masalalar uchun Thinking rejimi',
      'Ehtimoliy mavzular tahlili',
      'Kengaytirilgan zaiflik va progress tahlili',
    ],
    pro: true,
  },
]

type BillingMode = 'loading' | 'enforced' | 'beta' | 'unavailable'

function Pricing() {
  const [billingMode, setBillingMode] = useState<BillingMode>('loading')

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/billing/config', { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<unknown> : Promise.reject(new Error('billing_config_failed')))
      .then((data) => {
        if (data && typeof data === 'object') {
          const enforced = (data as Record<string, unknown>).enforced
          setBillingMode(enforced === true ? 'enforced' : enforced === false ? 'beta' : 'unavailable')
        } else {
          setBillingMode('unavailable')
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setBillingMode('unavailable')
      })
    return () => controller.abort()
  }, [])

  return (
    <section className="lp-section lp-pricing" id="narxlar">
      <div className="lp-shell">
        <div className="lp-section-heading lp-section-heading--split">
          <div>
            <p className="lp-section-label">Ochiq narxlar</p>
            <h2>Bepuldan boshlang. <span>Kerak bo‘lsa Proga o‘ting.</span></h2>
          </div>
          <p>Ro‘yxatdan o‘tish va asosiy tayyorgarlik bepul. Pro narxi yashirilmaydi: oyiga 35 000 so‘m.</p>
        </div>

        <div className="lp-price-table" aria-live="polite">
          {PLANS.map((plan) => (
            <article className={plan.pro ? 'lp-plan lp-plan--pro' : 'lp-plan'} key={plan.name}>
              <div className="lp-plan__top">
                <span>{plan.name}</span>
                {plan.pro && (
                  <b>{billingMode === 'enforced' ? 'Paylov orqali' : billingMode === 'beta' ? 'Beta davrida ochiq' : '35 000 so‘m / oy'}</b>
                )}
              </div>
              <div className="lp-plan__price"><strong>{plan.price}</strong><span>{plan.period}</span></div>
              <p>{plan.description}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><Check aria-hidden="true" size={18} /> {feature}</li>
                ))}
              </ul>
              <Button to={ROUTE_REGISTER} variant={plan.pro ? 'dark' : 'outline'} arrow>
                {plan.pro && billingMode === 'beta' ? 'Beta davomida Prodan foydalanish' : plan.pro ? 'Pro bilan boshlash' : 'Bepul boshlash'}
              </Button>
            </article>
          ))}
        </div>

        <div className="lp-pricing-note">
          <LockKeyhole aria-hidden="true" size={18} />
          <p>
            {billingMode === 'enforced'
              ? 'Bepul reja doim mavjud. Pro obunasi ixtiyoriy va Paylov orqali oyiga 35 000 so‘m.'
              : billingMode === 'beta'
                ? 'Beta davrida Pro imkoniyatlari vaqtincha bepul ochiq. E’lon qilingan odatiy narx — oyiga 35 000 so‘m.'
                : 'Bepul reja doim mavjud. Pro rejaning e’lon qilingan narxi oyiga 35 000 so‘m; joriy to‘lov holati akkaunt ichida ko‘rsatiladi.'}
            {' '}Ehtimoliy mavzular tahlili kafolatlangan imtihon savollari degani emas.
          </p>
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  ['DTMMax nima?', 'DTMMax — DTM va Milliy Sertifikat imtihonlariga tayyorlanish uchun AI o‘quv platformasi. U mavzuni tushuntiradi, test beradi va natijani keyingi reja bilan bog‘laydi.'],
  ['Platforma bepulmi?', 'Ha, ro‘yxatdan o‘tish va asosiy imkoniyatlar bepul, karta kerak emas. Qo‘shimcha imkoniyatlar uchun ixtiyoriy Pro reja bor; uning odatiy narxi oyiga 35 000 so‘m.'],
  ['Qaysi fanlar bor?', 'Matematika, Fizika, Kimyo, Biologiya, Ona tili, Ingliz tili, Tarix va Geografiya mavjud. Fanlar ro‘yxati kengayib boradi.'],
  ['AI ustoz qanday ishlaydi?', 'Avval darajangiz aniqlanadi. Keyin AI mavzuni tushuntiradi, misol ko‘rsatadi, mashq beradi va xatoni keyingi rejaga qo‘shadi.'],
  ['PDFdan testni kim yaratishi mumkin?', 'Material asosida test loyihasi o‘qituvchi oqimida yaratiladi. O‘qituvchi savol va javoblarni tekshirib, tahrirlab tasdiqlagandan keyin uni o‘quvchilarga ulashishi mumkin.'],
  ['DTMMax imtihon savollarini bashorat qiladimi?', 'DTMMax kafolatlangan savollarni bermaydi. Oldingi tahlillar asosida ko‘p uchraydigan mavzu va savol turlarini ajratib, tayyorgarlik fokusini yaxshilaydi.'],
] as const

function Faq() {
  return (
    <section className="lp-section lp-faq" id="faq">
      <div className="lp-shell lp-faq__layout">
        <div className="lp-faq__intro">
          <p className="lp-section-label">Aniq javoblar</p>
          <h2>Savol qolmasin.</h2>
          <p>Platforma, fanlar va to‘lov haqida eng ko‘p so‘raladigan savollar.</p>
        </div>
        <div className="lp-faq__list">
          {FAQS.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<ChevronDown aria-hidden="true" size={20} /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="lp-final-cta">
      <div className="lp-shell lp-final-cta__inner">
        <div>
          <GraduationCap aria-hidden="true" size={33} />
          <h2>Keyingi ball bugungi to‘g‘ri qadamdan boshlanadi.</h2>
          <p>Diagnostikani yeching. DTMMax sizga nimadan boshlashni ko‘rsatadi.</p>
        </div>
        <Button to={ROUTE_REGISTER} variant="light" arrow>Bepul boshlash</Button>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-shell">
        <div className="lp-footer__top">
          <div>
            <Brand />
            <p>O‘zbekiston abituriyentlari va o‘qituvchilari uchun AI tayyorgarlik tizimi.</p>
          </div>
          <nav aria-label="Mahsulot havolalari">
            <strong>Mahsulot</strong>
            <a href="#imkoniyatlar">Abituriyent uchun</a>
            <a href="#ai-oqim">AI oqimi</a>
            <a href="#oqituvchi">O‘qituvchi</a>
            <a href="#narxlar">Narxlar</a>
          </nav>
          <nav aria-label="Yordam havolalari">
            <strong>Yordam</strong>
            <a href="#faq">FAQ</a>
            <Link to={ROUTE_LOGIN}>Kirish</Link>
            <Link to={ROUTE_REGISTER}>Ro‘yxatdan o‘tish</Link>
          </nav>
          <nav aria-label="Huquqiy havolalar">
            <strong>Huquqiy</strong>
            <Link to="/maxfiylik">Maxfiylik</Link>
            <Link to="/shartlar">Shartlar</Link>
            <Link to="/oferta">Oferta</Link>
          </nav>
        </div>
        <div className="lp-footer__bottom">
          <span>© 2026 DTMMax</span>
          <span>DTM va Milliy Sertifikatga ongli tayyorgarlik.</span>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { token, user } = useAuthStore()

  useEffect(() => {
    if (!token || !user) return
    try {
      if (sessionStorage.getItem('dtmmax_skip_autoredirect') === '1') {
        sessionStorage.removeItem('dtmmax_skip_autoredirect')
        return
      }
    } catch {
      // sessionStorage mavjud bo‘lmasa oddiy role redirect davom etadi.
    }
    if (user.role === 'ADMIN') navigate('/boshqaruv', { replace: true })
    else if (user.role === 'TEACHER') navigate('/oqituvchi', { replace: true })
    else navigate('/bugun', { replace: true })
  }, [navigate, token, user])

  return (
    <div className="lp-root">
      <a className="lp-skip-link" href="#main">Asosiy kontentga o‘tish</a>
      <Nav />
      <main id="main">
        <Hero />
        <ProofStrip />
        <StudentValue />
        <AiWorkflow />
        <PdfToTest />
        <TeacherSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
