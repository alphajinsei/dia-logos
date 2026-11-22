#!/usr/bin/env node
// 記事化の候補を棚卸しする。前回の棚卸し以降に増えた会話だけを、チェックボックス付きの一覧にする。
//
// 読むもの（あるものだけ読む）:
//   - claude.ai: previous_chat/conversations.json（Export data の zip に入っているもの）
//   - Claude Code: ~/.claude/projects/**/*.jsonl と、WSL なら Windows 側の
//     /mnt/c/Users/*/.claude/projects/**/*.jsonl（古いセッションが Windows 側に残っていることがある）
//
// 書くもの（どちらも previous_chat/ の中。git 管理外＝公開リポに入らない）:
//   - previous_chat/INVENTORY.md      … 候補の一覧。ユーザーが記事にしたいものを [x] にする
//   - previous_chat/inventory-state.json … 一度見た会話の記録。次回の一覧から外すために使う
//
// 使い方:
//   node scripts/inventory.mjs           一覧を作る（既に見た会話は出さない）
//   node scripts/inventory.mjs --commit  INVENTORY.md を読み、[x] は selected、[ ] は skipped として記録する
//                                        （記事化が終わったあとに実行する。以後その会話は一覧に出ない）
//
// 会話を選ぶのはユーザー。このスクリプトは機械的に並べるだけで、良し悪しの判定はしない
// （機械的なスコアリングで良い会話を取りこぼした前例がある。CLAUDE.md 参照）。

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const DIR = 'previous_chat';
const STATE = join(DIR, 'inventory-state.json');
const OUT = join(DIR, 'INVENTORY.md');
const EXPORT = join(DIR, 'conversations.json');

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { reviewed: {} };

// ---- --commit: 一覧のチェック結果を記録する ----
if (process.argv.includes('--commit')) {
  if (!existsSync(OUT)) { console.error(`${OUT} がありません`); process.exit(1); }
  const today = new Date().toISOString().slice(0, 10);
  let sel = 0, skip = 0;
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    const m = line.match(/^- \[( |x|X)\] .*<!-- id:(\S+) -->/);
    if (!m) continue;
    const status = m[1] === ' ' ? 'skipped' : 'selected';
    state.reviewed[m[2]] = { status, on: today };
    status === 'selected' ? sel++ : skip++;
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`記録しました: selected ${sel} 件 / skipped ${skip} 件 → ${STATE}`);
  process.exit(0);
}

// ---- 共通 ----
const oneLine = (s, n = 90) => s.replace(/\s+/g, ' ').trim().slice(0, n);
const items = []; // { id, source, project, date, userMsgs, userChars, first }
let excluded = 0; // 記録済み（記事化済み・前回までに見た）ので一覧に出さなかった数

// ---- claude.ai ----
if (existsSync(EXPORT)) {
  const conv = JSON.parse(readFileSync(EXPORT, 'utf8'));
  for (const c of conv) {
    const id = `claude.ai:${c.uuid}`;
    if (state.reviewed[id]) { excluded++; continue; }
    // 本文は content から取る（text には英語の思考が混ざる。kijika Skill 参照）
    const human = c.chat_messages
      .filter((m) => m.sender === 'human')
      .map((m) => (m.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n') || m.text || '')
      .filter((t) => t.trim());
    if (!human.length) continue;
    items.push({
      id, source: 'claude.ai', project: '', title: c.name || '',
      date: c.created_at.slice(0, 10), userMsgs: human.length,
      userChars: human.join('').length, first: human[0],
    });
  }
} else {
  console.warn(`(${EXPORT} が無いので claude.ai は対象外)`);
}

// ---- Claude Code ----
const ccRoots = [join(homedir(), '.claude', 'projects')];
if (existsSync('/mnt/c/Users')) {
  for (const u of readdirSync('/mnt/c/Users')) {
    const p = join('/mnt/c/Users', u, '.claude', 'projects');
    try { if (statSync(p).isDirectory()) ccRoots.push(p); } catch {}
  }
}
// ユーザーが打った発言だけを拾う（ツール結果・コマンド出力・Skill の注入・中断表示を除く）
function userText(o) {
  if (o.type !== 'user' || o.isMeta || o.isSidechain) return null;
  let c = o.message?.content;
  if (Array.isArray(c)) c = c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n');
  if (typeof c !== 'string' || !c.trim()) return null;
  if (/^\s*(<|\[Request interrupted|Caveat:)/.test(c)) return null;
  return c;
}
// プロジェクトのフォルダ名（パスを - で潰したもの）から、末尾の作業フォルダ名だけを取り出す
const projName = (dir) =>
  basename(dir).replace(/^.*?-(claude-sandbox|sandbox|alphajinsei)-?/, '').replace(/^claude-sandbox-/, '') || basename(dir);

for (const root of ccRoots) {
  if (!existsSync(root)) continue;
  for (const proj of readdirSync(root)) {
    const pdir = join(root, proj);
    let files; try { files = readdirSync(pdir).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const sid = f.replace(/\.jsonl$/, '');
      const id = `claude-code:${sid}`;
      if (items.some((x) => x.id === id)) continue;
      if (state.reviewed[id]) { excluded++; continue; }
      const texts = []; let date = '';
      for (const line of readFileSync(join(pdir, f), 'utf8').split('\n')) {
        if (!line) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        const t = userText(o);
        if (t) { texts.push(t); if (!date) date = (o.timestamp || '').slice(0, 10); }
      }
      if (!texts.length) continue; // 自動実行（評価用の一括実行など）でユーザーの発言が無いもの
      items.push({
        id, source: 'Claude Code', project: projName(pdir), title: '',
        date, userMsgs: texts.length, userChars: texts.join('').length, first: texts[0],
      });
    }
  }
}

// ---- 出力 ----
items.sort((a, b) => b.date.localeCompare(a.date));
const lines = [
  '# 記事化の候補（棚卸し）',
  '',
  '記事にしたい会話の `[ ]` を `[x]` にしてください。Claude が [x] の会話だけを本文まで読んで記事化します。',
  '記事化が終わったら `node scripts/inventory.mjs --commit` で記録し、次回の一覧から外します。',
  '',
  '- 「発言」は自分の発言の数と文字数（多いほど自分が考えを書いた会話）。冒頭は最初の発言の書き出し。',
  `- 作成: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} / 候補 ${items.length} 件`,
  `- 記事化済み・前回までに見た会話 ${excluded} 件は、記録（${STATE}）にあるので一覧に出していない。`,
  '',
];
// 短い会話は末尾に畳む（消しはしない。--commit で畳んだ分も skipped として記録される）。
// - Claude Code: 発言1件だけ、または合計100字未満。試し打ちや自動実行（評価の一括実行など）がほとんど
// - claude.ai: 合計60字未満だけ。一問一答でも記事になった前例が多い（RAG と attention の回など）ので、発言数では畳まない
const isShort = (x) =>
  x.source === 'claude.ai' ? x.userChars < 60 : x.userMsgs < 2 || x.userChars < 100;
const row = (x) => {
  const where = x.source === 'claude.ai' ? x.title : `[${x.project}]`;
  return `- [ ] \`${x.date}\` ${where} 発言${x.userMsgs}件/${x.userChars}字 — ${oneLine(x.first)}  <!-- id:${x.id} -->`;
};
for (const src of ['claude.ai', 'Claude Code']) {
  const list = items.filter((x) => x.source === src && !isShort(x));
  if (!list.length) continue;
  lines.push(`## ${src}（${list.length} 件）`, '');
  let month = '';
  for (const x of list) {
    if (x.date.slice(0, 7) !== month) { month = x.date.slice(0, 7); lines.push('', `### ${month}`, ''); }
    lines.push(row(x));
  }
  lines.push('');
}
const short = items.filter(isShort);
if (short.length) {
  lines.push(`<details><summary>短い会話（Claude Code は発言1件のみか100字未満、claude.ai は60字未満）${short.length} 件</summary>`, '');
  for (const x of short) lines.push(row(x));
  lines.push('', '</details>', '');
}
writeFileSync(OUT, lines.join('\n'));
console.log(`候補 ${items.length - short.length} 件（ほかに短い会話 ${short.length} 件） → ${OUT}`);
