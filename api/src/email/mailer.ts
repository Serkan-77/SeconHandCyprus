// Transactional e-mail behind one interface.
//   smtp    production (credentials from the environment only)
//   log     development: prints the message, including its link, to the log.
//           Refused in production by config.ts, since links carry tokens.
//   memory  tests: messages are kept in `outbox`.
import nodemailer from "nodemailer";
import type { Config } from "../config.ts";

export type Mail = { to: string; subject: string; text: string; html: string };

export type Mailer = { send(mail: Mail): Promise<void>; outbox: Mail[] };

export function createMailer(config: Config, log: { info: (o: object, m: string) => void }): Mailer {
  const outbox: Mail[] = [];
  if (config.MAIL_TRANSPORT === "memory") {
    return { outbox, async send(mail) { outbox.push(mail); } };
  }
  if (config.MAIL_TRANSPORT === "log") {
    return {
      outbox,
      async send(mail) {
        log.info({ to: mail.to, subject: mail.subject, text: mail.text }, "mail (log transport, development only)");
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
  return {
    outbox,
    async send(mail) {
      await transport.sendMail({ from: config.MAIL_FROM, ...mail });
    },
  };
}
