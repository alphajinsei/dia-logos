#!/usr/bin/env node
// claude.ai の Export data (conversations.json) を会話ごとの生テキストに分割する。
//
// これは「機械的な抽出」だけを行う。記事化（サマリー生成・剪定・md整形）は
// この出力を素材に、/記事化 Skill と同じルールで Claude が行う。
// 生ログは個人情報を含むため、出力先 export/ は .gitignore 済み（リポに入らない）。
//
// 使い方:
//   1. claude.ai → Settings → Privacy → Export data でzipを取得し解凍
//   2. conversations.json をこのリポ直下に置く
//   3. node scripts/split-export.mjs
//   → export/ に 1会話1ファイル (.txt) が出る。中身を見て記事化する会話を選ぶ。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2] || 'conversations.json';
const OUT = 'export';

if (!existsSync(SRC)) {
  console.error(`✗ ${SRC} が見つかりません。conversations.json をリポ直下に置いてください。`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
// エクスポート形式のゆらぎに軽く対応（配列 or {conversations:[...]}）
const convos = Array.isArray(raw) ? raw : raw.conversations || [];
if (!convos.length) {
  console.error('✗ 会話が見つかりません。JSONの構造を確認してください。');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const slug = (s) =>
  (s || 'untitled')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);

// メッセージ本文の取り出し。
//
// 重要: `content` を優先する。`text` には Claude の英語内部思考が応答本文と連結されて
// 入っており汚染されている。`content` はユーザーに実際に返した応答だけを持つクリーンな側。
// content が空のときだけ text にフォールバックするが、それはエクスポート欠落の兆候なので
// 呼び出し側で警告する。
function textOf(msg) {
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content.trim();
  if (Array.isArray(msg.content)) {
    const joined = msg.content
      .map((c) => (typeof c === 'string' ? c : c.text || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined) return joined;
  }
  return '';
}

function roleOf(msg) {
  const r = msg.sender || msg.role || '';
  if (/assistant|claude/i.test(r)) return 'Claude';
  if (/human|user/i.test(r)) return 'あなた';
  return r || '?';
}

let count = 0;
const gaps = []; // 本文が空のメッセージ＝エクスポートの欠落候補
for (const c of convos) {
  const title = c.name || c.title || 'untitled';
  const created = (c.created_at || c.create_time || '').toString().slice(0, 10);
  const msgs = c.chat_messages || c.messages || [];
  if (!msgs.length) continue;

  const body = msgs
    .map((m, i) => {
      const t = textOf(m);
      // 空のメッセージは、エクスポートが本文を落としている可能性がある。
      // 黙って捨てると記事から議論が丸ごと欠ける（実際に起きた）ので記録して報告する。
      if (!t) gaps.push(`${title} — ${i + 1}番目 (${roleOf(m)})`);
      return t ? `### ${roleOf(m)}\n\n${t}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  const header = `# ${title}\n(${created || '日付不明'})\n\n---\n\n`;
  const name = `${created || '0000-00-00'}_${slug(title)}.txt`;
  writeFileSync(join(OUT, name), header + body, 'utf8');
  count++;
}

console.log(`✓ ${count} 件の会話を ${OUT}/ に書き出しました。`);

if (gaps.length) {
  console.log(`\n⚠ 本文が空のメッセージが ${gaps.length} 件あります（エクスポートの欠落の可能性）:`);
  for (const g of gaps.slice(0, 20)) console.log(`   - ${g}`);
  if (gaps.length > 20) console.log(`   ...他 ${gaps.length - 20} 件`);
  console.log('   → 該当会話を記事化するときは、元のチャット画面から本文を貼り直す必要があります。');
}

console.log('\n  次: 中身を眺め、記事化したい会話を選んで Claude に「これを記事化して」と渡してください。');
