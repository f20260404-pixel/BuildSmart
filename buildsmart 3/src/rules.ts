// Building rules as data. Each value carries the rule it comes from and how well it has been checked.
// 'official'  = read from the regulation text itself;  'secondary' = from guides or matching rules of other authorities, not the regulation text;
// 'unverified' = a working default to be replaced;       'yours'     = a value the user typed in.
export type Basis = 'official' | 'secondary' | 'unverified' | 'yours';
export interface RuleDef { key: string; label: string; value: number; unit: string; clause: string; basis: Basis }
export interface RulePack { id: string; name: string; authority: string; note: string; rules: RuleDef[] }
export const BASIS_TEXT: Record<Basis, string> = { official: 'From the regulation text', secondary: 'From a guide, check the text', unverified: 'Working default, not checked', yours: 'Entered by you' };

const nbc: RuleDef[] = [
  { key: 'habArea', label: 'Largest habitable room: minimum area', value: 9.5, unit: 'm²', clause: 'NBC 2016 Part 3, habitable rooms', basis: 'secondary' },
  { key: 'habWidth', label: 'Largest habitable room: minimum width', value: 2.4, unit: 'm', clause: 'NBC 2016 Part 3, habitable rooms', basis: 'secondary' },
  { key: 'habArea2', label: 'Other habitable rooms: minimum area', value: 7.5, unit: 'm²', clause: 'NBC 2016 Part 3, habitable rooms', basis: 'secondary' },
  { key: 'habWidth2', label: 'Other habitable rooms: minimum width', value: 2.1, unit: 'm', clause: 'NBC 2016 Part 3, habitable rooms', basis: 'secondary' },
  { key: 'kitArea', label: 'Kitchen: minimum area', value: 5.0, unit: 'm²', clause: 'NBC 2016 Part 3, kitchens', basis: 'secondary' },
  { key: 'kitWidth', label: 'Kitchen: minimum width', value: 1.8, unit: 'm', clause: 'NBC 2016 Part 3, kitchens', basis: 'secondary' },
  { key: 'bathArea', label: 'Bathroom: minimum area', value: 1.8, unit: 'm²', clause: 'NBC 2016 Part 3, bathrooms', basis: 'secondary' },
  { key: 'bathWidth', label: 'Bathroom: minimum width', value: 1.2, unit: 'm', clause: 'NBC 2016 Part 3, bathrooms', basis: 'secondary' },
  { key: 'clearHeight', label: 'Habitable room: minimum clear height', value: 2.75, unit: 'm', clause: 'NBC 2016 Part 3, height of rooms', basis: 'secondary' },
  { key: 'maxClearHeight', label: 'Habitable room: height above which extra area is counted', value: 0, unit: 'm', clause: 'Not used outside Mumbai', basis: 'unverified' },
  { key: 'corridorWidth', label: 'Passage: minimum width', value: 1.0, unit: 'm', clause: 'NBC 2016 Part 4, exit widths', basis: 'unverified' },
  { key: 'highRise', label: 'Height from which a building is treated as high-rise', value: 15, unit: 'm', clause: 'NBC 2016 Part 4, definitions', basis: 'unverified' },
  { key: 'sbFront', label: 'Front open space', value: 3.0, unit: 'm', clause: 'Local development control rules', basis: 'unverified' },
  { key: 'sbSide', label: 'Side open space', value: 1.5, unit: 'm', clause: 'Local development control rules', basis: 'unverified' },
  { key: 'sbRear', label: 'Rear open space', value: 1.5, unit: 'm', clause: 'Local development control rules', basis: 'unverified' },
];
const over = (base: RuleDef[], ch: Partial<RuleDef>[]): RuleDef[] => base.map(r => { const c = ch.find(x => x.key === r.key); return c ? { ...r, ...c } as RuleDef : r; });
export const PACKS: Record<string, RulePack> = {
  nbc: { id: 'nbc', name: 'National Building Code 2016', authority: 'National fallback', note: 'Used where no city pack exists. Local rules override the code, so enter your authority\'s FSI, coverage and open spaces on this page.', rules: nbc },
  mumbai: {
    id: 'mumbai', name: 'Mumbai DCPR 2034', authority: 'Municipal Corporation of Greater Mumbai', note: 'FSI comes from Regulation 30, Table 12 of DCPR 2034. Open spaces under Regulation 41 depend on building height and plot size, so the three open-space values are working defaults to replace with your architect\'s figures.',
    rules: over(nbc, [
      { key: 'clearHeight', clause: 'DCPR 2034 Regulation 37(2)', basis: 'secondary' },
      { key: 'maxClearHeight', value: 4.2, clause: 'DCPR 2034 Regulation 37(2)', basis: 'secondary' },
      { key: 'highRise', value: 32, clause: 'DCPR 2034 Regulation 2, definition of high-rise building', basis: 'secondary' },
      { key: 'habArea', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' }, { key: 'habWidth', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' },
      { key: 'habArea2', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' }, { key: 'habWidth2', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' },
      { key: 'kitArea', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' }, { key: 'kitWidth', clause: 'DCPR 2034 Regulation 37, Table 14 (code value shown)', basis: 'unverified' },
      { key: 'bathArea', clause: 'DCPR 2034 Regulation 37 (code value shown)', basis: 'unverified' }, { key: 'bathWidth', clause: 'DCPR 2034 Regulation 37 (code value shown)', basis: 'unverified' },
      { key: 'sbFront', clause: 'DCPR 2034 Regulation 41', basis: 'unverified' }, { key: 'sbSide', clause: 'DCPR 2034 Regulation 41', basis: 'unverified' }, { key: 'sbRear', clause: 'DCPR 2034 Regulation 41', basis: 'unverified' },
    ]),
  },
};
export const packFor = (city: string): RulePack => (city === 'Mumbai' ? PACKS.mumbai : PACKS.nbc);
export function resolve(city: string, overrides: Record<string, number> | undefined): { v: Record<string, number>; def: Record<string, RuleDef>; pack: RulePack } {
  const pack = packFor(city); const v: Record<string, number> = {}; const def: Record<string, RuleDef> = {};
  pack.rules.forEach(r => { const o = overrides ? overrides[r.key] : undefined; const used = typeof o === 'number' && isFinite(o) && Math.abs(o - r.value) > 1e-9; v[r.key] = used ? o! : r.value; def[r.key] = used ? { ...r, value: o!, basis: 'yours' } : r; });
  return { v, def, pack };
}

// DCPR 2034, Regulation 30(A)(1), Table 12: FSI in residential and commercial zones by road width.
export interface FsiRow { from: number; to: number; basic: number; premium: number; tdr: number; max: number }
export const MUMBAI_FSI: Record<'island' | 'suburbs', FsiRow[]> = {
  island: [{ from: 0, to: 9, basic: 1.33, premium: 0, tdr: 0, max: 1.33 }, { from: 9, to: 12, basic: 1.33, premium: 0.5, tdr: 0.17, max: 2.0 }, { from: 12, to: 18, basic: 1.33, premium: 0.62, tdr: 0.45, max: 2.4 }, { from: 18, to: 27, basic: 1.33, premium: 0.73, tdr: 0.64, max: 2.7 }, { from: 27, to: 1e9, basic: 1.33, premium: 0.84, tdr: 0.83, max: 3.0 }],
  suburbs: [{ from: 0, to: 9, basic: 1.0, premium: 0, tdr: 0, max: 1.0 }, { from: 9, to: 12, basic: 1.0, premium: 0.5, tdr: 0.5, max: 2.0 }, { from: 12, to: 18, basic: 1.0, premium: 0.5, tdr: 0.7, max: 2.2 }, { from: 18, to: 27, basic: 1.0, premium: 0.5, tdr: 0.9, max: 2.4 }, { from: 27, to: 1e9, basic: 1.0, premium: 0.5, tdr: 1.0, max: 2.5 }],
};
export const FSI_CLAUSE = 'DCPR 2034 Regulation 30(A)(1), Table 12';
export const mumbaiFsi = (area: 'island' | 'suburbs', road: number): FsiRow => MUMBAI_FSI[area].find(r => road >= r.from && road < r.to) || MUMBAI_FSI[area][0];
