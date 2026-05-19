import React from 'react';
import AboutMercerFlow from './AboutMercerFlow';
import PageHeader from './PageHeader';

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in px-4">
      <div className="mb-12">
        <PageHeader
          title="About"
          subtitle="The story, structure, and design philosophy behind MercerFlow."
        />
      </div>
      <AboutMercerFlow />
    </div>
  );
};

export default AboutPage;
