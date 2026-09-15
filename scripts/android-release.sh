#!/usr/bin/env bash
# Build a signed Play release bundle (AAB) when android/keystore.properties exists.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROPS="$ROOT/android/keystore.properties"
cd "$ROOT"

if [[ ! -f "$PROPS" ]]; then
  cat <<'EOF'
Missing android/keystore.properties.

Create a Play upload keystore once:

  keytool -genkeypair -v \
    -keystore android/matchcard-upload.jks \
    -alias matchcard \
    -keyalg RSA -keysize 2048 -validity 10000

Then write android/keystore.properties (gitignored):

  storeFile=matchcard-upload.jks
  storePassword=...
  keyAlias=matchcard
  keyPassword=...

Keep a backup of the .jks and passwords — Play updates need the same key.
EOF
  exit 1
fi

npm run cap:sync
cd android
./gradlew bundleRelease
echo
echo "AAB: android/app/build/outputs/bundle/release/app-release.aab"
