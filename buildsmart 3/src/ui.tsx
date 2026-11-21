import React, { useEffect, useRef, useState } from 'react';
import * as E from './engine';

export function Num({ value, onChange, step = 1, min, max, w = 84, id }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; w?: number; id?: string }) {
  const [txt, setTxt] = useState(String(value)); const foc = useRef(false);
  useEffect(() => { if (!foc.current) setTxt(String(value)); }, [value]);
  return <input id={id} className="num" style={{ width: w }} type="number" step={step} min={min} max={max} value={txt}
    onFocus={() => { foc.current = true; }} onBlur={() => { foc.current = false; setTxt(String(value)); }}
    onChange={e => { setTxt(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onChange(v); }} />;
}
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <label className="field"><span className="flabel">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
export const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) => <span className={'pill ' + tone}>{children}</span>;
export const Delta = ({ v, unit, good = 'down' }: { v: number; unit: 'inr' | 'm2' | 'days'; good?: 'down' | 'up' }) => {
  if (Math.abs(v) < (unit === 'inr' ? 50 : 0.05)) return <span className="delta zero">no change</span>;
  const isGood = good === 'down' ? v < 0 : v > 0; const txt = unit === 'inr' ? E.inr(Math.abs(v)) : unit === 'm2' ? Math.abs(v).toFixed(1) + ' m²' : Math.abs(v) + ' days';
  return <span className={'delta ' + (isGood ? 'good' : 'bad')}>{v < 0 ? '−' : '+'}{txt.replace('−', '')}</span>;
};
export const qty = (v: number, unit = '') => E.num(v, Math.abs(v) < 100 && Math.abs(v) % 1 > 0.001 ? 1 : 0) + (unit ? ' ' + unit : '');
export type Ctx = { m: E.Model; update: (fn: (x: E.Model) => void) => void; replace: (m: E.Model) => void; est: E.Estimate; sched: ReturnType<typeof E.schedule>; flags: E.Flag[]; ideas: E.Suggestion[]; tender: ReturnType<typeof E.analyseQuotes>; pname: string };
