import { useMemo, useRef, useState } from 'react';
import { BrickWall, CircleHelp, Dices, Goal, Lightbulb, Send, Warehouse } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Ball, C, DEG, Field, FormulaRow, G, LabScene, Label, Launcher, TimeChip, fieldSpan, fieldView, fitHeight, flight, parabolaPts, posAt } from './AngledThrow.parts';

/**
 * Tab 3 - "Hit the basket". A basket stands on the ground D metres away; the
 * reader picks v₀ and α and throws. From L = v₀²·sin2α/g the right angle is
 * sin2α = gD/v₀², which has two answers, α and 90° − α. The second level
 * puts a high wall in front of the basket (only the steep answer clears
 * it), the third a low ceiling (only the flat one stays under it).
 * No air resistance here, as in the lesson's formulas.
 */

const LEVELS = [
  { id: 'open', icon: Goal, targets: [32, 24, 41, 18, 36, 28, 45] },
  { id: 'wall', icon: BrickWall, targets: [30, 22, 36, 26, 40] },
  { id: 'roof', icon: Warehouse, targets: [34, 26, 44, 30, 38] },
];
const TOL = 1; // half the width of the basket, m
const KEEP = 4;
const PAD_N = { l: 34, r: 12, t: 44, b: 34 };
const PAD_W = { l: 46, r: 24, t: 66, b: 38 };
/** The field around a basket at D (and its obstacle). */
const boxFor = (D, obs) => {
  const span = fieldSpan(Math.max(D * 1.3, D + 10));
  return { span, yMax: Math.max(0.35 * span, (obs?.h ?? 0) + 3) };
};
const TONES = { idle: '#22d3ee', flying: '#a78bfa', hit: '#34d399', short: '#fbbf24', long: '#fb923c', wall: '#f87171', roof: '#f87171' };

/** The obstacle of a level for a basket at distance D. */
function obstacleFor(level, D) {
  if (level === 'wall') {
    const x1 = Math.round(0.55 * D * 2) / 2;
    return { kind: 'wall', x1, x2: x1 + 0.8, h: Math.round(0.3 * D * 2) / 2 };
  }
  if (level === 'roof') return { kind: 'roof', h: Math.round(0.2 * D * 10) / 10 };
  return null;
}

/** Where and how a throw ends: in the basket, short, long, against the wall or the ceiling. */
function outcome(f, D, obs) {
  if (obs?.kind === 'roof' && f.H > obs.h) {
    const tc = (f.vy - Math.sqrt(Math.max(0, f.vy * f.vy - 2 * G * obs.h))) / G;
    return { kind: 'roof', tEnd: tc, x: f.vx * tc };
  }
  if (obs?.kind === 'wall' && f.L > obs.x1) {
    const t1 = obs.x1 / f.vx;
    if (posAt(f, t1).y < obs.h) return { kind: 'wall', tEnd: t1, x: obs.x1 };
    if (f.L < obs.x2 || posAt(f, obs.x2 / f.vx).y < obs.h) {
      const tw = (f.vy + Math.sqrt(Math.max(0, f.vy * f.vy - 2 * G * obs.h))) / G;
      return { kind: 'wall', tEnd: tw, x: f.vx * tw };
    }
  }
  const d = f.L - D;
  return { kind: Math.abs(d) <= TOL ? 'hit' : d < 0 ? 'short' : 'long', tEnd: f.T, x: f.L, d };
}

export default function TargetSim({ t, c }) {
  const dec = c.decimal;
  const [level, setLevel] = useState('open');
  const [idx, setIdx] = useState({ open: 0, wall: 0, roof: 0 });
  const [v0, setV0] = useState(15);
  const [alpha, setAlpha] = useState(35);
  const [shots, setShots] = useState([]);
  const [score, setScore] = useState({ open: [0, 0], wall: [0, 0], roof: [0, 0] });
  const [hint, setHint] = useState(false);
  const counted = useRef(new Set());

  const lv = LEVELS.find((l) => l.id === level);
  const D = lv.targets[idx[level] % lv.targets.length];
  const obs = useMemo(() => obstacleFor(level, D), [level, D]);
  const cur = shots[shots.length - 1];
  const flying = !!cur && cur.t < cur.out.tEnd;

  useRafLoop(flying, (dt) => {
    const s = shots[shots.length - 1];
    if (!s || s.t >= s.out.tEnd) return;
    const tt = Math.min(s.t + dt, s.out.tEnd);
    setShots((ss) => ss.map((x) => (x.id === s.id ? { ...x, t: Math.max(x.t, tt) } : x)));
    if (tt >= s.out.tEnd && !counted.current.has(s.id)) {
      counted.current.add(s.id);
      const hit = s.out.kind === 'hit';
      setScore((sc) => ({ ...sc, [level]: [sc[level][0] + (hit ? 1 : 0), sc[level][1] + 1] }));
    }
  });

  const fire = () => {
    if (flying) return;
    const f = flight(v0, alpha);
    const out = outcome(f, D, obs);
    setShots((ss) => [...ss, { id: `${Date.now()}`, v0, a: alpha, f, out, t: 0 }].slice(-KEEP));
  };
  const nextTarget = () => {
    setIdx((m) => ({ ...m, [level]: m[level] + 1 }));
    setShots([]);
  };
  const pickLevel = (id) => {
    setLevel(id);
    setShots([]);
  };

  const F1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const Fv = (n) => fmt(n, Number.isInteger(n) ? 0 : 1, dec);
  const landed = cur && !flying ? cur : null;
  const [hits, tries] = score[level];
  const fNow = flight(v0, alpha);

  /* ---- explanation */
  let key = 'idle';
  if (flying) key = 'flying';
  else if (landed) key = landed.out.kind;
  const settled = useSettled(key, 0);
  const ex = t.explain;
  let text = ex.idle[level](Fv(D), obs ? Fv(obs.h) : '');
  if (settled === 'flying' && cur) text = ex.flying(F2(cur.f.T));
  else if (landed && settled === landed.out.kind) {
    const k = landed.out.kind;
    const Lt = F1(landed.f.L);
    if (k === 'hit') text = ex.hit[level](Fv(landed.v0), landed.a, 2 * landed.a, Lt, Fv(D), 90 - landed.a);
    else if (k === 'short') text = ex.short(F1(-landed.out.d), Lt);
    else if (k === 'long') text = ex.long(F1(landed.out.d), Lt);
    else if (k === 'wall') text = ex.wall(Fv(obs?.h ?? 0));
    else if (k === 'roof') text = ex.roof(F1(landed.f.H), Fv(obs?.h ?? 0));
  }

  /* ---- hint: sin2α = gD/v₀² */
  const s2 = (G * D) / (v0 * v0);
  const sols = [];
  if (s2 <= 1) {
    const a1 = Math.asin(s2) / DEG / 2;
    for (const a of [a1, 90 - a1]) {
      const ok = outcome(flight(v0, a), D, obs).kind === 'hit';
      sols.push({ a, ok });
    }
  }

  const legend = [
    { kind: 'line', color: C.path, label: t.legend.path },
    { kind: 'line', color: '#c4b5fd', label: t.legend.old },
    { kind: 'dot', color: C.second, label: t.legend.basket(fmt(2 * TOL, 0, dec)) },
    ...(obs ? [{ kind: 'line', color: '#64748b', label: obs.kind === 'wall' ? t.legend.wall : t.legend.roof }] : []),
  ];

  const lastX = landed ? landed.out.x : null;
  const diff = landed && landed.out.d !== undefined ? landed.out.d : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.levelsLabel}</p>
          <Segmented
            label={t.levelsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={level}
            onChange={pickLevel}
            options={LEVELS.map((l) => ({ value: l.id, label: t.levels[l.id].name, sub: t.levels[l.id].sub, icon: l.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Send} onClick={fire} disabled={flying} className="xl:min-w-[136px] min-h-[52px] text-[15px]">
            {t.fire}
          </Btn>
          <Btn icon={Dices} onClick={nextTarget} disabled={flying} className={`min-h-[52px] text-[15px] ${landed?.out.kind === 'hit' ? 'ring-2 ring-emerald-400/70' : ''}`}>
            {t.next}
          </Btn>
        </div>
      </div>

      <LabScene
        legend={legend}
        chip={<TimeChip text={c.common.realTime(F2(cur ? Math.min(cur.t, cur.out.tEnd) : 0))} />}
        height={(W, narrow) => {
          const b = boxFor(D, obs);
          return narrow ? fitHeight(W, b.span, b.yMax, PAD_N, 240, W) : fitHeight(W, b.span, b.yMax, PAD_W, 360, 500);
        }}
        ariaLabel={t.sceneLabel(Fv(D), Fv(v0), alpha)}
      >
        {(W, H, narrow) => <TargetScene W={W} H={H} narrow={narrow} t={t} c={c} D={D} obs={obs} alpha={alpha} shots={shots} flying={flying} />}
      </LabScene>

      <Explain icon={Lightbulb} id={`${settled}-${shots.length}-${D}-${level}`} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.D} symbol="D" value={Fv(D)} unit={c.m} accent={C.second} textColor={C.secondText} sub={t.readouts.Dsub(fmt(2 * TOL, 0, dec))} />
        <Readout
          label={t.readouts.last}
          symbol="x"
          value={lastX === null ? '—' : F1(lastX)}
          unit={lastX === null ? undefined : c.m}
          accent={C.path}
          textColor={C.pathText}
          sub={landed ? t.readouts.lastSub(Fv(landed.v0), landed.a) : t.readouts.none}
        />
        <Readout
          label={t.readouts.diff}
          symbol="L − D"
          value={diff === null ? '—' : `${diff > 0 ? '+' : ''}${F1(diff)}`}
          unit={diff === null ? undefined : c.m}
          accent={landed?.out.kind === 'hit' ? '#34d399' : '#fbbf24'}
          textColor={landed?.out.kind === 'hit' ? '#6ee7b7' : '#fde68a'}
          active={landed?.out.kind === 'hit'}
          sub={landed ? t.result[landed.out.kind] : t.readouts.diffSub}
        />
        <Readout label={t.readouts.score} value={`${hits} / ${tries}`} accent="#e2e8f0" sub={t.readouts.scoreSub(t.levels[level].name)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="at-target-v0"
            label={c.common.v0}
            symbol="v₀"
            min={5}
            max={30}
            step={0.5}
            value={v0}
            onChange={setV0}
            accent={C.vel}
            display={`${F1(v0)} ${c.ms}`}
            hint={t.v0Hint}
          />
          <RangeField
            id="at-target-alpha"
            label={c.common.alpha}
            symbol="α"
            min={5}
            max={85}
            step={1}
            value={alpha}
            onChange={setAlpha}
            accent="#e2e8f0"
            display={`${alpha}°`}
            hint={t.alphaHint}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-200">{t.hint.title}</p>
            <Btn icon={CircleHelp} onClick={() => setHint((h) => !h)} aria-pressed={hint} className="min-h-10">
              {hint ? t.hint.hide : t.hint.show}
            </Btn>
          </div>
          {hint ? (
            <dl className="mt-2 space-y-1.5">
              <FormulaRow name="L = v₀² · sin2α / g" value={`${Fv(v0)}² · sin ${2 * alpha}° / ${fmt(G, 1, dec)} = ${F1(fNow.L)} ${c.m}`} color={C.dispText} />
              <FormulaRow name="sin2α = g · D / v₀²" value={`${fmt(G, 1, dec)} · ${Fv(D)} / ${Fv(v0)}² = ${fmt(s2, 3, dec)}`} color="#e2e8f0" />
              {s2 <= 1 ? (
                sols.map((s, i) => (
                  <FormulaRow
                    key={i}
                    name={`α${i === 0 ? '₁' : '₂'}`}
                    value={`${F1(s.a)}° — ${s.ok ? t.hint.ok : obs?.kind === 'wall' ? t.hint.badWall : t.hint.badRoof}`}
                    color={s.ok ? '#6ee7b7' : '#fca5a5'}
                  />
                ))
              ) : (
                <FormulaRow name="v₀ min = √(g · D)" value={`${F1(Math.sqrt(G * D))} ${c.ms} (α = 45°)`} color="#fca5a5" />
              )}
              <p className="pt-1 text-xs leading-snug text-gray-500">{s2 <= 1 ? t.hint.note[level] : t.hint.tooSlow}</p>
            </dl>
          ) : (
            <p className="mt-2 text-sm leading-snug text-gray-400">{t.hint.teaser}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

function TargetScene({ W, H, narrow, t, c, D, obs, alpha, shots, flying }) {
  const dec = c.decimal;
  const { span, yMax } = boxFor(D, obs);
  const pad = narrow ? PAD_N : PAD_W;
  const view = useMemo(() => fieldView(W, H, span, yMax, pad), [W, H, span, yMax, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs = narrow ? 11 : 12;
  const gy = view.sy(0);
  const box = { w: W, h: H };
  const cur = shots[shots.length - 1];
  const landed = cur && !flying ? cur : null;
  const won = landed?.out.kind === 'hit';

  const bx = view.sx(D);
  const bw = Math.max(16, 2 * TOL * view.k);
  const bh = Math.max(11, 0.7 * view.k);

  return (
    <g>
      <Field view={view} W={W} H={H} narrow={narrow} xUnit={c.common.axisX} yUnit={c.common.axisY} dec={dec} yUnitAt={narrow ? 26 : 62} />

      {/* low ceiling */}
      {obs?.kind === 'roof' && (
        <g>
          <rect x={view.sx(0) - 40} y={0} width={W} height={view.sy(obs.h)} fill="#e2e8f0" opacity="0.85" />
          {Array.from({ length: Math.ceil(W / 9) + 6 }, (_, i) => (
            <line key={i} x1={i * 9 - 20} y1={view.sy(obs.h) - 9} x2={i * 9 - 11} y2={view.sy(obs.h)} stroke="#94a3b8" strokeWidth="1" />
          ))}
          <line x1={0} x2={W} y1={view.sy(obs.h)} y2={view.sy(obs.h)} stroke={C.ground} strokeWidth="2" />
          <Label x={W - 14} y={view.sy(obs.h) + 16} anchor="end" size={fs} color="#475569">
            {t.roofTag(fmt(obs.h, 1, dec))}
          </Label>
        </g>
      )}

      {/* wall */}
      {obs?.kind === 'wall' && (
        <g>
          <rect
            x={view.sx(obs.x1)}
            y={view.sy(obs.h)}
            width={Math.max(7, (obs.x2 - obs.x1) * view.k)}
            height={obs.h * view.k}
            fill="#cbd5e1"
            stroke="#475569"
            strokeWidth="1.5"
          />
          {Array.from({ length: Math.floor(obs.h / 1) }, (_, i) => (
            <line key={i} x1={view.sx(obs.x1)} x2={view.sx(obs.x1) + Math.max(7, (obs.x2 - obs.x1) * view.k)} y1={view.sy(i + 1)} y2={view.sy(i + 1)} stroke="#94a3b8" strokeWidth="1" />
          ))}
          <Label x={view.sx(obs.x1) - 8} y={view.sy(obs.h) + 4} anchor="end" size={fs} color="#475569">
            {t.wallTag(fmt(obs.h, Number.isInteger(obs.h) ? 0 : 1, dec))}
          </Label>
        </g>
      )}

      {/* basket and flag */}
      <g>
        {won && <circle cx={bx} cy={gy - bh / 2} r={bw * 0.75} fill="#34d399" className="cl-pulse" />}
        <path
          d={`M${bx - bw / 2},${gy - bh} L${bx - bw / 2 + 3},${gy} L${bx + bw / 2 - 3},${gy} L${bx + bw / 2},${gy - bh}`}
          fill={won ? '#bbf7d0' : '#fce7f3'}
          stroke={C.second}
          strokeWidth="2.25"
          strokeLinejoin="round"
        />
        <line x1={bx + bw / 2} x2={bx + bw / 2} y1={gy - bh} y2={gy - bh - (narrow ? 28 : 38)} stroke={C.ink} strokeWidth="1.5" />
        <path d={`M${bx + bw / 2},${gy - bh - (narrow ? 28 : 38)} l14,5 l-14,5 Z`} fill={C.second} />
        <Pill x={bx} y={gy - bh - (narrow ? 42 : 54)} text={t.dTag(fmt(D, Number.isInteger(D) ? 0 : 1, dec))} bg={C.second} size={fs} box={box} />
      </g>

      {/* throws: older ones faint, the newest bold */}
      {shots.map((s, i) => {
        const newest = i === shots.length - 1;
        const tt = Math.min(s.t, s.out.tEnd);
        if (tt <= 0) return null;
        const pts = parabolaPts(view, s.f, 0, tt, Math.max(8, Math.round((80 * tt) / s.f.T)));
        return (
          <g key={s.id} opacity={newest ? 1 : 0.4}>
            <polyline points={pts} fill="none" stroke={newest ? C.path : '#a78bfa'} strokeWidth={newest ? 3.25 : 2} strokeLinecap="round" strokeLinejoin="round" />
            {!newest && s.out.kind !== 'wall' && s.out.kind !== 'roof' && <circle cx={view.sx(s.out.x)} cy={gy} r="3.5" fill="#a78bfa" />}
          </g>
        );
      })}

      {/* the ball in flight or where it ended */}
      {cur &&
        (() => {
          const tt = Math.min(cur.t, cur.out.tEnd);
          const p = posAt(cur.f, tt);
          const x = view.sx(p.x);
          const y = view.sy(Math.max(0, p.y));
          const k = cur.out.kind;
          const tag = landed
            ? k === 'hit'
              ? t.result.hit
              : k === 'wall' || k === 'roof'
                ? t.result[k]
                : `${cur.out.d > 0 ? '+' : '−'}${fmt(Math.abs(cur.out.d), 1, dec)} ${c.m}`
            : null;
          const tagBg = k === 'hit' ? '#059669' : k === 'wall' || k === 'roof' ? '#dc2626' : '#d97706';
          return (
            <g>
              {landed && (k === 'wall' || k === 'roof') && (
                <g stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                    <line key={d} x1={x + Math.cos(d * DEG) * 9} y1={y + Math.sin(d * DEG) * 9} x2={x + Math.cos(d * DEG) * 14} y2={y + Math.sin(d * DEG) * 14} />
                  ))}
                </g>
              )}
              <Ball x={x} y={y - (landed && k !== 'roof' && k !== 'wall' ? (narrow ? 6 : 7) : 0)} r={narrow ? 6 : 7} pulse={!landed} />
              {tag && <Pill x={x} y={k === 'roof' ? y + 26 : y - 30} text={tag} bg={tagBg} size={fs} box={box} />}
            </g>
          );
        })()}

      <Launcher view={view} alpha={alpha} narrow={narrow} arcLabel={`α = ${alpha}°`} />
    </g>
  );
}
