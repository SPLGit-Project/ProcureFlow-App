import React, { useState } from 'react';
import {
  Sparkles, Zap, TrendingUp, Package2, Tag, Layers,
  ChevronRight, ArrowRight, Info, Shield, Globe, Database,
  DollarSign, BarChart3, Star
} from 'lucide-react';

// ── Data ───────────────────────────────────────────────────────────────────

const PARALLELS = [
  {
    id: 'fiber',
    physical: 'Structural Fiber Reconstruction',
    physicalDesc: 'Permanently restructures raw cotton fibers under tension, straightening erratic cell structures for superior strength.',
    digital: 'Catalog & Master Item Governance',
    digitalDesc: 'Ingests flat, erratic, non-standard vendor line-items and converts them into pristine, cross-referenced system entries with explicit governance rules.',
    icon: Package2,
    color: '#7c3aed',
    bgClass: 'from-violet-500/10 to-transparent',
    borderColor: 'border-violet-200 dark:border-violet-800/50',
  },
  {
    id: 'tensile',
    physical: 'Tensile Reinforcement',
    physicalDesc: 'Strengthens fabric fibers to withstand intense processing volumes without structural failure.',
    digital: 'Modular Architecture Stability',
    digitalDesc: 'Replaces fragile, manual steps with robust system controls (Procure, Price, Catalog), ensuring operational stability under intense processing volume.',
    icon: Shield,
    color: '#0ea5e9',
    bgClass: 'from-sky-500/10 to-transparent',
    borderColor: 'border-sky-200 dark:border-sky-800/50',
  },
  {
    id: 'dye',
    physical: 'Elevated Dye Affinity',
    physicalDesc: 'Maximizes the fabric\'s chemical receptivity so dyes are absorbed deeply and permanently without loss.',
    digital: 'External System Integration',
    digitalDesc: 'Prepares the host infrastructure to be perfectly receptive to telemetry, multi-tenant database synchronization, and external system handshakes without transactional loss.',
    icon: Globe,
    color: '#10b981',
    bgClass: 'from-emerald-500/10 to-transparent',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
  },
  {
    id: 'finish',
    physical: 'Permanent Lustrous Finish',
    physicalDesc: 'The final output — a refined, high-value fabric that holds its structure and sheen through repeated industrial cycles.',
    digital: 'Margin Recovery & Automatic Invoicing',
    digitalDesc: 'Squeezes structural voids, hidden cost inflation, and margin leakage out of the buying cycle, revealing clean financial health and optimized profit capture.',
    icon: DollarSign,
    color: '#f59e0b',
    bgClass: 'from-amber-500/10 to-transparent',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
  },
];

const MODULES = [
  {
    id: 'mercerflow',
    prefix: 'Mercer',
    suffix: 'Flow',
    tagline: 'The Parent Architecture',
    description: 'The overarching platform suite — the governance engine that every module operates within. Provides the infrastructure, security, and workflow backbone.',
    color: '#0ea5e9',
    icon: Database,
    psychology: 'Electric Sky Blue — macro intelligence, deep security, and platform transparency.',
  },
  {
    id: 'procureflow',
    prefix: 'Procure',
    suffix: 'Flow',
    tagline: 'Active Sourcing Operations',
    description: 'End-to-end purchase order management, approval workflows, vendor negotiations, and real-time logistics tracking for high-volume procurement environments.',
    color: '#f97316',
    icon: Package2,
    psychology: 'Vibrant Orange — operational energy, movement, and aggressive real-time logistics management.',
  },
  {
    id: 'priceflow',
    prefix: 'Price',
    suffix: 'Flow',
    tagline: 'Financial Yield Recovery',
    description: 'Automated invoice reconciliation, margin protection, and pricing schedule management that captures every dollar of value in the buying cycle.',
    color: '#10b981',
    icon: DollarSign,
    psychology: 'Emerald Green — capital preservation, margin protection, and green-light automated reconciliation.',
  },
  {
    id: 'catalogflow',
    prefix: 'Catalog',
    suffix: 'Flow',
    tagline: 'Structured Taxonomy',
    description: 'Item master governance, structured product categorization, catalogue publishing, and cross-system item synchronization with explicit data quality controls.',
    color: '#9333ea',
    icon: Layers,
    psychology: 'Amethyst Purple — structural precision, data taxonomy, and high-order product categorization.',
  },
];

// ── Sub-Components ─────────────────────────────────────────────────────────

const ParallelCard: React.FC<{
  item: typeof PARALLELS[0];
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}> = ({ item, isOpen, onToggle, index }) => {
  const Icon = item.icon;
  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer group ${item.borderColor} ${isOpen ? 'shadow-lg' : 'hover:shadow-md'}`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className={`flex items-center gap-4 p-5 bg-gradient-to-br ${item.bgClass} dark:from-white/5`}>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md"
          style={{ backgroundColor: item.color }}
        >
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
            Parallel {index + 1} of {PARALLELS.length}
          </div>
          <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
            {item.physical}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ArrowRight size={11} style={{ color: item.color }} />
            <span className="text-xs font-semibold truncate" style={{ color: item.color }}>
              {item.digital}
            </span>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={`text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}
        />
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div className="grid sm:grid-cols-2 gap-0 border-t border-gray-100 dark:border-gray-800">
          {/* Physical */}
          <div className="p-5 border-r-0 sm:border-r border-gray-100 dark:border-gray-800 bg-amber-50/50 dark:bg-white/3">
            <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
              Physical Process
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {item.physicalDesc}
            </p>
          </div>
          {/* Digital */}
          <div className="p-5" style={{ backgroundColor: `${item.color}08` }}>
            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: item.color }}>
              Digital Counterpart
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {item.digitalDesc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const ModuleCard: React.FC<{
  module: typeof MODULES[0];
  isSelected: boolean;
  onSelect: () => void;
}> = ({ module, isSelected, onSelect }) => {
  const Icon = module.icon;
  return (
    <button
      onClick={onSelect}
      className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 w-full ${
        isSelected
          ? 'shadow-lg scale-[1.02]'
          : 'border-gray-100 dark:border-gray-800 hover:shadow-md hover:scale-[1.01]'
      }`}
      style={isSelected ? { borderColor: module.color, backgroundColor: `${module.color}08` } : {}}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white shadow-md"
        style={{ backgroundColor: module.color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex items-baseline gap-0 mb-1">
        <span className="font-light text-lg text-gray-500 dark:text-gray-400">{module.prefix}</span>
        <span className="font-black text-lg" style={{ color: module.color }}>{module.suffix}</span>
      </div>
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: module.color }}
      >
        {module.tagline}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
        {module.description}
      </p>
    </button>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

const AboutMercerFlow: React.FC = () => {
  const [openParallel, setOpenParallel] = useState<string | null>('fiber');
  const [selectedModule, setSelectedModule] = useState<string>('mercerflow');

  const activeModule = MODULES.find(m => m.id === selectedModule) || MODULES[0];
  const ActiveModuleIcon = activeModule.icon;

  return (
    <div className="max-w-7xl mx-auto mt-20 mb-10 px-4 animate-fade-in-up" id="about-section">

      {/* ── Section Header ─────────────────────────────────────────────── */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 mb-4">
          <Sparkles size={13} className="text-[var(--color-brand)]" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--color-brand)]">About MercerFlow</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3">
          The Digital Mercerization<br className="hidden sm:block" />
          <span className="text-[var(--color-brand)]"> of Enterprise Data</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">
          Every aspect of MercerFlow — from its name to its colour palette — is engineered around
          a precise strategic metaphor drawn from the industrial textile world.
        </p>
      </div>

      {/* ── Hero Origin Story ────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden mb-10 bg-gradient-to-br from-gray-900 via-[#1a1c2e] to-gray-900 border border-white/10 shadow-2xl">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }}
          />
          <div
            className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #9333ea, transparent)' }}
          />
        </div>

        <div className="relative z-10 p-8 sm:p-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-400/30 bg-sky-400/10 mb-5">
                <Star size={11} className="text-sky-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">The Core Thesis</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
                Why the name<br />
                <span className="text-sky-400">Mercer</span>
                <span className="text-white font-light">Flow</span>?
              </h3>
              <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                <p>
                  At its primary surface, the name projects{' '}
                  <span className="text-white font-semibold">mercantile authority</span>,{' '}
                  <span className="text-white font-semibold">fiscal precision</span>, and{' '}
                  <span className="text-white font-semibold">uncompromised workflow execution</span> —
                  positioning the suite as a high-end financial and supply chain management engine.
                </p>
                <p>
                  But for those operating in commercial laundry, hospitality textiles, and industrial processing,
                  the identity carries a{' '}
                  <span className="text-sky-400 font-semibold">deeper, hidden significance</span>.
                  It draws directly from <em>Mercerization</em> — the foundational finishing treatment
                  discovered by John Mercer that permanently restructures raw cotton and linen fibers under
                  structural tension.
                </p>
                <p>
                  MercerFlow does not merely log data — it{' '}
                  <span className="text-emerald-400 font-semibold">acts upon it</span>. The application
                  takes raw, unmanaged, and often chaotic supply chain metrics and shapes them into
                  beautifully governed, optimized, high-value enterprise structures.
                </p>
              </div>
            </div>

            {/* Stats/Pillars */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Zap, label: 'Mercantile Authority', desc: 'Commanding, enterprise-grade nomenclature that signals institutional credibility.', color: '#fbbf24' },
                { icon: BarChart3, label: 'Fiscal Precision', desc: 'Every workflow decision is traceable, auditable, and financially governed.', color: '#34d399' },
                { icon: Shield, label: 'Structural Tension', desc: 'Like mercerization itself, raw data is transformed under controlled governance rules.', color: '#60a5fa' },
                { icon: TrendingUp, label: 'Workflow Execution', desc: 'The "Flow" suffix signals relentless, uncompromised process throughput at scale.', color: '#c084fc' },
              ].map((pillar) => {
                const PillarIcon = pillar.icon;
                return (
                  <div
                    key={pillar.label}
                    className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/8 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${pillar.color}20`, color: pillar.color }}
                    >
                      <PillarIcon size={16} />
                    </div>
                    <div className="font-bold text-white text-sm mb-1">{pillar.label}</div>
                    <p className="text-xs text-gray-400 leading-relaxed">{pillar.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Strategic Parallels ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-10 mb-10">
        {/* Left: Parallels list */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 rounded-full bg-[var(--color-brand)]" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white">The Strategic Parallel</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 ml-3">
            Four precise alignments between the physical textile process and the platform's digital output.
            Click any card to reveal both sides of the metaphor.
          </p>
          <div className="space-y-3">
            {PARALLELS.map((item, index) => (
              <ParallelCard
                key={item.id}
                item={item}
                isOpen={openParallel === item.id}
                onToggle={() => setOpenParallel(openParallel === item.id ? null : item.id)}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* Right: Info panel */}
        <div className="flex flex-col gap-5">
          {/* John Mercer callout */}
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 text-white">
                <Info size={20} />
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Historical Origin</div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">John Mercer, 1844</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  The process of Mercerization was discovered by British chemist John Mercer, who observed
                  that treating raw cotton with caustic soda under tension permanently improved its tensile
                  strength, surface lustre, and chemical receptivity. The commercial textile industry adopted
                  it as a mandatory finishing standard — a process that transforms raw material into something
                  structurally superior and permanently refined.
                </p>
              </div>
            </div>
          </div>

          {/* The metaphor bridge */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne p-6 flex-1">
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">The Corporate Metaphor</div>
            <div className="space-y-4">
              {[
                { from: 'Raw, chaotic cotton fibers', to: 'Unstructured vendor data & erratic line-items', icon: Package2 },
                { from: 'Caustic soda under tension', to: 'Governance rules & workflow enforcement', icon: Shield },
                { from: 'Permanently restructured fiber', to: 'Governed, cross-referenced master data', icon: Database },
                { from: 'Elevated dye absorption', to: 'Deep external system receptivity', icon: Globe },
                { from: 'Lustrous commercial finish', to: 'Clean margin capture & financial health', icon: TrendingUp },
              ].map((pair) => {
                const PairIcon = pair.icon;
                return (
                  <div key={pair.from} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <PairIcon size={13} className="text-[var(--color-brand)]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{pair.from}</span>
                        <ArrowRight size={11} className="text-[var(--color-brand)] shrink-0" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{pair.to}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modular Ecosystem ────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-nocturne shadow-sm overflow-hidden mb-10">
        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full bg-purple-500" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white">The Modular Product Ecosystem</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-3">
            Each module operates as a standalone commercial product while declaring its alignment to the parent MercerFlow suite
            through a precise <strong className="text-gray-700 dark:text-gray-300">Color Codification Logic</strong>.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {MODULES.map(mod => (
              <ModuleCard
                key={mod.id}
                module={mod}
                isSelected={selectedModule === mod.id}
                onSelect={() => setSelectedModule(mod.id)}
              />
            ))}
          </div>

          {/* Selected module detail */}
          <div
            className="rounded-2xl p-6 border"
            style={{ borderColor: `${activeModule.color}40`, backgroundColor: `${activeModule.color}06` }}
          >
            <div className="flex items-start gap-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-lg"
                style={{ backgroundColor: activeModule.color }}
              >
                <ActiveModuleIcon size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-light text-gray-400">{activeModule.prefix}</span>
                  <span className="text-2xl font-black" style={{ color: activeModule.color }}>{activeModule.suffix}</span>
                </div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: activeModule.color }}
                >
                  {activeModule.tagline}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  {activeModule.description}
                </p>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${activeModule.color}20`, color: activeModule.color }}
                  >
                    <Tag size={12} />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    <span className="font-black text-gray-700 dark:text-gray-300">Colour Psychology: </span>
                    {activeModule.psychology}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Typographic System ───────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-white/3 dark:to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 rounded-full bg-emerald-500" />
          <h3 className="text-xl font-black text-gray-900 dark:text-white">Progressive Typographic Hierarchy</h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
              The typography standard is engineered to maintain{' '}
              <strong className="text-gray-700 dark:text-gray-300">global suite alignment</strong>{' '}
              while giving each module immediate operational context at a glance.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Functional Prefix', example: 'Procure', style: 'font-light text-gray-500', desc: 'Lightweight, sophisticated — identifies the operational domain.' },
                { label: 'Suite Suffix', example: 'Flow', style: 'font-black', desc: 'Bold weight, module color — signals active, continuous processing.' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4 p-3 bg-white dark:bg-nocturne rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="text-2xl" style={{ color: selectedModule === 'procureflow' ? '#f97316' : 'var(--color-brand)' }}>
                    <span className={item.style}>{item.example}</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{item.label}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {MODULES.map(mod => (
              <div
                key={mod.id}
                className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-nocturne border-gray-100 dark:border-gray-800"
              >
                <div className="flex items-baseline gap-0">
                  <span className="font-light text-lg text-gray-400">{mod.prefix}</span>
                  <span className="font-black text-lg" style={{ color: mod.color }}>{mod.suffix}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: mod.color }} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{mod.tagline}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer attribution ───────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-center gap-2 text-gray-400 text-xs">
        <Sparkles size={12} />
        <span>
          MercerFlow Brand Architecture & Modular Product Ecosystem Blueprint — Approved Identity Standard
        </span>
      </div>
    </div>
  );
};

export default AboutMercerFlow;
