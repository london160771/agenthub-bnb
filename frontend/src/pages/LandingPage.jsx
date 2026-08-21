import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Fingerprint,
  Gauge,
  Clock,
  Radar,
  TrendingUp,
  HeartPulse,
  Sprout,
  PieChart,
  Search,
} from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { Button, ButtonLink } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { CATEGORIES } from '../config.js';

const CATEGORY_ICONS = {
  radar: Radar,
  'trending-up': TrendingUp,
  'heart-pulse': HeartPulse,
  sprout: Sprout,
  'pie-chart': PieChart,
  search: Search,
};

const JOURNEY = [
  { step: 'Discover', desc: 'Search the BNB agent ecosystem in one place.' },
  { step: 'Evaluate', desc: 'Identity, reputation and performance at a glance.' },
  { step: 'Compare', desc: 'Weigh alternatives side by side.' },
  { step: 'Hire', desc: 'Connect your wallet and commission a task.' },
  { step: 'Execute', desc: 'Watch the agent work in real time.' },
  { step: 'Verify', desc: 'See the result — and the advantage over doing it yourself.' },
];

const HOW_IT_WORKS = [
  { icon: Compass, title: 'Discover', body: 'Browse or describe your task in plain language and let AgentHub surface the right agents.' },
  { icon: ShieldCheck, title: 'Evaluate', body: 'Review ERC-8004 identity, an explainable trust score, and real performance history.' },
  { icon: Zap, title: 'Hire', body: 'Connect your BNB wallet, configure the task, and confirm — no private keys ever leave your wallet.' },
  { icon: CheckCircle2, title: 'Execute', body: 'Follow a live execution timeline and get a verifiable result you can act on.' },
];

function HeroFinder() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/find?q=${encodeURIComponent(q)}` : '/find');
  };

  return (
    <form onSubmit={submit} className="max-w-xl">
      <label htmlFor="hero-finder" className="mb-2 block text-sm font-medium text-muted sm:text-xs">
        Describe what you need
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="hero-finder"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="I need an agent to monitor my DeFi position"
          className="h-14 w-full min-w-0 rounded-xl border border-line bg-panel px-4 text-base text-fg placeholder:text-faint focus:border-brand/60 focus:outline-none sm:h-12 sm:w-auto sm:flex-1 sm:text-sm"
        />
        <Button type="submit" size="lg" className="h-14 shrink-0 sm:h-12">
          Find an Agent
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.35fr_0.9fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <Badge variant="brand" className="mb-5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            BNB Smart Chain · AI Agent Marketplace
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Find the <span className="text-brand">right</span> AI agent for the job.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Discover, compare and hire verified AI agents running on BNB Smart Chain — then measure
            exactly how much time and cost they save you.
          </p>
          <div className="mt-8">
            <HeroFinder />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <Link to="/discover" className="inline-flex items-center gap-1.5 text-fg underline-offset-4 hover:underline">
              Browse the marketplace <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <span className="hidden sm:inline text-faint">·</span>
            <span>No sign-up required to explore</span>
          </div>
        </div>

        {/* Journey preview card */}
        <Card className="hidden self-center bg-gradient-to-b from-panel to-panel-2 p-6 lg:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            The AgentHub journey
          </p>
          <ol className="space-y-0">
            {JOURNEY.map((j, i) => (
              <li
                key={j.step}
                className="flex items-baseline gap-3 border-b border-line py-3 last:border-0"
              >
                <span className="font-mono text-xs text-brand">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="font-semibold">{j.step}</p>
                  <p className="text-sm text-muted">{j.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </Container>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: Fingerprint, label: 'ERC-8004 identity', desc: 'On-chain agent identity where available' },
    { icon: Gauge, label: 'Explainable trust score', desc: 'A transparent, weighted marketplace score' },
    { icon: TrendingUp, label: 'Real performance', desc: 'Success rate, executions and response time' },
    { icon: Clock, label: 'Agent Advantage', desc: 'Measured time & cost vs doing it manually' },
  ];
  return (
    <section className="border-b border-line bg-panel/40">
      <Container className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted">{desc}</p>
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}

function Categories() {
  return (
    <section className="border-b border-line">
      <Container className="py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Browse by category</h2>
            <p className="mt-1 text-muted">Explore agents grouped by what they do.</p>
          </div>
          <Link to="/discover" className="hidden text-sm text-brand hover:underline sm:inline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] || Compass;
            return (
              <Link key={cat.id} to={`/discover?category=${cat.id}`}>
                <Card interactive className="flex h-full items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-panel-2 text-brand">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{cat.label}</p>
                    <p className="text-sm text-muted">Explore {cat.label.toLowerCase()} agents</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-b border-line bg-panel/40">
      <Container className="py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="mt-1 text-muted">
            From a plain-language request to a verified result in four steps.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
            <Card key={title} className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="font-mono text-sm text-faint">0{i + 1}</span>
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function AgentAdvantage() {
  return (
    <section className="border-b border-line">
      <Container className="grid items-center gap-10 py-16 lg:grid-cols-2">
        <div>
          <Badge variant="brand" className="mb-4">
            Agent Advantage
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Prove hiring an agent beats doing it yourself.
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted">
            For every execution, AgentHub compares the agent against the manual alternative — time,
            steps and cost — so the value is measurable, not assumed.
          </p>
          <div className="mt-6">
            <ButtonLink to="/discover" variant="outline">
              Explore BNB agents
              <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>

        {/* Illustrative comparison — clearly labelled, not a real measurement. */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-muted">Health factor check</p>
            <Badge variant="warn">Illustrative example</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-base p-4">
              <p className="text-xs uppercase tracking-wide text-faint">Manual</p>
              <p className="mt-2 text-3xl font-bold">~14 min</p>
              <p className="mt-1 text-sm text-muted">6 manual steps</p>
            </div>
            <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
              <p className="text-xs uppercase tracking-wide text-brand">Agent</p>
              <p className="mt-2 text-3xl font-bold text-brand">2.8 sec</p>
              <p className="mt-1 text-sm text-muted">1 request</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-muted">Time saved</span>
            <span className="font-mono font-semibold text-ok">≈ 13m 57s</span>
          </div>
        </Card>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section>
      <Container className="py-20 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to find your agent?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Turn the BNB agent ecosystem into a searchable, verifiable marketplace.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink to="/find" size="lg">
            Find an Agent
            <ArrowRight size={18} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink to="/discover" size="lg" variant="outline">
            Browse marketplace
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <Categories />
      <HowItWorks />
      <AgentAdvantage />
      <FinalCta />
    </>
  );
}
