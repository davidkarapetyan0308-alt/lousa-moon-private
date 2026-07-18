import { getUserFacingErrorMessage } from '../src/services/errorMessages';

describe('auth error messages', () => {
  it('does not expose the Firebase email-already-in-use code or English SDK message', () => {
    const message = getUserFacingErrorMessage({
      code: 'FIREBASE_EMAIL_ALREADY_IN_USE',
      message: '[auth/email-already-in-use] The email address is already in use by another account.',
    });

    expect(message).toBe(
      'Аккаунт с такой электронной почтой уже существует. Войдите в существующий аккаунт.',
    );
    expect(message).not.toContain('auth/email-already-in-use');
  });
});
