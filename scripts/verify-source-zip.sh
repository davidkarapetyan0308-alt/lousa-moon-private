#!/usr/bin/env bash
set -euo pipefail

ZIP="${1:-}"
[[ -n "$ZIP" && -f "$ZIP" ]] || { echo "Usage: scripts/verify-source-zip.sh <source.zip>" >&2; exit 2; }

python3 - "$ZIP" <<'PY'
import json, pathlib, re, sys, zipfile
zip_path=pathlib.Path(sys.argv[1])
required_suffixes={
    'package.json','package-lock.json','README.md','BUILD.md','RELEASE_NOTES.md',
    '.env.production.example','.env.qa.example','docs/HANDOFF.md',
    'docs/PAPER_MOON_ARCHITECTURE.md','docs/PAPER_MOON_DEVICE_QA.md',
    'GOOGLE_AUTH_BUILD128_IMPLEMENTATION_REPORT.md',
    'GOOGLE_AUTH_BUILD128_ROOT_CAUSE.md','GOOGLE_AUTH_BUILD128_DEVICE_QA.md',
    'GOOGLE_AUTH_BUILD128_BACKEND_DEPLOYMENT.md','docs/GOOGLE_AUTH_ARCHITECTURE.md',
    'STARTUP_BUILD130_ROOT_NAVIGATION_FIX.md','STARTUP_BUILD130_DEVICE_QA.md','STARTUP_BUILD131_GLOBAL_EXPERIENCE_FIX.md','STARTUP_BUILD132_STARTUP_GUARANTEE.md','STARTUP_BUILD133_NATIVE_HANDOFF_FIX.md',
    'docs/GOOGLE_OAUTH_CERTIFICATE_MATRIX.md','docs/BACKEND_ENV_MATRIX.md',
    'android/gradlew','android/gradle/wrapper/gradle-wrapper.jar',
    'android/gradle/wrapper/gradle-wrapper.properties','android/app/google-services.json',
    'google-services.json','firebase/google-services.production.json','firebase/google-services.qa.json',
    'scripts/validate-build-env.sh','scripts/build-qa-apk.sh','scripts/build-prod-apk.sh',
    'scripts/verify-apk.sh','scripts/package-source-zip.sh','scripts/verify-source-zip.sh',
    'scripts/run-paper-moon-device-qa.sh','scripts/verify-google-oauth-config.js',
    'scripts/verify-google-auth-build128.js','scripts/verify-build130-root-navigation.js','src/bootstrap/launchCoordinator.ts',
    'src/bootstrap/StartupExperience.tsx','src/features/auth/components/AuthPaperReveal.tsx','src/bootstrap/startupNavigation.ts','app/index.tsx','tests/paperMoonStartupContract.test.ts','tests/themeStartupRecovery.test.ts','tests/startupNavigation.test.ts',
    'assets/images/auth/paper-intro/paper-moon-body.png','assets/images/splash-transparent.png',
    'android/app/src/main/res/drawable-mdpi/splashscreen_logo.png',
    'android/app/src/main/res/drawable-hdpi/splashscreen_logo.png',
    'android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png',
    'android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png',
    'android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png',
}
forbidden_parts={'.git','node_modules','.gradle','.expo','Pods','dist','dist_web','__pycache__'}
forbidden_suffixes={'.apk','.aab','.jks','.keystore','.DS_Store'}
errors=[]
with zipfile.ZipFile(zip_path) as zf:
    files=[n for n in zf.namelist() if not n.endswith('/')]
    if not files:
        errors.append('ZIP is empty')
    roots={n.split('/',1)[0] for n in files}
    if len(roots)!=1:
        errors.append(f'ZIP must contain one project root, found: {sorted(roots)}')
    root=next(iter(roots), '')
    rels={n[len(root)+1:] if root and n.startswith(root+'/') else n for n in files}
    missing=sorted(required_suffixes-rels)
    if missing:
        errors.extend(f'missing required file: {m}' for m in missing)
    for rel in sorted(rels):
        p=pathlib.PurePosixPath(rel)
        if any(part in forbidden_parts for part in p.parts):
            errors.append(f'forbidden directory in ZIP: {rel}')
        if p.suffix in forbidden_suffixes:
            errors.append(f'forbidden binary/secret in ZIP: {rel}')
        if rel in {'.env','.env.qa','.env.production','android/keystore.properties'}:
            errors.append(f'forbidden private config in ZIP: {rel}')
    def read(rel):
        return zf.read(f'{root}/{rel}').decode('utf-8')
    if 'BUILD.md' in rels:
        build=read('BUILD.md')
        exact='npm ci && EXPO_PUBLIC_LOUSA_API_URL=https://lousa-moon-api.onrender.com PUBLIC_API_URL=https://lousa-moon-api.onrender.com npm run android:apk:qa'
        if exact not in build:
            errors.append('BUILD.md does not contain the exact one-command QA build')
    for rel in ['google-services.json','android/app/google-services.json']:
        if rel in rels:
            data=json.loads(read(rel))
            packages={c.get('client_info',{}).get('android_client_info',{}).get('package_name') for c in data.get('client',[])}
            for pkg in ('com.lousa.moon','com.lousa.moon.qa'):
                if pkg not in packages:
                    errors.append(f'{rel} missing Firebase client {pkg}')
            if data.get('project_info',{}).get('project_id')!='lousa-moon':
                errors.append(f'{rel} has unexpected Firebase project_id')
    for rel,pkg in [('firebase/google-services.production.json','com.lousa.moon'),('firebase/google-services.qa.json','com.lousa.moon.qa')]:
        if rel in rels:
            data=json.loads(read(rel))
            packages={c.get('client_info',{}).get('android_client_info',{}).get('package_name') for c in data.get('client',[])}
            if packages!={pkg}:
                errors.append(f'{rel} must contain only {pkg}, got {sorted(x for x in packages if x)}')
    if 'package.json' in rels:
        package=json.loads(read('package.json'))
        if package.get('version')!='1.18.22':
            errors.append(f"package.json version must be 1.18.22, got {package.get('version')}")
    if 'android/app/build.gradle' in rels:
        gradle=read('android/app/build.gradle')
        if not re.search(r'versionCode\s+133\b', gradle):
            errors.append('android/app/build.gradle versionCode 133 missing')
        if 'versionName "1.18.22"' not in gradle:
            errors.append('android/app/build.gradle versionName 1.18.22 missing')
    if 'src/features/auth/components/AuthPaperReveal.tsx' in rels:
        reveal=read('src/features/auth/components/AuthPaperReveal.tsx')
        for contract in ['Asset.loadAsync(AUTH_INTRO_ASSETS)', 'decodedAssetCount >= EXPECTED_DECODED_ASSETS', 'AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS', "activateFallback(missing, 'decode_timeout')", 'testID="auth-paper-thread"', 'getThreadHeightForMoonOffset(scene.threadStartHeight, moonTranslateY.value)', 'onLoad={() => markAssetLoaded', "hideNativeSplashOnce('paper_moon_first_frame_ready')"]:
            if contract not in reveal:
                errors.append(f'Paper Moon startup contract missing: {contract}')
        if 'onLoadEnd=' in reveal:
            errors.append('Paper Moon must not use onLoadEnd as a success signal')
    if 'app.json' in rels:
        app=json.loads(read('app.json'))
        plugins=app.get('expo',{}).get('plugins',[])
        splash=next((x for x in plugins if isinstance(x,list) and x and x[0]=='expo-splash-screen'), None)
        if not splash or splash[1].get('image')!='./assets/images/splash-transparent.png':
            errors.append('native splash must use the transparent background-only asset')
        for rel in ['assets/images/splash-transparent.png',
                    'android/app/src/main/res/drawable-mdpi/splashscreen_logo.png',
                    'android/app/src/main/res/drawable-hdpi/splashscreen_logo.png',
                    'android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png',
                    'android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png',
                    'android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png']:
            if rel in rels and zf.getinfo(f'{root}/{rel}').file_size > 200:
                errors.append(f'native splash asset is not the expected tiny transparent PNG: {rel}')

if errors:
    print('SOURCE ZIP VERIFICATION FAILED', file=sys.stderr)
    for error in errors:
        print(f'- {error}', file=sys.stderr)
    raise SystemExit(1)
print('SOURCE ZIP VERIFICATION PASS')
print(f'ZIP: {zip_path}')
print(f'Files: {len(files)}')
PY
