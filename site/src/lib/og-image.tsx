import { ImageResponse } from 'next/og';

export const OG_SIZE = {
  width: 1200,
  height: 630,
};

export const OG_CONTENT_TYPE = 'image/png';

const TOKENS = {
  desk: '#e2e3e5',
  sheet: '#ffffff',
  panel: '#ffffff',
  ink: '#121212',
  ink2: '#4b4b4b',
  rule: '#121212',
  marker: '#ffd60a',
  markerInk: '#121212',
};

export interface Frame12OgProps {
  cutLabel: string;
  tag: string;
  title: string;
  subtitle: string;
  footerRight?: string;
}

export function renderFrame12OgImage({
  cutLabel,
  tag,
  title,
  subtitle,
  footerRight = 'frame12.dev · 12fps on twos',
}: Frame12OgProps) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: TOKENS.desk,
          padding: '28px',
          fontFamily: 'sans-serif',
          color: TOKENS.ink,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: TOKENS.sheet,
            border: `4px solid ${TOKENS.rule}`,
            padding: '44px 48px 38px',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                style={{
                  backgroundColor: TOKENS.ink,
                  color: TOKENS.sheet,
                  padding: '6px 14px',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                {cutLabel}
              </span>
              <span
                style={{
                  backgroundColor: TOKENS.marker,
                  color: TOKENS.markerInk,
                  border: `3px solid ${TOKENS.rule}`,
                  padding: '6px 14px',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {tag}
              </span>
            </div>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: TOKENS.ink,
              }}
            >
              FRAME/12
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              border: `4px solid ${TOKENS.rule}`,
              backgroundColor: TOKENS.panel,
              padding: '36px 40px',
              boxShadow: `8px 8px 0 ${TOKENS.rule}`,
            }}
          >
            <div
              style={{
                fontSize: '64px',
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
                color: TOKENS.ink,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: '26px',
                lineHeight: 1.4,
                color: TOKENS.ink2,
              }}
            >
              {subtitle}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              borderTop: `3px solid ${TOKENS.rule}`,
              paddingTop: '18px',
              fontSize: '20px',
              color: TOKENS.ink2,
            }}
          >
            <span>2.5px Mitered Panels · 12/20/32px Gutters · 45° SVG Screentone</span>
            <span style={{ color: TOKENS.ink, fontWeight: 700 }}>{footerRight}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
    },
  );
}
