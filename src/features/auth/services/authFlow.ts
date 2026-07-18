export type AuthFlowStep =
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'verify'
  | 'success'
  | 'recovery'
  | 'phone'
  | 'verifyPhone'
  | 'recoveryCode'
  | 'reset'
  | 'resetSuccess';

export function isAuthFormStep(step: AuthFlowStep) {
  return step !== 'welcome';
}

export function getAuthBackTarget(step: AuthFlowStep): AuthFlowStep {
  if (step === 'signin' || step === 'signup' || step === 'phone') return 'welcome';
  if (step === 'verify') return 'signup';
  if (step === 'verifyPhone') return 'phone';
  if (step === 'recovery') return 'signin';
  if (step === 'recoveryCode') return 'recovery';
  if (step === 'reset') return 'recoveryCode';
  return 'welcome';
}
