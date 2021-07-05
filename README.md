# coinos-tests

### install/run

```bash
npm install
cp config.js.sample config.js
npm test
```

if necessary, change `baseUrl` in `config.js` to your own instance

to test headless ie- terminal only; without a Chromium window spawning - instead run: 

```bash
npm run test-headless
```

