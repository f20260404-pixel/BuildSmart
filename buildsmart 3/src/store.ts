// Projects and saved versions, kept in this browser. Falls back to memory when storage is unavailable.
import * as E from './engine';
import type { Model } from './engine';

export interface ProjMeta { id: string; name: string; updated: string }
export interface Version { id: string; name: string; date: string; model: Model }
const IDX = 'buildsmart-projects', CUR = 'buildsmart-current', OLD = 'buildsmart-demo-v2';
const mem: Record<string, string> = {};
const get = (k: string): any => { try { const s = localStorage.getItem(k); if (s) return JSON.parse(s); } catch { } try { return mem[k] ? JSON.parse(mem[k]) : null; } catch { return null; } };
const set = (k: string, v: any) => { const s = JSON.stringify(v); mem[k] = s; try { localStorage.setItem(k, s); } catch { } };
const del = (k: string) => { delete mem[k]; try { localStorage.removeItem(k); } catch { } };
export const validModel = (m: any): m is Model => !!(m && Array.isArray(m.walls) && Array.isArray(m.openings) && m.site && m.labour && m.prices && m.settings && m.crew);
/** Fill in anything a model saved by an older build is missing. */
export function upgrade(m: Model): Model { const b = E.blankModel(); const x: any = { ...b, ...m }; (['settings', 'site', 'allow', 'crew', 'buffer', 'owner'] as const).forEach(k => { x[k] = { ...(b as any)[k], ...((m as any)[k] || {}) }; }); x.stock = m.stock || []; x.expenses = m.expenses || []; x.quotes = m.quotes || []; x.labels = m.labels || []; x.rules = m.rules || {}; return x; }

export const listProjects = (): ProjMeta[] => (get(IDX) || []) as ProjMeta[];
export function saveModel(id: string, m: Model, name?: string) {
  set('buildsmart-p-' + id, m); const idx = listProjects(); const i = idx.findIndex(p => p.id === id); const now = new Date().toISOString();
  if (i >= 0) { idx[i].updated = now; if (name !== undefined) idx[i].name = name; } else idx.push({ id, name: name || 'Untitled project', updated: now });
  set(IDX, idx);
}
export const loadModel = (id: string): Model | null => { const m = get('buildsmart-p-' + id); return validModel(m) ? upgrade(m) : null; };
export function createProject(name: string, m: Model): string { const id = E.uid('p'); saveModel(id, m, name); return id; }
export function renameProject(id: string, name: string) { const idx = listProjects(); const p = idx.find(x => x.id === id); if (p) { p.name = name; set(IDX, idx); } }
export function deleteProject(id: string) { set(IDX, listProjects().filter(p => p.id !== id)); del('buildsmart-p-' + id); del('buildsmart-v-' + id); }
export const setCurrent = (id: string) => set(CUR, id);
export function initStore(): { id: string; model: Model } {
  let idx = listProjects(); const cur = get(CUR);
  if (cur && idx.some(p => p.id === cur)) { const m = loadModel(cur); if (m) return { id: cur, model: m }; }
  for (const p of idx) { const m = loadModel(p.id); if (m) { setCurrent(p.id); return { id: p.id, model: m }; } }
  const old = get(OLD); const model = validModel(old) ? upgrade(old) : E.demoModel();
  const id = createProject('Sample building, Mumbai', model); setCurrent(id); return { id, model };
}
export const listVersions = (id: string): Version[] => (get('buildsmart-v-' + id) || []) as Version[];
export function saveVersion(id: string, name: string, m: Model): Version { const v: Version = { id: E.uid('v'), name, date: new Date().toISOString(), model: E.clone(m) }; const all = listVersions(id); all.unshift(v); set('buildsmart-v-' + id, all.slice(0, 30)); return v; }
export function deleteVersion(id: string, vid: string) { set('buildsmart-v-' + id, listVersions(id).filter(v => v.id !== vid)); }
