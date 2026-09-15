# Kural data

`kurals.json` is intentionally kept as a local-cache-ready data slot. The website first reads a populated local dataset and falls back to the public Thirukkural API when the file is empty or a record is missing.

To populate all 1,330 records locally:

```bash
npm install
npm run build-data
```

The browser experience itself does not require this step because it can load individual Kurals from the API.

The primary source used by the app is documented as exposing a Kural-by-number endpoint with Tamil and English fields and browser CORS support. See `DATA-SOURCES.md`.
