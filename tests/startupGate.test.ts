import {
  isAuthIntroComplete,
  markAuthIntroComplete,
  markIntroNotRequired,
  requireAuthIntroCompletion,
  waitForStartupInteractionReady,
} from '../src/bootstrap/startupGate';

describe('startup gate', () => {
  afterEach(() => markIntroNotRequired());

  it('blocks deferred work until auth intro completes', async () => {
    requireAuthIntroCompletion();
    let released = false;
    const waiting = waitForStartupInteractionReady().then(() => { released = true; });
    await Promise.resolve();
    expect(released).toBe(false);
    expect(isAuthIntroComplete()).toBe(false);
    markAuthIntroComplete();
    await waiting;
    expect(released).toBe(true);
    expect(isAuthIntroComplete()).toBe(true);
  });

  it('resolves immediately when intro is not required', async () => {
    markIntroNotRequired();
    await expect(waitForStartupInteractionReady()).resolves.toBeUndefined();
  });
});
