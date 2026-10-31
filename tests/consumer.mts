import { createElement } from 'react';
import {
  ThemeStudio,
  createDefaultTheme,
  setToken,
  themeToVariables,
  type ThemeStudioProps,
} from '@lp-labs/react-theme-studio';

const value = setToken(createDefaultTheme(), 'colors', 'accent', '#f00');
const props: ThemeStudioProps = {
  value,
  onChange(next) {
    themeToVariables(next);
  },
};
createElement(ThemeStudio, props);
createElement('div', { style: themeToVariables(value) });
// @ts-expect-error Typography needs a structured token.
setToken(value, 'typography', 'heading', '1rem');
