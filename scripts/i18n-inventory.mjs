import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sourceFiles(dir = 'src') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
}

export function inventory() {
  const strings = new Set();
  for (const file of sourceFiles().filter(f => !f.includes('i18n'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let value;
      if (ts.isJsxText(node)) value = node.text.replace(/\s+/g, ' ').trim();
      else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
      else if (ts.isTemplateExpression(node)) value = node.head.text + node.templateSpans.map((s, i) => `{${i}}` + s.literal.text).join('');
      if (value && (/[çğıöşüÇĞİÖŞÜ]/.test(value) || (/^[A-Z]/.test(value) && !/[\/_{}#]|[a-z][A-Z]/.test(value))) && !value.includes('className')) strings.add(value.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return [...strings];
}
