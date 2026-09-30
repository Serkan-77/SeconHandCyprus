// Branded transactional e-mails (Turkish). Plain table layout with inline
// styles, which is what e-mail clients render reliably; every message also
// has a text version. Values are escaped; only our own URLs become links.
import type { Mail } from "./mailer.ts";

const BRAND = "Kıbrıs İkinci Elcim";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { title: string; intro: string; action?: { label: string; url: string }; outro: string }) {
  const button = opts.action
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(opts.action.label)}</a></td></tr>
       <tr><td style="font-size:13px;color:#6b7280;padding-bottom:16px">Buton çalışmazsa bu adresi tarayıcına yapıştır:<br><span style="word-break:break-all;color:#374151">${esc(opts.action.url)}</span></td></tr>`
    : "";
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-weight:700;font-size:15px;padding-bottom:20px">${BRAND}</td></tr>
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${esc(opts.title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#374151;padding-bottom:20px">${esc(opts.intro)}</td></tr>
${button}
<tr><td style="font-size:13px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px">${esc(opts.outro)}</td></tr>
</table></td></tr></table></body></html>`;
}

function text(opts: { title: string; intro: string; action?: { label: string; url: string }; outro: string }) {
  return [BRAND, "", opts.title, "", opts.intro, "", opts.action ? `${opts.action.label}: ${opts.action.url}\n` : "", opts.outro].join("\n");
}

function mail(to: string, subject: string, body: Parameters<typeof layout>[0]): Mail {
  return { to, subject, html: layout(body), text: text(body) };
}

export const emails = {
  verify(to: string, name: string, url: string) {
    return mail(to, "E-posta adresini doğrula", {
      title: `Hoş geldin, ${name}`,
      intro: "Hesabını kullanmaya başlamak için e-posta adresini doğrula. Bağlantı 24 saat geçerlidir.",
      action: { label: "E-postamı doğrula", url },
      outro: "Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin; adresin doğrulanmadan hesap kullanılamaz.",
    });
  },
  alreadyRegistered(to: string, loginUrl: string, resetUrl: string) {
    return mail(to, "Bu e-posta ile zaten bir hesabın var", {
      title: "Zaten kayıtlısın",
      intro: `Birisi (muhtemelen sen) bu e-posta adresiyle yeniden kayıt olmayı denedi. Hesabın duruyor; giriş yapabilirsin. Şifreni hatırlamıyorsan sıfırlayabilirsin: ${resetUrl}`,
      action: { label: "Giriş yap", url: loginUrl },
      outro: "Bu denemeyi sen yapmadıysan bir şey yapmana gerek yok; hesabında hiçbir değişiklik olmadı.",
    });
  },
  passwordReset(to: string, url: string) {
    return mail(to, "Şifre sıfırlama isteği", {
      title: "Şifreni sıfırla",
      intro: "Hesabın için şifre sıfırlama istendi. Yeni şifreni belirlemek için aşağıdaki bağlantıyı kullan. Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir.",
      action: { label: "Yeni şifre belirle", url },
      outro: "Bu isteği sen yapmadıysan bu e-postayı yok say; şifren değişmez.",
    });
  },
  passwordChanged(to: string, supportUrl: string) {
    return mail(to, "Şifren değiştirildi", {
      title: "Şifren değiştirildi",
      intro: "Hesabının şifresi az önce değiştirildi ve diğer cihazlardaki oturumların kapatıldı.",
      action: { label: "Bu ben değildim", url: supportUrl },
      outro: "Bu değişikliği sen yaptıysan başka bir şey yapmana gerek yok.",
    });
  },
};
