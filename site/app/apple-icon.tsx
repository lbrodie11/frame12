import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffd60a',
          border: '10px solid #121212',
          boxSizing: 'border-box',
        }}
      >
        <svg width="136" height="136" viewBox="0 0 32 32">
          <polygon points="2,2 30,2 30,13.5 2,18" fill="#121212" />
          <polygon points="2,22.5 30,18 30,30 2,30" fill="#121212" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
