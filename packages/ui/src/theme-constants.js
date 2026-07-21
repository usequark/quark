/**
 * Theme system constants for @techstream/quark-ui.
 *
 * These three values form the contract between ThemeProvider and any
 * out-of-tree component (e.g. HomeThemeToggle in apps/web) that interoperates
 * with it via the shared localStorage key, HTML attribute, and DOM event.
 *
 * An identical copy lives in apps/web/src/lib/theme.js - each package owns
 * its own copy so there is no cross-package import. If you rename any of
 * these, update both files and the CSS selectors in globals.css.
 */

/** Key used to persist the user's explicit theme choice in localStorage. */
export const THEME_STORAGE_KEY = "quark-theme";

/**
 * Attribute set on <html> so CSS custom properties can react to JS state.
 * Use via element.setAttribute(THEME_ATTR, value) / element.getAttribute(THEME_ATTR).
 * Referenced in globals.css as [data-theme="light"] / [data-theme="dark"].
 */
export const THEME_ATTR = "data-theme";

/** CustomEvent name dispatched when the theme changes outside a ThemeProvider. */
export const THEME_CHANGE_EVENT = "quark-theme-change";
