const fs = require('fs');
const os = require('os');
const path = require('path');
const { ImapFlow } = require('imapflow');

const ROOT = path.join(__dirname, '..');
const STATE_DIR = process.env.THREEDVR_AUTOPILOT_STATE_DIR || path.join(ROOT, 'state');
const STATE_FILE = process.env.THREEDVR_INBOX_STATE_FILE || path.join(STATE_DIR, 'inbox-monitor-state.json');
const DEFAULT_TOKEN_FILE = process.env.THREEDVR_AUTOPILOT_EMAIL_TOKEN_FILE || path.join(os.homedir(), '.3dvr-agent-operator-email-token');
const DEFAULT_NOTIFY_EMAIL = normalizeEmail(
  process.env.THREEDVR_AUTOPILOT_NOTIFY_EMAIL
  || process.env.GMAIL_USER
  || '3dvr.tech@gmail.com'
);
const DEFAULT_PORTAL_EMAIL_ENDPOINT = normalizeText(
  process.env.THREEDVR_AUTOPILOT_EMAIL_ENDPOINT
  || process.env.THREEDVR_OUTREACH_EMAIL_ENDPOINT
  || 'https://portal.3dvr.tech/api/calendar/reminder-email'
);
const DEFAULT_PORTAL_EMAIL_TOKEN = normalizeText(
  process.env.THREEDVR_AUTOPILOT_EMAIL_TOKEN
  || process.env.THREEDVR_OUTREACH_EMAIL_TOKEN
  || process.env.AGENT_OPERATOR_EMAIL_TOKEN
  || readOptionalFile(DEFAULT_TOKEN_FILE)
);
const DEFAULT_IMAP_HOST = normalizeText(process.env.THREEDVR_INBOX_IMAP_HOST || 'imap.gmail.com');
const DEFAULT_IMAP_PORT = parseInteger(process.env.THREEDVR_INBOX_IMAP_PORT, 993);
const DEFAULT_IMAP_TLS = !/^(0|false|no|off)$/i.test(String(process.env.THREEDVR_INBOX_IMAP_TLS || 'true').trim());
const DEFAULT_MAILBOX = normalizeText(process.env.THREEDVR_INBOX_MAILBOX || 'INBOX');
const DEFAULT_POLL_LIMIT = parseInteger(process.env.THREEDVR_INBOX_LIMIT, 10);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    return normalizeText(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return '';
  }
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function loadState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) {
    return {
      version: 1,
      seen: {},
      lastAlertAt: '',
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      version: 1,
      seen: parsed && typeof parsed.seen === 'object' ? parsed.seen : {},
      lastAlertAt: normalizeText(parsed?.lastAlertAt),
    };
  } catch {
    return {
      version: 1,
      seen: {},
      lastAlertAt: '',
    };
  }
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function usage() {
  console.log(`Usage:
  ask-inbox [--dry-run] [--limit 10]

Environment:
  GMAIL_USER / GMAIL_APP_PASSWORD          required for Gmail IMAP access
  THREEDVR_INBOX_IMAP_HOST                 default imap.gmail.com
  THREEDVR_INBOX_IMAP_PORT                 default 993
  THREEDVR_INBOX_IMAP_TLS                  default true
  THREEDVR_INBOX_MAILBOX                   default INBOX
  THREEDVR_INBOX_LIMIT                     default 10
  THREEDVR_AUTOPILOT_NOTIFY_EMAIL          operator alert recipient
  THREEDVR_AUTOPILOT_EMAIL_ENDPOINT        portal email relay endpoint
  THREEDVR_AUTOPILOT_EMAIL_TOKEN           portal email relay token
  THREEDVR_AUTOPILOT_EMAIL_TOKEN_FILE      optional token file path`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    limit: DEFAULT_POLL_LIMIT,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--limit') {
      options.limit = parseInteger(argv[++index], DEFAULT_POLL_LIMIT);
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.limit = Math.max(1, options.limit || DEFAULT_POLL_LIMIT);
  return options;
}

function formatAddress(address) {
  if (!address) return '';
  const name = normalizeText(address.name);
  const email = normalizeEmail(address.address);
  if (name && email) return `${name} <${email}>`;
  return email || name;
}

function formatSubject(subject) {
  const value = normalizeText(subject);
  return value || '(no subject)';
}

function snippet(text) {
  const value = normalizeText(String(text || ''));
  if (!value) return '';
  if (
    /content-transfer-encoding:/i.test(value)
    || /content-type:/i.test(value)
    || /--[a-z0-9]{8,}/i.test(value)
  ) {
    return '';
  }
  return value.replace(/\s+/g, ' ').slice(0, 220);
}

function summarizeMessage(message) {
  const envelope = message.envelope || {};
  const from = Array.isArray(envelope.from) && envelope.from.length ? formatAddress(envelope.from[0]) : 'unknown sender';
  const replyTo = Array.isArray(envelope.replyTo) && envelope.replyTo.length ? formatAddress(envelope.replyTo[0]) : '';
  const subject = formatSubject(envelope.subject);
  const date = envelope.date instanceof Date && !Number.isNaN(envelope.date.getTime())
    ? envelope.date.toISOString()
    : '';
  const messageId = normalizeText(envelope.messageId || `uid-${message.uid}`);
  const preview = snippet(message.bodyParts?.get('1') || message.bodyParts?.get('text/plain') || '');

  return {
    uid: message.uid,
    messageId,
    from,
    replyTo,
    subject,
    date,
    preview,
  };
}

async function loadUnreadMessages(limit) {
  const user = normalizeEmail(process.env.GMAIL_USER);
  const pass = normalizeText(process.env.GMAIL_APP_PASSWORD);
  if (!(user && pass)) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are required for inbox monitoring.');
  }

  const client = new ImapFlow({
    host: DEFAULT_IMAP_HOST,
    port: DEFAULT_IMAP_PORT,
    secure: DEFAULT_IMAP_TLS,
    auth: {
      user,
      pass,
    },
    logger: false,
  });

  const rows = [];

  try {
    await client.connect();
    await client.mailboxOpen(DEFAULT_MAILBOX);

    const sequence = await client.search({ seen: false });
    const unreadUids = sequence.slice(-limit).reverse();
    if (!unreadUids.length) {
      return [];
    }

    for await (const message of client.fetch(unreadUids, {
      uid: true,
      envelope: true,
      source: true,
    })) {
      let body = '';
      try {
        const source = message.source ? message.source.toString('utf8') : '';
        body = source.split(/\r?\n\r?\n/, 2)[1] || '';
      } catch {
        body = '';
      }

      rows.push({
        uid: message.uid,
        envelope: message.envelope,
        bodyParts: new Map([['1', body]]),
      });
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return rows.map(summarizeMessage).filter((row) => {
    const senderEmail = normalizeEmail(row.from.match(/<([^>]+)>$/)?.[1] || row.from);
    return senderEmail !== normalizeEmail(process.env.GMAIL_USER);
  });
}

function buildAlert(messages) {
  const newest = messages[0];
  const summary = messages.length === 1
    ? `Unread inbox reply from ${newest.from}: ${newest.subject}`
    : `${messages.length} unread inbox messages need review`;
  const actionItems = messages.slice(0, 5).map((message) => {
    const date = message.date ? ` (${message.date})` : '';
    return `${message.from}: ${message.subject}${date}`;
  });
  const lines = [
    summary,
    '',
    ...messages.map((message) => {
      const preview = message.preview ? `\nPreview: ${message.preview}` : '';
      const replyTo = message.replyTo ? `\nReply-To: ${message.replyTo}` : '';
      const date = message.date ? `\nDate: ${message.date}` : '';
      return `From: ${message.from}\nSubject: ${message.subject}${date}${replyTo}${preview}`;
    }),
    '',
    'Useful commands:',
    '- ask-inbox',
    '- ask-next',
  ];

  return {
    subject: `[3dvr-agent] inbox attention: ${summary}`,
    summary,
    actionItems,
    text: lines.join('\n'),
  };
}

async function sendPortalAlert(alert) {
  if (!DEFAULT_PORTAL_EMAIL_ENDPOINT) {
    return { ok: false, reason: 'portal email endpoint not configured' };
  }
  if (!DEFAULT_PORTAL_EMAIL_TOKEN) {
    return { ok: false, reason: 'portal email token not configured' };
  }
  if (!DEFAULT_NOTIFY_EMAIL) {
    return { ok: false, reason: 'notify email not configured' };
  }

  const response = await fetch(DEFAULT_PORTAL_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEFAULT_PORTAL_EMAIL_TOKEN}`,
    },
    body: JSON.stringify({
      mode: 'operator-alert',
      to: [DEFAULT_NOTIFY_EMAIL],
      subject: alert.subject,
      summary: alert.summary,
      text: alert.text,
      actionItems: alert.actionItems,
      commands: ['ask-inbox', 'ask-next'],
      metadata: {
        mailbox: DEFAULT_MAILBOX,
        unreadMessages: String(alert.actionItems.length),
      },
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: payload?.error || `portal email request failed: ${response.status}`,
      status: response.status,
    };
  }

  return {
    ok: true,
    status: response.status,
    to: DEFAULT_NOTIFY_EMAIL,
  };
}

function pruneSeen(seen) {
  const entries = Object.entries(seen)
    .sort((left, right) => String(right[1]).localeCompare(String(left[1])))
    .slice(0, 200);
  return Object.fromEntries(entries);
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

  const state = loadState();
  const unread = await loadUnreadMessages(options.limit);
  const fresh = unread.filter((message) => !state.seen[message.messageId]);

  if (!unread.length) {
    console.log('No unread inbox messages.');
    return;
  }

  console.log(`Unread inbox messages: ${unread.length}`);
  unread.forEach((message) => {
    console.log(`- ${message.from} | ${message.subject}`);
  });

  if (!fresh.length) {
    console.log('No newly surfaced unread messages.');
    return;
  }

  const alert = buildAlert(fresh);
  if (options.dryRun) {
    console.log('\nDry run alert preview:\n');
    console.log(alert.text);
    return;
  }

  const result = await sendPortalAlert(alert);
  if (!result.ok) {
    throw new Error(result.reason || 'Unable to send inbox alert.');
  }

  unread.forEach((message) => {
    state.seen[message.messageId] = message.date || new Date().toISOString();
  });
  state.seen = pruneSeen(state.seen);
  state.lastAlertAt = new Date().toISOString();
  saveState(state);
  console.log(`Alerted ${result.to} about ${fresh.length} inbox message(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
