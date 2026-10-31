# @lp-labs/react-theme-studio

Package version: `0.1.0`.

Edit typed color, spacing and typography tokens, preview their effect, import
and export JSON, and generate CSS custom properties. Each package entry is
available as ESM or CommonJS with TypeScript declarations. React 18.2 or 19 is
the only peer, and there are no runtime dependencies.

## Install and use

```sh
npm install @lp-labs/react-theme-studio react
```

```tsx
import { useState } from "react";
import {
  ThemeStudio, createDefaultTheme, themeToVariables, type ThemeTokens,
} from "@lp-labs/react-theme-studio";
import "@lp-labs/react-theme-studio/style.css";

export function ThemeDesigner() {
  const [theme, setTheme] = useState<ThemeTokens>(createDefaultTheme);
  return (
    <>
      <ThemeStudio value={theme} onChange={setTheme} prefix="app" />
      <div style={themeToVariables(theme, "app")}>
        <p style={{ color: "var(--app-color-primary)" }}>Your application preview</p>
      </div>
    </>
  );
}
```

Uncontrolled usage is `<ThemeStudio />` or `<ThemeStudio defaultValue={theme} />`.
Defaults are read once. Do not switch controlled/uncontrolled mode during a
mount. In controlled mode edits propose a copied theme; the preview waits for
the parent to update `value`. Text fields retain local drafts independently.

## Component API

`ThemeStudio(props: ThemeStudioProps)` is a named export.

| Prop | Type | Default / behavior |
| --- | --- | --- |
| `value` | `ThemeTokens` | Omit for internal state |
| `defaultValue` | `ThemeTokens` | `createDefaultTheme()`; initial state only |
| `onChange` | `(theme: ThemeTokens) => void` | Valid edit/import requests, not on mount; independent copy |
| `onError` | `(error: Error) => void` | UI operation errors, including invalid draft/import/add requests |
| `prefix` | `string` | `"theme"`; validated like a token name |
| `disabled` | `boolean` | `false`; disables native controls |
| `label` | `string` | `"Theme studio"`; legend |
| `className` | `string` | `""`; appended to root |
| `style` | `React.CSSProperties` | Optional root styles |
| `renderPreview` | `(theme: ThemeTokens) => React.ReactNode` | Optional custom content; receives an independent copy |

```ts
interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
}
interface ThemeTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, TypographyToken>;
}
type TokenGroup = keyof ThemeTokens;
type CSSVariables = Record<`--${string}`, string>;
```

These types and `ThemeStudioProps` are exported.

### Default theme

`createDefaultTheme()` returns a fresh independent model each time:

```ts
{
  colors: { primary: "#4f46e5", background: "#ffffff", text: "#172033" },
  spacing: { small: "0.5rem", medium: "1rem", large: "2rem" },
  typography: {
    body: {
      fontFamily: "system-ui, sans-serif",
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5
    }
  }
}
```

Token text commits on blur or Enter; Escape restores the current model text.
Invalid drafts remain visible, become `aria-invalid`, show an alert and do not
emit. New tokens are added to the selected group; names must be unique within
that group. New colors default to `#808080`, spacing to `1rem`, typography to a
copy of the default body token. Tokens may be removed, even leaving empty
groups. The pure `setToken` helper also intentionally supports replacing
existing tokens.

The default preview uses `background`, `text`, `primary`, `medium` spacing and
`body` typography. When `body` is absent, the first typography entry is used.
Missing colors/spacing have fixed readable fallbacks. Other names are still
exported as variables; a custom preview can consume them. Preview variables are
applied **only to the preview container**, including custom preview content.
No global stylesheet or `document.documentElement` is modified.

`Export JSON` fills the editable textarea; `Import JSON` validates that textarea
before proposing a replacement theme. CSS export is always available in a
read-only textarea. Neither operation downloads files or accesses the clipboard.

## Validation and safe output

The format deliberately accepts a small, auditable set of values:

- Exactly three plain-object groups: `colors`, `spacing`, `typography`, with
  at most 100 tokens in each. Empty groups are valid. Unknown top-level groups
  and unknown typography fields are rejected.
- Names and the CSS variable prefix: lowercase ASCII letter first, followed by
  lowercase letters/digits or single hyphen-separated segments; maximum
  64 characters. `constructor` and `prototype` are explicitly rejected;
  `__proto__` fails the syntax check.
- Colors: HEX only (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`), case-insensitive.
- Spacing: nonnegative decimal lengths in `px`, `rem` or `em`, or unitless `0`.
  Maximum numeric magnitude is 10000 and maximum string length is 24.
  Negative values, exponent notation, percentages, functions and variables
  are rejected.
- Typography must have exactly the four declared fields. `fontSize` follows
  the spacing grammar but must be greater than zero. `fontWeight` is an
  integer from 1 to 1000. Unitless `lineHeight` is finite from 0.5 to 4.
- `fontFamily`: at most 200 characters; unquoted comma-separated names,
  each starting with an ASCII letter and containing only letters, digits,
  spaces and hyphens. Quoted/escaped names, functions and arbitrary CSS are
  unsupported.
- JSON imports are limited to 100000 characters.

CSS values cannot contain declaration separators, braces, URLs, functions or
HTML. Prefixes and names cannot inject selectors or declarations. This is safe
token formatting, not a sanitizer for arbitrary CSS, DOM objects or application
content. Imported theme colors are not automatically contrast-checked.

## Pure API

All helpers are named exports and do not mutate inputs:

```ts
createDefaultTheme(): ThemeTokens
validateTokenName(name: string): void
validateTheme(value: unknown): asserts value is ThemeTokens
cloneTheme(theme: ThemeTokens): ThemeTokens

setToken(theme: ThemeTokens, group: "colors" | "spacing",
         name: string, token: string): ThemeTokens
setToken(theme: ThemeTokens, group: "typography",
         name: string, token: TypographyToken): ThemeTokens
removeToken(theme: ThemeTokens, group: TokenGroup, name: string): ThemeTokens

importTheme(json: string): ThemeTokens
exportTheme(theme: ThemeTokens): string
themeToVariables(theme: ThemeTokens, prefix?: string): CSSVariables
themeToCss(theme: ThemeTokens, prefix?: string): string
```

`importTheme` parses, validates and clones JSON. `exportTheme` validates and
formats it with two-space indentation. `cloneTheme` also clones typography
entries. Both CSS helpers default to prefix `"theme"`.

Variable names are:

- `--PREFIX-color-NAME`
- `--PREFIX-space-NAME`
- `--PREFIX-type-NAME-font-family`
- `--PREFIX-type-NAME-font-size`
- `--PREFIX-type-NAME-font-weight`
- `--PREFIX-type-NAME-line-height`

`themeToVariables` returns string values suitable for a React `style` object.
`themeToCss` returns a `:root { ... }` rule, preserving group insertion order.
It does not insert the rule into the document.

Malformed token schemas/strings/names throw `TypeError`; token-count, JSON-size,
font-weight and line-height bounds throw `RangeError`; JSON syntax errors throw
`SyntaxError`; removal of an unknown token throws `RangeError`. Invalid length
values, including out-of-range lengths, throw `TypeError`. Validators return
`undefined` on success. Invalid component models/prefixes throw during render
(not via `onError`); validate external data before supplying props.

Standalone token/export example:

```ts
import {
  createDefaultTheme, setToken, exportTheme, importTheme, themeToCss
} from "@lp-labs/react-theme-studio";

const changed = setToken(createDefaultTheme(), "colors", "primary", "#0369a1");
const restored = importTheme(exportTheme(changed));
console.log(themeToCss(restored, "app"));
```

## Styling and accessibility

Import `style.css` once or supply your own styles. All selectors are scoped to
`lp-theme-studio`. Public editor theme hooks:

```css
.my-studio {
  --lp-theme-accent: #0369a1;
  --lp-theme-surface: #f0f9ff;
  --lp-theme-text: #0c4a6e;
  max-width: 60rem;
}
```

Pass `className="my-studio"`. Generated theme variables and editor UI variables
are separate; changing a theme does not restyle the editor controls.

Visible labels, nested legends, native inputs/selects/buttons, focus outlines,
keyboard commits, editable JSON and read-only CSS support keyboard operation.
Errors are announced as alerts and linked to the root fieldset. Invalid token
inputs are marked individually. The sample primary swatch uses white text and
may not have sufficient contrast for arbitrary chosen colors; use a custom
preview when contrast is important.

This is not a full design-system compiler: there are no token aliases,
responsive modes, nested groups, font loading, undo history, automatic contrast
correction, arbitrary CSS import, or file/clipboard APIs. Pixel/rem/em values
depend on the consuming document's font context. Accessibility has not been
independently certified.

No background work, persistence, subscriptions, worker, or cancellation API is
created. Token validation, copying, JSON/CSS generation and preview rendering
are synchronous full-model work within the schema caps; these are not latency
guarantees. Import accesses no browser globals; helper-only root imports still
resolve React. The application owns mounting and disposing its React UI/state.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
