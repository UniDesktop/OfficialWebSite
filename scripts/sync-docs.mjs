#!/usr/bin/env node
/**
 * Sync the documentation from the upstream docs repository.
 *
 *   node scripts/sync-docs.mjs                clone upstream, rewrite, land
 *   node scripts/sync-docs.mjs --source DIR   use an existing upstream checkout
 *   node scripts/sync-docs.mjs --check        report drift, change nothing
 *
 * Long term this replaces hand-copying: the docs site and the website are two
 * repositories, and without this the website's copy silently goes stale.
 *
 * What it does, in order:
 *   1. reads src/content/docs from UniDesktop/unidesktop.github.io
 *   2. Chinese (the upstream root locale) -> src/content/docs/zh-cn
 *      English (upstream /en)            -> src/content/docs/en
 *   3. rewrites the site-absolute links, because the upstream serves Chinese
 *      from the domain root while the website serves it under /zh-cn
 *   4. re-applies docs-overrides/ (pages the website adds that upstream has not)
 *   5. re-applies the de-duplication fixes for sections upstream repeats
 *   6. records the upstream commit so the next run can say what moved
 *
 * Everything after step 4 is idempotent and self-healing: once upstream fixes a
 * duplicate, the rule simply stops matching.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'src', 'content', 'docs');
const OVERRIDES = path.join(ROOT, 'docs-overrides');
const STATE = path.join(DEST, '.sync-state.json');
const UPSTREAM = 'https://github.com/UniDesktop/unidesktop.github.io.git';
const DEFAULT_BRANCH = 'master';

const SECTIONS = ['getting-started', 'guides', 'reference', 'internals'];

/** Files the website adds that upstream does not have. */
const LOCAL_ONLY = [
  'zh-cn/internals/protocols/index.md',
  'en/internals/protocols/index.md',
];

/**
 * Sections upstream repeats verbatim. Keyed by heading; when the same heading
 * appears more than once with an identical body, every copy after the first is
 * dropped. If upstream fixes it there is only one occurrence and nothing runs.
 */
const DEDUPE = {
  'zh-cn/internals/protocols/statusnotifieritem.md': ['注册顺序'],
  'en/guides/troubleshooting.md': ['Diagnostics CLI'],
};

const args = process.argv.slice(2);
const dryRun = args.includes('--check');
const sourceArg = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;

// ---------------------------------------------------------------- upstream --
function fetchUpstream() {
  if (sourceArg) {
    const p = path.resolve(sourceArg);
    if (!fs.existsSync(path.join(p, 'src', 'content', 'docs'))) {
      throw new Error(`--source ${p} does not look like the docs repository`);
    }
    return { dir: p, commit: '(local checkout)', cleanup: () => {} };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uda-docs-'));
  const dir = path.join(tmp, 'repo');
  process.stdout.write('  cloning upstream… ');
  execFileSync('git', ['clone', '--depth', '1', '--quiet', '--branch', DEFAULT_BRANCH, UPSTREAM, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  const commit = execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  console.log(commit);
  return { dir, commit, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

// ---------------------------------------------------------------- rewrites --
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.mdx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * The upstream serves Chinese from the domain root, so its links are
 * `/guides/tray/`. The website serves Chinese under `/zh-cn`, and — because it
 * has a marketing homepage at `/` — it cannot adopt the root locale. Hence the
 * prefix on markdown links, raw hrefs and frontmatter action links alike.
 */
function rewriteZhLinks(text) {
  return text.replace(
    /(\]\(|href="|^([ \t]*)link:[ \t]*)(\/(?:getting-started|guides|reference|internals)\/)/gm,
    (_m, pre, _indent, url) => `${pre}/zh-cn${url}`,
  );
}

function transform(text, rel, { isEn }) {
  let out = text;
  if (isEn) {
    // The English tree keeps its /en/ links. Only the tip pointing at the
    // Chinese docs needs the prefix this site actually uses.
    out = out.replace(/href="\/"/g, 'href="/zh-cn/"');
  } else {
    out = rewriteZhLinks(out);
    // The Chinese index sits one directory deeper here than upstream.
    if (rel === 'index.mdx') out = out.replace(/(\bfile:[ \t]*)\.\.\/\.\.\/assets\//g, '$1../../../assets/');
  }
  return out;
}

// ------------------------------------------------------------ dedupe fixups --
function dropRepeatedSections(text, headings) {
  let out = text;
  for (const heading of headings) {
    const lines = out.split('\n');
    const marker = `## ${heading}`;
    const starts = [];
    lines.forEach((l, i) => {
      if (l.trim() === marker) starts.push(i);
    });
    if (starts.length < 2) continue;

    // A section runs from its heading to the next `## ` heading, or to EOF.
    const nextHeading = (from) => {
      for (let j = from + 1; j < lines.length; j++) if (lines[j].startsWith('## ')) return j;
      return lines.length;
    };
    const bodies = starts.map((s) => ({ s, e: nextHeading(s) }));
    for (const b of bodies) b.text = lines.slice(b.s, b.e).join('\n');

    // Drop identical later copies. Walk backwards so the earlier indices stay
    // valid as the array shrinks.
    const first = bodies[0].text;
    let result = lines;
    for (let i = bodies.length - 1; i >= 1; i--) {
      if (bodies[i].text !== first) continue;
      result = result.slice(0, bodies[i].s).concat(result.slice(bodies[i].e));
    }
    out = result.join('\n');
  }
  return out;
}

// --------------------------------------------------------------------- main --
const upstream = fetchUpstream();
const SRC = path.join(upstream.dir, 'src', 'content', 'docs');

const planned = new Map(); // relative dest path -> contents

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const isEn = rel.startsWith('en/');
  const destRel = isEn ? rel : `zh-cn/${rel}`;
  let text = transform(fs.readFileSync(file, 'utf8'), isEn ? rel.slice(3) : rel, { isEn });
  text = dropRepeatedSections(text, DEDUPE[destRel] ?? []);
  planned.set(destRel, text);
}

// Local-only pages land last so a sync can never wipe them out.
for (const rel of LOCAL_ONLY) {
  const p = path.join(OVERRIDES, rel);
  if (!fs.existsSync(p)) {
    console.warn(`  warning: override missing: docs-overrides/${rel}`);
    continue;
  }
  planned.set(rel, fs.readFileSync(p, 'utf8'));
}

// ------------------------------------------------------------------ compare --
const current = new Map();
if (fs.existsSync(DEST)) {
  for (const f of walk(DEST)) {
    current.set(path.relative(DEST, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8'));
  }
}

const added = [...planned.keys()].filter((k) => !current.has(k)).sort();
const removed = [...current.keys()].filter((k) => !planned.has(k)).sort();
const changed = [...planned.keys()].filter((k) => current.has(k) && current.get(k) !== planned.get(k)).sort();

console.log(`  upstream : ${upstream.commit}`);
console.log(`  files    : ${planned.size} upstream + overrides   (on disk: ${current.size})`);
console.log(`  added ${added.length} · changed ${changed.length} · removed ${removed.length}`);
for (const k of added) console.log(`    + ${k}`);
for (const k of changed) console.log(`    ~ ${k}`);
for (const k of removed) console.log(`    - ${k}`);

const drift = added.length + changed.length + removed.length;

if (dryRun) {
  upstream.cleanup();
  console.log(drift ? '\n  drift detected' : '\n  in sync');
  process.exit(drift ? 1 : 0);
}

if (!drift) {
  upstream.cleanup();
  console.log('\n  already in sync — nothing written');
  process.exit(0);
}

// -------------------------------------------------------------------- write --
fs.rmSync(DEST, { recursive: true, force: true });
for (const [rel, text] of planned) {
  const out = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text, 'utf8');
}
fs.writeFileSync(
  STATE,
  JSON.stringify({ upstream: UPSTREAM, commit: upstream.commit, syncedAt: new Date().toISOString(), files: planned.size }, null, 2) + '\n',
  'utf8',
);
upstream.cleanup();
console.log(`\n  synced ${planned.size} files from ${upstream.commit}`);
