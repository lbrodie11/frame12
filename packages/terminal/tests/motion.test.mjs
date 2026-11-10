import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FRAME_MS, MOTION_VALUES, POSE_MS, resolveTerminalMotion, tempoIntervalMs } from '@frame12/terminal';

const live = { interactive: true, ci: false, screenReader: false, dumb: false };

describe('motion: resolveTerminalMotion precedence', () => {
  // [name, argv, env, caps, tempo, source]
  const table = [
    ['default on an interactive TTY → twos', [], {}, live, 'twos', 'default'],
    ['--motion ones', ['--motion', 'ones'], {}, live, 'ones', 'flag'],
    ['--motion=still', ['--motion=still'], {}, live, 'still', 'flag'],
    ['FRAME12_MOTION=ones', [], { FRAME12_MOTION: 'ones' }, live, 'ones', 'env'],
    ['flag beats FRAME12_MOTION', ['--motion', 'twos'], { FRAME12_MOTION: 'still' }, live, 'twos', 'flag'],
    ['FRAME12_MOTION beats NO_MOTION', [], { FRAME12_MOTION: 'ones', NO_MOTION: '1' }, live, 'ones', 'env'],
    ['NO_MOTION=1 → still', [], { NO_MOTION: '1' }, live, 'still', 'reduced-motion-env'],
    ['REDUCED_MOTION=yes → still', [], { REDUCED_MOTION: 'yes' }, live, 'still', 'reduced-motion-env'],
    ['NO_MOTION=0 is ignored', [], { NO_MOTION: '0' }, live, 'twos', 'default'],
    ['NO_MOTION="" is ignored', [], { NO_MOTION: '' }, live, 'twos', 'default'],
    ['NO_MOTION beats the environment check', [], { NO_MOTION: '1' }, { ...live, ci: true }, 'still', 'reduced-motion-env'],
    ['not interactive → still', [], {}, { ...live, interactive: false }, 'still', 'environment'],
    ['CI → still', [], {}, { ...live, ci: true }, 'still', 'environment'],
    ['screen reader → still', [], {}, { ...live, screenReader: true }, 'still', 'environment'],
    ['TERM=dumb → still', [], {}, { ...live, dumb: true }, 'still', 'environment'],
    ['explicit --motion beats CI (decoration is still suppressed on non-TTY output by renderers)', ['--motion', 'twos'], {}, { ...live, ci: true }, 'twos', 'flag'],
    ['--motion auto falls through', ['--motion', 'auto'], { NO_MOTION: '1' }, live, 'still', 'reduced-motion-env'],
    ['FRAME12_MOTION=auto falls through to the default', [], { FRAME12_MOTION: 'auto' }, live, 'twos', 'default'],
    ['values are case-insensitive', ['--motion', 'ONES'], {}, live, 'ones', 'flag'],
  ];
  for (const [name, argv, env, caps, tempo, source] of table) {
    it(name, () => {
      const r = resolveTerminalMotion({ argv, env, caps });
      assert.equal(r.tempo, tempo);
      assert.equal(r.source, source);
      if (tempo === 'still') assert.ok(r.reason, 'still always says why');
    });
  }

  it('ignores invalid values with a warning instead of throwing', () => {
    const r = resolveTerminalMotion({ argv: ['--motion', 'fast'], env: { FRAME12_MOTION: 'slow' }, caps: live });
    assert.equal(r.tempo, 'twos');
    assert.equal(r.warnings.length, 2);
    assert.match(r.warnings[0], /--motion/);
  });

  it("respects a component's own default for auto", () => {
    assert.equal(resolveTerminalMotion({ caps: live, defaultTempo: 'ones' }).tempo, 'ones');
  });

  it('uses the F12-08 Tempo vocabulary and the 83.33 ms pose', () => {
    assert.deepEqual([...MOTION_VALUES], ['auto', 'twos', 'ones', 'still']);
    assert.ok(Math.abs(POSE_MS - 83.333) < 0.001);
    assert.equal(tempoIntervalMs('twos'), POSE_MS);
    assert.equal(tempoIntervalMs('ones'), FRAME_MS);
    assert.equal(tempoIntervalMs('still'), Infinity);
  });
});
