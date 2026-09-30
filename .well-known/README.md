# Android App Links

Android verifies Digital Asset Links only at the **host root**:

`https://ihormich.github.io/.well-known/assetlinks.json`

This file is also copied under the Matchcard site at
`/ffk/.well-known/assetlinks.json` for reference, but verification uses the
user GitHub Pages site (`IhorMich/ihormich.github.io`).

## Fingerprints

- Debug keystore SHA-256 is already included (local `./gradlew installDebug`).
- For Play / release builds, add the **App signing key certificate** SHA-256 from
  Play Console → App integrity → App signing into `assetlinks.json` (both repos),
  then rebuild the Android app.

```bash
# debug fingerprint
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" \
  -list -v -keystore "$HOME/.android/debug.keystore" \
  -storepass android -alias androiddebugkey
```
