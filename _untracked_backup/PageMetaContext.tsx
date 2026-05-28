import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface PageMeta {
  title?: string;
  subtitle?: string;
}

interface PageMetaContextValue {
  pageMeta: PageMeta;
  setPageMeta: (meta: PageMeta) => void;
}

const PageMetaContext = createContext<PageMetaContextValue>({
  pageMeta: {},
  setPageMeta: () => undefined,
});

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
  const [pageMeta, setPageMetaState] = useState<PageMeta>({});
  const setPageMeta = useCallback((meta: PageMeta) => setPageMetaState(meta), []);
  const value = useMemo(() => ({ pageMeta, setPageMeta }), [pageMeta, setPageMeta]);
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
}

export function useSetPageMeta(meta: PageMeta) {
  const { setPageMeta } = useContext(PageMetaContext);
  useEffect(() => setPageMeta(meta), [meta.title, meta.subtitle, setPageMeta]);
}

export function usePageMeta() {
  return useContext(PageMetaContext).pageMeta;
}
