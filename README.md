# coinos-tests

Integration test for helping to maintain the stability of features in [Coinos]

## setup

There are 2 ways to install & run the test: 
- direct (local) which will run the test directly via Node (`npm test`). 
- via [act] (and [docker]) which allows you to skip the npm install by instead pulling an image/building/running a container with said npm install and environment ready to go (can only run headless)

By default, both ways will test against your local instance of [coinos-server] (`http://localhost:8085`) 
So first, follow the instructions to install & bring that online separately (ie- concluding with `docker-compose up`) then from a fresh location do: 
```
git clone https://github.com/coinos/coinos-tests
cd coinos-tests
```

Optionally cp `config.js.sample` to `config.js` and change `baseUrl` to point to a different coinos URL ie- an instance in the cloud (noting the required trailing slash)

The server you are testing must have a precreated account.  Its username and password can be set in the config, but they are `test_admin` and `SetASecurePasswordHere` by default.  This account must have admin privileges and at least 1000 sats (0.000 01 BTC).

### install/run (direct)

```bash

npm install
npm test
```

To test headless ie- terminal only; without a Chromium window spawning - instead do: 

```bash
npm run test-headless
```

### install/run (act + docker)

Install [act] on your system (which also requires docker) and then: 

```bash
npm run test-act
```

#### build docker image (not required)

To build the docker image do: 

```bash
docker build -t coinos-tests:v0.0.3 .
```

where v0.0.3 is current version of package.json as of your latest commit.


### license

This code is [licensed].  Coinos and this repository are free to use for personal use.  Anyone can fork as long as it stays AGPLv3.  

To purchase a commercial license or to inquire about customized or managed instances, please reach out to us at [contact@coinos.io]


[Coinos]: https://github.com/coinos
[act]: https://github.com/nektos/act
[docker]: https://docs.docker.com/get-docker
[coinos-server]: https://github.com/coinos/coinos-server
[licensed]:./LICENSE.md
[contact@coinos.io]:mailto:contact@coinos.io
