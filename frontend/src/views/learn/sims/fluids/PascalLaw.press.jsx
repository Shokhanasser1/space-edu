import { useId, useState } from 'react';
import { BrickWall, Car, Footprints, Grid3x3, Lightbulb, MoveVertical, Pin, RotateCcw, Snowflake, Square, Tractor, Fingerprint, PersonStanding, RectangleHorizontal, Columns2 } from 'lucide-react';

import { Btn, Explain, Readout, Segmented, clamp, niceStep, textWidth, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import {
  COL,
  CapArrow,
  Chip,
  Formula,
  G,
  GroupLabel,
  LabScene,
  Label,
  LogRange,
  Panel,
  PaperGrid,
  ScaleChip,
  Tag,
  areaParts,
  fmtDepth,
  fmtF,
  fmtP,
  fmtSshort,
  pressureParts,
  sig,
} from './PascalLaw.parts';
import {
  BODIES,
  BrickBack,
  BrickFront,
  Car as CarBody,
  Finger,
  GROUNDS,
  GroundBack,
  GroundFront,
  KINDS,
  Needle,
  Person,
  Tank,
  contactsOf,
  forceAnchor,
  forceRange,
  holesOf,
  oblique,
  sinkDepth,
  surfaceFn,
} from './PascalLaw.bodies';

/**
 * Tab 1 — pressure p = F / S on soft ground. Pick a body and what it stands
 * on; it sinks into sand, snow, mud or plasticine as deep as its pressure
 * makes it (model h = p / k, see `PascalLaw.bodies`). The force F and the
 * support area S have their own (logarithmic) sliders. The orange arrows
 * under the support are the pressure — equal arrows for equal pressure,
 * drawn to one scale per body — and the ladder below puts the value among
 * everyday pressures from a skier (2 kPa) to a needle tip (200 MPa).
 */

const BODY_ICONS = { brick: BrickWall, person: PersonStanding, vehicle: Tractor, needle: Pin };
const KIND_ICONS = {
  wide: RectangleHorizontal,
  side: Columns2,
  end: Square,
  boots: Footprints,
  oneBoot: MoveVertical,
  skis: Snowflake,
  tank: Tractor,
  car: Car,
  tip: Pin,
  finger: Fingerprint,
};

const ARROW_NARROW = 0.6; // pressure arrows are drawn shorter on phones

const isPreset = (kind, F, S) => Math.abs(F - KINDS[kind].F) < 1e-9 * KINDS[kind].F && Math.abs(S - KINDS[kind].S) < 1e-9 * KINDS[kind].S;

/** "5 sm", "1 m", "5 mm" for a grid cell or a scale bar. */
function fmtLen(m, T) {
  if (m >= 1) return `${sig(m, 2, T.decimal)} ${T.m}`;
  if (m >= 0.01) return `${sig(m * 100, 2, T.decimal)} ${T.cm}`;
  return `${sig(m * 1000, 2, T.decimal)} ${T.mm}`;
}

/* ==================================================================== sim */

export default function PressSim({ T }) {
  const P = T.press;
  const dec = T.decimal;
  const [kind, setKind] = useState('wide');
  const [F, setF] = useState(KINDS.wide.F);
  const [S, setS] = useState(KINDS.wide.S);
  const [depth, setDepth] = useState(0);
  const K = KINDS[kind];
  const body = K.body;
  const B = BODIES[body];
  const g = GROUNDS[B.ground];
  const p = F / S;
  const hT = sinkDepth(kind, p);
  const through = p / g.k >= K.hmax - 1e-9;
  const preset = isPreset(kind, F, S);

  // the body settles into the ground with a short damped approach
  useRafLoop(Math.abs(depth - hT) > 1e-6, (dt) => {
    setDepth((d) => {
      const nd = hT + (d - hT) * Math.exp(-dt / 0.2);
      return Math.abs(nd - hT) < 1e-6 ? hT : nd;
    });
  });

  const place = (id) => {
    setKind(id);
    setF(KINDS[id].F);
    setS(KINDS[id].S);
    setDepth(0);
  };
  const pickBody = (b) => place(BODIES[b].kinds[0]);

  /* ---- words */
  const Ft = fmtF(F, T);
  const St = fmtSshort(S, T);
  const pt = fmtP(p, T);
  const ex = P.explain;
  const p0 = K.F / K.S;
  const ratio = p >= p0 ? p / p0 : p0 / p;
  let key = preset ? kind : Math.abs(ratio - 1) < 0.02 ? 'same' : 'custom';
  if (!preset && through) key += '+';
  const settled = useSettled(`${key}|${kind}|${F}|${S}`, preset ? 0 : 320);
  const [sKeyRaw, sKind] = settled.split('|');
  const sKey = sKeyRaw.replace('+', '');
  const sF = Number(settled.split('|')[2]);
  const sS = Number(settled.split('|')[3]);
  const sp = sF / sS;
  const sp0 = KINDS[sKind].F / KINDS[sKind].S;
  const sRatio = sp >= sp0 ? sp / sp0 : sp0 / sp;
  const sh = fmtDepth(sinkDepth(sKind, sp), T);
  let text;
  if (sKey === 'custom' || sKey === 'same') {
    const r = sig(sRatio, sRatio < 10 ? 2 : 3, dec);
    text = sKey === 'same' ? ex.same(fmtF(sF, T), fmtSshort(sS, T), fmtP(sp, T)) : ex.custom(fmtF(sF, T), fmtSshort(sS, T), fmtP(sp, T), r, sp > sp0 ? ex.bigger : ex.smaller, sh);
    if (sKeyRaw.endsWith('+')) text += ` ${KINDS[sKind].body === 'needle' ? ex.pierced : ex.buried}`;
  } else {
    text = ex[sKey]({ F: fmtF(sF, T), S: fmtSshort(sS, T), p: fmtP(sp, T), h: sh });
  }
  const tone = sKey === 'custom' ? (sp > sp0 ? '#fb923c' : '#34d399') : { end: '#fb923c', oneBoot: '#fb923c', car: '#fb923c', tip: '#fb923c', wide: '#22d3ee', boots: '#22d3ee', skis: '#34d399', tank: '#34d399', finger: '#34d399', side: '#fbbf24' }[sKey] ?? '#22d3ee';

  const [Fmin, Fmax] = forceRange(kind);
  const pp = pressureParts(p, T);
  const ap = areaParts(S, T);
  const mass = F / G;
  const massText = body === 'vehicle' ? sig(mass / 1000, 3, dec) : sig(mass, 3, dec);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_auto] xl:items-end">
        <div className="min-w-0">
          <GroupLabel>{P.bodyLabel}</GroupLabel>
          <Segmented
            label={P.bodyLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={body}
            onChange={pickBody}
            options={Object.keys(BODIES).map((b) => ({ value: b, label: P.bodies[b].name, sub: P.bodies[b].sub, icon: BODY_ICONS[b] }))}
          />
        </div>
        <div className="min-w-0">
          <GroupLabel>{P.kindLabel}</GroupLabel>
          <Segmented
            label={P.kindLabel}
            className={B.kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}
            size="lg"
            accent="#a78bfa"
            value={kind}
            onChange={place}
            options={B.kinds.map((id) => ({ value: id, label: P.kinds[id].name, sub: P.kinds[id].sub, icon: KIND_ICONS[id] }))}
          />
        </div>
        <Btn icon={RotateCcw} onClick={() => place(kind)} className="min-h-[52px] text-[15px] xl:min-w-[150px]">
          {P.replace}
        </Btn>
      </div>

      <PressScene T={T} kind={kind} F={F} S={S} h={depth} p={p} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={P.F}
          symbol="F"
          value={F < 1000 ? sig(F, 3, dec) : sig(F / 1000, 3, dec)}
          unit={F < 1000 ? T.N : T.kN}
          accent={COL.force}
          textColor={COL.forceText}
          sub={P.Fsub[body](massText)}
        />
        <Readout label={P.S} symbol="S" value={ap.v} unit={ap.u} accent={COL.area} textColor={COL.areaText} sub={preset ? P.Sbreak[kind] : ap.alt ? `= ${ap.alt}` : null}>
          <Footprint T={T} kind={kind} S={S} />
        </Readout>
        <Readout label={P.p} symbol="p" value={pp.v} unit={pp.u} accent={COL.press} textColor={COL.pressText} sub={pp.pa ? `= ${pp.pa}` : P.pSub} active />
        <Readout
          label={P.h}
          symbol="h"
          value={`≈ ${fmtDepth(hT, T).split(' ')[0]}`}
          unit={fmtDepth(hT, T).split(' ')[1]}
          accent={COL.depth}
          textColor={COL.depthText}
          sub={through ? (body === 'needle' ? P.hThrough : P.hBuried) : P.hSub(P.grounds[B.ground], sig(g.k / 1000, 3, dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-2">
          <LogRange
            id="pl-F"
            label={P.F}
            symbol="F"
            min={Fmin}
            max={Fmax}
            value={F}
            onChange={setF}
            accent={COL.force}
            display={Ft}
            hint={P.Fhint[body](massText)}
          />
          <LogRange
            id="pl-S"
            label={P.S}
            symbol="S"
            min={K.Smin}
            max={K.Smax}
            value={S}
            onChange={setS}
            accent={COL.area}
            display={`${ap.v} ${ap.u}`}
            hint={ap.alt ? `= ${ap.alt}` : undefined}
          />
          <Formula sym="p = F / S" nums={`= ${Ft} / ${ap.v} ${ap.u} =`} result={pt} note={P.formulaNote} />
          <p className="text-[11px] leading-snug text-gray-500">{P.logNote}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <Ladder T={T} p={p} kind={kind} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function PressScene({ T, kind, F, S, h, p }) {
  const P = T.press;
  const K = KINDS[kind];
  const B = BODIES[K.body];
  const bw = B.box.x1 - B.box.x0;
  const bh = B.box.y1 - B.box.y0;
  const kPw = 60 / B.pRef;
  return (
    <LabScene
      legend={[
        { color: COL.force, label: P.legend.F, kind: 'arrow' },
        { color: COL.area, label: P.legend.S, kind: 'line' },
        { color: COL.press, label: P.legend.p, kind: 'arrows' },
        { color: COL.depth, label: P.legend.h, kind: 'dim' },
      ]}
      chips={(W, narrow) => {
        const kP = kPw * (narrow ? ARROW_NARROW : 1);
        const pStep = niceStep(kP, 26);
        return (
          <>
            {!narrow && (
              <Chip icon={Grid3x3} color="#64748b">
                {P.cell(fmtLen(B.cell, T))}
              </Chip>
            )}
            <ScaleChip px={pStep * kP} text={fmtP(pStep, T)} label={P.pScale} />
          </>
        );
      }}
      height={(W, narrow) => (narrow ? clamp((W - 36) * (bh / bw) + 112, 300, 440) : B.height ?? 456)}
      ariaLabel={P.sceneLabel(P.bodies[K.body].name, P.kinds[kind].name, fmtF(F, T), fmtSshort(S, T), fmtP(p, T), fmtDepth(h, T))}
    >
      {(W, H, narrow) => <PressDrawing T={T} W={W} H={H} narrow={narrow} kind={kind} F={F} S={S} h={h} p={p} />}
    </LabScene>
  );
}

function PressDrawing({ T, W, H, narrow, kind, F, S, h, p }) {
  const P = T.press;
  const uid = useId().replace(/:/g, '');
  const K = KINDS[kind];
  const body = K.body;
  const B = BODIES[body];
  const g = GROUNDS[B.ground];
  const pad = narrow ? { l: 16, r: 16, t: 96, b: 14 } : { l: 28, r: 28, t: 116, b: 18 };
  const view = makeView(B.box, W, H, pad);
  const k = view.k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const holes = holesOf(kind, S, k);
  const contacts = contactsOf(kind, S);
  const band = body === 'brick' ? oblique(0.14, k) : { x: narrow ? 12 : 22, y: narrow ? -9 : -15 };
  const ySole = view.sy(-h);
  const ids = { front: `${uid}f`, comp: `${uid}c`, tex: `${uid}t`, below: `${uid}b` };

  /* body */
  let back = null;
  let front = null;
  if (body === 'brick') {
    const l = S / K.b;
    back = <BrickBack view={view} l={l} H={K.H} h={h} b={K.b} />;
    front = <BrickFront view={view} l={l} H={K.H} h={h} id={`${uid}k`} />;
  } else if (body === 'person') front = <Person view={view} kind={kind} S={S} h={h} />;
  else if (kind === 'tank') front = <Tank view={view} l={contacts[0][1] - contacts[0][0]} h={h} />;
  else if (kind === 'car') front = <CarBody view={view} S={S} h={h} />;
  else if (kind === 'tip') front = <Needle view={view} S={S} h={h} id={`${uid}n`} />;
  else front = <Finger view={view} S={S} h={h} />;

  /* pressure arrows under the support */
  const kP = (60 / B.pRef) * (narrow ? ARROW_NARROW : 1);
  const len = p * kP;
  const cap = Math.max(24, Math.min(112, H - ySole - 30));
  const arrows = [];
  contacts.forEach(([a, b], ci) => {
    const wpx = view.sx(b) - view.sx(a);
    const n = Math.max(1, Math.floor(wpx / 24));
    for (let i = 0; i < n; i += 1) {
      const x = view.sx(a + ((i + 0.5) * (b - a)) / n);
      arrows.push(<CapArrow key={`${ci}-${i}`} x={x} y={ySole + 3} ux={0} uy={1} len={len} cap={cap} color={COL.press} width={narrow ? 2 : 2.4} head={narrow ? 7 : 8} />);
    }
  });
  const main = contacts[contacts.length - 1];
  const pTagY = ySole + Math.min(len, cap) + (narrow ? 18 : 20);

  /* depth dimension at the left of the first hole */
  const ws = K.slit ? 1.5 / k : Math.max(g.slope * h, 2 / k);
  const dimX = view.sx(holes[0][0] - ws) - (narrow ? 10 : 14);
  const showDim = h * k > 7;

  /* the force arrow, ending just above the body */
  const anc = forceAnchor(view, kind, S, h);
  const LF = clamp((F / B.Fref) * (narrow ? 46 : 58), 16, narrow ? 72 : 92);
  const fTop = Math.max(anc.y - LF, 70);

  /* S tag at the right of the last contact, in the ground */
  const sX = view.sx(main[1]) + (narrow ? 8 : 12);
  const surf = surfaceFn(holes, h, g, k, K.slit);

  return (
    <>
      <PaperGrid view={view} W={W} H={H} step={B.cell} yMin={0} />
      <GroundBack view={view} W={W} g={g} holes={holes} h={h} band={band} slit={K.slit} />
      {back}
      <GroundFront view={view} W={W} H={H} g={g} holes={holes} h={h} ids={ids} slit={K.slit} names={{ ground: P.grounds[B.ground], below: P.belows[B.ground] }} />
      {front}

      {/* the support area */}
      {contacts.map(([a, b], i) =>
        view.sx(b) - view.sx(a) < 3 ? (
          <circle key={i} cx={view.sx((a + b) / 2)} cy={ySole} r={3} fill={COL.area} stroke="#fff" strokeWidth="1.2" />
        ) : (
          <line key={i} x1={view.sx(a)} x2={view.sx(b)} y1={ySole} y2={ySole} stroke={COL.area} strokeWidth={narrow ? 3 : 4} strokeLinecap="round" />
        ),
      )}

      {arrows}

      {showDim && (
        <g pointerEvents="none">
          <line x1={dimX} x2={dimX} y1={view.sy(0)} y2={ySole} stroke={COL.depth} strokeWidth="1.8" />
          <line x1={dimX - 5} x2={dimX + 5} y1={view.sy(0)} y2={view.sy(0)} stroke={COL.depth} strokeWidth="1.6" />
          <line x1={dimX - 5} x2={dimX + 5} y1={ySole} y2={ySole} stroke={COL.depth} strokeWidth="1.6" />
          <Label x={dimX - 7} y={(view.sy(0) + ySole) / 2 + 4} color={COL.depth} fs={fs} anchor="end">
            {`h ≈ ${fmtDepth(h, T)}`}
          </Label>
        </g>
      )}

      {/* force */}
      <CapArrow x={anc.x} y={fTop} ux={0} uy={1} len={anc.y - fTop} color={COL.force} width={narrow ? 3 : 3.6} head={narrow ? 10 : 12} />
      <Label x={anc.x + (narrow ? 8 : 10)} y={fTop + 12} color={COL.force} fs={fs + 1} anchor="start">
        {`F = ${fmtF(F, T)}`}
      </Label>

      {/* labels */}
      <Tag x={view.sx((main[0] + main[1]) / 2)} y={Math.min(pTagY, H - 14)} text={`p = ${fmtP(p, T)}`} color={COL.press} fs={fs} box={box} />
      <Tag x={sX} y={Math.max(view.sy(surf(main[1] + 0.001)), ySole) + (narrow ? 12 : 14)} text={`S = ${fmtSshort(S, T)}`} color={COL.area} outline fs={fs} box={box} anchor="start" />
      {body === 'brick' && <BrickDims T={T} view={view} l={S / K.b} H={K.H} h={h} b={K.b} fs={fs} />}
    </>
  );
}

/** The brick's three sizes: length on the front face, height at its left, depth along the top. */
function BrickDims({ T, view, l, H, h, b, fs }) {
  const o = oblique(b, view.k);
  const x0 = view.sx(-l / 2);
  const x1 = view.sx(l / 2);
  const yT = view.sy(-h + H);
  const yB = Math.min(view.sy(-h), view.sy(0));
  const cm = (m) => `${sig(m * 100, 3, T.decimal)} ${T.cm}`;
  const hx = x0 - 9;
  return (
    <g pointerEvents="none">
      {x1 - x0 > 44 && (
        <text x={(x0 + x1) / 2} y={(yT + Math.min(view.sy(-h), view.sy(0) + 2)) / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">
          {cm(l)}
        </text>
      )}
      <line x1={hx} x2={hx} y1={yT} y2={view.sy(-h)} stroke="#7c2d12" strokeWidth="1.3" strokeDasharray="3 2" />
      <line x1={hx - 4} x2={hx + 4} y1={yT} y2={yT} stroke="#7c2d12" strokeWidth="1.3" />
      <Label x={hx - 4} y={(yT + yB) / 2 + 4} color="#7c2d12" fs={fs - 1} anchor="end">
        {cm(H)}
      </Label>
      <Label x={x1 + o.x / 2 + 6} y={yT + o.y / 2 - 3} color="#7c2d12" fs={fs - 1} anchor="start">
        {cm(b)}
      </Label>
    </g>
  );
}

/* ============================================================ footprint */

const FOOT_BOX = { brick: [0.46, 0.13], person: [2.7, 0.42], vehicle: [7.2, 3.5], needle: [0.03, 0.03] };

/** The support seen from above, to scale, inside the S tile. */
function Footprint({ T, kind, S }) {
  const [ref, { width }] = useElementSize();
  const K = KINDS[kind];
  const W = Math.max(width, 120);
  const H = 50;
  const [bw, bh] = FOOT_BOX[K.body];
  const sc = Math.min((W - 8) / bw, (H - 8) / bh);
  const cx = W / 2;
  const cy = H / 2;
  const R = (x, y, w, hh, r = 2) => <rect key={`${x}${y}`} x={cx + (x - w / 2) * sc} y={cy + (y - hh / 2) * sc} width={Math.max(1.2, w * sc)} height={Math.max(1.2, hh * sc)} rx={r} fill="#a78bfa" fillOpacity="0.55" stroke="#c4b5fd" strokeWidth="1" />;
  let shapes;
  const c = contactsOf(kind, S);
  if (K.body === 'brick') shapes = [R(0, 0, S / K.b, K.b, 1.5)];
  else if (kind === 'boots') shapes = c.map(([a, b], i) => R((a + b) / 2, i ? -0.09 : 0.09, b - a, 0.1, 4));
  else if (kind === 'oneBoot') shapes = [R(0, 0, c[0][1] - c[0][0], 0.1, 4)];
  else if (kind === 'skis') shapes = [R(0, -0.09, c[0][1] - c[0][0], 0.1, 3), R(0, 0.09, c[0][1] - c[0][0], 0.1, 3)];
  else if (kind === 'tank') shapes = [R(0, -1.4, c[0][1] - c[0][0], 0.5, 2), R(0, 1.4, c[0][1] - c[0][0], 0.5, 2)];
  else if (kind === 'car') {
    const lp = c[0][1] - c[0][0];
    shapes = [-1.35, 1.35].flatMap((x) => [R(x, -0.75, lp, 0.2, 1), R(x, 0.75, lp, 0.2, 1)]);
  } else {
    const r = Math.max(1.2, Math.sqrt(S / Math.PI) * sc);
    shapes = [<circle key="c" cx={cx} cy={cy} r={r} fill="#a78bfa" fillOpacity="0.6" stroke="#c4b5fd" strokeWidth="1" />];
    if (r < 3) shapes.push(<circle key="ring" cx={cx} cy={cy} r={7} fill="none" stroke="#c4b5fd" strokeWidth="1" strokeDasharray="2 2" />);
  }
  const step = niceStep(sc, 26);
  const barPx = step * sc;
  return (
    <div ref={ref} className="mt-2 w-full">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block rounded-lg bg-black/25">
        {shapes}
        <line x1={W - 6 - barPx} x2={W - 6} y1={H - 6} y2={H - 6} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={W - 6 - barPx} x2={W - 6 - barPx} y1={H - 9} y2={H - 3} stroke="#94a3b8" strokeWidth="1.2" />
        <line x1={W - 6} x2={W - 6} y1={H - 9} y2={H - 3} stroke="#94a3b8" strokeWidth="1.2" />
        <text x={W - 6 - barPx / 2} y={H - 11} textAnchor="middle" fontSize="10" fill="#94a3b8">
          {fmtLen(step, T)}
        </text>
        <text x={6} y={12} fontSize="10" fill="#94a3b8">
          {T.press.topView}
        </text>
      </svg>
    </div>
  );
}

/* ================================================================ ladder */

const LADDER_LO = 2; // 10² Pa
const LADDER_HI = 9; // 10⁹ Pa

/** Where the pressure sits among everyday pressures, on a logarithmic scale. */
function Ladder({ T, p, kind }) {
  const L = T.press.ladder;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const narrow = W < 420;
  const H = narrow ? 196 : 186;
  const padX = 16;
  const X = (v) => padX + ((clamp(Math.log10(v), LADDER_LO, LADDER_HI) - LADDER_LO) / (LADDER_HI - LADDER_LO)) * (W - 2 * padX);
  const axisY = 100;
  const body = KINDS[kind].body;
  const fs = 11;
  const refs = [
    ...Object.keys(KINDS).map((id) => ({ id, v: KINDS[id].F / KINDS[id].S, mine: KINDS[id].body === body })),
    { id: 'knife', v: 1e7, mine: false },
  ].sort((a, b) => a.v - b.v);
  // greedy rows: the current body's supports above the axis, the others below
  const rowsUp = [];
  const rowsDown = [];
  const placed = refs.map((r) => {
    const text = L.names[r.id];
    const w = textWidth(text, fs, 600) + 8;
    const x = clamp(X(r.v), w / 2 + 2, W - w / 2 - 2);
    const rows = r.mine ? rowsUp : rowsDown;
    let row = rows.findIndex((right) => x - w / 2 > right + 4);
    if (row === -1 && rows.length < 3) row = rows.length;
    if (row !== -1) rows[row] = x + w / 2;
    return { ...r, text, x, row };
  });
  const xp = X(p);
  const now = `p = ${fmtP(p, T)}`;
  const nowW = textWidth(now, 12, 700) + 16;
  const nowX = clamp(xp, nowW / 2 + 2, W - nowW / 2 - 2);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400" /> {L.mine}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> {L.others}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.label(fmtP(p, T))} className="block">
          <defs>
            <linearGradient id="pl-ladder" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#34d399" />
              <stop offset="0.5" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f87171" />
            </linearGradient>
          </defs>
          <rect x={padX} y={axisY - 3} width={W - 2 * padX} height={6} rx={3} fill="url(#pl-ladder)" opacity="0.75" />
          {Array.from({ length: LADDER_HI - LADDER_LO + 1 }, (_, i) => LADDER_LO + i).map((e) => (
            <g key={e}>
              <line x1={X(10 ** e)} x2={X(10 ** e)} y1={axisY - 7} y2={axisY + 7} stroke="#cbd5e1" strokeWidth="1.3" />
              {e < LADDER_HI &&
                [2, 5].map((m) => <line key={m} x1={X(m * 10 ** e)} x2={X(m * 10 ** e)} y1={axisY - 4} y2={axisY + 4} stroke="#94a3b8" strokeWidth="1" />)}
              {(!narrow || e % 2 === 0 || e === LADDER_HI) && (
                <text x={clamp(X(10 ** e), 18, W - 18)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#94a3b8">
                  {L.decades[e - LADDER_LO]}
                </text>
              )}
            </g>
          ))}
          <line x1={xp} x2={xp} y1={24} y2={axisY + 8} stroke={COL.press} strokeWidth="2" />
          {placed.map((r) => {
            const up = r.mine;
            const ly = up ? axisY - 20 - r.row * 16 : axisY + 24 + r.row * 16;
            return (
              <g key={r.id}>
                <circle cx={X(r.v)} cy={axisY} r={up ? 4.5 : 3.5} fill={up ? '#a78bfa' : '#64748b'} stroke="#0b0b16" strokeWidth="1.2" />
                {r.row !== -1 && (
                  <>
                    <line x1={X(r.v)} x2={r.x} y1={up ? axisY - 6 : axisY + 6} y2={up ? ly + 3 : ly - 10} stroke={up ? '#a78bfa88' : '#64748b88'} strokeWidth="1" />
                    <text x={r.x} y={ly} textAnchor="middle" fontSize={fs} fontWeight={up ? 700 : 500} fill={up ? '#ddd6fe' : '#94a3b8'} stroke="#15151f" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
                      {r.text}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <path d={`M${xp},${axisY - 1} L${xp - 7},${axisY - 13} L${xp + 7},${axisY - 13} Z`} fill={COL.press} stroke="#0b0b16" strokeWidth="1" />
          <rect x={nowX - nowW / 2} y={4} width={nowW} height={20} rx={10} fill={COL.press} />
          <text x={nowX} y={18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            {now}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{L.note}</p>
    </div>
  );
}
