#!/usr/bin/env node
// Fails (exit 1) when the installed version has no «What's new» entry.
// Every release must add its entries to src/lib/whatsNew.ts (release-please does NOT do it).
// The website is built from this same app (App.web.tsx), so one check covers iPhone and web.
//
// Usage: npm run whatsnew:check
//        CHECK_VERSION=0.12.0 npm run whatsnew:check   # check another version (e.g. the next release)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'src', 'lib');
const version = process.env.CHECK_VERSION
  ?? readFileSync(join(LIB, 'version.ts'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
if (!version) { console.error('✗ APP_VERSION not found in src/lib/version.ts'); process.exit(1); }

const src = readFileSync(join(LIB, 'whatsNew.ts'), 'utf8');
const body = src.slice(src.indexOf('export const WHATS_NEW'));
const entries = [...body.matchAll(/\{\s*version:\s*'([^']*)',\s*date:\s*'([^']*)',\s*area:\s*'([^']*)',\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}/g)]
  .map(([, v, date, area, text]) => ({ v, date, area, text }));

const errors = [];
if (entries.length === 0) errors.push('no entries parsed from WHATS_NEW');
for (const e of entries) {
  const at = `${e.v} «${e.text}»`;
  if (!/^\d+\.\d+\.\d+$/.test(e.v)) errors.push(`${at}: version must be x.y.z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`${at}: date must be YYYY-MM-DD`);
  if (!['scan', 'herd', 'weather', 'team'].includes(e.area)) errors.push(`${at}: unknown area «${e.area}»`);
  if (!e.text.trim()) errors.push(`${e.v}: empty text`);
}
// «Coming next» (UPCOMING): título, área, estado e texto obrigatórios.
const upBody = src.includes('export const UPCOMING') ? src.slice(src.indexOf('export const UPCOMING'), src.indexOf('];', src.indexOf('export const UPCOMING'))) : '';
const upcoming = [...upBody.matchAll(/\{\s*title:\s*'((?:[^'\\]|\\.)*)',\s*area:\s*'([^']*)',\s*status:\s*'([^']*)',\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}/g)]
  .map(([, title, area, status, text]) => ({ title, area, status, text }));
const upCount = (upBody.match(/\btitle:/g) ?? []).length;
if (upCount !== upcoming.length) errors.push(`UPCOMING: ${upCount - upcoming.length} entr(y/ies) not in the form { title, area, status, text }`);
for (const u of upcoming) {
  if (!u.title.trim() || !u.text.trim()) errors.push(`upcoming «${u.title}»: title and text are required`);
  if (!['scan', 'herd', 'weather', 'team'].includes(u.area)) errors.push(`upcoming «${u.title}»: unknown area «${u.area}»`);
  if (!['in-progress', 'planned'].includes(u.status)) errors.push(`upcoming «${u.title}»: status must be in-progress or planned`);
}
const mine = entries.filter((e) => e.v === version);
if (mine.length === 0) {
  errors.push(`version ${version} has no entry in src/lib/whatsNew.ts — add what changed for users (plain words, one line per change)`);
}
if (errors.length) { errors.forEach((m) => console.error(`✗ ${m}`)); process.exit(1); }
console.log(`✓ What's new: ${mine.length} entr${mine.length === 1 ? 'y' : 'ies'} for ${version} (${entries.length} in total) · ${upcoming.length} coming next`);
