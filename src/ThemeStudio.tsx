import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import {
  cloneTheme,
  createDefaultTheme,
  exportTheme,
  importTheme,
  removeToken,
  setToken,
  themeToCss,
  themeToVariables,
  validateTheme,
  type ThemeTokens,
  type TokenGroup,
  type TypographyToken,
} from './theme.js';

export interface ThemeStudioProps {
  value?: ThemeTokens;
  defaultValue?: ThemeTokens;
  onChange?: (theme: ThemeTokens) => void;
  onError?: (error: Error) => void;
  prefix?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
  renderPreview?: (theme: ThemeTokens) => ReactNode;
}

function TokenField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  function commit() {
    setInvalid(!onCommit(draft));
  }
  return (
    <label>
      {label}
      <input
        value={draft}
        aria-invalid={invalid}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            setDraft(value);
            setInvalid(false);
          }
        }}
      />
    </label>
  );
}

export function ThemeStudio({
  value,
  defaultValue,
  onChange,
  onError,
  prefix = 'theme',
  disabled = false,
  label = 'Theme studio',
  className = '',
  style,
  renderPreview,
}: ThemeStudioProps) {
  const [internal, setInternal] = useState(() => cloneTheme(defaultValue ?? createDefaultTheme()));
  const theme = value ?? internal;
  validateTheme(theme);
  const variables = themeToVariables(theme, prefix);
  const css = themeToCss(theme, prefix);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [group, setGroup] = useState<TokenGroup>('colors');
  const errorId = useId();

  function attempt(operation: () => ThemeTokens): boolean {
    if (disabled) return false;
    try {
      const next = operation();
      if (value === undefined) setInternal(cloneTheme(next));
      setError('');
      onChange?.(cloneTheme(next));
      return true;
    } catch (reason) {
      const issue = reason instanceof Error ? reason : new Error(String(reason));
      setError(issue.message);
      onError?.(issue);
      return false;
    }
  }

  const body = theme.typography.body ?? Object.values(theme.typography)[0];
  const previewStyle: CSSProperties = {
    ...variables,
    background: theme.colors.background ?? '#ffffff',
    color: theme.colors.text ?? '#172033',
    padding: theme.spacing.medium ?? '1rem',
    fontFamily: body?.fontFamily,
    fontSize: body?.fontSize,
    fontWeight: body?.fontWeight,
    lineHeight: body?.lineHeight,
  };

  return (
    <fieldset
      className={`lp-theme-studio ${className}`}
      style={style}
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
    >
      <legend>{label}</legend>
      {error && (
        <p role="alert" id={errorId}>
          {error}
        </p>
      )}
      {(['colors', 'spacing'] as const).map((tokenGroup) => (
        <fieldset key={tokenGroup}>
          <legend>{tokenGroup === 'colors' ? 'Colors' : 'Spacing'}</legend>
          {Object.entries(theme[tokenGroup]).map(([name, token]) => (
            <div className="lp-theme-studio__row" key={name}>
              <TokenField
                label={`${tokenGroup}.${name}`}
                value={token}
                onCommit={(draft) => attempt(() => setToken(theme, tokenGroup, name, draft))}
              />
              <button
                type="button"
                aria-label={`Remove ${tokenGroup}.${name}`}
                onClick={() => attempt(() => removeToken(theme, tokenGroup, name))}
              >
                Remove
              </button>
            </div>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>Typography</legend>
        {Object.entries(theme.typography).map(([name, token]) => (
          <fieldset key={name}>
            <legend>{name}</legend>
            {(['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'] as const).map((key) => (
              <TokenField
                key={key}
                label={`typography.${name}.${key}`}
                value={String(token[key])}
                onCommit={(draft) =>
                  attempt(() =>
                    setToken(theme, 'typography', name, {
                      ...token,
                      [key]: key === 'fontWeight' || key === 'lineHeight' ? Number(draft) : draft,
                    }),
                  )
                }
              />
            ))}
            <button
              type="button"
              aria-label={`Remove typography.${name}`}
              onClick={() => attempt(() => removeToken(theme, 'typography', name))}
            >
              Remove
            </button>
          </fieldset>
        ))}
      </fieldset>
      <div className="lp-theme-studio__row">
        <label>
          New token group
          <select value={group} onChange={(event) => setGroup(event.target.value as TokenGroup)}>
            <option value="colors">Colors</option>
            <option value="spacing">Spacing</option>
            <option value="typography">Typography</option>
          </select>
        </label>
        <label>
          New token name
          <input value={newName} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => {
            if (Object.prototype.hasOwnProperty.call(theme[group], newName)) {
              attempt(() => {
                throw new Error('That token already exists.');
              });
              return;
            }
            const ok = attempt(() =>
              group === 'typography'
                ? setToken(
                    theme,
                    group,
                    newName,
                    createDefaultTheme().typography.body as TypographyToken,
                  )
                : setToken(theme, group, newName, group === 'colors' ? '#808080' : '1rem'),
            );
            if (ok) setNewName('');
          }}
        >
          Add token
        </button>
      </div>
      <section aria-label="Theme preview" className="lp-theme-studio__preview" style={previewStyle}>
        {renderPreview ? (
          renderPreview(cloneTheme(theme))
        ) : (
          <>
            <h2>Theme preview</h2>
            <p>Your colors, spacing and body typography in context.</p>
            <span
              className="lp-theme-studio__sample"
              style={{ background: theme.colors.primary ?? '#4f46e5' }}
            >
              Primary color
            </span>
          </>
        )}
      </section>
      <label>
        Theme JSON
        <textarea value={json} rows={8} onChange={(event) => setJson(event.target.value)} />
      </label>
      <div className="lp-theme-studio__row">
        <button type="button" onClick={() => attempt(() => importTheme(json))}>
          Import JSON
        </button>
        <button type="button" onClick={() => setJson(exportTheme(theme))}>
          Export JSON
        </button>
      </div>
      <label>
        CSS variables
        <textarea readOnly rows={8} value={css} />
      </label>
    </fieldset>
  );
}
