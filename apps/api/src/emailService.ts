import nodemailer from 'nodemailer';

type Locale = 'ru' | 'en' | 'hy';

export interface VerificationEmailInput {
  email: string;
  code: string;
  locale: Locale;
  expiresAt: Date;
  purpose: 'registration' | 'password_reset' | 'email_change';
}

export interface EmailSendResult {
  provider: 'resend' | 'smtp' | 'console-dev';
  messageId?: string;
  devCode?: string;
}

const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || (APP_ENV === 'production' ? '' : 'console')).toLowerCase();
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'LOUSA MOON';
const EMAIL_SENDER_ADDRESS = process.env.EMAIL_SENDER_ADDRESS || 'onboarding@resend.dev';
const EMAIL_FROM = process.env.EMAIL_FROM || `${EMAIL_SENDER_NAME} <${EMAIL_SENDER_ADDRESS}>`;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || '';

function getCopy(locale: Locale, purpose: VerificationEmailInput['purpose']) {
  const copies = {
    ru: {
      subject: purpose === 'password_reset' ? 'Код восстановления LOUSA MOON' : 'Код подтверждения LOUSA MOON',
      title: purpose === 'password_reset' ? 'Восстановление пароля' : 'Подтверждение email',
      intro: 'Введите этот шестизначный код в приложении LOUSA MOON:',
      expiry: 'Код действует 10 минут.',
      safety: 'Никому не сообщайте этот код. Если вы не запрашивали его, просто проигнорируйте письмо.',
    },
    en: {
      subject: purpose === 'password_reset' ? 'LOUSA MOON password reset code' : 'LOUSA MOON verification code',
      title: purpose === 'password_reset' ? 'Reset your password' : 'Verify your email',
      intro: 'Enter this six-digit code in the LOUSA MOON app:',
      expiry: 'The code is valid for 10 minutes.',
      safety: 'Do not share this code. If you did not request it, you can safely ignore this email.',
    },
    hy: {
      subject: purpose === 'password_reset' ? 'LOUSA MOON գաղտնաբառի վերականգնման կոդ' : 'LOUSA MOON հաստատման կոդ',
      title: purpose === 'password_reset' ? 'Գաղտնաբառի վերականգնում' : 'Էլ․ փոստի հաստատում',
      intro: 'Մուտքագրեք այս վեցանիշ կոդը LOUSA MOON հավելվածում․',
      expiry: 'Կոդը գործում է 10 րոպե։',
      safety: 'Մի փոխանցեք այս կոդը ուրիշներին։ Եթե չեք խնդրել այն, անտեսեք նամակը։',
    },
  } as const;
  return copies[locale] || copies.ru;
}

function renderEmail(input: VerificationEmailInput) {
  const copy = getCopy(input.locale, input.purpose);
  const html = `<!doctype html>
<html lang="${input.locale}">
  <body style="margin:0;background:#fbf8f7;font-family:Arial,sans-serif;color:#211a24">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbf8f7;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fffdfE;border:1px solid #f0dde5;border-radius:24px;padding:32px">
          <tr><td style="font-size:13px;letter-spacing:4px;color:#a64d72;font-weight:700">LOUSA MOON</td></tr>
          <tr><td style="padding-top:20px;font-family:Georgia,serif;font-size:30px;line-height:1.2">${copy.title}</td></tr>
          <tr><td style="padding-top:14px;font-size:16px;line-height:1.6;color:#655967">${copy.intro}</td></tr>
          <tr><td align="center" style="padding:28px 0">
            <div style="display:inline-block;padding:18px 26px;border-radius:18px;background:#f4dde6;color:#5b365f;font-size:36px;letter-spacing:10px;font-weight:700">${input.code}</div>
          </td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#655967">${copy.expiry}</td></tr>
          <tr><td style="padding-top:12px;font-size:13px;line-height:1.6;color:#8b7b86">${copy.safety}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `LOUSA MOON\n\n${copy.title}\n${copy.intro}\n\n${input.code}\n\n${copy.expiry}\n${copy.safety}`;
  return { subject: copy.subject, html, text };
}

async function sendWithResend(input: VerificationEmailInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const content = renderEmail(input);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [input.email],
      ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
      ...content,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((payload as any)?.message || `Resend error ${response.status}`));
  return { provider: 'resend', messageId: String((payload as any)?.id || '') || undefined };
}

async function sendWithSmtp(input: VerificationEmailInput): Promise<EmailSendResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS are required.');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });
  const content = renderEmail(input);
  const result = await transporter.sendMail({
    from: EMAIL_FROM,
    to: input.email,
    ...(EMAIL_REPLY_TO ? { replyTo: EMAIL_REPLY_TO } : {}),
    ...content,
  });
  return { provider: 'smtp', messageId: result.messageId };
}

export function isEmailDeliveryConfigured() {
  if (EMAIL_PROVIDER === 'resend') return Boolean(process.env.RESEND_API_KEY);
  if (EMAIL_PROVIDER === 'smtp') return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return APP_ENV !== 'production' && EMAIL_PROVIDER === 'console';
}

export function getEmailDeliveryMode() {
  if (EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) return 'resend';
  if (EMAIL_PROVIDER === 'smtp' && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  if (APP_ENV !== 'production' && EMAIL_PROVIDER === 'console') return 'console-dev';
  return 'not-configured';
}

export function canExposeDevOtp() {
  return APP_ENV !== 'production' && (process.env.ALLOW_DEV_OTP_RESPONSE === 'true' || EMAIL_PROVIDER === 'console');
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<EmailSendResult> {
  if (EMAIL_PROVIDER === 'resend') return sendWithResend(input);
  if (EMAIL_PROVIDER === 'smtp') return sendWithSmtp(input);
  if (APP_ENV !== 'production' && EMAIL_PROVIDER === 'console') {
    // Development transport. This prevents registration from failing when Resend/SMTP is not configured.
    // In production, configure RESEND_API_KEY or SMTP_*; console delivery is blocked.
    console.info(`[dev-email] ${input.purpose} ${input.email}: ${input.code}`);
    return { provider: 'console-dev', devCode: canExposeDevOtp() ? input.code : undefined };
  }
  throw new Error('EMAIL_PROVIDER is not configured for real email delivery.');
}
