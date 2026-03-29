import { useNavigate } from "react-router-dom";
import { ArrowRight, Terminal, Layers, Shield, Zap, Code2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import styles from "./LandingPage.module.css";

/* ------------------------------------------------------------------ */
/*  Inline SVG illustrations – stroke-based, Hooklab aesthetic        */
/* ------------------------------------------------------------------ */

function HeroDashboardMock() {
  return (
    <div className={styles.lpHeroMock} aria-hidden="true">
      {/* Browser chrome */}
      <div className={styles.lpMockChrome}>
        <span className={cn(styles.lpDot, styles.lpDotRed)} />
        <span className={cn(styles.lpDot, styles.lpDotYellow)} />
        <span className={cn(styles.lpDot, styles.lpDotGreen)} />
        <span className={styles.lpMockUrl}>hooklab.dev/dashboard</span>
      </div>

      {/* Header bar */}
      <div className={styles.lpMockHeader}>
        <span className={styles.lpMockLogo}>HOOKLAB</span>
        <span className={styles.lpMockLink}>Github</span>
      </div>

      {/* Action bar */}
      <div className={styles.lpMockActionbar}>
        <span className={styles.lpMockTextMuted}>Application is ready to use</span>
        <div className={styles.lpMockActionbarRight}>
          <div className={styles.lpMockSearch}>
            <span className={styles.lpMockSearchIcon}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <span className={styles.lpMockTextPlaceholder}>search by webhook</span>
          </div>
          <span className={styles.lpMockBtnPrimary}>ADD NEW</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className={styles.lpMockFilters}>
        <span className={cn(styles.lpMockPill, styles.lpMockPillActive)}>All 12</span>
        <span className={styles.lpMockPill}>Active 10</span>
        <span className={styles.lpMockPill}>Closed 2</span>
      </div>

      {/* Endpoint rows */}
      <div className={styles.lpMockRows}>
        {[
          { name: "Payment Webhooks", status: true, count: 8, url: "/w/a3f2...c8d1" },
          { name: "Stripe Events", status: true, count: 7, url: "/w/b7e4...9fa2" },
          { name: "GitHub Push Events", status: true, count: 4, url: "/w/d1c3...4e5b" },
          { name: "Slack Alerts", status: false, count: 3, url: "/w/e8a1...7f6c" },
        ].map((row, i) => (
          <div key={i} className={styles.lpMockRow}>
            {row.status && <span className={styles.lpMockStatusDot} />}
            <div className={styles.lpMockRowInfo}>
              <span className={styles.lpMockRowName}>{row.name}</span>
              <span className={styles.lpMockRowUrl}>{row.url}</span>
            </div>
            <div className={styles.lpMockRowMeta}>
              <span className={cn(styles.lpMockRowStatus, row.status && styles.lpMockRowStatusActive)}>
                {row.status ? "Active" : "Closed"}
              </span>
              <span className={styles.lpMockRowCount}>{row.count}</span>
            </div>
            <span className={styles.lpMockRowDots}>...</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScriptEditorMock() {
  return (
    <div className={styles.lpEditorMock} aria-hidden="true">
      {/* Browser chrome */}
      <div className={styles.lpMockChrome}>
        <span className={cn(styles.lpDot, styles.lpDotRed)} />
        <span className={cn(styles.lpDot, styles.lpDotYellow)} />
        <span className={cn(styles.lpDot, styles.lpDotGreen)} />
        <span className={styles.lpMockUrl}>hooklab.dev/endpoint/script</span>
      </div>

      {/* Editor header */}
      <div className={styles.lpEditorHeader}>
        <span className={styles.lpEditorTitle}>Script Editor</span>
        <div className={styles.lpEditorActions}>
          <span className={cn(styles.lpEditorBadge, styles.lpEditorBadgeSaved)}>Saved</span>
          <span className={styles.lpEditorBtn}>Reset</span>
          <span className={styles.lpEditorBtn}>Test</span>
          <span className={cn(styles.lpEditorBtn, styles.lpEditorBtnPrimary)}>Save</span>
        </div>
      </div>

      {/* Code area */}
      <div className={styles.lpEditorCode}>
        <div className={styles.lpEditorLines}>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <div className={styles.lpEditorContent}>
          <span className={styles.lpCodeComment}>{"// Parse incoming webhook & route"}</span>
          <span className={styles.lpCodeKeyword}>{"const"}</span>
          <span className={styles.lpCodeText}>{" data = "}</span>
          <span className={styles.lpCodeFn}>{"JSON.parse"}</span>
          <span className={styles.lpCodeText}>{"(request.body);"}</span>
          <br />
          <br />
          <span className={styles.lpCodeKeyword}>{"if"}</span>
          <span className={styles.lpCodeText}>{" (data.event === "}</span>
          <span className={styles.lpCodeString}>{'"payment.success"'}</span>
          <span className={styles.lpCodeText}>{")"}</span>
          <span className={styles.lpCodeText}>{" {"}</span>
          <br />
          <span className={styles.lpCodeText}>{"  "}</span>
          <span className={styles.lpCodeKeyword}>{"return"}</span>
          <span className={styles.lpCodeText}>{" {"}</span>
          <br />
          <span className={styles.lpCodeText}>{"    status: "}</span>
          <span className={styles.lpCodeNumber}>{"200"}</span>
          <span className={styles.lpCodeText}>{","}</span>
          <br />
          <span className={styles.lpCodeText}>{"    headers: { "}</span>
          <span className={styles.lpCodeString}>{'"Content-Type"'}</span>
          <span className={styles.lpCodeText}>{": "}</span>
          <span className={styles.lpCodeString}>{'"application/json"'}</span>
          <span className={styles.lpCodeText}>{" },"}</span>
          <br />
          <span className={styles.lpCodeText}>{"    body: "}</span>
          <span className={styles.lpCodeFn}>{"JSON.stringify"}</span>
          <span className={styles.lpCodeText}>{"({ ok: "}</span>
          <span className={styles.lpCodeKeyword}>{"true"}</span>
          <span className={styles.lpCodeText}>{" })"}</span>
          <br />
          <span className={styles.lpCodeText}>{"  };"}</span>
          <br />
          <span className={styles.lpCodeText}>{"}"}</span>
        </div>
      </div>

      {/* Test result */}
      <div className={styles.lpEditorResult}>
        <span className={styles.lpEditorResultLabel}>Test Result</span>
        <span className={styles.lpEditorResultBadge}>200 OK</span>
        <span className={styles.lpEditorResultBody}>{`{ "ok": true }`}</span>
      </div>
    </div>
  );
}

function EndpointsMock() {
  return (
    <div className={styles.lpEndpointsMock} aria-hidden="true">
      <div className={styles.lpEndpointsGrid}>
        {[
          { name: "Stripe Payments", method: "POST", path: "/w/stripe-pay", color: "#01189b" },
          { name: "GitHub Webhooks", method: "POST", path: "/w/github-hooks", color: "#2e7d5b" },
          { name: "Slack Notifications", method: "POST", path: "/w/slack-alerts", color: "#c5930a" },
          { name: "Shopify Orders", method: "POST", path: "/w/shopify-ord", color: "#01189b" },
          { name: "CI/CD Pipeline", method: "POST", path: "/w/cicd-deploy", color: "#ac1b11" },
          { name: "Analytics Events", method: "POST", path: "/w/analytics", color: "#2e7d5b" },
        ].map((ep, i) => (
          <div key={i} className={styles.lpEndpointCard}>
            <div className={styles.lpEndpointCardHeader}>
              <span className={styles.lpEndpointDot} style={{ backgroundColor: ep.color }} />
              <span className={styles.lpEndpointMethod}>{ep.method}</span>
            </div>
            <span className={styles.lpEndpointName}>{ep.name}</span>
            <span className={styles.lpEndpointPath}>{ep.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Page Component                                       */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const navigate = useNavigate();

  const goToApp = () => navigate("/auth");

  return (
    <div className={styles.lpRoot}>
      {/* ===================== NAV ===================== */}
      <nav className={styles.lpNav}>
        <span className="lp-nav-logo">HOOKLAB</span>
        <div className={styles.lpNavLinks}>
          <a href="#features" className={styles.lpNavLink}>Features</a>
          <a href="#scripting" className={styles.lpNavLink}>Scripting</a>
          <a href="#endpoints" className={styles.lpNavLink}>Endpoints</a>
          <a href="https://github.com/nicholasadamou/webhook" target="_blank" rel="noopener noreferrer" className={styles.lpNavGithub} aria-label="GitHub">
            <GitHubIcon className={styles.lpIconMd} />
          </a>
          <button onClick={goToApp} className={styles.lpNavCta}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ===================== HERO ===================== */}
      <section className={styles.lpHero}>
        <div className={styles.lpHeroContent}>
          <p className={styles.lpHeroLabel}>WEBHOOK TESTING PLATFORM</p>
          <h1 className={styles.lpHeroTitle}>
            Inspect, debug & transform <br />
              webhooks in real time
          </h1>
          <p className={styles.lpHeroSubtitle}>
            Create unlimited endpoints, capture every request payload, and write
            custom JavaScript to transform responses — all from a single,
            developer-focused dashboard.
          </p>
          <div className={styles.lpHeroActions}>
            <button onClick={goToApp} className={styles.lpBtnPrimary}>
              Start Testing
              <ArrowRight className={styles.lpBtnIcon} />
            </button>
            <a href="#features" className={styles.lpBtnOutline}>
              See How It Works
            </a>
          </div>
        </div>
        <div className={styles.lpHeroVisual}>
          <HeroDashboardMock />
        </div>
      </section>

      {/* ===================== FEATURES GRID ===================== */}
      <section id="features" className={cn(styles.lpSection, styles.lpSectionOffset)}>
        <p className={styles.lpSectionLabel}>FEATURES</p>
        <h2 className={styles.lpSectionTitle}>Everything you need to master webhooks</h2>

        <div className={styles.lpFeaturesGrid}>
          {[
            {
              icon: <Globe />,
              title: "Instant Endpoints",
              description:
                "Create a webhook URL in one click. No configuration, no deployment. Start receiving requests immediately.",
            },
            {
              icon: <Terminal />,
              title: "JavaScript Scripting",
              description:
                "Write custom scripts that execute on every incoming request. Transform, validate, and route webhooks with full ES2023+ support.",
            },
            {
              icon: <Shield />,
              title: "Sandboxed Execution",
              description:
                "Scripts run in an isolated Deno Worker with zero permissions. No network, no file access. Safe by design.",
            },
            {
              icon: <Layers />,
              title: "Deep Inspection",
              description:
                "View headers, body, query params, and response for every request. Pretty-printed JSON, tabbed interface, full detail.",
            },
            {
              icon: <Zap />,
              title: "Real-time Updates",
              description:
                "Auto-refresh mode polls for new webhooks every 3 seconds. See requests as they arrive without lifting a finger.",
            },
            {
              icon: <Code2 />,
              title: "Method Agnostic",
              description:
                "Accept GET, POST, PUT, DELETE, PATCH, and any other HTTP method. Each endpoint handles them all.",
            },
          ].map((feature, i) => (
            <div key={i} className={styles.lpFeatureCard}>
              <div className={styles.lpFeatureIcon}>{feature.icon}</div>
              <h3 className={styles.lpFeatureTitle}>{feature.title}</h3>
              <p className={styles.lpFeatureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== SCRIPTING SECTION ===================== */}
      <section id="scripting" className={styles.lpSection}>
        <div className={styles.lpSplit}>
          <div className={styles.lpSplitText}>
            <p className={styles.lpSectionLabel}>ADVANCED SCRIPTING</p>
            <h2 className={cn(styles.lpSectionTitle, styles.lpSectionTitleLeft)}>
              Programmable webhook responses
            </h2>
            <p className={styles.lpSplitDesc}>
              Go beyond simple inspection. Write JavaScript that executes on every
              incoming request inside a secure, sandboxed environment. Parse payloads,
              validate signatures, route by content, or mock entire API responses.
            </p>
            <ul className={styles.lpSplitList}>
              <li>
                <span className={styles.lpListMarker} />
                Full access to <code>request.method</code>, <code>headers</code>, <code>query</code>, <code>body</code>
              </li>
              <li>
                <span className={styles.lpListMarker} />
                Return custom status codes, headers, and response bodies
              </li>
              <li>
                <span className={styles.lpListMarker} />
                5-second timeout with zero-permission sandbox
              </li>
              <li>
                <span className={styles.lpListMarker} />
                Built-in test runner to verify scripts instantly
              </li>
            </ul>
            <button onClick={goToApp} className={cn(styles.lpBtnPrimary, styles.lpBtnPrimarySm)}>
              Try the Script Editor
              <ArrowRight className={styles.lpBtnIcon} />
            </button>
          </div>
          <div className={styles.lpSplitVisual}>
            <ScriptEditorMock />
          </div>
        </div>
      </section>

      {/* ===================== MULTIPLE ENDPOINTS ===================== */}
      <section id="endpoints" className={cn(styles.lpSection, styles.lpSectionOffset)}>
        <div className={cn(styles.lpSplit, styles.lpSplitReverse)}>
          <div className={styles.lpSplitText}>
            <p className={styles.lpSectionLabel}>MULTIPLE ENDPOINTS</p>
            <h2 className={cn(styles.lpSectionTitle, styles.lpSectionTitleLeft)}>
              One dashboard, unlimited endpoints
            </h2>
            <p className={styles.lpSplitDesc}>
              Organize your webhook testing by integration. Create dedicated endpoints
              for Stripe, GitHub, Slack, Shopify, CI/CD pipelines, and more. Each
              endpoint gets its own URL, script, and request history.
            </p>
            <ul className={styles.lpSplitList}>
              <li>
                <span className={styles.lpListMarker} />
                Unique URL per endpoint for clean separation
              </li>
              <li>
                <span className={styles.lpListMarker} />
                Independent scripts for each endpoint
              </li>
              <li>
                <span className={styles.lpListMarker} />
                Filter by status — active, closed, or all
              </li>
              <li>
                <span className={styles.lpListMarker} />
                Search across all endpoints instantly
              </li>
            </ul>
            <button onClick={goToApp} className={cn(styles.lpBtnPrimary, styles.lpBtnPrimarySm)}>
              Create Your First Endpoint
              <ArrowRight className={styles.lpBtnIcon} />
            </button>
          </div>
          <div className={styles.lpSplitVisual}>
            <EndpointsMock />
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className={styles.lpSection}>
        <p className={styles.lpSectionLabel}>HOW IT WORKS</p>
        <h2 className={styles.lpSectionTitle}>Three steps to full control</h2>

        <div className={styles.lpSteps}>
          {[
            {
              step: "01",
              title: "Create an endpoint",
              desc: "Name it, click create. You get a unique webhook URL ready to receive requests from any source.",
            },
            {
              step: "02",
              title: "Send webhooks",
              desc: "Point your integration at the generated URL. Every request is logged with full headers, body, and metadata.",
            },
            {
              step: "03",
              title: "Inspect & transform",
              desc: "Browse request details in the tabbed inspector. Write custom scripts to transform responses on the fly.",
            },
          ].map((s, i) => (
            <div key={i} className={styles.lpStep}>
              <span className={styles.lpStepNumber}>{s.step}</span>
              <h3 className={styles.lpStepTitle}>{s.title}</h3>
              <p className={styles.lpStepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className={styles.lpCtaSection}>
        <h2 className={styles.lpCtaTitle}>
          Stop guessing.<br />Start inspecting.
        </h2>
        <p className={styles.lpCtaDesc}>
          Create your first webhook endpoint in seconds. No credit card, no setup,
          no configuration files.
        </p>
        <button onClick={goToApp} className={styles.lpBtnCta}>
          Get Started — Free
          <ArrowRight className={styles.lpBtnIcon} />
        </button>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className={styles.lpFooter}>
        <div className={styles.lpFooterInner}>
          <div className={styles.lpFooterLeft}>
            <span className={styles.lpFooterLogo}>HOOKLAB</span>
            <p className={styles.lpFooterCopy}>Free and open source.</p>
          </div>
          <div className={styles.lpFooterLinks}>
            <a href="#features" className={styles.lpFooterLink}>Features</a>
            <a href="#scripting" className={styles.lpFooterLink}>Scripting</a>
            <a href="#endpoints" className={styles.lpFooterLink}>Endpoints</a>
            <a href="https://github.com/nicholasadamou/webhook" target="_blank" rel="noopener noreferrer" className={cn(styles.lpFooterLink, styles.lpFooterGithub)}>
              <GitHubIcon className={styles.lpIconSm} />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
