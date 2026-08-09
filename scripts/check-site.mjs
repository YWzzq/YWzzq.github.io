#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const outputDirectory = resolve(process.argv[2] || 'public');
const failures = [];

const fail = (file, message) => {
  failures.push(`${relative(outputDirectory, file) || '.'}: ${message}`);
};

const walk = (directory) => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

if (!existsSync(outputDirectory)) {
  console.error(`Site output does not exist: ${outputDirectory}`);
  process.exit(1);
}

const files = walk(outputDirectory);
const htmlFiles = files.filter((file) => extname(file) === '.html');
const renderedHtml = new Map();

if (htmlFiles.length === 0) {
  failures.push('No rendered HTML files found.');
}

const attributeValues = (html, name) => {
  const pattern = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
};

const pagePathForFile = (file) => {
  const localPath = relative(outputDirectory, file).split(sep).join('/');
  if (localPath === 'index.html') return '/';
  if (localPath.endsWith('/index.html')) return `/${localPath.slice(0, -'index.html'.length)}`;
  return `/${localPath}`;
};

const fileForUrlPath = (urlPath) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch (_) {
    return null;
  }

  const localPath = decodedPath.replace(/^\/+/, '');
  if (!localPath || decodedPath.endsWith('/')) return join(outputDirectory, localPath, 'index.html');
  if (extname(localPath)) return join(outputDirectory, localPath);
  return join(outputDirectory, localPath, 'index.html');
};

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  renderedHtml.set(file, html);

  if (!html.trim()) fail(file, 'rendered page is empty');
  if (!/^<!doctype html>/i.test(html.trimStart())) fail(file, 'missing HTML doctype');
  if (!/<html\b[^>]*\blang=(?:"zh-CN"|'zh-CN'|zh-CN)/i.test(html)) fail(file, 'missing zh-CN language');
  const isRedirect = /<meta\b[^>]*\bhttp-equiv=(?:"refresh"|'refresh'|refresh)/i.test(html);
  if (!isRedirect && (html.match(/<main\b/gi) || []).length !== 1) fail(file, 'expected exactly one main landmark');
  if (!isRedirect && (html.match(/<h1\b/gi) || []).length !== 1) fail(file, 'expected exactly one h1');
  if (/{{\s*(?:block|define|if|partial|range|with)\b/.test(html)) fail(file, 'contains unrendered Hugo template syntax');

  const ids = attributeValues(html, 'id');
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(file, `duplicate id values: ${duplicateIds.join(', ')}`);

  const schemaPattern = /<script\b[^>]*\btype=(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(schemaPattern)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      fail(file, `invalid JSON-LD: ${error.message}`);
    }
  }
}

for (const [file, html] of renderedHtml) {
  const currentUrl = new URL(pagePathForFile(file), 'https://site.invalid');
  const links = [...attributeValues(html, 'href'), ...attributeValues(html, 'src')];

  for (const value of links) {
    if (!value || value.startsWith('//') || !/^(?:\.?\.?\/|#)/.test(value)) continue;

    let targetUrl;
    try {
      targetUrl = new URL(value, currentUrl);
    } catch (_) {
      fail(file, `invalid internal URL: ${value}`);
      continue;
    }

    const targetFile = fileForUrlPath(targetUrl.pathname);
    if (!targetFile || !existsSync(targetFile)) {
      fail(file, `broken internal reference: ${value}`);
      continue;
    }

    if (targetUrl.hash && extname(targetFile) === '.html') {
      const targetHtml = renderedHtml.get(targetFile) ?? readFileSync(targetFile, 'utf8');
      const targetIds = new Set(attributeValues(targetHtml, 'id'));
      let fragment;
      try {
        fragment = decodeURIComponent(targetUrl.hash.slice(1));
      } catch (_) {
        fragment = targetUrl.hash.slice(1);
      }
      if (fragment && !targetIds.has(fragment)) fail(file, `missing fragment target: ${value}`);
    }
  }
}

const searchIndex = join(outputDirectory, 'index.json');
if (!existsSync(searchIndex)) {
  failures.push('index.json: search index is missing');
} else {
  try {
    const entries = JSON.parse(readFileSync(searchIndex, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('top-level value must be an array');
    entries.forEach((entry, index) => {
      if (!entry || typeof entry.title !== 'string' || typeof entry.url !== 'string') {
        throw new Error(`entry ${index} must include string title and url fields`);
      }
    });
  } catch (error) {
    fail(searchIndex, `invalid search index: ${error.message}`);
  }
}

for (const filename of ['index.xml', 'sitemap.xml']) {
  const file = join(outputDirectory, filename);
  if (!existsSync(file)) {
    fail(file, 'required XML output is missing');
    continue;
  }
  const xml = readFileSync(file, 'utf8');
  if (!xml.startsWith('<?xml')) fail(file, 'missing XML declaration');
  if (/{{\s*/.test(xml)) fail(file, 'contains unrendered Hugo template syntax');
}

if (failures.length) {
  console.error(`Site validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Validated ${htmlFiles.length} HTML pages and ${files.length} generated files.`);
