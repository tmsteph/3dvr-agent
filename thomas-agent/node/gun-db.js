const Gun = require('gun');

const RELAY = process.env.THREEDVR_GUN_RELAY || 'https://gun-relay-3dvr.fly.dev/gun';
const APP_ROOT = process.env.THREEDVR_GUN_ROOT || '3dvr';
const CRM_ROOT = process.env.THREEDVR_GUN_CRM || 'crm';
const LEADS_ROOT = process.env.THREEDVR_GUN_LEADS || 'leads';

const gun = Gun({
  peers: [RELAY],
});

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function leadsNode() {
  return gun.get(APP_ROOT).get(CRM_ROOT).get(LEADS_ROOT);
}

module.exports = {
  gun,
  RELAY,
  APP_ROOT,
  CRM_ROOT,
  LEADS_ROOT,
  leadsNode,
  slugify,
};
