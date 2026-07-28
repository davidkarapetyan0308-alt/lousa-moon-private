let introRequired = false;
let introComplete = false;
let resolveIntro: (() => void) | null = null;
let introPromise: Promise<void> = Promise.resolve();

export function requireAuthIntroCompletion() {
  if (introRequired && !introComplete) return;
  introRequired = true;
  introComplete = false;
  introPromise = new Promise<void>((resolve) => {
    resolveIntro = resolve;
  });
}

export function markAuthIntroComplete() {
  if (introComplete) return;
  introComplete = true;
  resolveIntro?.();
  resolveIntro = null;
}

export function markIntroNotRequired() {
  introRequired = false;
  introComplete = true;
  resolveIntro?.();
  resolveIntro = null;
  introPromise = Promise.resolve();
}

export function waitForStartupInteractionReady() {
  return introRequired && !introComplete ? introPromise : Promise.resolve();
}

export function isAuthIntroComplete() {
  return introComplete;
}
