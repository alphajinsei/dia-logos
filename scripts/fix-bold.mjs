#!/usr/bin/env node
// 日本語の中で効かなくなった markdown の太字（**...**）を直す。
//
// なぜ要るか:
//   CommonMark は「閉じの ** の直前が約物（」）。など）で、その直後が非空白」だと、
//   その ** を閉じタグとして認めない。日本語だと **「A」**を… という書き方が
//   まさにこれに当たり、太字にならずアスタリスクがそのまま読者に見える。
//   閉じ損ねた ** が隣の ** と誤って結合して、強調するつもりのない地の文が太字に
//   なる「誤爆」も起きる。
//
// 直し方:
//   ** の外側に半角スペースを補う（開き側・閉じ側の両方。片方だけでは効かない）。
//
//   肝は「どの ** が壊れているか」を事前に判定しないこと。判定しようとすると、
//   正常な太字と壊れた太字が混在した行で開き／閉じの対応を読み違え、正しい太字まで
//   壊す（実際にやった）。代わりに「スペースを入れてみて、結果が良くなったときだけ
//   採用する」。良くならなければ元に戻すので、余計なスペースは入らない。
//
//   採用の条件は3つ全部を満たすこと:
//     (1) 生の ** が減った        … 壊れが1つ直った
//     (2) 太字の数が減っていない  … 既存の太字を壊していない
//     (3) 本文の文字が変わらない  … 空白以外は一切いじっていない
//
// 限界:
//   壊れた ** が複数絡み合った段落（1つ直すだけでは改善が現れない）は直せない。
//   その場合は何もせずに残し、最後に「直せなかった」と報告する。悪化はしない。
//
// 使い方:
//   node scripts/fix-bold.mjs src/content/posts/2026-07-13-foo.md   # 1ファイル
//   node scripts/fix-bold.mjs                                       # 全記事
//   node scripts/fix-bold.mjs --check                               # 直さず検出のみ

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

const POSTS = 'src/content/posts';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const given = args.filter((a) => !a.startsWith('--'));
const files = given.length
  ? given
  : readdirSync(POSTS).filter((f) => f.endsWith('.md')).map((f) => join(POSTS, f));

// --- レンダリング結果を測るものさし ------------------------------------

const stars = (html) => (html.match(/\*\*/g) || []).length;  // 生で残った **
const plain = (html) =>                                      // 空白と ** を除いた地の文
  html.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, '');

// 効いている太字の中身を、空白を無視して列挙する。
// 「元の太字が1つも失われていないか」を見るために使う。
const boldTexts = (html) =>
  [...html.matchAll(/<strong>([\s\S]*?)<\/strong>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ''));

// before にあった太字が、after にすべて残っているか（多重集合として包含）。
// 太字の「数」だけ見ると、1つ壊れて2つ増えた場合を見逃す。中身で見る。
const keepsBolds = (before, after) => {
  const pool = boldTexts(after);
  for (const b of boldTexts(before)) {
    const i = pool.indexOf(b);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return true;
};

// --- 1つのテキスト塊（段落 or front matter の1フィールド）を直す --------

// 1組直すたびにペアを組み直し、改善が止まるまで繰り返す。
function fixChunk(text) {
  const origin = marked.parse(text);  // 判定の基準は常に「元のテキスト」に置く
  let cur = text;
  let fixed = 0;

  for (let round = 0; round < 50; round++) {
    const now = marked.parse(cur);
    if (!now.includes('**')) break;  // もう壊れていない

    const marks = [];
    for (let i = cur.indexOf('**'); i !== -1; i = cur.indexOf('**', i + 2)) marks.push(i);
    if (marks.length % 2 !== 0) break;  // 奇数個は組めない

    let improved = false;
    for (let p = 0; p * 2 + 1 < marks.length; p++) {
      const open = marks[p * 2];
      const close = marks[p * 2 + 1];

      const before = open > 0 ? cur[open - 1] : '';
      const after = cur[close + 2];
      const needOpen = before !== '' && !/\s/.test(before);
      const needClose = after !== undefined && !/\s/.test(after);
      if (!needOpen && !needClose) continue;  // 両側とも既に空白

      // 入れてみる（後ろから入れて位置ずれを防ぐ）
      let trial = cur;
      if (needClose) trial = trial.slice(0, close + 2) + ' ' + trial.slice(close + 2);
      if (needOpen) trial = trial.slice(0, open) + ' ' + trial.slice(open);

      const got = marked.parse(trial);

      // 採用の条件:
      //   ・生の ** が減った                     … 壊れが1つ直った
      //   ・地の文が変わらない                   … 空白以外を触っていない
      //   ・元の太字が1つも失われていない        … 既存の太字を壊していない
      // 最後の条件は「元のテキスト」と比べる。1手前と比べると、少しずつ崩れるのを
      // 見逃す（** は消えたのに、太字の範囲が別物になっているケースを実際に作った）。
      const better =
        stars(got) < stars(now) &&
        plain(got) === plain(now) &&
        keepsBolds(origin, got);

      if (better) {
        cur = trial;
        fixed++;
        improved = true;
        break;  // ペアを組み直す
      }
    }
    if (!improved) break;  // これ以上よくならない
  }

  return { text: cur, fixed, stuck: marked.parse(cur).includes('**') };
}

// --- 本文 ---------------------------------------------------------------

// 段落（空行区切り）ごとに直す。太字が改行をまたぐことがあるので行単位では見ない。
function fixBody(body) {
  const lines = body.split('\n');

  // コードブロックの行を印付け（中の ** は markdown ではないので触らない）
  const code = new Array(lines.length).fill(false);
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { fence = !fence; code[i] = true; return; }
    code[i] = fence;
  });

  // 段落 = 空行とコードブロックで区切られた、連続する行のかたまり
  const paras = [];
  let cur = [];
  lines.forEach((line, i) => {
    if (code[i] || line.trim() === '') {
      if (cur.length) { paras.push(cur); cur = []; }
      return;
    }
    cur.push(i);
  });
  if (cur.length) paras.push(cur);

  let fixed = 0;
  const stuck = [];

  for (const idxs of paras) {
    const text = idxs.map((i) => lines[i]).join('\n');
    if (!text.includes('**') || !marked.parse(text).includes('**')) continue;

    const r = fixChunk(text);
    if (r.fixed) {
      const out = r.text.split('\n');
      // 行数が変わることはない（空白を足すだけ）が、念のため確かめる
      if (out.length === idxs.length) {
        idxs.forEach((li, k) => { lines[li] = out[k]; });
        fixed += r.fixed;
      }
    }
    if (r.stuck) stuck.push(idxs[0] + 1);
  }

  return { text: lines.join('\n'), fixed, stuck };
}

// --- front matter -------------------------------------------------------

// summary / notes も描画時に markdown として解釈されるので、同じ壊れ方をする。
// ブロックスカラ（>- や |）の中身を、インデントを保ったまま直す。
function fixFrontMatter(fmLines) {
  let fixed = 0;
  const stuck = [];

  for (const key of ['summary', 'notes']) {
    const head = fmLines.findIndex((l) => new RegExp(`^${key}:\\s*[>|]`).test(l));
    if (head === -1) continue;

    let end = head + 1;
    while (end < fmLines.length && (fmLines[end] === '' || /^[ \t]/.test(fmLines[end]))) end++;

    const rows = fmLines.slice(head + 1, end);
    if (!rows.some((l) => l.includes('**'))) continue;

    // インデントを外して中身だけを取り出す（YAML の構造には触らない）
    const indents = rows.map((l) => l.match(/^[ \t]*/)[0]);
    const text = rows.map((l, i) => l.slice(indents[i].length)).join('\n');
    if (!marked.parse(text).includes('**')) continue;

    const r = fixChunk(text);
    if (r.fixed) {
      const out = r.text.split('\n');
      if (out.length === rows.length) {
        out.forEach((l, i) => { fmLines[head + 1 + i] = indents[i] + l; });
        fixed += r.fixed;
      }
    }
    if (r.stuck) stuck.push(key);
  }

  return { fixed, stuck };
}

// --- 実行 ---------------------------------------------------------------

let totalFixed = 0;
let totalStuck = 0;
const notes = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);

  const fmLines = m ? m[1].split(/\r?\n/) : [];
  const body = (m ? raw.slice(m[0].length) : raw).replace(/\r\n/g, '\n');

  const fm = m ? fixFrontMatter(fmLines) : { fixed: 0, stuck: [] };
  const bd = fixBody(body);

  const fixed = fm.fixed + bd.fixed;
  const stuck = [
    ...fm.stuck.map((k) => `front matter の ${k}`),
    ...bd.stuck.map((n) => `本文 ${n} 行目付近`),
  ];

  if (!fixed && !stuck.length) continue;

  totalFixed += fixed;
  totalStuck += stuck.length;

  if (checkOnly) {
    console.log(`⚠ ${file}: 壊れている太字 ${fixed + stuck.length} 箇所`);
    continue;
  }

  if (fixed) {
    const out = m
      ? `---${eol}${fmLines.join(eol)}${eol}---${eol}${bd.text.split('\n').join(eol)}`
      : bd.text.split('\n').join(eol);
    writeFileSync(file, out, 'utf8');
    console.log(`✓ ${file}: ${fixed} 箇所を修正`);
  }
  if (stuck.length) notes.push(`${file}: ${stuck.join(' / ')}`);
}

if (checkOnly) {
  if (totalFixed + totalStuck) {
    console.log(`\n合計 ${totalFixed + totalStuck} 箇所。node scripts/fix-bold.mjs で直せます。`);
    process.exit(1);
  }
  console.log('✓ 太字の壊れはありません。');
  process.exit(0);
}

if (!totalFixed && !notes.length) console.log('✓ 太字の壊れはありません。');
else if (totalFixed) console.log(`\n合計 ${totalFixed} 箇所を修正しました。`);

if (notes.length) {
  console.log('\n⚠ 自動で直せなかった箇所（壊れたまま残っています）:');
  notes.forEach((n) => console.log(`  ${n}`));
  console.log('  壊れた ** が複数絡み合っている段落です。気になるなら手で直してください。');
}
