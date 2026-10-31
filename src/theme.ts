export interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
}

export interface ThemeTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, TypographyToken>;
}

export type TokenGroup = keyof ThemeTokens;
export type CSSVariables = Record<`--${string}`, string>;

const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const hexPattern = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const sizePattern = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))$/;
const familyPattern = /^[a-z][a-z0-9 -]*(?:,\s*[a-z][a-z0-9 -]*)*$/i;
const owns = (object: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(object, key);

export function validateTokenName(name: string): void {
  if (
    typeof name !== 'string' ||
    name.length > 64 ||
    !namePattern.test(name) ||
    ['constructor', 'prototype'].includes(name)
  ) {
    throw new TypeError(
      'Token names use lowercase letters, digits and single hyphens; start with a letter (max 64).',
    );
  }
}

function record(value: unknown): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError('Expected a plain object.');
  }
}

function size(value: unknown, positive = false): void {
  if (
    typeof value !== 'string' ||
    value.length > 24 ||
    !sizePattern.test(value) ||
    parseFloat(value) > 10000 ||
    (positive && parseFloat(value) <= 0)
  ) {
    throw new TypeError(
      'Use a nonnegative px, rem or em length (up to 10000); font sizes must be positive.',
    );
  }
}

export function validateTheme(value: unknown): asserts value is ThemeTokens {
  record(value);
  if (
    Object.keys(value).length !== 3 ||
    !['colors', 'spacing', 'typography'].every((key) => owns(value, key))
  ) {
    throw new TypeError('Expected exactly colors, spacing and typography groups.');
  }
  for (const group of ['colors', 'spacing', 'typography'] as const) {
    const tokens = value[group];
    record(tokens);
    if (Object.keys(tokens).length > 100) throw new RangeError('At most 100 tokens per group.');
    for (const [name, token] of Object.entries(tokens)) {
      validateTokenName(name);
      if (group === 'colors') {
        if (typeof token !== 'string' || !hexPattern.test(token))
          throw new TypeError('Colors must be HEX.');
      } else if (group === 'spacing') {
        size(token);
      } else {
        record(token);
        const fields = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'];
        if (
          Object.keys(token).length !== fields.length ||
          !fields.every((key) => owns(token, key))
        ) {
          throw new TypeError(
            'Typography requires fontFamily, fontSize, fontWeight and lineHeight only.',
          );
        }
        if (
          typeof token.fontFamily !== 'string' ||
          token.fontFamily.length > 200 ||
          !familyPattern.test(token.fontFamily)
        ) {
          throw new TypeError(
            'Font families must be unquoted comma-separated names without CSS functions.',
          );
        }
        size(token.fontSize, true);
        if (
          !Number.isInteger(token.fontWeight) ||
          Number(token.fontWeight) < 1 ||
          Number(token.fontWeight) > 1000
        ) {
          throw new RangeError('Font weight must be an integer from 1 to 1000.');
        }
        if (
          typeof token.lineHeight !== 'number' ||
          !Number.isFinite(token.lineHeight) ||
          token.lineHeight < 0.5 ||
          token.lineHeight > 4
        ) {
          throw new RangeError('Line height must be from 0.5 to 4.');
        }
      }
    }
  }
}

export function createDefaultTheme(): ThemeTokens {
  return {
    colors: { primary: '#4f46e5', background: '#ffffff', text: '#172033' },
    spacing: { small: '0.5rem', medium: '1rem', large: '2rem' },
    typography: {
      body: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
      },
    },
  };
}

export function cloneTheme(theme: ThemeTokens): ThemeTokens {
  validateTheme(theme);
  return {
    colors: { ...theme.colors },
    spacing: { ...theme.spacing },
    typography: Object.fromEntries(
      Object.entries(theme.typography).map(([name, token]) => [name, { ...token }]),
    ),
  };
}

export function setToken(
  theme: ThemeTokens,
  group: 'colors' | 'spacing',
  name: string,
  token: string,
): ThemeTokens;
export function setToken(
  theme: ThemeTokens,
  group: 'typography',
  name: string,
  token: TypographyToken,
): ThemeTokens;
export function setToken(
  theme: ThemeTokens,
  group: TokenGroup,
  name: string,
  token: string | TypographyToken,
): ThemeTokens {
  validateTokenName(name);
  const next = cloneTheme(theme);
  if (group === 'typography') next.typography[name] = { ...(token as TypographyToken) };
  else if (group === 'colors' || group === 'spacing') next[group][name] = token as string;
  else throw new TypeError('Unknown token group.');
  validateTheme(next);
  return next;
}

export function removeToken(theme: ThemeTokens, group: TokenGroup, name: string): ThemeTokens {
  validateTokenName(name);
  const next = cloneTheme(theme);
  if (!owns(next, group)) throw new TypeError('Unknown token group.');
  if (!owns(next[group], name)) throw new RangeError('Unknown token name.');
  delete next[group][name];
  return next;
}

export function importTheme(json: string): ThemeTokens {
  if (typeof json !== 'string' || json.length > 100000)
    throw new RangeError('Theme JSON is limited to 100000 characters.');
  const theme: unknown = JSON.parse(json);
  validateTheme(theme);
  return cloneTheme(theme);
}

export function exportTheme(theme: ThemeTokens): string {
  validateTheme(theme);
  return JSON.stringify(theme, null, 2);
}

export function themeToVariables(theme: ThemeTokens, prefix = 'theme'): CSSVariables {
  validateTheme(theme);
  validateTokenName(prefix);
  const variables: CSSVariables = {};
  for (const [name, color] of Object.entries(theme.colors))
    variables[`--${prefix}-color-${name}`] = color;
  for (const [name, spacing] of Object.entries(theme.spacing))
    variables[`--${prefix}-space-${name}`] = spacing;
  for (const [name, token] of Object.entries(theme.typography)) {
    variables[`--${prefix}-type-${name}-font-family`] = token.fontFamily;
    variables[`--${prefix}-type-${name}-font-size`] = token.fontSize;
    variables[`--${prefix}-type-${name}-font-weight`] = String(token.fontWeight);
    variables[`--${prefix}-type-${name}-line-height`] = String(token.lineHeight);
  }
  return variables;
}

export function themeToCss(theme: ThemeTokens, prefix = 'theme'): string {
  const declarations = Object.entries(themeToVariables(theme, prefix)).map(
    ([key, value]) => `  ${key}: ${value};`,
  );
  return `:root {\n${declarations.join('\n')}\n}`;
}
