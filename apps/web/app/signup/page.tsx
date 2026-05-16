import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuoteworthyMark } from "@/components/shell/quoteworthy-mark";
import { signup } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <QuoteworthyMark size={32} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            Quoteworthy
          </span>
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.018em",
            color: "var(--ink)",
            margin: 0,
            marginBottom: 6,
          }}
        >
          Create your account
        </h1>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 15,
            color: "var(--ink-muted)",
            margin: 0,
            marginBottom: 24,
          }}
        >
          14-day trial. No card required.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 6,
              background: "var(--risky-bg)",
              color: "var(--risky)",
              border: "1px solid rgba(194,104,90,0.20)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <form action={signup} style={{ display: "grid", gap: 14 }}>
          <Field
            id="display_name"
            label="Your name"
            hint="optional"
          >
            <Input
              id="display_name"
              name="display_name"
              type="text"
              autoComplete="name"
            />
          </Field>
          <Field id="email" label="Email">
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </Field>
          <Field id="password" label="Password" hint="≥ 8 characters">
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" className="w-full mt-2 h-9">
            Create account
          </Button>
        </form>

        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            marginTop: 24,
            textAlign: "center",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{ color: "var(--info)", textDecoration: "none" }}
          >
            Log in
          </Link>
        </p>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-faint)",
            marginTop: 32,
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          By signing up you agree to our{" "}
          <a
            href="https://github.com/wow-solutions/Quoteworthy/blob/main/docs/terms.md"
            style={{
              color: "var(--ink-muted)",
              textDecoration: "underline",
            }}
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/wow-solutions/Quoteworthy/blob/main/docs/privacy.md"
            style={{
              color: "var(--ink-muted)",
              textDecoration: "underline",
            }}
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--ink-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        {hint && (
          <span style={{ color: "var(--ink-faint)", textTransform: "none", letterSpacing: 0 }}>
            {hint}
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}
