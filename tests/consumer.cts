import { createElement } from 'react';
import {
  ThemeStudio,
  createDefaultTheme,
  themeToCss,
  type ThemeStudioProps,
} from '@lp-labs/react-theme-studio';

const props: ThemeStudioProps = {
  value: createDefaultTheme(),
  onChange(next) {
    const css: string = themeToCss(next);
    void css;
  },
};
createElement(ThemeStudio, props);
