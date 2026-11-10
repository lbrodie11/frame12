import { Sheet, Scene, Panel, Tag } from '@/components/frame12';
import { CopyCommand } from '@/components/copy-command';
import { PrReportReact } from '@/components/pr-report-react';
import { renderStaticPrReport } from '@/lib/pr-report';

const USAGE_SNIPPET = `import { document, sheet, scene, panel, metric, ghostWire, receiptList, fragment } from '@frame12/static';

const body = sheet({
  autoCut: true, // panels without a cut are numbered C-01, C-02… by the stylesheet
  children: scene({
    areas: ['summary metrics'],
    children: fragment(
      panel({ area: 'summary', label: 'Change summary', children: pr.summary }), // strings are escaped
      panel({ area: 'metrics', children: metric({ label: 'Lines changed', value: pr.lines }) }),
    ),
  }),
});

// A self-contained page: tokens + static CSS inlined, no scripts or external requests.
const html = document({ title: pr.title, body });`;

const CSP_SNIPPET = `// CSP-restricted hosts (e.g. VS Code webviews): don't inline CSS, load both stylesheets as resources.
const page = document({ title, body, inlineCss: false });
// <link rel="stylesheet" href="…/@frame12/tokens/tokens.css">
// <link rel="stylesheet" href="…/@frame12/static/static.css">`;

/** Side-by-side: the React kit and @frame12/static rendering the same pull-request report. */
export default function StaticPage() {
  const staticReport = renderStaticPrReport();
  return (
    <>
      <Sheet autoCut pegs id="static-intro">
        <header className="f12-hd">
          <div className="f12-hd-text">
            <p className="f12-eyebrow">
              Package <Tag>@frame12/static</Tag>
            </p>
            <h1 className="f12-title">One grammar, two renderers</h1>
            <p className="f12-sub">
              The same pull-request report rendered by the React kit and by @frame12/static: the same
              DOM, classes and stylesheet, with no React in the static output.
            </p>
          </div>
        </header>
        <Scene gutter="scene" layout="split">
          <Panel label="Install and render">
            <CopyCommand command="npm install @frame12/static" label="Install @frame12/static" id="static-install" />
            <pre className="f12-cmd-pre" id="static-usage-snippet">
              <code>{USAGE_SNIPPET}</code>
            </pre>
          </Panel>
          <Panel label="Hosts with a strict CSP">
            <pre className="f12-cmd-pre" id="static-csp-snippet">
              <code>{CSP_SNIPPET}</code>
            </pre>
            <p>
              <a href="/static/report.html" id="static-standalone-link">
                Open the standalone static page
              </a>{' '}
              (served with <code>default-src &apos;none&apos;</code>).
            </p>
          </Panel>
        </Scene>
      </Sheet>
      <div className="f12-static-compare" id="static-compare">
        <section aria-labelledby="static-compare-react" className="f12-static-compare-col" data-renderer="react">
          <h2 id="static-compare-react" className="f12-static-compare-h">React kit</h2>
          <PrReportReact />
        </section>
        <section aria-labelledby="static-compare-static" className="f12-static-compare-col" data-renderer="static">
          <h2 id="static-compare-static" className="f12-static-compare-h">@frame12/static</h2>
          {/* renderStaticPrReport() returns escaped, deterministic markup built only from the report data. */}
          <div dangerouslySetInnerHTML={{ __html: staticReport }} />
        </section>
      </div>
    </>
  );
}
