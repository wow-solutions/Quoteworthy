import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteworthyMark } from "@/components/shell/quoteworthy-mark";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <Header />

      <Hero />
      <Problem />
      <How />
      <FinalCTA />

      <Footer />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header
      style={{
        height: "var(--shell-topbar-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <QuoteworthyMark size={28} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          Quoteworthy
        </span>
        <Eyebrow style={{ marginLeft: 8 }}>pre-alpha</Eyebrow>
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontSize: 13,
        }}
      >
        <a
          href="https://github.com/wow-solutions/Quoteworthy"
          style={{ color: "var(--ink-muted)" }}
        >
          GitHub
        </a>
        <Link href="/login" style={{ color: "var(--ink-muted)" }}>
          Log in
        </Link>
        <Link href="/signup">
          <Button size="sm">Sign up</Button>
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <Section paddingY={120}>
      <Eyebrow>Detection-aware content AI</Eyebrow>
      <h1
        style={{
          fontSize: "var(--text-display)",
          lineHeight: "var(--leading-tight)",
          letterSpacing: "var(--tracking-tight)",
          fontWeight: 600,
          color: "var(--ink)",
          margin: "16px 0 12px",
          maxWidth: 760,
        }}
      >
        Posts your clients can actually publish.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 22,
          color: "var(--ink-muted)",
          margin: 0,
          marginBottom: 24,
        }}
      >
        Content AI wants to quote.
      </p>
      <p
        style={{
          fontSize: 16,
          lineHeight: "var(--leading-relaxed)",
          color: "var(--ink-muted)",
          margin: 0,
          marginBottom: 32,
          maxWidth: 620,
        }}
      >
        Quoteworthy generates LinkedIn and blog posts in your client&apos;s
        voice — Pangram-verified to pass AI detection. Built for boutique
        agencies juggling many brands at once.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/signup">
          <Button size="lg">Sign up</Button>
        </Link>
        <Link
          href="/login"
          style={{
            fontSize: 14,
            color: "var(--ink-muted)",
            padding: "10px 14px",
          }}
        >
          Already have an account →
        </Link>
      </div>
    </Section>
  );
}

function Problem() {
  return (
    <Section paddingY={96} bordered>
      <Eyebrow>The 2026 penalty</Eyebrow>
      <h2
        style={{
          fontSize: "var(--text-h1)",
          lineHeight: "var(--leading-tight)",
          letterSpacing: "var(--tracking-tight)",
          fontWeight: 600,
          color: "var(--ink)",
          margin: "16px 0 32px",
          maxWidth: 640,
        }}
      >
        LinkedIn now penalizes AI-detected posts.
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 24,
          maxWidth: 720,
          marginBottom: 24,
        }}
      >
        <Stat number="−30%" label="reach on detected posts" />
        <Stat number="−55%" label="engagement loss" />
        <Stat number="1 in 4" label="AI posts flagged" />
      </div>

      <p
        style={{
          fontSize: 15,
          lineHeight: "var(--leading-relaxed)",
          color: "var(--ink-muted)",
          margin: 0,
          maxWidth: 620,
        }}
      >
        Agency clients can&apos;t afford the haircut. Generic AI tools fail
        detection because they all sound the same. Quoteworthy is built
        around the detector, not despite it.
      </p>
    </Section>
  );
}

function How() {
  return (
    <Section paddingY={96} bordered>
      <Eyebrow>How it works</Eyebrow>
      <h2
        style={{
          fontSize: "var(--text-h1)",
          lineHeight: "var(--leading-tight)",
          letterSpacing: "var(--tracking-tight)",
          fontWeight: 600,
          color: "var(--ink)",
          margin: "16px 0 40px",
        }}
      >
        Three steps from brand to publishable post.
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 32,
        }}
      >
        <Step
          n="01"
          title="Define brand voice"
          body="A short wizard captures each client's tone, audience, and vocabulary. Five minutes per brand, once."
        />
        <Step
          n="02"
          title="Generate posts"
          body="One button. Quoteworthy writes in the brand's voice — not generic-LLM voice. Edit inline if you want."
        />
        <Step
          n="03"
          title="See Detection Pass Score"
          body="Every draft is scored by Pangram before you ship. Green means safe to publish."
        />
      </div>
    </Section>
  );
}

function FinalCTA() {
  return (
    <Section paddingY={96} bordered>
      <Eyebrow>Get started</Eyebrow>
      <h2
        style={{
          fontSize: "var(--text-h1)",
          lineHeight: "var(--leading-tight)",
          letterSpacing: "var(--tracking-tight)",
          fontWeight: 600,
          color: "var(--ink)",
          margin: "16px 0 12px",
        }}
      >
        Start writing posts that pass.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: "var(--ink-muted)",
          margin: 0,
          marginBottom: 24,
          maxWidth: 560,
        }}
      >
        Free during pre-alpha. No card required.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/signup">
          <Button size="lg">Sign up</Button>
        </Link>
        <a
          href="https://github.com/wow-solutions/Quoteworthy"
          style={{
            fontSize: 14,
            color: "var(--ink-muted)",
            padding: "10px 14px",
          }}
        >
          View on GitHub →
        </a>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        padding: "32px 24px",
        textAlign: "center",
        fontSize: 12,
        color: "var(--ink-faint)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      Apache 2.0 ·{" "}
      <a
        href="https://github.com/wow-solutions/Quoteworthy/blob/main/docs/privacy.md"
        style={{ color: "var(--ink-faint)" }}
      >
        Privacy
      </a>{" "}
      ·{" "}
      <a
        href="https://github.com/wow-solutions/Quoteworthy/blob/main/docs/terms.md"
        style={{ color: "var(--ink-faint)" }}
      >
        Terms
      </a>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Helpers                                                       */
/* ──────────────────────────────────────────────────────────── */

function Section({
  children,
  paddingY,
  bordered = false,
}: {
  children: React.ReactNode;
  paddingY: number;
  bordered?: boolean;
}) {
  return (
    <section
      style={{
        padding: `${paddingY}px 24px`,
        borderTop: bordered ? "1px solid var(--border-subtle)" : undefined,
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--risky)",
          lineHeight: 1.1,
          marginBottom: 8,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-muted)",
          lineHeight: "var(--leading-snug)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.12em",
          color: "var(--ink-faint)",
          marginBottom: 12,
        }}
      >
        {n}
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "var(--ink)",
          margin: 0,
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: "var(--leading-relaxed)",
          color: "var(--ink-muted)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}
