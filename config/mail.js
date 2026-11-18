// Envoi des e-mails avec Nodemailer.
// En développement (SMTP_HOST vide), les mails ne partent pas : ils sont affichés dans la console.
const nodemailer = require('nodemailer');

const transporteur = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

async function envoyerMail(destinataire, sujet, texte) {
  try {
    const info = await transporteur.sendMail({
      from: process.env.MAIL_FROM || 'Vite & Gourmand <no-reply@vite-gourmand.fr>',
      to: destinataire,
      subject: sujet,
      text: texte,
    });
    if (!process.env.SMTP_HOST) console.log(`[MAIL non envoyé, mode dev] à ${destinataire} : ${sujet}\n${texte}\n`);
    return info;
  } catch (erreur) {
    // Un mail qui échoue ne doit pas faire planter l'action de l'utilisateur
    console.error('Erreur envoi mail :', erreur.message);
  }
}

module.exports = { envoyerMail };
