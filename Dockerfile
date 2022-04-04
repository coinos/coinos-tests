FROM ubuntu:20.04

RUN  apt-get update \
     && DEBIAN_FRONTEND=noninteractive \
     && apt-get install -y --no-install-recommends wget gnupg ca-certificates curl iputils-ping libxshmfence-dev \
     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
     && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
     && apt-get update \
     && apt-get install -y --no-install-recommends google-chrome-stable \
     && rm -rf /var/lib/apt/lists/* \
     && wget --quiet https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh -O /usr/sbin/wait-for-it.sh \
     && chmod +x /usr/sbin/wait-for-it.sh \
     && curl -sL https://deb.nodesource.com/setup_16.x | bash - \
     && apt-get install -y nodejs git 

RUN git clone https://github.com/coinos/coinos-tests.git 
WORKDIR /coinos-tests
RUN npm install
