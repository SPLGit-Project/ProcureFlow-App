import React from 'react';
import { useApp } from '../context/AppContext';
import { useSetPageMeta } from '../context/PageMetaContext';
import ContextHelp from './ContextHelp';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  helpTitle?: string;
  helpDescription?: string;
  helpLinkTarget?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  helpTitle,
  helpDescription,
  helpLinkTarget,
}) => {
  const { featureFlags } = useApp();
  const uiRevamp = featureFlags?.uiRevampEnabled ?? false;

  useSetPageMeta(uiRevamp ? { subtitle } : {});

  if (uiRevamp) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {helpTitle && helpDescription && helpLinkTarget && (
          <ContextHelp
            title={helpTitle}
            description={helpDescription}
            linkTarget={helpLinkTarget}
          />
        )}
      </div>
      {subtitle && (
        <p className="text-secondary dark:text-gray-400 text-sm mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default PageHeader;
