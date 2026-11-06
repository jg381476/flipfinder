import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculate, verdictFor, searchQuery, searchLinks, num } from '../src/calc.js'

test('basic profit math', () => {
  // sell 100, 8% fee = 8, shipping 5 -> net 87; buy 20 -> profit 67, ROI 335%
  const r = calculate({ sell: 100, buy: 20, feePct: 8, shipping: 5 })
  assert.equal(r.fees, 8)
  assert.equal(r.netProceeds, 87)
  assert.equal(r.profit, 67)
  assert.equal(r.roi, 335)
  assert.equal(r.verdict, 'green')
})

test('max buy price is 43 for net 87 and gives a green result', () => {
  const r = calculate({ sell: 100, buy: '', feePct: 8, shipping: 5 })
  assert.equal(r.maxBuy, 43)
  assert.equal(r.profit, null)
  assert.equal(r.verdict, null)
  const at = calculate({ sell: 100, buy: r.maxBuy, feePct: 8, shipping: 5 })
  assert.equal(at.verdict, 'green')
  const above = calculate({ sell: 100, buy: r.maxBuy + 1, feePct: 8, shipping: 5 })
  assert.notEqual(above.verdict, 'green')
})

test('max buy is always green when > 0, for many inputs', () => {
  for (let sell = 5; sell <= 600; sell += 7) {
    for (const fee of [0, 8, 13]) {
      for (const ship of [0, 3.5, 12]) {
        const m = calculate({ sell, buy: '', feePct: fee, shipping: ship }).maxBuy
        if (m > 0) assert.equal(calculate({ sell, buy: m, feePct: fee, shipping: ship }).verdict, 'green', `${sell}/${fee}/${ship}`)
      }
    }
  }
})

test('traffic light thresholds', () => {
  assert.equal(verdictFor(10, 100), 'green')
  assert.equal(verdictFor(9.99, 100), 'orange')
  assert.equal(verdictFor(50, 99), 'orange')
  assert.equal(verdictFor(5, 40), 'orange')
  assert.equal(verdictFor(4.99, 200), 'red')
  assert.equal(verdictFor(30, 39), 'red')
  assert.equal(verdictFor(-3, -10), 'red')
})

test('loss is red, negative ROI', () => {
  const r = calculate({ sell: 30, buy: 30, feePct: 8, shipping: 5 })
  assert.equal(r.profit, -7.4)
  assert.equal(r.verdict, 'red')
  assert.ok(r.roi < 0)
})

test('free item (buy 0) does not divide by zero', () => {
  const r = calculate({ sell: 40, buy: 0, feePct: 8, shipping: 5 })
  assert.equal(r.roi, Infinity)
  assert.equal(r.verdict, 'green')
})

test('decimal comma input and garbage', () => {
  assert.equal(num('12,5'), 12.5)
  assert.equal(num('abc'), 0)
  assert.equal(num(-4), 0)
  const r = calculate({ sell: '50,00', buy: '10,5', feePct: '10', shipping: '4' })
  assert.equal(r.fees, 5)
  assert.equal(r.profit, 30.5)
})

test('no selling price -> no verdict', () => {
  assert.equal(calculate({ sell: '', buy: 10 }).verdict, null)
})

test('search query dedupes words and links are encoded', () => {
  assert.equal(searchQuery({ brand: 'Moulinex', name: 'Moulinex Blender 500', model: 'LM 500' }), 'Moulinex Blender 500 LM')
  const links = searchLinks({ brand: 'Seiko', name: 'Seiko 5 watch', model: '' })
  assert.equal(links.length, 4)
  assert.ok(links[0].url.includes('LH_Sold=1'))
  assert.ok(links.every((l) => l.url.includes('Seiko%205%20watch')))
})
