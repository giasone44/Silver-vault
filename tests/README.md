# End-to-end test

Runs the whole app as a user would (identify, save, research, collection,
search, edit, re-identify, settings, delete) against simulated Claude,
Numista, Ollama and spot-price services.

```bash
cd app && CI=1 npx expo export -p web && cd ../server
APP_TOKEN=t ANTHROPIC_API_KEY=sk-ant-GOOD-0000000000000000000000 NUMISTA_API_KEY=k \
  DATA_DIR=/tmp/sv-test PORT=8788 WEB_DIST_DIR=../app/dist \
  node --no-warnings --import tsx --import ../tests/mock-services.mjs src/index.ts &
cd ../tests && node e2e.mjs            # add OPUS_FAIL=1 to the server to test the backup model
```
Requires Playwright (`npm i playwright`).
