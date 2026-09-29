"use client";

import { Children, Fragment, cloneElement, isValidElement, createElement, type ReactNode, type ComponentProps, type JSX } from 'react';
import NextLink from 'next/link';
import NextImage from 'next/image';
import { useLocale } from './LocaleProvider';
import { formatLocalized, type FormatKind } from '@/lib/i18n/format';

// React owns these text nodes: switching language never edits the DOM behind
// React's back, remounts forms, refreshes the router, or translates input values.
function localizeChildren(children: ReactNode, t: (text: string) => string): ReactNode {
  return Children.map(children, child => {
    if (typeof child === 'string') return t(child);
    if (isValidElement<{ children: ReactNode }>(child) && child.type === Fragment) {
      return cloneElement(child, {}, localizeChildren(child.props.children, t));
    }
    return child;
  });
}

/** User-written content must stay in its original language, even if it matches a UI key. */
export function Raw({ children }: { children: ReactNode }) { return children; }

export function Text({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return localizeChildren(children, t);
}

export function Formatted({ kind, args }: { kind: FormatKind; args: (string | number | Date)[] }) {
  const { locale } = useLocale();
  return formatLocalized(kind, args, locale);
}

function useTranslatedProps<P extends { children?: ReactNode; translate?: 'yes' | 'no'; title?: string; 'aria-label'?: string; placeholder?: string; alt?: string }>(props: P): P {
  const { t } = useLocale();
  if (props.translate === 'no') return props;
  const translated = { ...props };
  for (const key of ['title', 'aria-label', 'placeholder', 'alt'] as const) {
    const value = props[key];
    if (typeof value === 'string') translated[key] = t(value);
  }
  if ('children' in props) translated.children = localizeChildren(props.children, t);
  return translated;
}

function localized<Tag extends keyof JSX.IntrinsicElements>(tag: Tag) {
  return function LocalizedElement(props: ComponentProps<Tag>) {
    const translated = useTranslatedProps(props);
    // Options without an explicit value submit their label. Retain the
    // original Turkish enum even when its visible label changes to English.
    if (tag === 'option' && !('value' in props) && typeof props.children === 'string') {
      return createElement(tag, { ...translated, value: props.children });
    }
    return createElement(tag, translated);
  };
}

export function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...useTranslatedProps(props)} />;
}

export function Image(props: ComponentProps<typeof NextImage>) {
  return <NextImage {...useTranslatedProps(props)} />;
}

export const a = localized('a');
export const article = localized('article');
export const aside = localized('aside');
export const b = localized('b');
export const button = localized('button');
export const code = localized('code');
export const dd = localized('dd');
export const div = localized('div');
export const dl = localized('dl');
export const dt = localized('dt');
export const fieldset = localized('fieldset');
export const form = localized('form');
export const h1 = localized('h1');
export const h2 = localized('h2');
export const h3 = localized('h3');
export const header = localized('header');
export const input = localized('input');
export const ins = localized('ins');
export const label = localized('label');
export const legend = localized('legend');
export const li = localized('li');
export const main = localized('main');
export const nav = localized('nav');
export const ol = localized('ol');
export const option = localized('option');
export const p = localized('p');
export const section = localized('section');
export const select = localized('select');
export const small = localized('small');
export const span = localized('span');
export const strong = localized('strong');
export const summary = localized('summary');
export const tbody = localized('tbody');
export const td = localized('td');
export const text = localized('text');
export const textarea = localized('textarea');
export const th = localized('th');
export const ul = localized('ul');
