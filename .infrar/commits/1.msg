Use npm ci in orbit-api Dockerfile

Add the generated package-lock.json and switch the Dockerfile install
step from `npm install --omit=dev` to `npm ci --omit=dev` for
reproducible, lockfile-driven production builds.
