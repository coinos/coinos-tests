const test = require('tape')
const puppeteer = require('puppeteer')

const delay = async seconds => 
  await new Promise(r => setTimeout(r, seconds ? seconds * 1000 : 1000 ))

const openCoinosHome = async () => {
  return new Promise(async resolve => {
    const browser = await puppeteer.launch( {headless: false, defaultViewport: null } )
    const page = await browser.newPage()
    await page.goto(`https://dev.coinos.io/`, {waitUntil: 'networkidle2'})
    resolve([browser,page])
  })
}

test('Can open homepage', async t => {
  const [browser,page] = await openCoinosHome() 
  await delay(3) 

  const body = await page.evaluate(() => document.body.innerText )
  t.ok(body.search('Send and receive bitcoin') > -1, `Homepage loads OK (displays "Send and receive bitcoin")`)

  await browser.close()
  t.end()
})


test('Can create an anonymous account', async t => {
  const [browser,page] = await openCoinosHome() 
  
  await delay(3) 
  
  const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
  await buttonSpan[0].click()
  
  await delay(4) 
  
  const body = await page.evaluate(() => document.body.innerText )

  t.ok(body.search('No payments yet') > -1, `Anonymous account created OK (displays "No payments yet")`)
  t.ok(body.search('0.00') > -1, 'New account page shows a 0.00 balance')

  await browser.close()

  t.end()
})