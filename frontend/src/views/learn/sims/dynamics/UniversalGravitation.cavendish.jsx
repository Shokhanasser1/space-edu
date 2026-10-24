import { useState } from 'react';
import { ArrowLeftRight, Lightbulb, MoveDown, MoveUp, Pause, Play, RotateCcw } from 'lucide-react';
import { Btn, Explain, Readout, Segmented, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, G, g, Calc, Dimension, ForceArrow, Panel, ScaleChip, SimScene, niceNum, numt, sci, useSvgId } from './UniversalGravitation.parts';

/**
 * Cavendish's torsion balance (1798), seen from above and drawn to scale:
 * a 1.8 m rod with two small lead balls (0.73 kg) hangs on a thin wire; two
 * big lead balls (158 kg) are swung next to them, centre to centre
 * r = 0.23 m, on opposite sides, so both attractions twist the rod the same
 * way. The rod swings and settles where the wire's twist balances
 * F = G·M·m/r² ≈ 1.45·10⁻⁷ N (about 1/50 000 000 of a small ball's weight).
 * From the measured force G = F·r²/(M·m), and then the Earth's mass
 * M = g·R²/G ≈ 5.96·10²⁴ kg. The twist is exaggerated and time is sped up
 * (the chip says so); the torque on the rod is computed from the real
 * geometry of all four balls, so it fades smoothly as the big balls swing.
 */

const L = 1.8; // m, rod length
const M_BIG = 158; // kg
const M_SMALL = 0.73; // kg
const R_GAP = 0.23; // m, centre to centre when "near"
const RHO_LEAD = 11340; // kg/m³
const ballR = (m) => Math.cbrt((3 * m) / (4 * Math.PI * RHO_LEAD));
const R_BIG = ballR(M_BIG); // ≈ 0.149 m
const R_SMALL = ballR(M_SMALL); // ≈ 0.025 m
const ARM = Math.hypot(L / 2, R_GAP);
const ALPHA = { far: Math.PI / 2, A: Math.atan2(R_GAP, L / 2), B: Math.PI - Math.atan2(R_GAP, L / 2) };
const THETA_MAX = (1.6 * Math.PI) / 180; // drawn twist at the "near" position (exaggerated)
const OMEGA = (2 * Math.PI) / 3.6; // drawn swing period 3.6 s
const ZETA = 0.35;
const FRAME_SPEED = 1.25; // rad/s, how fast the big balls are swung round
const F_NEAR = (G * M_BIG * M_SMALL) / (R_GAP * R_GAP);
const F_SCALE_IN = 70 / F_NEAR; // px per newton inside the magnifier
const F_BAR = niceNum(46 / F_SCALE_IN);
const R_EARTH = 6.37e6;
const BOX = { x0: -1.15, x1: 1.15, y0: -1.12, y1: 1.12 };

/** Torque on the (unturned) rod from both big balls at frame angle α, in units of G·M·m. */
function torque(alpha) {
  const smalls = [
    [L / 2, 0],
    [-L / 2, 0],
  ];
  const bx = ARM * Math.cos(alpha);
  const by = ARM * Math.sin(alpha);
  const bigs = [
    [bx, by],
    [-bx, -by],
  ];
  let t = 0;
  for (const [sx, sy] of smalls)
    for (const [Bx, By] of bigs) {
      const dx = Bx - sx;
      const dy = By - sy;
      const d3 = Math.hypot(dx, dy) ** 3;
      t += sx * (dy / d3) - sy * (dx / d3);
    }
  return t;
}
const TAU_REF = torque(ALPHA.A);

const START = { theta: 0, omega: 0, alpha: ALPHA.far, pos: 'far', running: false, paused: false, moved: false };

export default function CavendishSim({ T }) {
  const tx = T.cav;
  const dec = T.decimal;
  const [s, setS] = useState(START);

  useRafLoop(s.running && !s.paused, (dt) => {
    setS((p) => {
      if (!p.running || p.paused) return p;
      let { theta, omega, alpha } = p;
      const target = ALPHA[p.pos];
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i += 1) {
        const da = target - alpha;
        alpha += Math.sign(da) * Math.min(Math.abs(da), FRAME_SPEED * h);
        const eq = (THETA_MAX * torque(alpha)) / TAU_REF;
        omega += (OMEGA * OMEGA * (eq - theta) - 2 * ZETA * OMEGA * omega) * h;
        theta += omega * h;
      }
      const eq = (THETA_MAX * torque(alpha)) / TAU_REF;
      const settled = Math.abs(alpha - target) < 1e-9 && Math.abs(theta - eq) < 1.5e-4 && Math.abs(omega) < 8e-4;
      return { ...p, theta: settled ? eq : theta, omega: settled ? 0 : omega, alpha, running: !settled };
    });
  });

  const pick = (pos) => setS((p) => (p.pos === pos ? p : { ...p, pos, running: true, paused: false, moved: true }));
  const reset = () => setS(START);
  const togglePause = () => setS((p) => ({ ...p, paused: !p.paused }));

  /* ---- numbers */
  const weight = M_SMALL * g;
  const Gm = (F_NEAR * R_GAP * R_GAP) / (M_BIG * M_SMALL);
  const mEarth = (g * R_EARTH * R_EARTH) / Gm;

  /* ---- explanation */
  const moving = s.running;
  let key;
  if (s.pos === 'far') key = s.moved ? (moving ? 'release' : 'back') : 'far';
  else key = moving ? `swing${s.pos}` : `done${s.pos}`;
  const settled = useSettled(key, 0);
  const ex = tx.explain;
  let text;
  if (settled === 'swingA') text = ex.swingA(sci(F_NEAR, dec), sci(weight / F_NEAR, dec, 2));
  else if (settled === 'doneA') text = ex.doneA(sci(Gm, dec));
  else if (settled === 'doneB') text = ex.doneB(sci(mEarth, dec));
  else text = ex[settled] ?? ex.far;
  const tone = settled.startsWith('done') ? '#34d399' : settled.startsWith('swing') ? '#fb923c' : '#22d3ee';

  const legend = [
    { label: tx.legend.force, color: COL.force, kind: 'arrow' },
    { label: tx.legend.big, color: '#334155', kind: 'dot' },
    { label: tx.legend.small, color: '#b45309', kind: 'dot' },
    { label: tx.legend.rest, color: '#94a3b8', kind: 'dash' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.posLabel}</p>
          <Segmented
            label={tx.posLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={s.pos}
            onChange={pick}
            options={[
              { value: 'far', label: tx.pos.far.name, sub: tx.pos.far.sub, icon: ArrowLeftRight },
              { value: 'A', label: tx.pos.A.name, sub: tx.pos.A.sub, icon: MoveUp },
              { value: 'B', label: tx.pos.B.name, sub: tx.pos.B.sub, icon: MoveDown },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={s.paused ? Play : Pause} onClick={togglePause} disabled={!s.running} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {s.paused ? T.common.resume : T.common.pause}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={!s.moved} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={<ScaleChip time={tx.chip} forceBar={{ px: F_BAR * F_SCALE_IN, text: `${sci(F_BAR, dec)} ${T.N}` }} />}
        ariaLabel={tx.sceneLabel(tx.pos[s.pos].name, numt((s.theta * 180) / Math.PI, dec, 2))}
        height={(W, narrow) => (narrow ? Math.round(W * 1.08 + Math.min(W * 0.33, 130) * 2 + 64) : 470)}
      >
        {(W, H, narrow) => <Balance W={W} H={H} narrow={narrow} s={s} tx={tx} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.F} symbol="F" value={sci(F_NEAR, dec)} unit={T.N} accent={COL.force} textColor={COL.forceText} sub={tx.readouts.Fsub} />
        <Readout label={tx.readouts.ratio} symbol="mg/F" value={sci(weight / F_NEAR, dec, 2)} accent="#facc15" textColor="#fde68a" sub={tx.readouts.ratioSub(numt(weight, dec, 3))} />
        <Readout label={tx.readouts.G} symbol="G" value={sci(Gm, dec)} unit={T.Nm2} accent={COL.g} textColor={COL.gText} sub={tx.readouts.Gsub} className="col-span-2 sm:col-span-1" />
        <Readout label={tx.readouts.earth} symbol="M" value={sci(mEarth, dec)} unit={T.kg} accent="#2563eb" textColor="#93c5fd" sub="M = g·R² / G" className="col-span-2 sm:col-span-1" />
      </div>

      <Panel>
        <Calc
          title={T.common.calc}
          rows={[
            { sym: 'F', color: COL.forceText, formula: 'G·M·m / r²', subst: `${sci(G, dec)} · ${M_BIG} · ${numt(M_SMALL, dec)} / ${numt(R_GAP, dec)}²`, result: `${sci(F_NEAR, dec)} ${T.N}` },
            { sym: 'mg', color: '#fde68a', formula: 'm·g', subst: `${numt(M_SMALL, dec)} · ${numt(g, dec)}`, result: `${numt(weight, dec, 3)} ${T.N} ≈ ${sci(weight / F_NEAR, dec, 2)} · F` },
            {
              sym: 'G',
              color: COL.gText,
              formula: 'F·r² / (M·m)',
              subst: `${sci(F_NEAR, dec)} · ${numt(R_GAP, dec)}² / (${M_BIG} · ${numt(M_SMALL, dec)})`,
              result: `${sci(Gm, dec)} ${T.Nm2}`,
            },
            { sym: 'M', color: '#93c5fd', formula: 'g·R² / G', subst: `${numt(g, dec)} · (${sci(R_EARTH, dec)})² / ${sci(Gm, dec)}`, result: `${sci(mEarth, dec)} ${T.kg}` },
          ]}
          note={tx.calcNote}
        />
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function LeadBall({ cx, cy, r, id, small }) {
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="36%" cy="32%" r="72%">
          <stop offset="0%" stopColor={small ? '#fde68a' : '#cbd5e1'} />
          <stop offset="100%" stopColor={small ? '#b45309' : '#1e293b'} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} stroke="#fff" strokeWidth="1.2" />
    </g>
  );
}

function Balance({ W, H, narrow, s, tx, T }) {
  const dec = T.decimal;
  const gid = useSvgId('ugc');
  const fs = narrow ? 11 : 12;

  // main (top) view on the left — or on top on a phone; the magnifier on the right — or below
  const mainW = narrow ? W : Math.round(W * 0.56);
  const mainH = narrow ? Math.round(W * 1.08) : H;
  const view = makeView(BOX, mainW, mainH, narrow ? { l: 12, r: 12, t: 70, b: 14 } : { l: 26, r: 18, t: 56, b: 22 });
  const R = narrow ? Math.min(W * 0.33, 130) : Math.min(H / 2 - 48, (W - mainW) / 2 - 28);
  const icx = narrow ? W / 2 : mainW + (W - mainW) / 2;
  const icy = narrow ? mainH + R + 30 : H / 2 + 14;
  const kin = R / 0.2; // px per metre inside the magnifier
  const zoom = kin / view.k;

  const P = (x, y) => ({ x: view.sx(x), y: view.sy(y) });
  const ct = Math.cos(s.theta);
  const st = Math.sin(s.theta);
  const s1 = [(L / 2) * ct, (L / 2) * st];
  const s2 = [-s1[0], -s1[1]];
  const b1 = [ARM * Math.cos(s.alpha), ARM * Math.sin(s.alpha)];
  const b2 = [-b1[0], -b1[1]];

  // force between the small ball and the nearer big ball
  const pair = (sm, big) => {
    const dx = big[0] - sm[0];
    const dy = big[1] - sm[1];
    const d = Math.hypot(dx, dy);
    return { F: (G * M_BIG * M_SMALL) / (d * d), ux: dx / d, uy: -dy / d };
  };
  const near1 = Math.hypot(b1[0] - s1[0], b1[1] - s1[1]) < Math.hypot(b2[0] - s1[0], b2[1] - s1[1]) ? b1 : b2;
  const f1 = pair(s1, near1);

  const ps1 = P(...s1);
  const ps2 = P(...s2);
  const pb1 = P(...b1);
  const pb2 = P(...b2);
  const o = P(0, 0);
  const rb = R_BIG * view.k;
  const pbR = b1[0] >= -1e-9 ? pb1 : pb2;
  const nearS2 = Math.hypot(b1[0] - s2[0], b1[1] - s2[1]) < Math.hypot(b2[0] - s2[0], b2[1] - s2[1]) ? b1 : b2;
  const mBelow = s.pos !== 'far' && nearS2[1] > s2[1];
  const rs = Math.max(R_SMALL * view.k, 4.5);

  // magnifier: centred on the small ball's rest position (L/2, 0)
  const Z = (x, y) => ({ x: icx + (x - L / 2) * kin, y: icy - y * kin });
  const zs = Z(...s1);
  const zRodA = Z((L / 2 - 0.35) * ct, (L / 2 - 0.35) * st);
  const zb1 = Z(...b1);
  const zb2 = Z(...b2);
  const zLen = f1.F * F_SCALE_IN;
  const zNear = Z(...near1);
  const nOff = { x: -f1.uy * 7, y: f1.ux * 7 };

  const ticks = [];
  for (let cm = -18; cm <= 18; cm += 1) {
    const y = icy - (cm / 100) * kin;
    ticks.push(<line key={cm} x1={icx + 0.1 * kin} x2={icx + 0.1 * kin + (cm % 5 === 0 ? 14 : 7)} y1={y} y2={y} stroke="#475569" strokeWidth={cm % 5 === 0 ? 1.4 : 1} />);
  }
  const lens = 0.2 * view.k;

  return (
    <g>
      <defs>
        <clipPath id={`${gid}-main`}>
          <rect x={0} y={0} width={mainW} height={mainH} />
        </clipPath>
        <clipPath id={`${gid}-lens`}>
          <circle cx={icx} cy={icy} r={R} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />
      <g clipPath={`url(#${gid}-main)`}>
        <Grid view={view} W={mainW} H={mainH} minPx={narrow ? 22 : 28} />
      </g>
      {!narrow && <line x1={mainW} x2={mainW} y1={56} y2={H - 16} stroke="#e2e8f0" strokeWidth="1.5" />}

      {/* rest position of the rod */}
      <line x1={P(-L / 2, 0).x} y1={o.y} x2={P(L / 2, 0).x} y2={o.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="5 5" />

      {/* the frame that carries the big balls (it hangs above the rod) */}
      <line x1={pb1.x} y1={pb1.y} x2={pb2.x} y2={pb2.y} stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" />
      <line x1={pb1.x} y1={pb1.y} x2={pb2.x} y2={pb2.y} stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <LeadBall cx={pb1.x} cy={pb1.y} r={rb} id={`${gid}-b1`} />
      <LeadBall cx={pb2.x} cy={pb2.y} r={rb} id={`${gid}-b2`} />

      {/* the rod with the small balls, on the wire at O */}
      <line x1={ps1.x} y1={ps1.y} x2={ps2.x} y2={ps2.y} stroke="#78350f" strokeWidth={narrow ? 3 : 4} strokeLinecap="round" />
      <LeadBall cx={ps1.x} cy={ps1.y} r={rs} id={`${gid}-s1`} small />
      <LeadBall cx={ps2.x} cy={ps2.y} r={rs} id={`${gid}-s2`} small />
      <circle cx={o.x} cy={o.y} r={5} fill="#fff" stroke={COL.ink} strokeWidth="2" />
      <circle cx={o.x} cy={o.y} r={1.6} fill={COL.ink} />


      {/* labels */}
      <text x={o.x + 9} y={o.y - 9} fontSize={fs - 1} fontWeight="600" fill={COL.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {tx.wire}
      </text>
      <text x={pbR.x + rb + 8 > mainW - 80 ? pbR.x - rb - 8 : pbR.x + rb + 8} y={pbR.y + 4} textAnchor={pbR.x + rb + 8 > mainW - 80 ? 'end' : 'start'} fontSize={fs - 1} fontWeight="700" fill="#334155" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {`M = ${M_BIG} ${T.kg}`}
      </text>
      <text x={ps2.x - 4} y={mBelow ? ps2.y + fs + 8 : ps2.y - 10} textAnchor="start" fontSize={fs - 1} fontWeight="700" fill="#92400e" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {`m = ${numt(M_SMALL, dec)} ${T.kg}`}
      </text>
      <Dimension x1={P(-L / 2, 0).x} x2={P(L / 2, 0).x} y={view.sy(-0.5)} text={`L = ${numt(L, dec)} ${T.m}`} size={fs} box={{ w: mainW, h: mainH }} />

      {/* the lens around the small ball and the lines to the magnifier */}
      <circle cx={P(L / 2, 0).x} cy={o.y} r={lens} fill="none" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4 3" />
      {narrow ? (
        <>
          <line x1={P(L / 2, 0).x - lens} y1={o.y} x2={icx - R} y2={icy} stroke="#7dd3fc" strokeWidth="1.2" />
          <line x1={P(L / 2, 0).x + lens} y1={o.y} x2={icx + R} y2={icy} stroke="#7dd3fc" strokeWidth="1.2" />
        </>
      ) : (
        <>
          <line x1={P(L / 2, 0).x} y1={o.y - lens} x2={icx} y2={icy - R} stroke="#7dd3fc" strokeWidth="1.2" />
          <line x1={P(L / 2, 0).x} y1={o.y + lens} x2={icx} y2={icy + R} stroke="#7dd3fc" strokeWidth="1.2" />
        </>
      )}

      {/* magnifier */}
      <circle cx={icx} cy={icy} r={R} fill="#fff" stroke="#0284c7" strokeWidth="2.5" />
      <g clipPath={`url(#${gid}-lens)`}>
        {Array.from({ length: 9 }, (_, i) => (i - 4) * 0.05).map((v) => (
          <g key={v} stroke="#e2e8f0" strokeWidth="1">
            <line x1={icx - R} x2={icx + R} y1={icy - v * kin} y2={icy - v * kin} />
            <line x1={icx + v * kin} x2={icx + v * kin} y1={icy - R} y2={icy + R} />
          </g>
        ))}
        <line x1={icx - R} x2={icx + 0.1 * kin} y1={icy} y2={icy} stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="6 5" />
        {ticks}
        <LeadBall cx={zb1.x} cy={zb1.y} r={R_BIG * kin} id={`${gid}-zb1`} />
        <LeadBall cx={zb2.x} cy={zb2.y} r={R_BIG * kin} id={`${gid}-zb2`} />
        <line x1={zRodA.x} y1={zRodA.y} x2={zs.x} y2={zs.y} stroke="#78350f" strokeWidth={narrow ? 7 : 9} strokeLinecap="round" />
        <LeadBall cx={zs.x} cy={zs.y} r={R_SMALL * kin} id={`${gid}-zs`} small />
        <line x1={zs.x + R_SMALL * kin} x2={icx + 0.1 * kin} y1={zs.y} y2={zs.y} stroke="#0284c7" strokeWidth="1.6" />
        <path d={`M${icx + 0.1 * kin},${zs.y} l-8,-5 l0,10 Z`} fill="#0284c7" />
        {zLen > 4 && (
          <>
            <ForceArrow x1={zs.x + nOff.x} y1={zs.y + nOff.y} ux={f1.ux} uy={f1.uy} len={zLen} width={3.5} head={13} />
            <ForceArrow x1={zNear.x - nOff.x} y1={zNear.y - nOff.y} ux={-f1.ux} uy={-f1.uy} len={zLen} width={3.5} head={13} />
          </>
        )}
      </g>
      <text x={icx} y={icy - R - 10} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#0369a1">
        {tx.inset(numt(zoom, dec, 1))}
      </text>
      <text x={icx + 0.1 * kin + 18} y={icy + 4} fontSize={fs - 1} fill="#475569" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {tx.scaleMark}
      </text>
      {s.pos !== 'far' && !s.running && (
        <text x={icx} y={icy + R + fs + 10} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#047857">
          {tx.balanced}
        </text>
      )}
    </g>
  );
}
