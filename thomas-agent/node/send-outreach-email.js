const nodemailer = require('nodemailer');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function usage() {
  console.error('Usage: node send-outreach-email.js --to lead@example.com --subject "Quick idea" --text "Message body"');
}

function parseArgs(argv) {
  const options = {
    to: '',
    subject: '',
    text: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--to') {
      options.to = argv[++index] || '';
    } else if (arg === '--subject') {
      options.subject = argv[++index] || '';
    } else if (arg === '--text') {
      options.text = argv[++index] || '';
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.to = normalizeEmail(options.to);
  options.subject = normalizeText(options.subject);
  options.text = String(options.text || '').trim();
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message || error);
    usage();
    process.exit(1);
  }

  if (options.help) {
    usage();
    return;
  }

  if (!(options.to && options.subject && options.text)) {
    usage();
    process.exit(1);
  }

  const user = normalizeEmail(process.env.GMAIL_USER);
  const pass = normalizeText(process.env.GMAIL_APP_PASSWORD);
  if (!(user && pass)) {
    console.error('GMAIL_USER and GMAIL_APP_PASSWORD are required for automatic outreach email.');
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `"Thomas @ 3dvr.tech" <${user}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });

  console.log(`Sent outreach email to ${options.to}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
