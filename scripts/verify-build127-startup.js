const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const layout = read('app/_layout.tsx');
const shell = read('src/bootstrap/AppShell.tsx');
const reveal = read('src/features/auth/components/AuthPaperReveal.tsx');
const startupExperience = read('src/bootstrap/StartupExperience.tsx');
const gate = read('src/bootstrap/startupGate.ts');
const trace = read('src/bootstrap/startupTrace.ts');
const login = read('app/auth/login.tsx');

if (!layout.includes("import AppShell from '../src/bootstrap/AppShell'")) errors.push('RootLayout must statically import AppShell');
if (/require\(['"]\.\.\/src\/bootstrap\/AppShell['"]\)/.test(layout)) errors.push('Dynamic AppShell require is forbidden');
if (!layout.includes('holdNativeSplashAtModuleLoad();')) errors.push('Native splash hold missing');
if (!shell.includes('requireAuthIntroCompletion()')) errors.push('Unauthenticated route must require intro completion');
if (!shell.includes('waitForStartupInteractionReady()')) errors.push('Deferred services are not gated');
if (!shell.includes("traceStartup('DEFERRED_BOOTSTRAP_STARTED'")) errors.push('Deferred bootstrap trace missing');
if (!reveal.includes('markAuthIntroComplete();')) errors.push('Intro completion does not release startup gate');
if (!reveal.includes("traceStartup('FIRST_PAPER_FRAME_READY')")) errors.push('First frame trace missing');
if (!reveal.includes("traceStartup('INTRO_COMPLETED'")) errors.push('Intro completion trace missing');
if (!gate.includes('introPromise')) errors.push('Startup gate promise missing');
if (!trace.includes('global.performance?.now?.()')) errors.push('Monotonic startup trace missing');
if (!startupExperience.includes('<AuthPaperRevealGate active startWhenReady={routeReady}>')) errors.push('Global StartupExperience must own Paper Moon');
if (!shell.includes('<StartupExperience routeReady=')) errors.push('AppShell must mount global StartupExperience');
if (login.includes('AuthPaperRevealGate') || login.includes('playPaperMoonIntro')) errors.push('Login must not own Paper Moon');
if (/PaperMoonEntry|BootMoon|SplashMoon|WelcomeAnimation/.test(shell + layout + login)) errors.push('Legacy intro runtime reference found');
if (/Проверяем сессию|Начинаем сессию|Загружаем данные/.test(shell + layout)) errors.push('Visible startup copy remains');
if (errors.length) {
  console.error('verify:build127-startup FAIL');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}
console.log('verify:build127-startup PASS — one startup tree, gated services, monotonic trace');
