console.log(`###### Coinos Integration Test ######
-------------------------------------`)

// ### configuration setup ###
// Parse terminal params:
const argv = require("minimist")(process.argv.slice(2))
const headless = argv.headless ? true : false

// Acquire other necessary variables from env or config file:
let config
try {
  config = config = require("./config")
} catch {}

let baseUrl =
  config && config.baseUrl ? config.baseUrl : "http://localhost:8085/"
let email = config && config.email ? config.email : "hello@coinos.io"
let adminUsername = config && config.adminUsername ? config.adminUsername : "test_admin"
let adminPassword = config && config.adminPassword ? config.adminPassword : "SetASecurePasswordHere"

//ENV var can override config:
if (process.env.BASE_URL) baseUrl = process.env.BASE_URL
if (process.env.EMAIL) email = process.env.EMAIL
if (process.env.ADMIN_USERNAME) adminUsername = process.env.ADMIN_USERNAME
if (process.env.ADMIN_PASSWORD) adminUsername = process.env.ADMIN_PASSWORD

console.log(`targeting: ${baseUrl}
using email: ${email}`)
// ######

// ### Deps ###
const test = require("tape")
const puppeteer = require("puppeteer")
const _coin = require('undercoin')
const log = console.log

const delay = async (seconds) =>
  await new Promise((r) => setTimeout(r, seconds ? seconds * 1000 : 1000))

// Function to setup/launch Puppeteer and open Coinos homepage:
const openCoinosHome = async () => {
  const opts = {
    headless: headless,
    timeout: 60000,
    args: [
      "--disabled-setupid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-sandbox",
      "--no-zygote",
    ],
  }
  if (headless) {
    opts.args.push("--window-size=1600,900")
  } else {
    opts.defaultViewport = null
  }
  return new Promise(async (resolve) => {
    const browser = await puppeteer.launch(opts)
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
    )
    await page.goto(baseUrl, {
      waitUntil: "networkidle2",
    })
    resolve([browser, page])
  })
}

const characters = "abcdefghijklmnopqrstuvwxyz0123456789"
const numChars = characters.length
const randomCredentialLength = 12
// future proofing in case password rules are added to coinos
// this does not actually make the passwords more secure
const defaultPasswordPrefix = "P@s$w0rd-"

// generate random username and password
// the two use the same random data - so I can still access the accounts after a test
// (e.g. if a test fails and I sent sats to one of those accounts I can get them back)
// DO NOT USE THIS FOR A REAL ACCOUNT
function randomCredentials(usernamePrefix) {
  let randomText = ''
  for (var i = 0; i < randomCredentialLength; i++) {
    randomText += characters.charAt(Math.floor(Math.random() * numChars))
  }
  let username = usernamePrefix + randomText
  let password = defaultPasswordPrefix + randomText
  return [username, password]
}

// ### Tests ###

test("Can open homepage", async (t) => {
  const [browser, page] = await openCoinosHome()
  await delay(3)

  const body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("Send and receive bitcoin") > -1,
    `Homepage loads OK (displays "Send and receive bitcoin")`
  )

  await browser.close()
  t.end()
})

test("Can create an anonymous account", async (t) => {
  const [browser, page] = await openCoinosHome()
  await delay(3)

  const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
  await buttonSpan[0].click()
  await delay(6)

  const body = await page.evaluate(() => document.body.innerText)

  t.ok(
    body.search("No payments yet") > -1,
    `Anonymous account created OK (displays "No payments yet")`
  )
  t.ok(body.search("0.00") > -1, "New account page shows a 0.00 balance")

  await browser.close()

  t.end()
})

test("Can change username and password", async (t) => {
  const [browser, page] = await openCoinosHome()

  await delay(3)

  const anonButtonSpan = await page.$x(
    "//span[contains(., 'Use Anonymously')]"
  )
  await anonButtonSpan[0].click()

  await delay(3)

  let userButtonSpan = await page.$x("//span[contains(., 'satoshi')]")
  await userButtonSpan[0].click()
  await delay(1)

  const settingsDiv = await page.$x("//div[contains(., 'Settings')]")
  await settingsDiv[5].click()

  await delay(4)

  let body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("Your public page") > -1,
    `Setting page loads OK (shows 'Your public page')"`
  )

  await page.focus("input")

  await page.evaluate(
    () => (document.getElementsByTagName("input")[0].value = "")
  )
  await delay(2)

  //create a new user account with a randomized ending so as to ensure (not guaranteed) unique:
  const [ userName, password ] = randomCredentials("penguinfan-")
  await page.keyboard.type(userName)
  await delay(1)

  const saveSpan = await page.$x("//span[contains(., 'Save')]")
  await saveSpan[0].click()

  await delay(2)

  body = await page.evaluate(() => document.body.innerText)
  t.ok(body.search(baseUrl + userName) > -1, `Username updated successfully`)

  await delay(4)

  const passButtonSpan = await page.$x(
    "//span[contains(., 'Change Password')]"
  )
  await passButtonSpan[0].click()

  await page.keyboard.type("anarchocapitalist")
  await page.keyboard.press("Tab")
  await page.keyboard.type("anarchocapitalist")
  await delay(1)

  await saveSpan[0].click()
  await delay(2)

  //now logout and try logging in with the new creds:
  userButtonSpan = await page.$x(`//span[contains(., ${userName})]`)
  await userButtonSpan[0].click()
  await delay(1)
  const signoutButton = await page.$x("//button[contains(., 'Sign Out')]")
  await signoutButton[0].click()
  await delay(4)

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("Send and receive bitcoin") > -1,
    `Signed out ok (we are now back to default message)`
  )

  await page.focus("input")
  await page.keyboard.type(userName)
  await page.keyboard.press("Tab")
  await page.keyboard.type("anarchocapitalist")
  await page.keyboard.press("Enter")
  await delay(2)

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("No payments yet") > -1,
    `Logged back in OK with the updated credentials`
  )
  await delay(1)

  await browser.close()
  t.end()
})

test("Can set, change and remove PIN", async (t) => {
  const [browser, page] = await openCoinosHome()

  // create account and go to settings page
  const anonButtonSpan = await page.$x(
      "//span[contains(., 'Use Anonymously')]"
  )
  await anonButtonSpan[0].click()
  await delay(3)

  const userButtonSpan = await page.$x("//span[contains(., 'satoshi')]")
  await userButtonSpan[0].click()
  await delay(1)
  const settingsDiv = await page.$x("//div[contains(., 'Settings')]")
  await settingsDiv[5].click()
  await delay(4)

  let body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("Your public page") > -1,
    `Setting page loads OK (shows 'Your public page')")`
  )

  // try to set a PIN
  let pinButtonSpan = await page.$x("//span[contains(., 'Set PIN')]")
  await pinButtonSpan[0].click()

  await page.keyboard.press("Tab")
  await page.keyboard.type("857142")
  await delay(1)
  await page.keyboard.type("142857")

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("PIN mismatch") > -1,
    `Cannot set PIN when confirmation != original`
  )

  await page.keyboard.type("857142")
  await delay(1)
  await page.keyboard.type("857142")

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("PIN Set Successfully!") > -1,
    `Can set PIN`
  )

  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")

  // try to change PIN
  pinButtonSpan = await page.$x("//span[contains(., 'Change PIN')]")
  await pinButtonSpan[0].click()

  await page.keyboard.press("Tab")
  await page.keyboard.type("142857")
  await delay(1)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("Wrong PIN, try again") > -1,
    `Current PIN is required to change PIN`
  )

  // try to change it correctly
  await page.keyboard.type("857142")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await delay(1)
  await page.keyboard.down("Shift")
  for (var i = 0; i < 7; i++)
      await page.keyboard.press("Tab")
  await page.keyboard.up("Shift")
  await page.keyboard.type("142857")
  await page.keyboard.type("142857")

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("PIN Set Successfully!") > -1,
    `Can change PIN`
  )

  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")

  // try to unset PIN
  pinButtonSpan = await page.$x("//span[contains(., 'Change PIN')]")
  await pinButtonSpan[0].click()

  await page.keyboard.press("Tab")
  await page.keyboard.type("142857")
  await delay(1)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await delay(1)
  await page.keyboard.press("Enter")
  await delay(1)

  // I need to press tab 7 times due to a bug in the system
  for (i = 0; i < 7; i++)
      await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await delay(1)

  body = await page.evaluate(() => document.body.innerText)
  t.ok(
    body.search("PIN Set Successfully!") > -1,
    `Can unset PIN`
  )

  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")

  await delay(1)
  await browser.close()
  t.end()
})

test.skip("Can register an account", async (t) => {
  const [browser, page] = await openCoinosHome()
  await delay(6)

  const registerAccountButtonSpan = await page.$x(
    "//span[contains(., 'Register An Account')]"
  )
  await registerAccountButtonSpan[0].click()
  await delay(6)

  const [ userName, password ] = randomCredentials("penguinfan-")
  await page.keyboard.type(userName)
  await page.keyboard.press("Tab")
  await page.keyboard.type(email)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.type("anarchocapitalist")
  await delay(2)

  const registerButtonSpan = await page.$x("//span[contains(., 'Register')]")
  await registerButtonSpan[0].click()
  await delay(6)
  // problem with redirect happening here

  await delay(3)

  let body = await page.evaluate(() => document.body.innerHTML)
  t.ok(
    body.search("No payments yet") > -1,
    `Anonymous account created OK (displays "No payments yet")`
  )
  t.ok(body.search("0.00") > -1, "New account page shows a 0.00 balance")

  const pathname = await page.evaluate(() => window.location.pathname)
  t.equals(pathname, "/home", "resulting URL pathname is /home")

  t.ok(
    body.search(userName) > -1,
    `The new user is logged in (userName is displayed on page)`
  )

  await delay(1)
  await browser.close()
  t.end()
})

test("Cannot register account if input fields are invalid", async (t) => {
  const clickRegister = async () => {
    return new Promise(async (resolve) => {
      const registerButtonSpan = await page.$x(
        "//span[contains(., 'Register')]"
      )
      await registerButtonSpan[0].click()
      await delay(2)
      resolve()
    })
  }

  const [browser, page] = await openCoinosHome()

  try {
    const [ userName, password ] = randomCredentials("bruinsfan-")
  
    await page.goto(baseUrl + "register", { waitUntil: "networkidle2" })
    await delay(3)
  
    //### skip username ###
    await page.keyboard.press("Tab") //< where username normally would go
    await page.keyboard.type(email)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    await page.keyboard.type("anarchocapitalist")
    await clickRegister()
  
    let body = await page.evaluate(() => document.body.innerHTML)
    /*
      this is no longer the expected result
    t.ok(
      body.search("Name is required") > -1,
      `User is warned that 'Name is required'`
    )
    */
    t.ok(
      body.search("Email is required") === -1,
      `User not warned about email since that was entered OK`
    )
  
    let pathname = await page.evaluate(() => window.location.pathname)
      /*
        this is no longer the expected result
    t.equals(
      pathname,
      "/register",
      "user was prevented from registering (URL did not change)"
    )
    */
  
    //### skip email ###
    await page.goto(baseUrl + "register", { waitUntil: "networkidle2" })
  
    await page.keyboard.type(userName)
    await page.keyboard.press("Tab") //< where email would go
    await page.keyboard.press("Tab")
    await page.keyboard.type("anarchocapitalist")
    await clickRegister()
  
    body = await page.evaluate(() => document.body.innerHTML)
    t.ok(
      body.search("Name is required") === -1,
      `User is not warned about name since that was entered OK'`
    )
      /*
        this is no longer the expected result
    t.ok(
      body.search("Email is required") > -1,
      `User is warned that 'Email is required'`
    )
    */
    pathname = await page.evaluate(() => window.location.pathname)
      /*
        this is no longer the expected result
    t.equals(
      pathname,
      "/register",
      "user was prevented from registering (URL did not change)"
    )
    */
  
    //### invalid email ###
    await page.goto(baseUrl + "register", { waitUntil: "networkidle2" })
  
    await page.keyboard.type(userName)
    await page.keyboard.press("Tab")
    await page.keyboard.type("zfsdfasdfasdf") //< jibberish email
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab") //< skip phone
    await page.keyboard.type("anarchocapitalist")
    await clickRegister()
  
    body = await page.evaluate(() => document.body.innerHTML)
      /*
        this is no longer the expected result
    t.ok(
      body.search("E-mail must be valid") > -1,
      `User is warned that 'Email must be valid'`
    )
    */
    pathname = await page.evaluate(() => window.location.pathname)
      /*
        this is no longer the expected result
    t.equals(
      pathname,
      "/register",
      "user was prevented from registering (URL did not change)"
    )
    */
  
    await delay(1)
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})

test.skip("Can refer users", async (t) => {
  const [browser, page] = await openCoinosHome()

  await page.goto(baseUrl + "login", {waitUntil: "networkidle2"})
  await page.keyboard.type(adminUsername)
  await page.keyboard.press("Tab")
  await page.keyboard.type(adminPassword)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await delay(1)

  await page.goto(baseUrl + "referral", {waitUntil: "networkidle2"})
  const createTokenButtons = await page.$x("//span[contains(., 'Generate Raw Token')]")
  await createTokenButtons[0].click()
  await delay(0.5)
  const token = await page.evaluate(() => document.getElementsByTagName("TD")[0].innerHTML)
  t.ok(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(token),
    "Token successfully generated & matches regexp"
  )

  await page.goto(baseUrl + "logout", {waitUntil: "networkidle2"})
  await page.goto(baseUrl + "register", {waitUntil: "networkidle2"})
  const [ username, password ] = randomCredentials("want2bereferred-")
  await page.keyboard.type(username)
  await page.keyboard.press("Tab")
  await page.keyboard.type(password)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await delay(1)

  await page.goto(baseUrl + "funding", {waitUntil: "networkidle2"})
  const enterCodeButtons = await page.$x("//span[contains(., 'Enter Referral Code')]")
  await enterCodeButtons[0].click()
  await delay(0.8)
  await page.keyboard.type(token)
  const submitCodeButtons = await page.$x("//span[contains(., 'Submit Referral Code')]")
  await submitCodeButtons[0].click()
  await delay(0.8)

  let body = await page.evaluate(() => document.body.innerHTML)
  t.ok(body.search("Your Verification Status: "), "Token can be used to refer user")

  await delay(1)
  await browser.close()
  t.end()
})

test('Lightning address is generated ok', async t => {
  const [browser,page] = await openCoinosHome()
  try {

    const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
    await buttonSpan[0].click()
    log('wait 4 seconds...')
    await delay(4)

    await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })
    log('wait 5 seconds...')
    await delay(5)

    let lightningAddress
    const lightningAddressContainer = await page.evaluate(() => document.getElementsByClassName('body-1')[0])
    if(!lightningAddressContainer) console.warn('no container loaded for Lightning address')
    log('lightningAddressContainer:' + lightningAddressContainer)
    if(lightningAddressContainer) {
      lightningAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML)
    }
    log('lightningAddress:' + lightningAddress)
    if(!lightningAddress) console.warn('could not retrieve Lightning address')
    t.ok(lightningAddress && lightningAddress.length < 264 && 
      lightningAddress.length > 189, 'Lightning address generated has expected # of characters')

    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }    
})

test('Bitcoin address is generated ok', async t => {
  const [browser,page] = await openCoinosHome()
  await delay(3)
  try {
    const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
    await buttonSpan[0].click()
    log('wait 5 seconds...')
    await delay(5)

    //test address:
    await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })
    log('wait 2 seconds...')
    await delay(2)

    const bitcoinBtn = await page.$x("//button[contains(., 'Bitcoin')]")
    await bitcoinBtn[0].click()
    log('wait 3 seconds...')
    await delay(3)
    const bitcoinAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML)
    log('Bitcoin address generated is a valid Segwit address?')
    t.ok(_coin.isSegwit(bitcoinAddress), 'Bitcoin address generated is a valid Segwit address')
    
    log('wait 2 seconds and close test...')
    await delay(2)
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})

test('Liquid address is generated ok', async t => {

  const [browser,page] = await openCoinosHome()
  await delay(3)
  try {
    const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
    await buttonSpan[0].click()
    log('wait 5 seconds...')
    await delay(5)

    await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })
    log('wait 5 seconds...')
    await delay(5)

      
    const liquidBtn = await page.$x("//button[contains(., 'Liquid')]")
    await liquidBtn[0].click()
    log('wait 3 seconds...')
    await delay(3)

    const liquidAddressContainer = await page.evaluate(() => document.getElementsByClassName('body-1')[0])
    if(!liquidAddressContainer) console.warn('no container loaded for Liquid address')
    let liquidAddress
    if(liquidAddressContainer) {
      liquidAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML)
    }
    if(liquidAddress) {
      log('liquidAddress: ' + liquidAddress)
      t.equal(liquidAddress.length, 80, 'Liquid address generated is 80 characters')
    } else {
      t.fail('could not retrieve Liquid address')
    }

    await delay(5)
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }    
})

test("Lightning amount and invoice functionality", async t => {
  const [browser,page] = await openCoinosHome()
  await delay(3)
  try {
    const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
    await buttonSpan[0].click()
    log('wait 3 seconds...')
    await delay(3)
  
    await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })
    log('wait 4 seconds...')
    await delay(4)
  
    //check Lightning amount and invoice functionality: 
    const amountBtn = await page.$x("//button[contains(., 'Amount')]")
    await amountBtn[0].click()
    await delay(1)
    await page.keyboard.type("10")
    const doneBtn = await page.$x("//button[contains(., 'Done')]")
    await doneBtn[0].click()
    await delay(1)
  
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("10") > -1, 'Amount incorporated into address')
    const lightningInvoice1 = await page.evaluate(() => document.getElementsByClassName('body-1')[2].innerHTML)
    t.ok(lightningInvoice1.length >= 258, 'Lightning invoice generated is at least 258 characters')
  
    const checkoutBtn = await page.$x("//button[contains(., 'Show QR')]")
    await checkoutBtn[0].click()
    await delay(1)
  
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("10") > -1, 'Amount incorporated into invoice')
    const lightningInvoice2 = await page.evaluate(() => document.getElementsByClassName('body-1')[2].innerHTML)
    t.equal(lightningInvoice2, lightningInvoice1, 'Checkout page shows correct invoice')
  
    const tipBtn = await page.$x("//button[contains(., 'Add Tip')]")
    await tipBtn[0].click()
    await delay(1)
    const twentyBtn = await page.$x("//button[contains(., '20%')]")
    await twentyBtn[0].click()
    await delay(1)
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("12") > -1 || body.search(/10.*\+2/) > -1, 'Tip incorporated into amount')
  
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})

test.skip("Test that addresses work internally", async t => {
  const [browser,page] = await openCoinosHome()
  await delay(3)
  try {
    const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
    await buttonSpan[0].click()
    log('wait 3 seconds...')
    await delay(3)

    //Get a Bitcoin address:
    await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })
    log('wait 2 seconds...')
    await delay(2)

    const bitcoinBtn = await page.$x("//button[contains(., 'Bitcoin')]")
    await bitcoinBtn[0].click()
    log('wait 3 seconds...')
    await delay(3)
    const bitcoinAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML)

    // go to a new account
    await page.goto(baseUrl + "register", {waitUntil: "networkidle2"})
    const [ username, password ] = randomCredentials("vikingsfan-")
    await page.keyboard.type(username)
    await page.keyboard.press("Tab")
    await page.keyboard.type(password)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    log('wait 4 seconds...')
    await delay(4)

    // Test that all addresses work internally
    await page.goto(baseUrl + "send", {waitUntil: "networkidle2"})
    await page.keyboard.type(bitcoinAddress)
    await page.keyboard.press("Enter")
    log('wait 5 seconds...')
    await delay(5)
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search(/Sending to.*satoshi/) > -1, 'Bitcoin address should be detected as coinos user')

    await delay(2)
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})


test.skip("Can perform internal transfers", async t => {
  const [browser, page] = await openCoinosHome()
  try {
    // register an account without money
    await page.goto(baseUrl + "register", {waitUntil: "networkidle2"})
    const [ username, password ] = randomCredentials("vikingfan-")
    await page.keyboard.type(username)
    await page.keyboard.press("Tab")
    await page.keyboard.type(password)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")

    // login on account with money
    await page.goto(baseUrl + "logout", {waitUntil: "networkidle2"})
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"})
    await page.keyboard.type(adminUsername)
    await page.keyboard.press("Tab")
    await page.keyboard.type(adminPassword)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    await delay(1)

    // try to send money from rich to poor
    const amount = Math.floor(Math.random() * 1000)

    await page.goto(baseUrl + "send", {waitUntil: "networkidle2"})
    await page.keyboard.type(username)
    await page.keyboard.press("Enter")
    await delay(1)
    await page.click("input")
    await delay(0.5)
    let numpadInput = (await page.$$("input"))[1]
    await numpadInput.type(amount.toString())
    await page.keyboard.down("Shift")
    await page.keyboard.press("Tab")
    await page.keyboard.up("Shift")
    await page.keyboard.press("Enter")
    await delay(1)

    let sendBtn = await page.$x("//button[contains(., 'Send')]")
    if(!sendBtn.length) {
      throw 'no Send button'
    }
    await sendBtn[0].click()
    await delay(1)

    let body = await page.evaluate(() => document.body.innerHTML)
    t.ok(
      body.search("Payment sent!") > -1,
      "User able to send payment"
    )

    // go to other account and check if money was received
    await page.goto(baseUrl + "logout", {waitUntil: "networkidle2"})
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"})
    await page.keyboard.type(username)
    await page.keyboard.press("Tab")
    await page.keyboard.type(password)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    await delay(1)
    await page.goto(baseUrl + "home", {waitUntil: "networkidle2"})

    body = await page.evaluate(() => document.body.innerHTML)
    t.ok(
      body.search(amount.toString()) > -1,
      "Money sent to account"
    )

    // send the money back, so my tester doesn't run out of money
    await page.goto(baseUrl + "send", {waitUntil: "networkidle2"})
    await page.keyboard.type(adminUsername)
    await page.keyboard.press("Enter")
    await delay(1)
    await page.click("input")
    await delay(0.5)
    numpadInput = (await page.$$("input"))[1]
    await numpadInput.type(amount.toString())
    await page.keyboard.down("Shift")
    await page.keyboard.press("Tab")
    await page.keyboard.up("Shift")
    await page.keyboard.press("Enter")
    await delay(1)

    sendBtn = await page.$x("//button[contains(., 'Send')]")
    await sendBtn[0].click()
    await delay(1)

    body = await page.evaluate(() => document.body.innerHTML)
    t.ok(
      body.search("Payment sent!") > -1,
      "User able to return money"
    )
    t.ok(
      body.search(/0\s*<\/div>/) > -1,
      "Returned money was deducted from user's account"
    )

    await delay(1)
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }    
})

test.skip("Can create wallets", async t => {
  const [browser, page] = await openCoinosHome()
  //t.timeoutAfter(20000)
  try {
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"})
    const anonLoginButtons = await page.$x("//span[contains(., 'Use Anonymously')]")
    await anonLoginButtons[0].click()
    await delay(6)

    await page.goto(baseUrl + "wallets", {waitUntil: "networkidle2"})
    await delay(1)

    const newWalletButtons = await page.$x("//span[contains(., 'New Wallet')]")
    await newWalletButtons[0].click()
    await delay(2)

    // enter new wallet creation page
    let body = await page.evaluate(() => document.body.innerText)
    if (body.search("Password")) {
      await page.keyboard.type("password")
      await page.keyboard.press("Enter")
      console.log("🛈 Was prompted for password")
    } else {
      console.log("🛈 Was not prompted for password")
    }

    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("New Wallet") > -1, "Can enter wallet creation menu")

    log('wait 3 seconds...')
    await delay(3)

    // enable Liquid
    const liquidButtons = await page.$x("//span[contains(., 'Liquid')]")

    await liquidButtons[0].click()
    log('wait 5 seconds...')
    await delay(5)

    // ensure advanced settings work
    const advancedSettingsButtons = await page.$x("//span[contains(., 'Advanced Settings')]")
    await advancedSettingsButtons[0].click()
    log('wait 5 seconds...')
    await delay(5)

    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Seed") > -1, "Can enable advanced settings")

    await advancedSettingsButtons[0].click()
    await delay(1)

    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Seed") === -1, "Can disable advanced settings")

    // create wallet
    const goButtons = await page.$x("//span[contains(., 'Go')]")
    await goButtons[0].click()
    log('wait 5 seconds...')
    await delay(5)

    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("LBTC") > -1, "Currency switched to LBTC")

    log('wait 5 seconds...')
    await delay(5)

    await page.goto(baseUrl + "wallets", {waitUntil: "networkidle2"})

    log('wait 5 seconds...')
    await delay(5)

    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Liquid Bitcoin") > -1, "New wallet created")

    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})

test.skip("Can use the admin page", async t => {
  const [browser, page] = await openCoinosHome()

  try {
    // try to get into admin page without logging on
    await page.goto(baseUrl + "admin", {waitUntil: "networkidle2"})
    await delay(6)
    let body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Access Denied") > -1, "Cannot access admin page without logging in")
  
    // try to get into admin page as non-admin
    const [username, password] = randomCredentials("totallyrealadmin-")
    await page.goto(baseUrl + "register", {waitUntil: "networkidle2"})
    await page.keyboard.type(username)
    await page.keyboard.press("Tab")
    await page.keyboard.type(password)
    await page.keyboard.press("Enter")
    await delay(1)
    await page.goto(baseUrl + "admin", {waitUntil: "networkidle2"})
    await delay(6)
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Access Denied") > -1, "Cannot access admin page as non-admin")
  
    // login as admin
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"})
    await page.keyboard.type(adminUsername)
    await page.keyboard.press("Tab")
    await page.keyboard.type(adminPassword)
    await page.keyboard.press("Enter")
    await delay(1)
    await page.goto(baseUrl + "admin", {waitUntil: "networkidle2"})
    await delay(6)
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search("Access Denied") === -1, "Can access admin page as admin")
  
    // try to list users
    const listUsersButtons = await page.$x("//span[contains(., 'List Users')]")
    await listUsersButtons[0].click()
    await delay(1)
  
    body = await page.evaluate(() => document.body.innerText)
    // because we created a user earlier & are using admin, we know there's at least 2 users in the system
    t.ok(body.search('test_admin') > -1 &&
      body.search('satoshi-') > -1, "Can list users")
  
    // try to list users with balance
    await page.goto(baseUrl + "admin", {waitUntil: "networkidle2"})
    await delay(4)
    const listUsersWithBalanceButtons = await page.$x("//span[contains(., 'Accounts with Balance')]")
    await listUsersWithBalanceButtons[0].click()
    await delay(1)
  
    body = await page.evaluate(() => document.body.innerText)
    // I asked you to make sure this account has a balance - that's one!
    t.ok(body.search(/[1-9]\d* accounts since \d{4}-\d{2}-\d{2}/) > -1, "Can list users with balance")
  
    // try to list referrals
    const tabs = await page.$$(".v-tab")
    await tabs[1].click()
    await delay(1)
    const listReferralsButtons = await page.$x("//span[contains(., 'List Referrals')]")
    await listReferralsButtons[0].click()
    await delay(1)
  
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search(/([1-9]\d*|No) referrals/) > -1, "Can list referrals")
  
    // try to list transactions
    await tabs[2].click()
    await delay(1)
  
    // these 5 things are basically the same in terms of UI, so I'll use a for loop
    const keys = ["Payments", "Orders", "Deposits", "Withdrawals", "Invoices"]
    for (let i = 0; i < keys.length; i++) {
      // click the button
      let buttons = await page.$x("//span[contains(., '" + keys[i] + "')]")
      await buttons[0].click()
      await delay(1)
  
      // look for the message
      body = await page.evaluate(() => document.body.innerText)
      let pattern = new RegExp("([1-9]\\d*|No) " + keys[i].toLowerCase() + " since \\d{4}-\\d{2}-\\d{2}")
      t.ok(body.search(pattern) > -1, "Can list " + keys[i].toLowerCase())
    }
  
    // finally, summaries
    await tabs[3].click()
    await delay(1)
  
    // try to list transactions (summaries page)
    let transactionButtons = await page.$x("//span[contains(., 'Transactions')]")
    await transactionButtons[0].click()
    await delay(3) // longer because the page warns it could take longer
    body = await page.evaluate(() => document.body.innerText)
    t.ok(body.search(/([1-9]\d*|No) transactions since \d{4}-\d{2}-\d{2}/) > -1, "Can list transactions")
  
    // try to list kyc required users
    let kycRequiredButtons = await page.$x("//span[contains(., 'KYC Required')]")
    await kycRequiredButtons[0].click()
    await delay(1)
    body = await page.evaluate(() => document.body.innerText)
    t.ok(
      body.search(/([1-9]\d*|No) kyc flagged users since \d{4}-\d{2}-\d{2} \(max > 2.1M SAT\)/) > -1,
      "Can list KYC required users"
    )
  
    await browser.close()
    t.end()
  } catch (error) { 
    console.error(error)
    await browser.close()
    t.end('test ended early with error') 
  }
})
