import * as React from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  Accordion as FumadocsAccordion,
  Accordions as FumadocsAccordions,
} from 'fumadocs-ui/components/accordion';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import {
  OpenAccessButton,
  OpenAccessBadge,
  OpenFeatureCallout,
  OpenMethodSection,
} from '@/components/licensing';
import {
  Callout,
  ComparisonTable,
  FAQ,
  Step,
  Steps,
  PackageManagerTabs,
} from '@/components/docs-primitives';
import { ConfigExplorer } from '@/components/config-explorer';
import {
  InterfacePreference,
  InterfaceTabs,
  InterfaceTab,
} from '@/components/interface-tabs';
import { ClientReference, TypeDisplay } from '@/components/client-reference';
import type { AsyncAPIPageProps_Preloaded } from '@fumadocs/asyncapi/ui';

const EventReference = React.lazy(() => import('@/components/asyncapi-page').then(module => ({ default: module.AsyncAPIPage })));

function AsyncAPIPage(props: Omit<AsyncAPIPageProps_Preloaded, 'preloaded'>) {
  return <React.Suspense fallback={<p>Loading event reference…</p>}><EventReference {...props} /></React.Suspense>;
}

const AccordionScope = React.createContext(false);

function DocsAccordions(
  props: React.ComponentPropsWithoutRef<typeof FumadocsAccordions>,
) {
  return (
    <AccordionScope.Provider value>
      <FumadocsAccordions {...props} />
    </AccordionScope.Provider>
  );
}

function DocsAccordion(
  props: React.ComponentPropsWithoutRef<typeof FumadocsAccordion>,
) {
  const isInsideAccordions = React.useContext(AccordionScope);

  if (isInsideAccordions) {
    return <FumadocsAccordion {...props} />;
  }

  return (
    <DocsAccordions>
      <FumadocsAccordion {...props} />
    </DocsAccordions>
  );
}

function DocumentHeading({ id, children }: React.ComponentPropsWithoutRef<'h1'>) {
  return (
    <span id={id} className="sr-only docs-mdx-title-anchor">
      {children}
    </span>
  );
}

export const docsMdxComponents = {
  ...defaultMdxComponents,
  ...TabsComponents,
  Accordion: DocsAccordion,
  Accordions: DocsAccordions,
  h1: DocumentHeading,
  TypeTable,
  OpenAccessButton,
  OpenAccessBadge,
  OpenFeatureCallout,
  OpenMethodSection,
  Callout,
  ComparisonTable,
  FAQ,
  Step,
  Steps,
  PackageManagerTabs,
  ConfigExplorer,
  InterfacePreference,
  InterfaceTabs,
  InterfaceTab,
  ClientReference,
  TypeDisplay,
  AsyncAPIPage,
};
