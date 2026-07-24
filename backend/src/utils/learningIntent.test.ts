import assert from 'node:assert/strict'
import test from 'node:test'
import { detectBroadLearningTopic } from './learningIntent'

test('aniq o‘rganish so‘rovlaridan mavzuni ajratadi', () => {
    assert.equal(detectBroadLearningTopic('Integrallarni tushuntir'), 'Integrallar')
    assert.equal(detectBroadLearningTopic('Integerallarni tushuntirib ber'), 'Integrallar')
    assert.equal(detectBroadLearningTopic("Hosilani o'rgatib ber"), 'Hosila')
    assert.equal(detectBroadLearningTopic('Menga funksiyalarni o‘rgat'), 'Funksiyalar')
})

test('tabiiy kengaytirilgan so‘rovni o‘quv sessiyasi sifatida taniydi', () => {
    assert.equal(
        detectBroadLearningTopic('Integrallarni o‘rganishni boshlamoqchiman. Avval menga qaysi bilimlar kerakligini aniqlab ber.'),
        'Integrallar',
    )
    assert.equal(
        detectBroadLearningTopic('Integrallarni tushuntir, avval hosilani bilishimni tekshir'),
        'Integrallar',
    )
    assert.equal(detectBroadLearningTopic('Iltimos menga limitni o‘rganishni xohlayman'), 'Limit')
})

test('formula, yechim va inkor so‘rovlarini keng o‘quv sessiyasiga aylantirmaydi', () => {
    assert.equal(detectBroadLearningTopic('Integral formulalarini jadval qilib ber'), null)
    assert.equal(detectBroadLearningTopic('Shu integralni yech: ∫x dx'), null)
    assert.equal(detectBroadLearningTopic('Integrallarni tushuntirma'), null)
    assert.equal(detectBroadLearningTopic('Men nimani o‘rganmoqchiman bilmayman'), null)
})
