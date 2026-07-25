import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react'
import QRCode from 'qrcode'
import * as bwipjs from 'bwip-js/browser'
import { fetchApi } from '@/lib/api'
import '../../styles/certificate-page.css'

interface CertificateData {
    code: string
    verificationUrl: string
    holderName: string
    subject: string
    testTitle: string
    scorePercent: number
    rawScore: number
    scoreMax: number
    grade: string
    qualified: boolean
    completedAt: string
    productName: string
    official: false
    disclaimer: string
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('uz-UZ', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(value))
}

function shortCode(code: string) {
    const parts = code.split('-')
    if (parts.length < 3) return code
    const identity = parts[1]
    return `${parts[0]}-${identity.slice(0, 8)}-${identity.slice(-8)}-${parts[2]}`
}

export default function CertificatePage() {
    const { code = '' } = useParams<{ code: string }>()
    const nav = useNavigate()
    const barcodeRef = useRef<HTMLCanvasElement>(null)
    const [certificate, setCertificate] = useState<CertificateData | null>(null)
    const [qrDataUrl, setQrDataUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        setLoading(true)
        setError('')
        fetchApi(`/tests/certificates/${encodeURIComponent(code)}`, { silent: true, authFailure: 'throw' })
            .then((data: CertificateData) => {
                if (!active) return
                setCertificate(data)
                document.title = `${data.holderName} — DTMMax sertifikat`
                return QRCode.toDataURL(data.verificationUrl, {
                    width: 220,
                    margin: 1,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#171717', light: '#FFFFFF' },
                })
            })
            .then(dataUrl => {
                if (active && dataUrl) setQrDataUrl(dataUrl)
            })
            .catch((requestError: unknown) => {
                if (!active) return
                setError(requestError instanceof Error ? requestError.message : 'Sertifikat topilmadi')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
            document.title = 'DTMMax'
        }
    }, [code])

    useEffect(() => {
        if (!certificate || !barcodeRef.current) return
        try {
            bwipjs.code128(barcodeRef.current, {
                bcid: 'code128',
                text: certificate.code,
                scale: 2,
                height: 8,
                includetext: false,
                backgroundcolor: 'FFFFFF',
                barcolor: '171717',
                paddingwidth: 0,
                paddingheight: 0,
            })
        } catch {
            // Matnli serial kod har doim ko'rinadi; barcode browser cheklovida yordamchi qatlam.
        }
    }, [certificate])

    if (loading) {
        return (
            <main className="certificate-page certificate-page--state">
                <div className="certificate-page__loader" aria-label="Sertifikat tekshirilmoqda" />
                <p>Sertifikat tekshirilmoqda…</p>
            </main>
        )
    }

    if (!certificate || error) {
        return (
            <main className="certificate-page certificate-page--state">
                <div className="certificate-page__invalid">
                    <ShieldCheck aria-hidden="true" />
                    <h1>Sertifikat tasdiqlanmadi</h1>
                    <p>{error || 'Kod haqiqiy emas yoki natija topilmadi.'}</p>
                    <button type="button" onClick={() => nav('/testlar')}>Test markaziga qaytish</button>
                </div>
            </main>
        )
    }

    return (
        <main className="certificate-page">
            <div className="certificate-page__actions">
                <button type="button" onClick={() => nav('/testlar')}>
                    <ArrowLeft aria-hidden="true" /> Test markazi
                </button>
                <div className="certificate-page__verified">
                    <CheckCircle2 aria-hidden="true" />
                    <span><strong>Tekshirildi</strong><small>DTMMax bazasida mavjud</small></span>
                </div>
                <button type="button" className="is-primary" onClick={() => window.print()}>
                    <Download aria-hidden="true" /> PDF saqlash
                </button>
            </div>

            <article className="certificate-sheet" aria-label={`${certificate.holderName} uchun DTMMax sinov sertifikati`}>
                <div className="certificate-sheet__frame" aria-hidden="true" />
                <header className="certificate-sheet__header">
                    <div className="certificate-sheet__brand">
                        <img src="/dtmmax-logo.png" alt="" aria-hidden="true" />
                        <span><strong>DTMMax</strong><small>ta’lim platformasi</small></span>
                    </div>
                    <div className="certificate-sheet__status">
                        <ShieldCheck aria-hidden="true" />
                        <span><strong>Tekshiriladigan hujjat</strong><small>QR va yagona serial bilan</small></span>
                    </div>
                </header>

                <section className="certificate-sheet__title">
                    <span>DTMMAX SINOV IMTIHONI</span>
                    <h1>MILLIY SERTIFIKAT</h1>
                    <p>NATIJA HUJJATI</p>
                </section>

                <section className="certificate-sheet__recipient">
                    <span>Ushbu natija hujjati</span>
                    <h2>{certificate.holderName}</h2>
                    <p>
                        <strong>{certificate.subject}</strong> fanidan DTMMax platformasidagi
                        “{certificate.testTitle}” sinov imtihonini yakunlaganini tasdiqlaydi.
                    </p>
                </section>

                <section className="certificate-sheet__result" aria-label="Sinov natijasi">
                    <div>
                        <span>Ball</span>
                        <strong>{certificate.rawScore}<small> / {certificate.scoreMax}</small></strong>
                    </div>
                    <div className="certificate-sheet__grade">
                        <span>Daraja</span>
                        <strong>{certificate.grade}</strong>
                        {!certificate.qualified && <small>Daraja talabi bajarilmadi</small>}
                    </div>
                    <div>
                        <span>Natija</span>
                        <strong>{Math.round(certificate.scorePercent)}<small>%</small></strong>
                    </div>
                </section>

                <footer className="certificate-sheet__footer">
                    <div className="certificate-sheet__details">
                        <div><span>Yakunlangan sana</span><strong>{formatDate(certificate.completedAt)}</strong></div>
                        <div><span>Hujjat raqami</span><strong>{shortCode(certificate.code)}</strong></div>
                        <canvas ref={barcodeRef} aria-label={`Sertifikat barcode: ${certificate.code}`} />
                        <p>{certificate.disclaimer}</p>
                    </div>
                    <a className="certificate-sheet__qr" href={certificate.verificationUrl} target="_blank" rel="noreferrer">
                        {qrDataUrl && <img src={qrDataUrl} alt="Sertifikatni tekshirish QR kodi" />}
                        <span>Tekshirish uchun skanerlang <ExternalLink aria-hidden="true" /></span>
                    </a>
                </footer>
            </article>

            <p className="certificate-page__note">
                Bu DTMMax sinov imtihoni hujjati. Davlat organi bergan rasmiy milliy sertifikat emas.
            </p>
        </main>
    )
}
