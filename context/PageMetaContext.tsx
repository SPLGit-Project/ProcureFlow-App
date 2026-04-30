import React from 'react';

export interface PageMeta {
  subtitle?: string;
}

const PageMetaContext = React.createContext<{
  setMeta: (meta: PageMeta) => void;
}>({ setMeta: () => {} });

export default PageMetaContext;

export const useSetPageMeta = (meta: PageMeta) => {
  const { setMeta } = React.useContext(PageMetaContext);
  const key = `${meta.subtitle ?? ''}`;
  React.useEffect(() => {
    setMeta(meta);
    return () => setMeta({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
