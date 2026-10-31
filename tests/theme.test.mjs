import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import * as api from '../dist/esm/index.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.replaceChildren();
});
function mount(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const render = (next) => act(() => root.render(createElement(api.ThemeStudio, next)));
  render(props);
  return { container, render };
}
function field(container, name) {
  return [...container.querySelectorAll('label')]
    .find((label) => label.firstChild.textContent.trim() === name)
    .querySelector('input,textarea,select');
}
function input(element, value) {
  const prototype =
    element.tagName === 'SELECT'
      ? dom.window.HTMLSelectElement.prototype
      : element.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, String(value));
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}
function enter(element) {
  act(() =>
    element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  );
}
function click(container, name) {
  act(() =>
    [...container.querySelectorAll('button')].find((button) => button.textContent === name).click(),
  );
}

test('default themes are independent; JSON and CSS variable exports round trip', () => {
  const theme = api.createDefaultTheme();
  const imported = api.importTheme(api.exportTheme(theme));
  assert.deepEqual(imported, theme);
  imported.typography.body.fontSize = '2rem';
  assert.equal(theme.typography.body.fontSize, '1rem');
  assert.equal(api.createDefaultTheme().typography.body.fontSize, '1rem');
  assert.equal(api.themeToVariables(theme, 'app')['--app-type-body-line-height'], '1.5');
  assert.equal(api.themeToVariables(theme)['--theme-space-medium'], '1rem');
  assert.match(api.themeToCss(theme), /^:root \{\n  --theme-color-primary: #4f46e5;/);
});

test('immutable token insertion/update/removal and validation work across all groups', () => {
  const theme = api.createDefaultTheme();
  const next = api.setToken(theme, 'colors', 'accent', '#f008');
  assert.equal(next.colors.accent, '#f008');
  assert.equal(theme.colors.accent, undefined);
  const spaced = api.setToken(next, 'spacing', 'zero', '0');
  assert.equal(spaced.spacing.zero, '0');
  const typed = api.setToken(spaced, 'typography', 'heading', {
    ...theme.typography.body,
    fontWeight: 700,
  });
  assert.equal(typed.typography.heading.fontWeight, 700);
  assert.equal(api.removeToken(typed, 'colors', 'accent').colors.accent, undefined);
  assert.throws(() => api.removeToken(theme, 'colors', 'missing'), RangeError);
});

test('validator rejects prototype keys, CSS injection, invalid units and malformed schemas', () => {
  for (const name of ['__proto__', 'constructor', 'prototype', 'Upper', 'a;b', 'a--b', '1a']) {
    assert.throws(() => api.validateTokenName(name));
  }
  for (const color of ['red', 'url(https://example.test)', '#fff; color:red']) {
    assert.throws(() => api.setToken(api.createDefaultTheme(), 'colors', 'danger', color));
  }
  for (const spacing of ['-1rem', 'calc(1rem)', '1vh', '10001px', '1rem; color:red']) {
    assert.throws(() => api.setToken(api.createDefaultTheme(), 'spacing', 'danger', spacing));
  }
  for (const patch of [
    { fontFamily: 'url(evil)' },
    { fontSize: '0' },
    { fontWeight: 1.5 },
    { lineHeight: Infinity },
    { lineHeight: 0.1 },
    { extra: 'unexpected' },
  ]) {
    assert.throws(() =>
      api.setToken(api.createDefaultTheme(), 'typography', 'bad', {
        ...api.createDefaultTheme().typography.body,
        ...patch,
      }),
    );
  }
  assert.throws(() =>
    api.importTheme('{"colors":{"__proto__":"#fff"},"spacing":{},"typography":{}}'),
  );
  assert.throws(() => api.importTheme('{"colors":{},"spacing":{},"typography":{},"extra":{}}'));
  assert.throws(() => api.importTheme('x'.repeat(100001)), RangeError);
  assert.throws(() => api.themeToCss(api.createDefaultTheme(), 'x; color:red'));
  assert.equal({}.polluted, undefined);
  const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`n${i}`, '#fff']));
  assert.throws(
    () => api.validateTheme({ colors: tooMany, spacing: {}, typography: {} }),
    RangeError,
  );
});

test('keyboard editing updates tokens, preview and CSS; invalid edits are reported and retained as drafts', () => {
  const changes = [];
  const errors = [];
  const { container } = mount({
    onChange: (theme) => changes.push(theme),
    onError: (error) => errors.push(error),
  });
  const primary = field(container, 'colors.primary');
  input(primary, '#112233');
  enter(primary);
  assert.equal(changes.at(-1).colors.primary, '#112233');
  const preview = container.querySelector('[aria-label="Theme preview"]');
  assert.equal(preview.style.getPropertyValue('--theme-color-primary'), '#112233');
  input(field(container, 'typography.body.fontWeight'), '600');
  enter(field(container, 'typography.body.fontWeight'));
  assert.equal(changes.at(-1).typography.body.fontWeight, 600);
  input(field(container, 'spacing.medium'), 'bad');
  enter(field(container, 'spacing.medium'));
  assert.equal(changes.length, 2);
  assert.equal(errors.length, 1);
  assert.ok(container.querySelector('[role="alert"]'));
  assert.equal(field(container, 'spacing.medium').getAttribute('aria-invalid'), 'true');
  assert.equal(field(container, 'spacing.medium').value, 'bad');
});

test('token add/remove and JSON import/export are real UI operations', () => {
  const changes = [];
  const { container } = mount({ onChange: (theme) => changes.push(theme) });
  input(field(container, 'New token name'), 'accent');
  click(container, 'Add token');
  assert.equal(changes.at(-1).colors.accent, '#808080');
  act(() => container.querySelector('[aria-label="Remove colors.accent"]').click());
  assert.equal(changes.at(-1).colors.accent, undefined);
  click(container, 'Export JSON');
  assert.deepEqual(api.importTheme(field(container, 'Theme JSON').value), changes.at(-1));
  const imported = api.createDefaultTheme();
  imported.colors.primary = '#ff0000';
  input(field(container, 'Theme JSON'), api.exportTheme(imported));
  click(container, 'Import JSON');
  assert.equal(changes.at(-1).colors.primary, '#ff0000');
  input(field(container, 'Theme JSON'), '{"not":"a theme"}');
  const before = changes.length;
  click(container, 'Import JSON');
  assert.equal(changes.length, before);
  assert.ok(container.querySelector('[role="alert"]'));
});

test('controlled changes wait for parent rendering and custom preview receives a clone', () => {
  const value = api.createDefaultTheme();
  let next;
  const props = {
    value,
    onChange: (theme) => {
      next = theme;
    },
    renderPreview: (theme) => {
      theme.colors.primary = '#000';
      return createElement('p', null, 'Custom preview');
    },
  };
  const { container, render } = mount(props);
  input(field(container, 'colors.primary'), '#abcdef');
  enter(field(container, 'colors.primary'));
  assert.equal(next.colors.primary, '#abcdef');
  assert.equal(value.colors.primary, '#4f46e5');
  assert.equal(
    container
      .querySelector('[aria-label="Theme preview"]')
      .style.getPropertyValue('--theme-color-primary'),
    '#4f46e5',
  );
  render({ ...props, value: next });
  assert.equal(
    container
      .querySelector('[aria-label="Theme preview"]')
      .style.getPropertyValue('--theme-color-primary'),
    '#abcdef',
  );
  assert.match(container.textContent, /Custom preview/);
});

test('disabled studio cannot change theme', () => {
  let calls = 0;
  const { container } = mount({ disabled: true, onChange: () => calls++ });
  input(field(container, 'colors.primary'), '#000');
  enter(field(container, 'colors.primary'));
  click(container, 'Import JSON');
  assert.equal(calls, 0);
});

test('ESM and CJS exports match', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(api).sort());
  assert.equal(cjs.themeToCss(cjs.createDefaultTheme()), api.themeToCss(api.createDefaultTheme()));
});
