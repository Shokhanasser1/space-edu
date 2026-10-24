import { useState } from 'react';
import { CircleCheck, CircleX, Crosshair, Dices, Lightbulb, Trophy } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import {
  AxisX,
  AxisY,
  COL,
  Chip,
  DimLine,
  FormulaTile,
  G,
  GroupLabel,
  Label,
  LabScene,
  PlayControls,
  Rich,
  SceneGrid,
  Soil,
  Sym,
  VelocityArrows,
  fitView,
  flightTime,
  len,
  num,
} from './HorizontalThrow.parts';

/**
 * "Nishonga tashlash": a helicopter flies horizontally at height h with
 * speed v₀ and releases a package over the release mark. With no air
 * resistance the package keeps v₀ horizontally (it stays right below the
 * helicopter) and falls freely, landing at L = v₀·√(2h/g). The reader picks
 * v₀ so that L hits the target D metres away (± TOL). Strings: T.target.
 *
 * Missions (needed v₀ = D / √(2h/g)):
 *   h = 20 m, D = 40 m  → t = 2.02 s, v₀ ≈ 19.8 m/s (20 m/s → L = 40.4 m)
 *   h = 45 m, D = 120 m → t = 3.03 s, v₀ ≈ 39.6 m/s (40 m/s → L = 121.2 m)
 *   h = 80 m, D = 240 m → t = 4.04 s, v₀ ≈ 59.4 m/s (59 m/s → L = 238.4 m)
 */

const MISSIONS = { m1: { h: 20, D: 40 }, m2: { h: 45, D: 120 }, m3: { h: 80, D: 240 } };
const TOL = 3; // m, half-width of the target
const T_APPROACH = 0.8; // s of flight before the release mark
const V_MIN = 10;
const V_MAX = 70;
const IDLE = { t: 0, running: false, done: false };

function randomMission() {
  const h = 20 + 5 * Math.floor(Math.random() * 17); // 20…100 m
  const vNeed = 15 + Math.random() * 50; // 15…65 m/s
  const D = Math.max(30, Math.round((vNeed * flightTime(h)) / 5) * 5);
  return { id: 'rnd', h, D };
}

export default function TargetSim({ T }) {
  const L = T.target;
  const dec = T.decimal;
  const [mission, setMission] = useState({ id: 'm1', ...MISSIONS.m1 });
  const [v0, setV0] = useState(25);
  const [game, setGame] = useState({ ...IDLE, log: [] });
  const { h, D } = mission;
  const tf = flightTime(h);
  const total = T_APPROACH + tf;

  useRafLoop(game.running, (step) => {
    setGame((p) => {
      if (!p.running) return p;
      const t = Math.min(total, p.t + step);
      if (t < total - 1e-9) return { ...p, t };
      const Lr = v0 * tf;
      const diff = Lr - D;
      return { ...p, t: total, running: false, done: true, log: [...p.log, { id: p.log.length + 1, v0, L: Lr, diff, hit: Math.abs(diff) <= TOL }] };
    });
  });

  const toggle = () => {
    if (game.done) setGame((p) => ({ ...p, ...IDLE, running: true }));
    else setGame((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setGame((p) => ({ ...p, ...IDLE }));
  const pickMission = (id) => {
    setMission(id === 'rnd' ? randomMission() : { id, ...MISSIONS[id] });
    setGame({ ...IDLE, log: [] });
  };

  const t = game.t;
  const tFall = clamp(t - T_APPROACH, 0, tf);
  const released = t >= T_APPROACH;
  const x = v0 * tFall;
  const last = game.done ? game.log[game.log.length - 1] : null;
  const hits = game.log.filter((a) => a.hit).length;
  const misses = game.log.length - hits;
  const vNeed = D / tf;
  const showNeed = hits > 0 || misses >= 2;
  const F = (n, d = 1) => num(n, d, dec);

  let key = 'idle';
  if (last) key = last.hit ? 'hit' : last.diff < 0 ? 'short' : 'long';
  else if (t > 0) key = released ? 'falling' : 'approach';
  const settled = useSettled(key, 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(fmt(h, 0, dec), fmt(D, 0, dec)),
    approach: ex.approach,
    falling: ex.falling,
    hit: last ? ex.hit(len(last.L, dec)) : '',
    short: last ? ex.short(len(Math.abs(last.diff), dec)) : '',
    long: last ? ex.long(len(Math.abs(last.diff), dec)) : '',
  }[settled];
  const tone = { idle: '#22d3ee', approach: '#a78bfa', falling: '#a78bfa', hit: '#34d399', short: '#f87171', long: '#f87171' }[settled];

  const missionOpts = ['m1', 'm2', 'm3'].map((id) => ({ value: id, label: L.missions[id].name, sub: L.missions[id].sub, icon: Crosshair }));
  missionOpts.push({
    value: 'rnd',
    label: L.missions.rnd.name,
    sub: mission.id === 'rnd' ? L.rndSub(fmt(h, 0, dec), fmt(D, 0, dec)) : L.missions.rnd.sub,
    icon: Dices,
  });

  let lSub = L.LSub.idle;
  if (last) lSub = last.hit ? L.LSub.hit : last.diff < 0 ? L.LSub.short(len(-last.diff, dec)) : L.LSub.long(len(last.diff, dec));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.missionsLabel}</GroupLabel>
          <Segmented label={L.missionsLabel} className="grid-cols-2 md:grid-cols-4" size="lg" value={mission.id} onChange={pickMission} options={missionOpts} />
        </div>
        <PlayControls
          labels={{ ...T.common, start: L.drop, again: L.drop }}
          running={game.running}
          done={game.done}
          started={t > 0}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <TargetScene T={T} h={h} D={D} v0={v0} t={t} tf={tf} running={game.running} last={last} hits={hits} tries={game.log.length} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.h} symbol="h" value={fmt(h, 0, dec)} unit={T.m} accent={COL.y} textColor={COL.yText} sub={L.hSub} />
        <Readout label={L.readouts.D} symbol="D" value={fmt(D, 0, dec)} unit={T.m} accent="#dc2626" textColor="#fca5a5" sub={L.DSub(fmt(TOL, 0, dec))} />
        <Readout label={L.readouts.t} symbol="t" value={fmt(tFall, 2, dec)} unit={T.s} accent={COL.time} textColor="#a5f3fc" sub={L.tSub(fmt(tf, 2, dec))} />
        <Readout
          label={L.readouts.L}
          symbol="L"
          value={len(x, dec)}
          unit={T.m}
          accent={COL.path}
          textColor={COL.pathText}
          sub={lSub}
          active={!!last}
          className={last ? (last.hit ? '!border-emerald-400/60' : '!border-red-400/50') : ''}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="tg-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={V_MIN}
            max={V_MAX}
            step={1}
            value={v0}
            disabled={game.running}
            onChange={(v) => {
              setV0(v);
              setGame((p) => ({ ...p, ...IDLE }));
            }}
            accent={COL.vel}
            display={`${fmt(v0, 0, dec)} ${T.ms}`}
            hint={T.common.kmh(fmt(v0 * 3.6, 0, dec))}
          />
          <FormulaTile
            tag={L.formula.L}
            color={COL.pathText}
            general="L = v₀·√(2h/g)"
            filled={`= ${fmt(v0, 0, dec)} · √(2·${fmt(h, 0, dec)} / ${F(G)}) = ${fmt(v0, 0, dec)} · ${fmt(tf, 2, dec)} = ${last ? `${len(v0 * tf, dec)} ${T.m}` : '?'}`}
            ok={!!last?.hit}
          />
          {showNeed ? (
            <FormulaTile
              tag={L.formula.need}
              color={COL.velText}
              general="v₀ = D / √(2h/g)"
              filled={`= ${fmt(D, 0, dec)} / ${fmt(tf, 2, dec)} = ${F(vNeed)} ${T.ms}`}
            />
          ) : (
            misses > 0 && (
              <p className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">
                <Rich>{L.hint}</Rich>
              </p>
            )
          )}
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-200">{L.log.title}</p>
            <span className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums text-gray-200">
              <Trophy size={14} className="text-amber-300" aria-hidden="true" />
              {L.score(hits, game.log.length)}
            </span>
          </div>
          {game.log.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{L.log.empty}</p>
          ) : (
            <ol className="mt-3 space-y-1.5" aria-live="polite">
              {game.log
                .slice(-6)
                .reverse()
                .map((a) => {
                  const status = a.hit ? L.log.hit : a.diff < 0 ? L.log.short : L.log.long;
                  const Icon = a.hit ? CircleCheck : CircleX;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-black/25 px-3 py-2 text-sm tabular-nums">
                      <span className="w-6 text-gray-500">#{a.id}</span>
                      <span className="text-gray-200">
                        <Rich>{`v₀ = ${fmt(a.v0, 0, dec)} ${T.ms}`}</Rich>
                      </span>
                      <span className="text-gray-500">→</span>
                      <span style={{ color: COL.pathText }}>L = {len(a.L, dec)} {T.m}</span>
                      <span className="ml-auto flex items-center gap-1.5 font-semibold" style={{ color: a.hit ? '#34d399' : '#f87171' }}>
                        <Icon size={15} aria-hidden="true" />
                        {a.hit ? status : `${a.diff > 0 ? '+' : '−'}${len(Math.abs(a.diff), dec)} ${T.m} · ${status}`}
                      </span>
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function geometry(W, narrow, h, D, reach) {
  const padT = narrow ? 92 : 128; // room for the helicopter above the package
  const padB = narrow ? 70 : 84;
  const left = narrow ? 34 : 46;
  const padR = narrow ? 12 : 24;
  const xMin = -0.16 * D;
  const xMax = Math.max(1.14 * D, reach + 0.08 * D); // the landing point always stays in view
  const kW = (W - left - padR) / (xMax - xMin);
  const H = clamp(h * kW + padT + padB, narrow ? 300 : 380, narrow ? 440 : 540);
  return { padT, padB, left, padR, xMin, xMax, H };
}

function TargetScene({ T, h, D, v0, t, tf, running, last, hits, tries }) {
  const L = T.target;
  const dec = T.decimal;
  const tFall = clamp(t - T_APPROACH, 0, tf);
  const released = t >= T_APPROACH;
  const hx = v0 * (t - T_APPROACH); // helicopter's x (negative before the mark)
  const x = released ? v0 * tFall : hx;
  const y = Math.max(0, h - 0.5 * G * tFall * tFall);
  const vy = G * tFall;
  const landed = !!last;
  const chips = (
    <>
      <Chip icon={Trophy} color="#d97706">
        {L.score(hits, tries)}
      </Chip>
      <Chip>
        {T.common.chipReal} · t = {fmt(tFall, 2, dec)} {T.s}
      </Chip>
    </>
  );

  return (
    <LabScene
      legend={[
        { color: COL.path, label: L.legend.path, kind: 'line' },
        { color: '#dc2626', label: L.legend.target, kind: 'box' },
        { color: '#64748b', label: L.legend.under, kind: 'dash' },
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
      ]}
      chips={chips}
      height={(W, narrow) => geometry(W, narrow, h, D, v0 * tf).H}
      ariaLabel={L.sceneLabel(fmt(h, 0, dec), fmt(D, 0, dec), len(Math.max(x, 0), dec), len(y, dec))}
    >
      {(W, H, narrow) => {
        const g = geometry(W, narrow, h, D, v0 * tf);
        const fs = narrow ? 11 : 12;
        const groundY = H - g.padB;
        const view = fitView({ xMin: g.xMin, xMax: g.xMax, yMax: h, left: g.left, right: W - g.padR, top: g.padT, groundY });
        const step = niceStep(view.k, narrow ? 30 : 38);
        const pk = narrow ? 10 : 13; // package size, px
        const s = narrow ? 50 : 70; // helicopter length, px
        const pkX = view.sx(x);
        const pkY = view.sy(y) - pk / 2;
        const heliX = view.sx(hx);
        const heliY = view.sy(h) - pk - s * 0.3;
        const relX = view.sx(0);
        const zone0 = view.sx(D - TOL);
        const zone1 = view.sx(D + TOL);
        const zw = Math.max(zone1 - zone0, 10);
        const zc = (zone0 + zone1) / 2;
        const vk = Math.min(64 / Math.max(Math.hypot(v0, G * tf), 1), 1.6);
        const box = { w: W, h: H };

        const pts = [];
        if (released) {
          for (let i = 0; i <= 60; i += 1) {
            const tt = (tFall * i) / 60;
            pts.push(`${view.sx(v0 * tt).toFixed(1)},${(view.sy(h - 0.5 * G * tt * tt) - pk / 2).toFixed(1)}`);
          }
        }

        return (
          <>
            <rect width={W} height={H} fill={COL.paper} />
            <SceneGrid view={view} W={W} top={0} step={step} fromPx={g.left} />
            <Soil W={W} H={H} groundY={groundY} />
            <AxisY view={view} x={g.left - 6} step={step} top={g.padT - 40} unit={L.axisY} decimal={dec} fs={fs - 1} />
            <AxisX view={view} W={W} y={H - 9} step={niceStep(view.k, narrow ? 46 : 60)} unit={L.axisX} decimal={dec} fs={fs - 1} />

            {/* flight level and the release mark */}
            <line x1={0} x2={W} y1={view.sy(h)} y2={view.sy(h)} stroke="#94a3b8" strokeOpacity={0.5} strokeDasharray="2 6" />
            <line x1={relX} x2={relX} y1={groundY} y2={view.sy(h) - s * 0.55} stroke={COL.ink} strokeOpacity={0.45} strokeWidth={1.3} strokeDasharray="6 5" />
            <Label x={relX + 6} y={groundY - 8} text={L.release} color={COL.ink} fs={fs - 1} anchor="start" />

            {/* the target */}
            <g aria-hidden="true">
              <rect x={zc - zw / 2} y={groundY - 4} width={zw} height={8} rx={3} fill="#dc2626" />
              <rect x={zc - zw / 6} y={groundY - 4} width={zw / 3} height={8} fill="#fff" />
              <line x1={zc + zw / 2 + 3} x2={zc + zw / 2 + 3} y1={groundY} y2={groundY - (narrow ? 30 : 42)} stroke="#334155" strokeWidth={2} />
              <path d={`M${zc + zw / 2 + 4},${groundY - (narrow ? 30 : 42)} l${narrow ? 16 : 22},${narrow ? 6 : 8} l${-(narrow ? 16 : 22)},${narrow ? 6 : 8} Z`} fill="#dc2626" />
            </g>
            <DimLine x1={relX} x2={view.sx(D)} y={groundY + 20} color="#dc2626" label={L.DTag(fmt(D, 0, dec))} fs={fs - 1} />

            {/* the package's path, and the line that shows it stays under the helicopter */}
            {pts.length > 1 && (
              <>
                <polyline points={pts.join(' ')} fill="none" stroke={COL.path} strokeOpacity={0.16} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pts.join(' ')} fill="none" stroke={COL.path} strokeWidth={3.25} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {released && !landed && <line x1={heliX} x2={pkX} y1={heliY + s * 0.24} y2={pkY - pk / 2} stroke="#64748b" strokeWidth={1.3} strokeDasharray="4 4" />}

            {landed && (
              <>
                <DimLine x1={relX} x2={view.sx(last.L)} y={groundY + 44} color={COL.path} label={L.LTag(len(last.L, dec))} fs={fs - 1} />
                <Pill
                  x={pkX}
                  y={groundY - (narrow ? 44 : 56)}
                  text={last.hit ? L.hitTag : `${last.diff > 0 ? '+' : '−'}${len(Math.abs(last.diff), dec)} ${T.m}`}
                  bg={last.hit ? '#059669' : '#dc2626'}
                  size={fs}
                  box={box}
                />
              </>
            )}

            <Helicopter x={heliX} y={heliY} s={s} phase={t * 38} />
            {v0 * vk > 8 && !landed && (
              <>
                <Arrow x1={heliX + s * 0.36} y1={heliY} x2={heliX + s * 0.36 + v0 * vk} y2={heliY} color={COL.vel} width={2.75} head={10} />
                <Sym x={heliX + s * 0.36 + v0 * vk + 4} y={heliY + 5} base="v" sub="0" color={COL.vel} fs={fs} />
              </>
            )}

            {/* the package */}
            {running && released && <circle cx={pkX} cy={pkY} r={pk + 4} fill="#d97706" className="cl-pulse" opacity="0.3" />}
            <g transform={`translate(${pkX.toFixed(1)} ${pkY.toFixed(1)})`}>
              <rect x={-pk / 2} y={-pk / 2} width={pk} height={pk} rx={2} fill="#b45309" stroke="#78350f" strokeWidth={1.2} />
              <line x1={0} x2={0} y1={-pk / 2} y2={pk / 2} stroke="#fde68a" strokeWidth={1.5} />
              <line x1={-pk / 2} x2={pk / 2} y1={0} y2={0} stroke="#fde68a" strokeWidth={1.5} />
            </g>
            {released && !landed && tFall > 0.02 && <VelocityArrows px={pkX} py={pkY} vx={v0} vy={vy} vk={vk} r={pk / 2} fs={fs} showComp={false} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** A side view of a helicopter flying to the right; (x, y) is the cabin centre. */
function Helicopter({ x, y, s, phase }) {
  const rx = s * 0.27;
  const ry = s * 0.15;
  const hub = y - ry - s * 0.08;
  const blade = s * 0.56 * (0.3 + 0.7 * Math.abs(Math.cos(phase)));
  const tailX = x - s * 0.66;
  return (
    <g aria-hidden="true">
      <ellipse cx={x} cy={hub} rx={s * 0.56} ry={2.2} fill="#0f172a" opacity={0.12} />
      <line x1={x - blade} x2={x + blade} y1={hub} y2={hub} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={x} x2={x} y1={hub} y2={y - ry + 1} stroke="#334155" strokeWidth={2.5} />
      <path d={`M${x - rx * 0.7},${y - ry * 0.35} L${tailX},${y - ry * 0.55} L${tailX},${y - ry * 0.05} L${x - rx * 0.7},${y + ry * 0.3} Z`} fill="#0e7490" />
      <path d={`M${tailX + 2},${y - ry * 0.5} L${tailX - s * 0.04},${y - ry * 1.6} L${tailX + s * 0.08},${y - ry * 0.5} Z`} fill="#0e7490" />
      <circle cx={tailX} cy={y - ry * 0.3} r={s * 0.07 * (0.4 + 0.6 * Math.abs(Math.sin(phase * 1.7)))} fill="none" stroke="#1e293b" strokeWidth={1.4} />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#0891b2" stroke="#155e75" strokeWidth={1.2} />
      <path d={`M${x + rx * 0.15},${y - ry * 0.85} Q${x + rx * 0.95},${y - ry * 0.75} ${x + rx * 0.98},${y + ry * 0.05} L${x + rx * 0.15},${y + ry * 0.05} Z`} fill="#cffafe" stroke="#155e75" strokeWidth={0.8} />
      <line x1={x - rx * 0.6} x2={x - rx * 0.5} y1={y + ry * 0.8} y2={y + ry + s * 0.08} stroke="#334155" strokeWidth={1.6} />
      <line x1={x + rx * 0.5} x2={x + rx * 0.4} y1={y + ry * 0.8} y2={y + ry + s * 0.08} stroke="#334155" strokeWidth={1.6} />
      <line x1={x - rx * 0.95} x2={x + rx * 0.85} y1={y + ry + s * 0.08} y2={y + ry + s * 0.08} stroke="#334155" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}
