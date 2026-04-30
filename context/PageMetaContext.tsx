import React from 'react';

export interface PageMeta {
  subtitle?: string;
  helpTitle?: string;
  helpDescription?: string;
  helpLinkTarget?: string;
}

const PageMetaContext = React.createContext<{
  setMeta: (meta: PageMeta) => void;
}>({ setMeta: () => {} });

export default PageMetaContext;

export const useSetPageMeta = (meta: PageMeta) => {
  const { setMeta } = React.useContext(PageMetaContext);
  const key = `${meta.subtitle ?? ''}|${meta.helpTitle ?? ''}|${meta.helpLinkTarget ?? ''}`;
  React.useEffect(() => {
    setMeta(meta);
    return () => setMeta({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
