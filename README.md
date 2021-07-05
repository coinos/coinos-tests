# coinos-tests

Tested with NodeJS 16

### install/run (local)

```bash
git clone https://github.com/coinos/coinos-tests
cd coinos-tests
npm install
cp config.js.sample config.js
npm test
```

if necessary, change `baseUrl` (noting the required slash at the end) in `config.js` to your own instance

To test headless ie- terminal only; without a Chromium window spawning - instead do: 

```bash
npm run test-headless
```

### install/run (docker)

Alternatively, the test can be run in a docker container for the purpose of CI
Requires [docker] and [docker-compose]

First, start [coinos-server] (using network name 'coinos')

```bash
git clone https://github.com/coinos/coinos-tests
cd coinos-tests
npm install
docker-compose up
```
The final step will download the necessary image from Dockerhub, build it, and run test-headless against your live instance of coinos-server 

To customize the docker build ie- to reflect changes to the Dockerfile run `docker build . --no-cache` tthen edit `docker-compose.yml` `image` value with the resulting image ID from your build. 

[docker]: https://docs.docker.com/get-docker
[docker-compose]: https://docs.docker.com/compose/install/
[coinos-server]: https://github.com/coinos/coinos-server