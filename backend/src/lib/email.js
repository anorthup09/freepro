const { sendMail, isConfigured } = require('./mailer');

async function sendQuestionNotification({ pocEmail, pocName, projectTitle, projectCode, question, shareToken }) {
  if (!isConfigured() || !pocEmail) return;
  const shareUrl = `${process.env.FRONTEND_URL || 'https://freepro-production.up.railway.app'}/share/${shareToken}`;
  try {
    const { noticeHtml } = require('./emailTemplates');
    await sendMail({
      identity: 'production',
      to: pocEmail,
      subject: `New question on ${projectCode} — ${projectTitle}`,
      text: `Hi ${pocName || 'there'},\n\nA new question was submitted on the Crew View for ${projectCode} — ${projectTitle}:\n\n"${question}"\n\nView & answer: ${shareUrl}`,
      html: noticeHtml({ tag: 'Call Sheet', note: 'New crew question',
        title: projectTitle, subtitle: projectCode,
        intro: `Hi ${pocName || 'there'} — a new question was submitted on the Crew View:`,
        blocks: [['Question', question]],
        button: { label: 'View & answer', url: shareUrl },
        postmark: new Date() }),
    });
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

module.exports = { sendQuestionNotification };
