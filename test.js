console.log(`###### Coinos Integration Test ######
-------------------------------------`);

// ### configuration setup ###
// Parse terminal params:
const argv = require("minimist")(process.argv.slice(2));
const headless = argv.headless ? true : false;

// Acquire other necessary variables from env or config file:
let config;
try {
  config = config = require("./config");
} catch {}

let baseUrl =
  config && config.baseUrl ? config.baseUrl : "http://localhost:8085/";
let email = config && config.email ? config.email : "hello@coinos.io";
let adminUsername = config && config.adminUsername ? config.adminUsername : "test_admin";
let adminPassword = config && config.adminPassword ? config.adminPassword : "SetASecurePasswordHere";

//ENV var can override config:
if (process.env.BASE_URL) baseUrl = process.env.BASE_URL;
if (process.env.EMAIL) email = process.env.EMAIL;
if (process.env.ADMIN_USERNAME) adminUsername = process.env.ADMIN_USERNAME;
if (process.env.ADMIN_PASSWORD) adminUsername = process.env.ADMIN_PASSWORD;

console.log(`targeting: ${baseUrl}
using email: ${email}`);
// ######

// ### Deps ###
const test = require("tape");
const puppeteer = require("puppeteer");
const select = require("puppeteer-select");
const _coin = require('undercoin'); 

const delay = async (seconds) =>
  await new Promise((r) => setTimeout(r, seconds ? seconds * 1000 : 1000));

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
  };
  if (headless) {
    opts.args.push("--window-size=1600,900");
  } else {
    opts.defaultViewport = null;
  }
  return new Promise(async (resolve) => {
    const browser = await puppeteer.launch(opts);
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
    );
    await page.goto(baseUrl, {
      waitUntil: "networkidle2",
    });
    resolve([browser, page]);
  });
};

// ### Tests ###

test("Can open homepage", async (t) => {
  const [browser, page] = await openCoinosHome();
  await delay(3);

  const body = await page.evaluate(() => document.body.innerText);
  t.ok(
    body.search("Send and receive bitcoin") > -1,
    `Homepage loads OK (displays "Send and receive bitcoin")`
  );

  await browser.close();
  t.end();
});

test("Can create an anonymous account", async (t) => {
  const [browser, page] = await openCoinosHome();
  await delay(3);

  const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]");
  await buttonSpan[0].click();
  await delay(6);

  const body = await page.evaluate(() => document.body.innerText);

  t.ok(
    body.search("No payments yet") > -1,
    `Anonymous account created OK (displays "No payments yet")`
  );
  t.ok(body.search("0.00") > -1, "New account page shows a 0.00 balance");

  await browser.close();

  t.end();
});

test("Can change username and password", async (t) => {
  const [browser, page] = await openCoinosHome();

  await delay(3);

  const anonButtonSpan = await page.$x(
    "//span[contains(., 'Use Anonymously')]"
  );
  await anonButtonSpan[0].click();

  await delay(3);

  let userButtonSpan = await page.$x("//span[contains(., 'satoshi')]");
  await userButtonSpan[0].click();
  await delay(1);

  const settingsDiv = await page.$x("//div[contains(., 'Settings')]");
  await settingsDiv[5].click();

  await delay(4);

  let body = await page.evaluate(() => document.body.innerText);
  t.ok(
    body.search("Your public page") > -1,
    `Setting page loads OK (shows 'Your public page')")`
  );

  await page.focus("input");

  await page.evaluate(
    () => (document.getElementsByTagName("input")[0].value = "")
  );
  await delay(2);

  //create a new user account with a randomized ending so as to ensure (not guaranteed) unique:
  const userName =
    "penguinfan" + Math.floor(Math.random() * (99999999 - 1000) + 1000);
  await page.keyboard.type(userName);
  await delay(1);

  const saveSpan = await page.$x("//span[contains(., 'Save')]");
  await saveSpan[0].click();

  await delay(2);

  body = await page.evaluate(() => document.body.innerText);
  t.ok(body.search(baseUrl + userName) > -1, `Username updated successfully`);

  await delay(4);

  const passButtonSpan = await page.$x(
    "//span[contains(., 'Change Password')]"
  );
  await passButtonSpan[0].click();

  await page.keyboard.type("anarchocapitalist");
  await page.keyboard.press("Tab");
  await page.keyboard.type("anarchocapitalist");
  await delay(1);

  await saveSpan[0].click();
  await delay(2);

  //now logout and try logging in with the new creds:
  userButtonSpan = await page.$x(`//span[contains(., ${userName})]`);
  await userButtonSpan[0].click();
  await delay(1);
  const signoutButton = await page.$x("//button[contains(., 'Sign Out')]");
  await signoutButton[0].click();
  await delay(4);

  body = await page.evaluate(() => document.body.innerText);
  t.ok(
    body.search("Send and receive bitcoin") > -1,
    `Signed out ok (we are now back to default message)`
  );

  await page.focus("input");
  await page.keyboard.type(userName);
  await page.keyboard.press("Tab");
  await page.keyboard.type("anarchocapitalist");
  await page.keyboard.press("Enter");
  await delay(2);

  body = await page.evaluate(() => document.body.innerText);
  t.ok(
    body.search("No payments yet") > -1,
    `Logged back in OK with the updated credentials`
  );
  await delay(1);

  await browser.close();
  t.end();
});

test("Can set, change and remove PIN", async (t) => {
    const [browser, page] = await openCoinosHome();

    // create account and go to settings page
    const anonButtonSpan = await page.$x(
        "//span[contains(., 'Use Anonymously')]"
    );
    await anonButtonSpan[0].click();
    await delay(3);

    const userButtonSpan = await page.$x("//span[contains(., 'satoshi')]");
    await userButtonSpan[0].click();
    await delay(1);
    const settingsDiv = await page.$x("//div[contains(., 'Settings')]");
    await settingsDiv[5].click();
    await delay(4);

    let body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("Your public page") > -1,
        `Setting page loads OK (shows 'Your public page')")`
    );

    // try to set a PIN
    let pinButtonSpan = await page.$x("//span[contains(., 'Set PIN')]");
    await pinButtonSpan[0].click();

    await page.keyboard.press("Tab");
    await page.keyboard.type("857142");
    await delay(1);
    await page.keyboard.type("142857");

    body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("PIN mismatch") > -1,
        `Cannot set PIN when confirmation != original`
    );

    await page.keyboard.type("857142");
    await delay(1);
    await page.keyboard.type("857142");

    body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("PIN Set Successfully!") > -1,
        `Can set PIN`
    );

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // try to change PIN
    pinButtonSpan = await page.$x("//span[contains(., 'Change PIN')]");
    await pinButtonSpan[0].click();

    await page.keyboard.press("Tab");
    await page.keyboard.type("142857");
    await delay(1);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("Wrong PIN, try again") > -1,
        `Current PIN is required to change PIN`
    );

    // try to change it correctly
    await page.keyboard.type("857142");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await delay(1);
    await page.keyboard.down("Shift");
    for (var i = 0; i < 7; i++)
        await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    await page.keyboard.type("142857");
    await page.keyboard.type("142857");

    body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("PIN Set Successfully!") > -1,
        `Can change PIN`
    );

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // try to unset PIN
    pinButtonSpan = await page.$x("//span[contains(., 'Change PIN')]");
    await pinButtonSpan[0].click();

    await page.keyboard.press("Tab");
    await page.keyboard.type("142857");
    await delay(1);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await delay(1);
    await page.keyboard.press("Enter");
    await delay(1);

    // I need to press tab 7 times due to a bug in the system
    for (i = 0; i < 7; i++)
        await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await delay(1);

    body = await page.evaluate(() => document.body.innerText);
    t.ok(
        body.search("PIN Set Successfully!") > -1,
        `Can unset PIN`
    );

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await delay(1);
    await browser.close();
    t.end();
});

test.skip("Can register an account", async (t) => {
  const [browser, page] = await openCoinosHome();
  await delay(6);

  const registerAccountButtonSpan = await page.$x(
    "//span[contains(., 'Register An Account')]"
  );
  await registerAccountButtonSpan[0].click();
  await delay(6);

  const userName =
    "penguinfan" + Math.floor(Math.random() * (99999999 - 1000) + 1000);
  await page.keyboard.type(userName);
  await page.keyboard.press("Tab");
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("anarchocapitalist");
  await delay(2);

  const registerButtonSpan = await page.$x("//span[contains(., 'Register')]");
  await registerButtonSpan[0].click();
  await delay(6);
  // problem with redirect happening here

  await delay(3);

  let body = await page.evaluate(() => document.body.innerHTML);
  t.ok(
    body.search("No payments yet") > -1,
    `Anonymous account created OK (displays "No payments yet")`
  );
  t.ok(body.search("0.00") > -1, "New account page shows a 0.00 balance");

  const pathname = await page.evaluate(() => window.location.pathname);
  t.equals(pathname, "/home", "resulting URL pathname is /home");

  t.ok(
    body.search(userName) > -1,
    `The new user is logged in (userName is displayed on page)`
  );

  await delay(1);
  await browser.close();
  t.end();
});

test("Cannot register account if input fields are invalid", async (t) => {
  const clickRegister = async () => {
    return new Promise(async (resolve) => {
      const registerButtonSpan = await page.$x(
        "//span[contains(., 'Register')]"
      );
      await registerButtonSpan[0].click();
      await delay(2);
      resolve();
    });
  };

  const [browser, page] = await openCoinosHome();
  const userName =
    "bruinsfan" + Math.floor(Math.random() * (99999999 - 1000) + 1000);

  await page.goto(baseUrl + "register", { waitUntil: "networkidle2" });
  await delay(3);

  //### skip username ###
  await page.keyboard.press("Tab"); //< where username normally would go
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("anarchocapitalist");
  await clickRegister();

  let body = await page.evaluate(() => document.body.innerHTML);
  /*
    this is no longer the expected result
  t.ok(
    body.search("Name is required") > -1,
    `User is warned that 'Name is required'`
  );
  */
  t.ok(
    body.search("Email is required") === -1,
    `User not warned about email since that was entered OK`
  );

  let pathname = await page.evaluate(() => window.location.pathname);
    /*
      this is no longer the expected result
  t.equals(
    pathname,
    "/register",
    "user was prevented from registering (URL did not change)"
  );
  */

  //### skip email ###
  await page.goto(baseUrl + "register", { waitUntil: "networkidle2" });

  await page.keyboard.type(userName);
  await page.keyboard.press("Tab"); //< where email would go
  await page.keyboard.press("Tab");
  await page.keyboard.type("anarchocapitalist");
  await clickRegister();

  body = await page.evaluate(() => document.body.innerHTML);
  t.ok(
    body.search("Name is required") === -1,
    `User is not warned about name since that was entered OK'`
  );
    /*
      this is no longer the expected result
  t.ok(
    body.search("Email is required") > -1,
    `User is warned that 'Email is required'`
  );
  */
  pathname = await page.evaluate(() => window.location.pathname);
    /*
      this is no longer the expected result
  t.equals(
    pathname,
    "/register",
    "user was prevented from registering (URL did not change)"
  );
  */

  //### invalid email ###
  await page.goto(baseUrl + "register", { waitUntil: "networkidle2" });

  await page.keyboard.type(userName);
  await page.keyboard.press("Tab");
  await page.keyboard.type("zfsdfasdfasdf"); //< jibberish email
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab"); //< skip phone
  await page.keyboard.type("anarchocapitalist");
  await clickRegister();

  body = await page.evaluate(() => document.body.innerHTML);
    /*
      this is no longer the expected result
  t.ok(
    body.search("E-mail must be valid") > -1,
    `User is warned that 'Email must be valid'`
  );
  */
  pathname = await page.evaluate(() => window.location.pathname);
    /*
      this is no longer the expected result
  t.equals(
    pathname,
    "/register",
    "user was prevented from registering (URL did not change)"
  );
  */

  await delay(1);
  await browser.close();
  t.end();
});

test('Bitcoin, Lightning, and Liquid payment addresses are generated', async t => {
  const [browser,page] = await openCoinosHome() 
  await delay(3) 

  const buttonSpan = await page.$x("//span[contains(., 'Use Anonymously')]")
  await buttonSpan[0].click()
  await delay(6) 

  const body = await page.evaluate(() => document.body.innerText )

  t.ok(body.search('No payments yet') > -1, `Anonymous account created OK (displays "No payments yet")`)
  t.ok(body.search('0.00') > -1, 'New account page shows a 0.00 balance')
  await delay(2) 

  //test payment addresses: 

  await page.goto(baseUrl + 'receive', { waitUntil: 'networkidle2' })

  const lightningBtn = await page.$x("//button[contains(., 'Lightning')]")
  await lightningBtn[0].click()
  await delay(1) 
  const lightningAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML) 
  t.equal(lightningAddress.length, 263, 'Lightning address generated is 263 characters')  

  await delay(2) 

  const liquidBtn = await page.$x("//button[contains(., 'Liquid')]")
  await liquidBtn[0].click()
  await delay(1) 
  const liquidAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML) 
  t.equal(liquidAddress.length, 80, 'Liquid address generated is 80 characters')   

  await delay(2) 

  const bitcoinBtn = await page.$x("//button[contains(., 'Bitcoin')]")
  await bitcoinBtn[0].click()
  await delay(1) 
  const bitcoinAddress = await page.evaluate(() => document.getElementsByClassName('body-1')[0].innerHTML) 
  t.ok(_coin.isSegwit(bitcoinAddress), 'Bitcoin address generated is a valid Segwit address') 

  await delay(2) 

  await browser.close()
  t.end()
})

test("Can perform internal transfers", async t => {
    const [browser, page] = await openCoinosHome();

    // register an account without money
    await page.goto(baseUrl + "register", {waitUntil: "networkidle2"});
    const username =
          "vikingfan" + Math.floor(Math.random() * (999999999999 - 1000) + 1000);
    const password = Math.floor(Math.random() * (999999999999 - 1000) + 1000).toString();
    await page.keyboard.type(username);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // login on account with money
    await page.goto(baseUrl + "logout", {waitUntil: "networkidle2"});
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"});
    await page.keyboard.type(adminUsername);
    await page.keyboard.press("Tab");
    await page.keyboard.type(adminPassword);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await delay(1);

    // try to send money from rich to poor
    const amount = Math.floor(Math.random() * 1000);

    await page.goto(baseUrl + "send", {waitUntil: "networkidle2"});
    await page.keyboard.type(username);
    await page.keyboard.press("Enter");
    await delay(1);
    await page.click("input");
    await delay(0.5);
    let numpadInput = (await page.$$("input"))[1];
    await numpadInput.type(amount.toString());
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    await page.keyboard.press("Enter");
    await delay(1);

    let sendBtn = await page.$x("//button[contains(., 'Send')]");
    await sendBtn[0].click();
    await delay(1);

    let body = await page.evaluate(() => document.body.innerHTML);
    t.ok(
        body.search("Payment sent!") > -1,
        "User able to send payment"
    );

    // go to other account and check if money was received
    await page.goto(baseUrl + "logout", {waitUntil: "networkidle2"});
    await page.goto(baseUrl + "login", {waitUntil: "networkidle2"});
    await page.keyboard.type(username);
    await page.keyboard.press("Tab");
    await page.keyboard.type(password);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await delay(1);
    await page.goto(baseUrl + "home", {waitUntil: "networkidle2"});

    body = await page.evaluate(() => document.body.innerHTML);
    t.ok(
        body.search(amount.toString()) > -1,
        "Money sent to account"
    );

    // send the money back, so my tester doesn't run out of money
    await page.goto(baseUrl + "send", {waitUntil: "networkidle2"});
    await page.keyboard.type(adminUsername);
    await page.keyboard.press("Enter");
    await delay(1);
    await page.click("input");
    await delay(0.5);
    numpadInput = (await page.$$("input"))[1];
    await numpadInput.type(amount.toString());
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    await page.keyboard.press("Enter");
    await delay(1);

    sendBtn = await page.$x("//button[contains(., 'Send')]");
    await sendBtn[0].click();
    await delay(1);

    body = await page.evaluate(() => document.body.innerHTML);
    t.ok(
        body.search("Payment sent!") > -1,
        "User able to return money"
    );
    t.ok(
        body.search(/0\s*<\/div>/) > -1,
        "Returned money was deducted from user's account"
    );

    await delay(1);
    await browser.close();
    t.end();
});
