// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { formatINR } from '../utils/format.js';

let transporter;
const outbox = []; // last messages when running without SMTP (useful for tests and demos)

function getTransporter() {
  if (transporter) return transporter;
  transporter = env.smtp.enabled
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export const getOutbox = () => outbox;

const layout = (title, body) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
  <h2 style="color:#3B6FB6;margin-bottom:4px">OrderIt</h2>
  <h3 style="margin-top:0">${title}</h3>
  ${body}
  <p style="color:#64748b;font-size:12px;margin-top:32px">This is an automated message from OrderIt.</p>
</div>`;

export async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
    if (!env.smtp.enabled) {
      outbox.push({ to, subject, text, html, at: new Date() });
      if (outbox.length > 50) outbox.shift();
      logger.info(`[email:console] To: ${to} | Subject: ${subject}\n${text}`);
    }
    return info;
  } catch (err) {
    // E-mail failures must never break checkout or auth flows.
    logger.error(`Failed to send e-mail to ${to}: ${err.message}`);
    return null;
  }
}

export function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to OrderIt',
    text: `Hi ${user.name}, your OrderIt account is ready. Happy shopping!`,
    html: layout('Welcome aboard', `<p>Hi ${user.name}, your OrderIt account is ready. Happy shopping!</p>`),
  });
}

export function sendPasswordResetEmail(user, resetUrl) {
  return sendEmail({
    to: user.email,
    subject: 'Reset your OrderIt password',
    text: `Hi ${user.name}, reset your password using this link (valid for 30 minutes): ${resetUrl}\nIf you did not request this, ignore this e-mail.`,
    html: layout(
      'Password reset',
      `<p>Hi ${user.name},</p><p>Use the button below to reset your password. The link is valid for 30 minutes.</p>
       <p><a href="${resetUrl}" style="background:#3B6FB6;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p>
       <p>If you did not request this, you can ignore this e-mail.</p>`,
    ),
  });
}

export function sendOrderConfirmationEmail(user, order) {
  const rows = order.items
    .map((i) => `<tr><td>${i.name}</td><td align="center">${i.quantity}</td><td align="right">${formatINR(i.price * i.quantity)}</td></tr>`)
    .join('');
  return sendEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} confirmed`,
    text: `Hi ${user.name}, thanks for your order ${order.orderNumber}. Total: ${formatINR(order.totalPrice)}.`,
    html: layout(
      `Order ${order.orderNumber} confirmed`,
      `<p>Hi ${user.name}, thanks for shopping with us.</p>
       <table width="100%" cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows}</table>
       <p><strong>Total: ${formatINR(order.totalPrice)}</strong></p>`,
    ),
  });
}

export function sendOrderStatusEmail(user, order) {
  return sendEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} is now ${order.status}`,
    text: `Hi ${user.name}, your order ${order.orderNumber} status changed to "${order.status}".`,
    html: layout(
      'Order update',
      `<p>Hi ${user.name}, your order <strong>${order.orderNumber}</strong> is now <strong>${order.status}</strong>.</p>`,
    ),
  });
}
