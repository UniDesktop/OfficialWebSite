#!/usr/bin/env node
/**
 * Hero version control.
 *
 *   node scripts/hero.mjs list                 show every saved version
 *   node scripts/hero.mjs save [name]          snapshot the current hero
 *   node scripts/hero.mjs restore [name]       restore a version (default: 00-baseline)
 *   node scripts/hero.mjs diff [name]          diff the live hero against a version
 *
 * The hero lives in src/components/Hero.astro, so testing a variation means
 * editing exactly one file — and everything here is a plain file copy, which
 * means a restore can never fail because of a broken edit.
 *
 * Restoring is itself undoable: the current file is snapshotted first, under
 * an _autosave- name, before it is overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERO = path.join(ROOT, 'src', 'components', 'Hero.astro');
const VERSIONS = path.join(ROOT, 'hero-versions');
const BASELINE = '00-baseline';

const slug = (s) =>
  String(s).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'version';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function versionFile(name) {
  return path.join(VERSIONS, `${name}.astro`);
}

function listVersions() {
  if (!fs.existsSync(VERSIONS)) return [];
  return fs
    .readdirSync(VERSIONS)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => {
      const p = path.join(VERSIONS, f);
      const st = fs.statSync(p);
      return { name: f.replace(/\.astro$/, ''), bytes: st.size, mtime: st.mtime };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function requireHero() {
  if (!fs.existsSync(HERO)) {
    console.error(`\n  src/components/Hero.astro is missing.\n  Restore it with:  node scripts/hero.mjs restore ${BASELINE}\n`);
    process.exit(1);
  }
}

function assertVersionsDir() {
  if (!fs.existsSync(VERSIONS)) {
    console.error('\n  hero-versions/ is missing — nothing to restore from.\n');
    process.exit(1);
  }
}

const [command, arg] = process.argv.slice(2);

switch (command) {
  case 'list': {
    assertVersionsDir();
    const all = listVersions();
    if (!all.length) {
      console.log('\n  no saved versions yet\n');
      break;
    }
    const live = fs.existsSync(HERO) ? fs.readFileSync(HERO, 'utf8') : null;
    console.log('\n  name                              bytes  saved              matches live');
    console.log('  ' + '-'.repeat(72));
    for (const v of all) {
      const content = fs.readFileSync(versionFile(v.name), 'utf8');
      const same = live !== null && content === live;
      const when = v.mtime.toISOString().slice(0, 16).replace('T', ' ');
      console.log(`  ${v.name.padEnd(32)} ${String(v.bytes).padStart(5)}  ${when}  ${same ? 'yes' : ''}`);
    }
    // Report the live size in bytes too — string length would count CJK glyphs
    // as one and silently disagree with the numbers in the column above.
    const liveBytes = live === null ? 'missing' : fs.statSync(HERO).size;
    console.log(`\n  live hero: src/components/Hero.astro (${liveBytes} bytes)\n`);
    break;
  }

  case 'save': {
    requireHero();
    fs.mkdirSync(VERSIONS, { recursive: true });
    const name = arg ? slug(arg) : `snapshot-${stamp()}`;
    const dest = versionFile(name);
    if (fs.existsSync(dest) && !arg) {
      console.error(`  ${name} already exists`);
      process.exit(1);
    }
    fs.copyFileSync(HERO, dest);
    console.log(`\n  saved  src/components/Hero.astro  ->  hero-versions/${name}.astro\n`);
    break;
  }

  case 'restore': {
    assertVersionsDir();
    const name = arg ? slug(arg) : BASELINE;
    const src = versionFile(name);
    if (!fs.existsSync(src)) {
      console.error(`\n  no such version: ${name}\n`);
      const all = listVersions();
      console.error(all.length ? '  available: ' + all.map((v) => v.name).join(', ') + '\n' : '');
      process.exit(1);
    }
    // Make the restore itself undoable.
    if (fs.existsSync(HERO)) {
      fs.mkdirSync(VERSIONS, { recursive: true });
      const auto = `_autosave-${stamp()}`;
      fs.copyFileSync(HERO, versionFile(auto));
      console.log(`\n  current hero backed up as hero-versions/${auto}.astro`);
    }
    fs.copyFileSync(src, HERO);
    console.log(`  restored  hero-versions/${name}.astro  ->  src/components/Hero.astro`);
    console.log('\n  the dev server reloads on its own; hard-refresh the browser to replay the hero animation\n');
    break;
  }

  case 'diff': {
    assertVersionsDir();
    const name = arg ? slug(arg) : BASELINE;
    const src = versionFile(name);
    if (!fs.existsSync(src)) {
      console.error(`\n  no such version: ${name}\n`);
      process.exit(1);
    }
    try {
      execFileSync('git', ['--no-pager', 'diff', '--no-index', '--color=always', src, HERO], { stdio: 'inherit' });
    } catch {
      /* git diff exits 1 when files differ; that is the normal case */
    }
    break;
  }

  default:
    console.log(`
  Hero version control — the hero is src/components/Hero.astro.

    node scripts/hero.mjs list               show saved versions
    node scripts/hero.mjs save [name]        snapshot the current hero
    node scripts/hero.mjs restore [name]     restore one (default: ${BASELINE})
    node scripts/hero.mjs diff [name]        diff live vs a version

  Edit Hero.astro freely to test a variation; ${BASELINE} is the committed
  restore point and is never written to by the save command.
`);
    if (command) process.exit(1);
}
