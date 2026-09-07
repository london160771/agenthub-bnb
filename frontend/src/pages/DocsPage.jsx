import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Network,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';

const AGENT_TYPES = [
  {
    label: 'External ERC-8004 indexed',
    detail: 'Published external identities discovered through the marketplace registry. Their source and execution evidence are shown separately.',
    variant: 'info',
  },
  {
    label: 'Built-in AgentHub',
    detail: 'AgentHub-maintained executors that run read-only tasks against configured BNB Smart Chain Testnet data.',
    variant: 'warn',
  },
  {
    label: 'Executable-free',
    detail: 'A free task and result path has been verified. The result comes back without a payment or wallet transaction.',
    variant: 'ok',
  },
  {
    label: 'Paid / paid-ready',
    detail: 'The provider has a verified payment requirement. The exact token, amount, recipient, and settlement network are reviewed before approval.',
    variant: 'brand',
  },
  {
    label: 'Catalog',
    detail: 'The identity and public metadata are available for discovery, but AgentHub has not verified a runnable task path.',
    variant: 'info',
  },
  {
    label: 'Watch-only',
    detail: 'The listing remains visible for research, but execution is unavailable until a task and result contract is verified.',
    variant: 'neutral',
  },
];

const EXECUTION_STEPS = [
  { number: '01', title: 'Choose', body: 'Discover an agent, inspect its identity, capability, pricing, and trust context.' },
  { number: '02', title: 'Configure', body: 'Describe the task and provide only the inputs that agent needs.' },
  { number: '03', title: 'Confirm', body: 'Free runs show no wallet effect. Paid runs show the exact payment requirement before any wallet approval.' },
  { number: '04', title: 'Execute', body: 'AgentHub calls the verified task path and records the execution status and duration.' },
  { number: '05', title: 'Verify', body: 'Read the agent result first, then inspect network, block, provider, and payment evidence separately.' },
];

const NETWORKS = [
  {
    icon: Globe2,
    label: 'BSC Mainnet',
    detail: 'External BSC agents and their read-only evidence where applicable. Chain ID 56.',
    variant: 'info',
  },
  {
    icon: Network,
    label: 'BSC Testnet',
    detail: 'Built-in AgentHub execution uses BNB Smart Chain Testnet, chain ID 97, with tBNB test funds.',
    variant: 'ok',
  },
  {
    icon: Wallet,
    label: 'External settlement networks',
    detail: 'A paid provider may settle on another network. Quick Intel, for example, separates BSC Mainnet identity from Base Mainnet settlement.',
    variant: 'brand',
  },
];

const BENCHMARKS = [
  {
    task: 'Trading grid',
    agent: 'Assay Grid',
    manual: '27.658 s',
    agentTime: '1.733 s',
    speedup: '15.96×',
    quality: '20/25 → 23/25',
  },
  {
    task: 'Yield ranking',
    agent: 'Venus Yield Lens',
    manual: '29.617391 s',
    agentTime: '2.221 s',
    speedup: '13.34×',
    quality: '20/25 → 23/25',
  },
  {
    task: 'Borrow/liquidation risk',
    agent: 'SMEAI Reference Health Factor Monitor',
    manual: '134.4137659 s',
    agentTime: '2.797 s',
    speedup: '48.06×',
    quality: '23/25 → 23/25',
  },
];

function DocsSection({ id, eyebrow, title, description, children, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>}
      <SectionHeading title={title} description={description} />
      {children}
    </section>
  );
}

function TypeCard({ label, detail, variant }) {
  return (
    <Card className="h-full p-5">
      <Badge variant={variant}>{label}</Badge>
      <p className="mt-3 text-sm leading-relaxed text-muted">{detail}</p>
    </Card>
  );
}

export default function DocsPage() {
  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="Guide"
        title="AgentHub Docs"
        description="A concise guide to discovering agents, running tasks, and reading the evidence behind each result."
        actions={<ButtonLink to="/discover" variant="primary">Explore agents <ArrowRight size={16} /></ButtonLink>}
      />

      <div className="mt-10 space-y-12 lg:space-y-16">
        <DocsSection
          id="what-is-agenthub"
          eyebrow="The marketplace"
          title="What is AgentHub?"
          description="One clear path from a task to an inspectable result."
        >
          <Card>
            <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <BookOpen size={19} aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-fg">Discover → Evaluate → Hire → Execute → Verify</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  AgentHub brings BNB-focused AI agents into one marketplace. You can compare what an
                  agent claims to do with what has actually been verified, then follow a task through to
                  its result and provenance.
                </p>
              </div>
              <ButtonLink to="/find" variant="outline" className="w-fit shrink-0">Describe a task <ArrowRight size={15} /></ButtonLink>
            </CardBody>
          </Card>
        </DocsSection>

        <DocsSection
          id="agent-types"
          eyebrow="Read the labels"
          title="Agent types"
          description="Source and capability labels keep external listings distinct from built-in execution."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_TYPES.map((type) => <TypeCard key={type.label} {...type} />)}
          </div>
        </DocsSection>

        <DocsSection
          id="how-execution-works"
          eyebrow="The task flow"
          title="How execution works"
          description="The interface keeps review and authorization visible at the point where they matter."
        >
          <Card>
            <CardBody className="grid gap-0 md:grid-cols-5 md:divide-x md:divide-line">
              {EXECUTION_STEPS.map((step) => (
                <div key={step.number} className="flex gap-3 border-b border-line py-4 last:border-0 md:block md:border-0 md:px-4 md:py-1 first:md:pl-0 last:md:pr-0">
                  <span className="font-mono text-xs text-brand">{step.number}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </DocsSection>

        <DocsSection
          id="networks"
          eyebrow="Context matters"
          title="Networks"
          description="There is no single global network: the current agent and action determine the relevant context."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {NETWORKS.map(({ icon: Icon, label, detail, variant }) => (
              <Card key={label} className="p-5">
                <div className="flex items-start gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${variant === 'ok' ? 'bg-ok/10 text-ok' : variant === 'brand' ? 'bg-brand/10 text-brand' : 'bg-info/10 text-info'}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-fg">{label}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{detail}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </DocsSection>

        <DocsSection
          id="agent-advantage"
          eyebrow="Measured evidence"
          title="Agent Advantage"
          description="Three real external ERC-8004 marketplace agents compared with frozen manual workflows."
        >
          <Card>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">External ERC-8004 agents</Badge>
                <Badge variant="ok">BSC Mainnet provenance</Badge>
                <Badge variant="neutral">$0 direct cost</Badge>
                <Badge variant="neutral">hasSimulated: false</Badge>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
                Manual work was completed and frozen before each corresponding AgentHub run. All three
                AgentHub executions completed in under three seconds. Scores use the same 25-point
                rubric for both sides and are not independent third-party certification.
              </p>

              <div className="mt-6 overflow-x-auto rounded-lg border border-line">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <caption className="sr-only">Verified manual versus AgentHub benchmark results</caption>
                  <thead className="bg-panel-2 text-xs uppercase tracking-wide text-faint">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Task</th>
                      <th className="px-4 py-3 font-semibold">External agent</th>
                      <th className="px-4 py-3 font-semibold">Manual</th>
                      <th className="px-4 py-3 font-semibold">AgentHub</th>
                      <th className="px-4 py-3 font-semibold">Speedup</th>
                      <th className="px-4 py-3 font-semibold">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {BENCHMARKS.map((benchmark) => (
                      <tr key={benchmark.agent}>
                        <td className="px-4 py-3 font-medium text-fg">{benchmark.task}</td>
                        <td className="px-4 py-3 text-muted">{benchmark.agent}</td>
                        <td className="px-4 py-3 font-mono text-muted">{benchmark.manual}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-brand">{benchmark.agentTime}</td>
                        <td className="px-4 py-3 font-semibold text-fg">{benchmark.speedup}</td>
                        <td className="px-4 py-3 text-muted">{benchmark.quality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="mt-5 rounded-lg border border-line bg-panel-2 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-fg">Disclosures and scope</summary>
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                  <p>Assay Grid measured trading-analysis efficiency, not realized trading profitability. No win-rate or profitability claim is made.</p>
                  <p>Two Venus Borrow Buffer Watch attempts failed with the same provider message and remain disclosed in the full report: `exe_d3ac0f823141` and `exe_8d3ff6855a4d`.</p>
                  <p>Supplementary built-in benchmarks are separate AgentHub executors on BSC Testnet chain 97; they are not external ERC-8004 comparisons.</p>
                </div>
              </details>

              <a
                href="https://github.com/london160771/agenthub-bnb/blob/main/AGENT_ADVANTAGE_REPORT.md"
                target="_blank"
                rel="noreferrer noopener"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-2"
              >
                View full Agent Advantage Report <ExternalLink size={15} aria-hidden="true" />
              </a>
            </CardBody>
          </Card>
        </DocsSection>

        <DocsSection
          id="safety"
          eyebrow="Trust by design"
          title="Safety / trust model"
          description="The product makes uncertainty and authorization visible instead of hiding them."
        >
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {[
                [LockKeyhole, 'No private keys stored', 'AgentHub only sees the public wallet address shared by the browser wallet.'],
                [Wallet, 'Explicit paid confirmation', 'Paid actions show the exact amount, token, recipient, and settlement chain before approval.'],
                [ShieldCheck, 'Fail-closed payment checks', 'Incomplete or unverified payment metadata does not become a runnable paid flow.'],
                [CheckCircle2, 'Result and provenance separated', 'Read the agent output first, then inspect network, block, provider, and warnings as evidence.'],
              ].map(([Icon, title, detail]) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border border-line bg-panel-2 p-4">
                  <Icon size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-fg">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </DocsSection>

        <DocsSection
          id="quick-demo"
          eyebrow="Try it yourself"
          title="Quick demo path"
          description="A judge can follow the product in one short loop."
        >
          <Card>
            <CardBody className="flex flex-wrap items-center gap-2">
              {[
                ['/discover', '1. Discover'],
                ['/discover', '2. Choose executable agent'],
                ['/agents/8004-56-331751', '3. Hire'],
                ['/hire/8004-56-331751', '4. Run'],
                ['/activity', '5. Inspect Result + Verification'],
              ].map(([to, label], index) => (
                <span key={label} className="flex items-center gap-2">
                  <Link to={to} className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-line-strong hover:text-brand">
                    {label}
                  </Link>
                  {index < 4 && <ArrowRight size={14} className="text-faint" aria-hidden="true" />}
                </span>
              ))}
              <Zap size={17} className="ml-1 text-brand" aria-hidden="true" />
            </CardBody>
          </Card>
        </DocsSection>
      </div>
    </Container>
  );
}
