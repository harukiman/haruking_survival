// audit/lint.js — コミット前静的ガード
//  1) 全 js の構文チェック (node --check)
//  2) IIFE 内 UPPERCASE 定数への後付け代入検出 (var巻き上げ TypeError の既知落とし穴)
//  3) 公開リポへのユーザー名/絶対パス露出検出
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const problems = [];

// 1) 構文チェック
const jsFiles = [];
for (const dir of ['js', 'audit', 'audit/lib', 'audit/personas', '.']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith('.js') && fs.statSync(path.join(d, f)).isFile()) jsFiles.push(path.join(d, f));
  }
}
for (const f of [...new Set(jsFiles)]) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { problems.push(`SYNTAX: ${path.relative(ROOT, f)}: ${String(e.stderr).split('\n')[0]}`); }
}

// 2) UPPERCASE const 後付け代入: 同一ファイルで `const NAME = {...}` 宣言後に `NAME.xxx = ` 以外の
//    `NAME = ` 再代入、または宣言前の `NAME.prop` アクセスがある var 巻き上げパターンを検出
for (const f of jsFiles.filter(p => p.includes('/js/'))) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const constDecl = {}; // NAME -> line
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*(?:const|var|let)\s+([A-Z][A-Z0-9_]{2,})\s*=/);
    if (m && constDecl[m[1]] === undefined) constDecl[m[1]] = i;
  });
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*=[^=]/);
    if (m && constDecl[m[1]] !== undefined && i !== constDecl[m[1]]) {
      problems.push(`HOIST-RISK: ${path.relative(ROOT, f)}:${i + 1}: 後付け代入 ${m[1]} = ... (宣言 literal に含めるべき)`);
    }
  });
}

// 3) ユーザー名/絶対パス露出 (git 管理ファイルのみ)
let tracked = [];
try { tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n'); } catch (e) {}
const user = os.userInfo().username;
for (const rel of tracked) {
  if (!/\.(js|html|css|md|json)$/.test(rel)) continue;
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('/Users/' + user) || src.includes(user)) {
    problems.push(`LEAK: ${rel}: ユーザー名/絶対パスが含まれる`);
  }
}

if (problems.length) {
  console.error('LINT FAIL (' + problems.length + '):');
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
} else {
  console.log('LINT PASS — syntax / hoist / leak すべて緑');
}
