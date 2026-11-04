FROM node:24.14.1-trixie-slim@sha256:9707cd4542f400df5078df04f9652a272429112f15202d22b5b8bdd148df494f
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg python3 make g++ unixodbc-dev && \
 curl -fsSL https://packages.microsoft.com/config/debian/13/packages-microsoft-prod.deb -o /tmp/packages-microsoft-prod.deb && \
 dpkg -i /tmp/packages-microsoft-prod.deb && rm /tmp/packages-microsoft-prod.deb && \
 apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 && \
 rm -rf /var/lib/apt/lists/*
# Debian security-maintained Node links the same shared OpenSSL as msodbcsql.
# Official static-OpenSSL binaries reproduced a native crash on this driver.
RUN apt-get update && apt-get install -y --no-install-recommends nodejs && \
 ln -sf /usr/bin/node /usr/local/bin/node && rm -rf /var/lib/apt/lists/*
COPY production/certs/chapa-ca.crt /usr/local/share/ca-certificates/chapa-ca.crt
RUN update-ca-certificates
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
COPY pilot-local ./pilot-local
COPY production ./production
RUN node production/build-assets.mjs /app/chapa-public
ENV NODE_ENV=production CHAPA_CONFIG=/run/secrets/chapa-runtime.json
USER node
EXPOSE 3211
CMD ["node","production/serve.mjs"]
