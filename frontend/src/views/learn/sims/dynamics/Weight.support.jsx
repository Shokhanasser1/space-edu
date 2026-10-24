import { useState } from 'react';
import { Layers, Lightbulb, Scissors, Undo2 } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { Chip, FC, ForceArrow, G, GroupLabel, LabScene, PaperGrid, SidePill, num } from './Weight.parts';

/**
 * Tab 2 — the force of gravity and the weight are two different forces.
 * A book lies on a table and a lamp hangs on a cord. On each body act mg
 * (the Earth pulls the body; applied to the body) and the support's force
 * N or T (applied to the body). The weight P is the force with which the
 * body presses on the table or pulls the cord — it is applied to the table
 * and to the cord, not to the body. At rest P = mg = N = T.
 * "Remove the supports" takes the table away and cuts the cord: both bodies
 * fall freely, P = 0 while mg stays; on the floor P = mg again.
 * Strings come from T.support.
 */

const TABLE_H = 0.75; // m, the book falls this far
const LAMP_H = 0.9; // m, height of the lamp's rim above the floor
const SLOW = 0.25; // the fall is shown 4 times slower
const T_BOOK = Math.sqrt((2 * TABLE_H) / G);
const T_LAMP = Math.sqrt((2 * LAMP_H) / G);
const M_MAX = 2;
const HOLD = { phase: 'hold', tf: 0 };

const SELECT = ['all', 'mg', 'P', 'NT'];

export default function SupportSim({ T }) {
  const S = T.support;
  const dec = T.decimal;
  const [sel, setSel] = useState('all');
  const [mb, setMb] = useState(1);
  const [ml, setMl] = useState(1.5);
  const [drop, setDrop] = useState(HOLD);

  useRafLoop(drop.phase === 'fall', (dt) => {
    setDrop((p) => {
      if (p.phase !== 'fall') return p;
      const tf = Math.min(T_LAMP, p.tf + dt * SLOW);
      return { phase: tf >= T_LAMP - 1e-9 ? 'landed' : 'fall', tf };
    });
  });

  const bookDown = drop.phase !== 'hold' && drop.tf >= T_BOOK - 1e-9;
  const lampDown = drop.phase === 'landed';
  const bookFree = drop.phase !== 'hold' && !bookDown;
  const lampFree = drop.phase === 'fall';
  const mgB = mb * G;
  const mgL = ml * G;
  const PB = bookFree ? 0 : mgB;
  const PL = lampFree ? 0 : mgL;
  const F1 = (n) => num(n, 1, dec);

  let key = sel;
  if (drop.phase === 'fall') key = 'fall';
  else if (drop.phase === 'landed') key = 'landed';
  const settled = useSettled(key, key === 'fall' || key === 'landed' ? 0 : 120);
  const vals = { mgB: F1(mgB), mgL: F1(mgL), mb: F1(mb), ml: F1(ml) };
  const tone = { all: '#22d3ee', mg: '#f87171', P: '#a78bfa', NT: '#38bdf8', fall: '#fb923c', landed: '#34d399' }[settled];

  const where = (falling, landed, normal) => (falling ? S.applied.none : landed ? S.applied.floor : normal);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{S.selectLabel}</GroupLabel>
          <Segmented
            label={S.selectLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={sel}
            onChange={setSel}
            accent={{ all: '#22d3ee', mg: '#f87171', P: '#a78bfa', NT: '#38bdf8' }[sel]}
            options={SELECT.map((id) => ({ value: id, label: S.select[id].name, sub: S.select[id].sub, icon: id === 'all' ? Layers : undefined }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 xl:flex">
          {drop.phase === 'hold' ? (
            <Btn variant="primary" icon={Scissors} onClick={() => {
                setSel('all');
                setDrop({ phase: 'fall', tf: 0 });
              }} className="xl:min-w-[200px] min-h-[52px] text-[15px]">
              {S.remove}
            </Btn>
          ) : (
            <Btn variant="primary" icon={Undo2} onClick={() => setDrop(HOLD)} className="xl:min-w-[200px] min-h-[52px] text-[15px]">
              {S.restore}
            </Btn>
          )}
        </div>
      </div>

      <SupportScene T={T} sel={sel} mb={mb} ml={ml} drop={drop} bookFree={bookFree} lampFree={lampFree} bookDown={bookDown} lampDown={lampDown} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {S.explain[settled](vals)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={S.readouts.mgB} symbol="mg" value={F1(mgB)} unit={T.N} accent={FC.mg} textColor={FC.mgText} active={sel === 'mg'} sub={S.applied.book} />
        <Readout
          label={S.readouts.PB}
          symbol="P"
          value={F1(PB)}
          unit={T.N}
          accent={FC.P}
          textColor={FC.PText}
          active={sel === 'P'}
          sub={where(bookFree, bookDown, S.applied.table)}
        />
        <Readout label={S.readouts.mgL} symbol="mg" value={F1(mgL)} unit={T.N} accent={FC.mg} textColor={FC.mgText} active={sel === 'mg'} sub={S.applied.lamp} />
        <Readout
          label={S.readouts.PL}
          symbol="P"
          value={F1(PL)}
          unit={T.N}
          accent={FC.P}
          textColor={FC.PText}
          active={sel === 'P'}
          sub={where(lampFree, lampDown, S.applied.cord)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wt-sup-book"
            label={S.massBook}
            symbol="m"
            min={0.5}
            max={M_MAX}
            step={0.1}
            value={mb}
            onChange={setMb}
            accent={FC.mg}
            display={`${F1(mb)} ${T.kg}`}
            hint={S.massHint(F1(mgB))}
          />
          <RangeField
            id="wt-sup-lamp"
            label={S.massLamp}
            symbol="m"
            min={0.5}
            max={M_MAX}
            step={0.1}
            value={ml}
            onChange={setMl}
            accent={FC.mg}
            display={`${F1(ml)} ${T.kg}`}
            hint={S.massHint(F1(mgL))}
          />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300">{S.thirdLaw}</p>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{S.table.title}</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full border-collapse text-left text-[12.5px] sm:text-[13px] leading-snug">
              <thead>
                <tr className="bg-white/[0.06]">
                  <th scope="col" className="w-[30%] px-2.5 py-2 font-medium text-gray-400" />
                  <th scope="col" className="px-2.5 py-2 font-semibold" style={{ color: FC.mgText }}>
                    {S.table.colMg}
                  </th>
                  <th scope="col" className="px-2.5 py-2 font-semibold" style={{ color: FC.PText }}>
                    {S.table.colP}
                  </th>
                </tr>
              </thead>
              <tbody>
                {S.table.rows.map((r) => (
                  <tr key={r.q} className="border-t border-white/10 align-top">
                    <th scope="row" className="px-2.5 py-2 font-medium text-gray-400">
                      {r.q}
                    </th>
                    <td className="px-2.5 py-2 text-gray-100">{r.mg}</td>
                    <td className="px-2.5 py-2 text-gray-100">{r.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function SupportScene({ T, sel, mb, ml, drop, bookFree, lampFree, bookDown, lampDown }) {
  const S = T.support;
  const dec = T.decimal;
  const mgB = mb * G;
  const mgL = ml * G;
  const F1 = (n) => num(n, 1, dec);
  const falling = drop.phase === 'fall';
  const op = (kind) => (sel === 'all' || sel === kind ? 1 : 0.14);

  return (
    <LabScene
      legend={[
        { color: FC.mg, label: S.legend.mg, kind: 'arrow' },
        { color: FC.N, label: S.legend.N, kind: 'arrow' },
        { color: FC.T, label: S.legend.T, kind: 'arrow' },
        { color: FC.P, label: S.legend.P, kind: 'arrow' },
        ...(falling ? [{ color: FC.a, label: S.legend.a, kind: 'arrow' }] : []),
      ]}
      chips={
        drop.phase === 'hold' ? null : (
          <Chip>{S.slowChip(fmt(1 / SLOW, 0, dec))}</Chip>
        )
      }
      height={(W, narrow) => (narrow ? 450 : 520)}
      ariaLabel={S.sceneLabel(F1(mgB), F1(bookFree ? 0 : mgB), F1(mgL), F1(lampFree ? 0 : mgL))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const floorY = H - (narrow ? 112 : 128);
        const Lmax = H - floorY - 14;
        const kF = Lmax / (M_MAX * G);
        const cellN = niceStep(kF, 18);
        const tablePx = narrow ? 92 : 112;
        const pxM = tablePx / TABLE_H;
        const kA = narrow ? 3.4 : 4.2;
        const wArrow = narrow ? 3 : 3.6;
        const head = narrow ? 11 : 13;
        const short = narrow;

        /* --- book station */
        const bcx = W * (narrow ? 0.27 : 0.29);
        const tw = Math.min(narrow ? W * 0.46 : 420, W * 0.4);
        const tx0 = bcx - tw / 2;
        const tTop = floorY - tablePx;
        const bw = narrow ? 76 : 170;
        const bh = narrow ? 26 : 36;
        const fallB = drop.phase === 'hold' ? 0 : Math.min(0.5 * G * drop.tf * drop.tf, TABLE_H) * pxM;
        const bBot = tTop + fallB;
        const bCom = bBot - bh / 2;
        const tableGone = drop.phase !== 'hold';

        /* --- lamp station */
        const lcx = W * (narrow ? 0.76 : 0.72);
        const ceilY = narrow ? 52 : 64;
        const shadeH = narrow ? 44 : 56;
        const shadeW = narrow ? 64 : 88;
        const rim0 = floorY - LAMP_H * pxM;
        const fallL = drop.phase === 'hold' ? 0 : Math.min(0.5 * G * drop.tf * drop.tf, LAMP_H) * pxM;
        const rim = rim0 + fallL;
        const hook = rim - shadeH - 8;
        const lCom = rim - shadeH * 0.45;
        const hook0 = rim0 - shadeH - 8;

        const lenB = mgB * kF;
        const lenL = mgL * kF;

        const glowB = sel === 'mg' || sel === 'NT';
        const glowT = sel === 'P';

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={W} y1={floorY} cell={cellN * kF} ax={bcx} ay={tTop} />
            {/* floor */}
            <rect x={0} y={floorY} width={W} height={H - floorY} fill="#f5f5f4" />
            <line x1={0} x2={W} y1={floorY} y2={floorY} stroke="#475569" strokeWidth="2" />
            {Array.from({ length: Math.ceil(W / 12) }, (_, i) => (
              <line key={`fh${i}`} x1={i * 12} x2={i * 12 - 9} y1={floorY + 2} y2={floorY + 11} stroke="#a8a29e" />
            ))}
            <text x={8} y={floorY + 28} fontSize={fs - 1} fontWeight="600" fill="#78716c">
              {S.floor}
            </text>

            {/* ---------------- table */}
            <g opacity={tableGone ? 0.28 : 1} strokeDasharray={tableGone ? '5 4' : undefined}>
              <rect x={tx0} y={tTop} width={tw} height={14} rx={3} fill={tableGone ? 'none' : '#c08457'} stroke="#92400e" strokeWidth="1.6" />
              <rect x={tx0 + 14} y={tTop + 14} width={10} height={floorY - tTop - 14} fill={tableGone ? 'none' : '#a16207'} stroke="#92400e" strokeWidth="1.2" />
              <rect x={tx0 + tw - 24} y={tTop + 14} width={10} height={floorY - tTop - 14} fill={tableGone ? 'none' : '#a16207'} stroke="#92400e" strokeWidth="1.2" />
            </g>
            {glowT && !tableGone && (
              <rect x={tx0 - 4} y={tTop - 4} width={tw + 8} height={22} rx={6} fill={FC.P} fillOpacity="0.12" stroke={FC.P} strokeWidth="2.5" />
            )}
            {glowT && bookDown && <rect x={bcx - bw / 2 - 16} y={floorY - 3} width={bw + 32} height={10} rx={4} fill={FC.P} fillOpacity="0.18" stroke={FC.P} strokeWidth="2.5" />}

            {/* ---------------- book */}
            {glowB && <rect x={bcx - bw / 2 - 5} y={bBot - bh - 5} width={bw + 10} height={bh + 10} rx={6} fill={sel === 'mg' ? FC.mg : FC.N} fillOpacity="0.12" stroke={sel === 'mg' ? FC.mg : FC.N} strokeWidth="2.5" />}
            <g aria-hidden="true">
              <rect x={bcx - bw / 2} y={bBot - bh} width={bw} height={bh} rx={3} fill="#fef3c7" stroke="#065f46" strokeWidth="1.5" />
              <rect x={bcx - bw / 2} y={bBot - bh} width={bw} height={5} rx={2} fill="#047857" />
              <rect x={bcx - bw / 2} y={bBot - 5} width={bw} height={5} rx={2} fill="#047857" />
              <rect x={bcx - bw / 2} y={bBot - bh} width={9} height={bh} rx={2} fill="#065f46" />
              {[0.35, 0.5, 0.65].map((f) => (
                <line key={`pg${f}`} x1={bcx - bw / 2 + 12} x2={bcx + bw / 2 - 3} y1={bBot - bh * f} y2={bBot - bh * f} stroke="#d6b77a" strokeWidth="0.8" />
              ))}
            </g>

            {/* ---------------- ceiling, cord, lamp */}
            <g aria-hidden="true">
              <rect x={lcx - 80} y={ceilY - 12} width={160} height={12} fill="#e7e5e4" />
              {Array.from({ length: 14 }, (_, i) => (
                <line key={`ch${i}`} x1={lcx - 80 + i * 12} x2={lcx - 80 + i * 12 + 9} y1={ceilY - 12} y2={ceilY - 2} stroke="#a8a29e" />
              ))}
              <line x1={lcx - 80} x2={lcx + 80} y1={ceilY} y2={ceilY} stroke="#475569" strokeWidth="2" />
              <rect x={lcx - 9} y={ceilY} width={18} height={6} rx={2} fill="#475569" />
            </g>
            {glowT && !lampFree && !lampDown && <line x1={lcx} x2={lcx} y1={ceilY + 6} y2={hook} stroke={FC.P} strokeOpacity="0.3" strokeWidth="9" strokeLinecap="round" />}
            {glowT && lampDown && <rect x={lcx - shadeW / 2 - 16} y={floorY - 3} width={shadeW + 32} height={10} rx={4} fill={FC.P} fillOpacity="0.18" stroke={FC.P} strokeWidth="2.5" />}
            {drop.phase === 'hold' ? (
              <line x1={lcx} x2={lcx} y1={ceilY + 6} y2={hook} stroke="#334155" strokeWidth="2" />
            ) : (
              <>
                <path d={`M${lcx},${ceilY + 6} L${lcx},${hook0 - 22} l-3,5 m3,-5 l3,6`} fill="none" stroke="#334155" strokeWidth="2" />
                <line x1={lcx} x2={lcx} y1={hook - 10} y2={hook} stroke="#334155" strokeWidth="2" />
              </>
            )}
            {glowB && (
              <path
                d={`M${lcx - 12},${hook - 4} L${lcx + 12},${hook - 4} L${lcx + shadeW / 2 + 6},${rim + 5} L${lcx - shadeW / 2 - 6},${rim + 5} Z`}
                fill={sel === 'mg' ? FC.mg : FC.T}
                fillOpacity="0.12"
                stroke={sel === 'mg' ? FC.mg : FC.T}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}
            <g aria-hidden="true">
              <rect x={lcx - 5} y={hook} width={10} height={9} rx={2} fill="#475569" />
              <path d={`M${lcx - 9},${hook + 8} L${lcx + 9},${hook + 8} L${lcx + shadeW / 2},${rim} L${lcx - shadeW / 2},${rim} Z`} fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx={lcx} cy={rim - 7} r={narrow ? 7 : 9} fill="#fef08a" stroke="#eab308" strokeWidth="1.2" />
              {drop.phase === 'hold' && <circle cx={lcx} cy={rim + 4} r={narrow ? 20 : 26} fill="#fde047" opacity="0.18" />}
            </g>

            {/* ---------------- forces on the book */}
            <ForceArrow x1={bcx} y1={bCom} x2={bcx} y2={bCom + lenB} color={FC.mg} width={wArrow} head={head} opacity={op('mg')} />
            {!bookFree && (
              <>
                <ForceArrow x1={bcx - 22} y1={bBot} x2={bcx - 22} y2={bBot - lenB} color={FC.N} width={wArrow} head={head} opacity={op('NT')} />
                <ForceArrow x1={bcx + 22} y1={bBot} x2={bcx + 22} y2={bBot + lenB} color={FC.P} width={wArrow} head={head} opacity={op('P')} />
              </>
            )}
            <g opacity={op('mg')}>
              <SidePill x={bcx - 4} y={bCom + lenB - 2} side={-1} gap={2} text={short ? 'mg' : S.tag.mg(F1(mgB))} bg={FC.mg} fs={fs} box={box} />
            </g>
            {!bookFree && (
              <>
                <g opacity={op('NT')}>
                  <SidePill x={bcx - 26} y={bBot - lenB + 6} side={-1} gap={2} text={short ? 'N' : S.tag.N(F1(mgB))} bg={FC.N} fs={fs} box={box} />
                </g>
                <g opacity={op('P')}>
                  <SidePill x={bcx + 26} y={bBot + lenB - 4} side={1} gap={2} text={short ? 'P' : S.tag.P(F1(mgB))} bg={FC.P} fs={fs} box={box} />
                </g>
              </>
            )}
            {bookFree && (
              <>
                <ForceArrow x1={bcx + bw / 2 + 14} y1={bCom} x2={bcx + bw / 2 + 14} y2={bCom + G * kA} color={FC.a} width={2.8} head={10} dot={false} />
                <SidePill x={bcx + bw / 2 + 16} y={bCom + G * kA * 0.5} side={1} gap={4} text={S.tag.ag} bg={FC.a} fs={fs - 1} box={box} />
                <SidePill x={bcx} y={bBot - bh - 16} side={0} text={S.tag.zero} bg={FC.P} fs={fs - 1} box={box} />
              </>
            )}

            {/* ---------------- forces on the lamp */}
            <ForceArrow x1={lcx} y1={lCom} x2={lcx} y2={lCom + lenL} color={FC.mg} width={wArrow} head={head} opacity={op('mg')} />
            {!lampFree &&
              (lampDown ? (
                <>
                  <ForceArrow x1={lcx - 18} y1={rim} x2={lcx - 18} y2={rim - lenL} color={FC.N} width={wArrow} head={head} opacity={op('NT')} />
                  <ForceArrow x1={lcx + 18} y1={rim} x2={lcx + 18} y2={rim + lenL} color={FC.P} width={wArrow} head={head} opacity={op('P')} />
                </>
              ) : (
                <>
                  <ForceArrow x1={lcx - 9} y1={hook} x2={lcx - 9} y2={hook - lenL} color={FC.T} width={wArrow} head={head} opacity={op('NT')} />
                  <ForceArrow x1={lcx + 9} y1={hook} x2={lcx + 9} y2={hook + lenL} color={FC.P} width={wArrow} head={head} opacity={op('P')} />
                </>
              ))}
            <g opacity={op('mg')}>
              <SidePill x={lcx - shadeW / 2 - 2} y={lCom + lenL - 2} side={-1} gap={2} text={short ? 'mg' : S.tag.mg(F1(mgL))} bg={FC.mg} fs={fs} box={box} />
            </g>
            {!lampFree &&
              (lampDown ? (
                <>
                  <g opacity={op('NT')}>
                    <SidePill x={lcx - shadeW / 2 - 2} y={rim - lenL + 6} side={-1} gap={2} text={short ? 'N' : S.tag.N(F1(mgL))} bg={FC.N} fs={fs} box={box} />
                  </g>
                  <g opacity={op('P')}>
                    <SidePill x={lcx + 22} y={rim + lenL - 4} side={1} gap={2} text={short ? 'P' : S.tag.P(F1(mgL))} bg={FC.P} fs={fs} box={box} />
                  </g>
                </>
              ) : (
                <>
                  <g opacity={op('NT')}>
                    <SidePill x={lcx - 13} y={hook - lenL + 6} side={-1} gap={2} text={short ? 'T' : S.tag.T(F1(mgL))} bg={FC.T} fs={fs} box={box} />
                  </g>
                  <g opacity={op('P')}>
                    <SidePill x={lcx + shadeW / 2 + 2} y={hook + lenL - 4} side={1} gap={2} text={short ? 'P' : S.tag.P(F1(mgL))} bg={FC.P} fs={fs} box={box} />
                  </g>
                </>
              ))}
            {lampFree && (
              <>
                <ForceArrow x1={lcx + shadeW / 2 + 14} y1={lCom} x2={lcx + shadeW / 2 + 14} y2={lCom + G * kA} color={FC.a} width={2.8} head={10} dot={false} />
                <SidePill x={lcx + shadeW / 2 + 16} y={lCom + G * kA * 0.5} side={1} gap={4} text={S.tag.ag} bg={FC.a} fs={fs - 1} box={box} />
                <SidePill x={lcx} y={hook - 22} side={0} text={S.tag.zero} bg={FC.P} fs={fs - 1} box={box} />
              </>
            )}

            {/* ---------------- "applied to" tags */}
            {sel !== 'all' && (
              <g>
                {sel === 'mg' && (
                  <>
                    <SidePill x={bcx + bw / 2 + 4} y={bBot - bh - 14} side={1} gap={0} text={S.on.book} bg="#0f172a" fs={fs - 1} box={box} />
                    <SidePill x={lcx + shadeW / 2 + 6} y={rim - shadeH * 0.6} side={1} gap={0} text={S.on.lamp} bg="#0f172a" fs={fs - 1} box={box} />
                  </>
                )}
                {sel === 'NT' && !bookFree && <SidePill x={bcx + bw / 2 + 4} y={bBot - bh - 14} side={1} gap={0} text={S.on.bookN} bg="#0f172a" fs={fs - 1} box={box} />}
                {sel === 'NT' && !lampFree && (
                  <SidePill x={lcx + shadeW / 2 + 6} y={rim - shadeH * 0.6} side={1} gap={0} text={lampDown ? S.on.lampN : S.on.lampT} bg="#0f172a" fs={fs - 1} box={box} />
                )}
                {sel === 'P' && !bookFree && (
                  <SidePill
                    x={bookDown ? bcx + bw / 2 + 18 : tx0 + tw - 4}
                    y={bookDown ? floorY - 14 : tTop + 34}
                    side={bookDown ? 1 : -1}
                    gap={0}
                    text={bookDown ? S.on.floor : S.on.table}
                    bg="#0f172a"
                    fs={fs - 1}
                    box={box}
                  />
                )}
                {sel === 'P' && !lampFree && (
                  <SidePill
                    x={lampDown ? lcx + shadeW / 2 + 18 : lcx + 8}
                    y={lampDown ? floorY - 14 : (ceilY + hook) / 2}
                    side={1}
                    gap={0}
                    text={lampDown ? S.on.floor : S.on.cord}
                    bg="#0f172a"
                    fs={fs - 1}
                    box={box}
                  />
                )}
              </g>
            )}

            {/* grid scale */}
            <g aria-hidden="true">
              <text x={W - 10} y={H - 10} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#64748b">
                {S.cell(fmt(cellN, 0, dec))}
              </text>
            </g>
          </>
        );
      }}
    </LabScene>
  );
}

