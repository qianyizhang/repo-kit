import { marked, type Token, type MarkedToken } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import diff from 'highlight.js/lib/languages/diff';
import { format } from 'prettier/standalone';
import * as babel from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';
for (const [name, language] of Object.entries({ javascript, json, bash, python, xml, diff }))
  hljs.registerLanguage(name, language);
type TextMode = 'rendered' | 'raw';
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, css?: string) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (css) item.className = css;
  return item;
}
function entities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const names: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity[0] !== '#') return names[entity.toLowerCase()] ?? whole;
    const value =
      entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole;
  });
}
const safeHref = (href: string) => /^(https?:\/\/|codex:\/\/|#|\/(?!\/))/.test(href);
function codeBlock(text: string, language = '', pretty = false) {
  const pre = element('pre', undefined, 'code-block');
  const code = element('code');
  pre.append(code);
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'javascript',
    typescript: 'javascript',
    sh: 'bash',
    shell: 'bash',
    html: 'xml',
  };
  const lang = aliases[language] ?? language;
  function paint(value: string) {
    if (value.length <= 50000 && hljs.getLanguage(lang)) {
      // highlight.js escapes all source text; only its generated span markup is inserted.
      code.innerHTML = hljs.highlight(value, { language: lang, ignoreIllegals: true }).value;
    } else code.textContent = value;
  }
  paint(text);
  if (pretty && text.length < 50000 && ['javascript', 'json'].includes(lang))
    void format(text, {
      parser: lang === 'json' ? 'json' : 'babel-ts',
      plugins: [babel, estree],
      printWidth: 88,
    })
      .then(paint)
      .catch(() => {
        /* Partial or unusual code stays readable as recorded. */
      });
  return pre;
}
function markdownTokens(tokens: Token[], parent: HTMLElement) {
  for (const raw of tokens) {
    // No custom tokenizer extensions are registered.
    const token = raw as MarkedToken;
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'code':
        parent.append(codeBlock(token.text, token.lang?.split(' ')[0]));
        break;
      case 'codespan':
        parent.append(element('code', entities(token.text)));
        break;
      case 'br':
        parent.append(element('br'));
        break;
      case 'hr':
        parent.append(element('hr'));
        break;
      case 'image':
        parent.append(element('span', token.text ? `[Image: ${token.text}]` : '[Image]', 'small'));
        break;
      case 'html':
        parent.append(document.createTextNode(token.text));
        break;
      case 'text':
        if (token.tokens) markdownTokens(token.tokens, parent);
        else parent.append(document.createTextNode(entities(token.text).replace(/\n/g, ' ')));
        break;
      case 'escape':
        parent.append(document.createTextNode(entities(token.text)));
        break;
      case 'link': {
        const link = element('a');
        markdownTokens(token.tokens, link);
        if (safeHref(token.href)) {
          link.href = token.href;
          link.rel = 'noreferrer';
        }
        link.title = token.title ?? token.href;
        parent.append(link);
        break;
      }
      case 'table': {
        const wrap = element('div', undefined, 'markdown-table');
        const table = element('table'),
          head = element('thead'),
          body = element('tbody');
        const row = (cells: typeof token.header, header: boolean) => {
          const tr = element('tr');
          for (const cell of cells) {
            const td = element(header ? 'th' : 'td');
            if (cell.align) td.style.textAlign = cell.align;
            markdownTokens(cell.tokens, td);
            tr.append(td);
          }
          return tr;
        };
        head.append(row(token.header, true));
        for (const cells of token.rows) body.append(row(cells, false));
        table.append(head, body);
        wrap.append(table);
        parent.append(wrap);
        break;
      }
      case 'list': {
        const list = element(token.ordered ? 'ol' : 'ul');
        if (list instanceof HTMLOListElement && typeof token.start === 'number')
          list.start = token.start;
        for (const item of token.items) {
          const li = element('li');
          if (item.task) li.append(element('span', item.checked ? '☑ ' : '☐ '));
          markdownTokens(item.tokens, li);
          list.append(li);
        }
        parent.append(list);
        break;
      }
      case 'checkbox':
        parent.append(element('span', token.checked ? '☑ ' : '☐ '));
        break;
      case 'list_item':
        markdownTokens(token.tokens, parent);
        break;
      default: {
        const tag =
          token.type === 'heading'
            ? (('h' + Math.min(6, token.depth + 1)) as 'h2')
            : (
                {
                  paragraph: 'p',
                  blockquote: 'blockquote',
                  strong: 'strong',
                  em: 'em',
                  del: 'del',
                } as const
              )[token.type];
        const child = element(tag);
        markdownTokens(token.tokens, child);
        parent.append(child);
      }
    }
  }
}
/** Fold line-delimited XML envelopes without interpreting any source HTML. */
export function prose(text: string, depth = 0): HTMLElement {
  const box = element('div', undefined, 'record-prose');
  const tags = /^([ \t]*)<([A-Za-z][\w:.-]*)(?:\s+[^>\n]*)?>[ \t]*\r?$/gm;
  let start = 0;
  for (const match of text.matchAll(tags)) {
    if (match.index < start || depth >= 12) continue;
    // XML inside a Markdown code fence remains code, rather than a fold.
    const prefix = text.slice(start, match.index);
    if ((prefix.match(/^\s*(?:```|~~~)/gm)?.length ?? 0) % 2) continue;
    const name = match[2];
    const pair = new RegExp(`^\\s*<(\\/?)${name}(?:\\s+[^>\\n]*)?>[ \\t]*\\r?$`, 'gm');
    pair.lastIndex = match.index + match[0].length;
    let nesting = 1,
      end: RegExpExecArray | null = null;
    for (let tag = pair.exec(text); tag; tag = pair.exec(text)) {
      nesting += tag[1] ? -1 : 1;
      if (!nesting) {
        end = tag;
        break;
      }
    }
    if (!end) continue;
    markdownTokens(marked.lexer(prefix, { gfm: true }), box);
    const section = element('details', undefined, 'xml-section');
    section.append(element('summary', name));
    // Context remains present, but ancillary envelopes can be unfolded as needed.
    section.open = name.toUpperCase() === 'INSTRUCTIONS';
    section.append(prose(text.slice(match.index + match[0].length, end.index).trim(), depth + 1));
    box.append(section);
    start = end.index + end[0].length;
  }
  markdownTokens(marked.lexer(text.slice(start), { gfm: true }), box);
  return box;
}
export function presentedText(text: string, kind: string, mode: TextMode) {
  if (mode === 'raw') return element('pre', text, 'raw-text');
  if (kind === 'goal') {
    const objective = /<objective>([\s\S]*?)<\/objective>/.exec(text)?.[1]?.trim();
    const box = element('div', undefined, 'goal-content');
    box.append(prose(objective ?? text));
    if (objective) {
      const context = element('details');
      context.append(element('summary', 'Continuation context'), prose(text));
      box.append(context);
    }
    return box;
  }
  if (kind === 'auto-review' || kind === 'message' || kind === 'request') return prose(text);
  const box = element('div', undefined, 'record-content');
  // Pull envelope metadata out of plain tool output, while raw mode retains exact bytes.
  const envelope =
    /^(?:(?:Script (?:completed|running[^\n]*)|Wall time[^\n]*|Process exited[^\n]*|Exit code[^\n]*|Session ID[^\n]*|Chunk ID[^\n]*|Original token count[^\n]*|Final output:[^\n]*|Output:|Warning: truncated output[^\n]*|Total output lines:[^\n]*|Total lines:[^\n]*)\r?\n)+/.exec(
      text,
    );
  if (envelope) {
    box.append(element('p', envelope[0].trim().replace(/\nOutput:\s*$/, ''), 'tool-meta'));
    text = text.slice(envelope[0].length);
  }
  try {
    const value: unknown = text.length < 100000 ? JSON.parse(text) : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const fields = element('dl', undefined, 'record-fields');
      for (const [key, field] of Object.entries(value)) {
        const label = element('dt', key),
          item = element('dd');
        if (typeof field === 'string')
          item.append(
            codeBlock(
              field,
              key === 'cmd' ? 'bash' : /^(code|input|script)$/.test(key) ? 'javascript' : '',
              /^(code|input|script)$/.test(key),
            ),
          );
        else item.append(codeBlock(JSON.stringify(field, null, 2), 'json'));
        fields.append(label, item);
      }
      box.append(fields);
      return box;
    }
    if (
      Array.isArray(value) &&
      value.length >= 3 &&
      value.every((arg) => typeof arg === 'string') &&
      ['-lc', '-c'].includes(String(value[1]))
    ) {
      box.append(codeBlock(String(value[2]), 'bash'));
      return box;
    }
    if (value && typeof value === 'object') {
      box.append(codeBlock(JSON.stringify(value, null, 2), 'json'));
      return box;
    }
  } catch {
    /* Plain tool output or code. */
  }
  const language =
    kind === 'edit' || /^\*\*\* (Begin Patch|Update File)|^diff --git|^@@/m.test(text)
      ? 'diff'
      : /^\s*(?:const |let |var |import |async |await |function |tools\.)/m.test(text)
        ? 'javascript'
        : '';
  box.append(codeBlock(text, language, language === 'javascript'));
  return box;
}
