fix(api): commit package-lock.json so the image build finds it

The repo-root .gitignore excluded package-lock.json, so the lockfile
never reached the build context and `COPY package.json package-lock.json`
failed in kaniko. Add services/api/.gitignore with a `!package-lock.json`
negation to re-include the lockfile required by `npm ci`.
