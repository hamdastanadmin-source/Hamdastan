#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
// Radix primitives are wrapped in src/components/ui so RTL defaults (dir on
// portalled content, logical spacing) are applied in exactly one place.
// Anything outside that directory must go through the wrappers.
const uiDir = path.normalize('src/components/ui');
const scanExt = new Set(['.ts', '.tsx', '.js', '.jsx']);
const disallowedClassRegex = /(^|[\s"'`{(])((?:ml|mr|pl|pr|left|right)-[^\s"'`})]+)/g;
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!scanExt.has(path.extname(entry.name))) continue;
    checkFile(absolute);
  }
}

function addViolation(filePath, lineNumber, message) {
  const rel = path.relative(projectRoot, filePath);
  violations.push(`${rel}:${lineNumber} ${message}`);
}

function checkFile(filePath) {
  const rel = path.normalize(path.relative(projectRoot, filePath));
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (
      line.includes("from 'radix-ui'") ||
      line.includes('from "radix-ui"') ||
      line.includes("from '@radix-ui/") ||
      line.includes('from "@radix-ui/')
    ) {
      if (!rel.startsWith(uiDir)) {
        addViolation(
          filePath,
          i + 1,
          "Direct Radix import is forbidden outside src/components/ui. Use '@/components/UiComponents' or '@/components/ui/*'.",
        );
      }
    }

    // Opt-out for the cases where a physical direction is the correct answer:
    // centring via translate, and APIs whose contract is a physical side.
    // `rtl-ok` suppresses its own line and the line after it, so it can be
    // written as a comment above a long className string.
    if (line.includes('rtl-ok') || (i > 0 && lines[i - 1].includes('rtl-ok'))) continue;

    disallowedClassRegex.lastIndex = 0;
    let match;
    while ((match = disallowedClassRegex.exec(line)) !== null) {
      const token = match[2];
      addViolation(
        filePath,
        i + 1,
        `Physical direction utility '${token}' is forbidden. Use logical utilities (ms/me/ps/pe/start/end).`,
      );
    }
  }
}

function checkLayoutDefaults() {
  const layoutPath = path.join(srcRoot, 'app', 'layout.tsx');
  if (!fs.existsSync(layoutPath)) {
    violations.push('src/app/layout.tsx:1 Missing root layout file.');
    return;
  }

  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  if (!layoutContent.includes('lang={APP_LANG}')) {
    violations.push("src/app/layout.tsx:1 Root <html> must use lang={APP_LANG}.");
  }
  if (!layoutContent.includes('dir={APP_DIR}')) {
    violations.push("src/app/layout.tsx:1 Root <html> must use dir={APP_DIR}.");
  }
}

walk(srcRoot);
checkLayoutDefaults();

if (violations.length > 0) {
  console.error('RTL smoke check failed:\n');
  for (const item of violations) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('RTL smoke check passed.');
