import { MarketError } from './market-errors.mjs';

export const requirementLabels = {
  identificacion: 'Identificación registrada',
  declaracion_actividad: 'Declaración de actividad registrada',
  revision_sanitaria: 'Revisión sanitaria registrada',
} as const;
export type RequirementCode = keyof typeof requirementLabels;
export const statuses = ['pendiente', 'en_revision', 'completo'] as const;
export type Status = typeof statuses[number];
export type DossierFilter = Status | 'todos' | 'pendientes';
export const statusLabels: Record<Status, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', completo: 'Completo' };
export type Merchant = { id: string; dni: string; name: string; trade: string; stall_code: string | null };
export type Stall = { id: string; code: string; sector: string; merchant_id: string | null; merchant_name: string | null };
export type Dossier = { id: string; merchant_id: string; name: string; dni: string; status: Status; requirements: { code: RequirementCode; fulfilled: boolean }[] };
export type Indicators = { total: number; pendiente: number; en_revision: number; completo: number; pendientes: number };

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MarketError(400, 'Datos inválidos.');
  return input as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new MarketError(400, `${label} inválido.`);
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > max) throw new MarketError(400, `${label}: entre 2 y ${max} caracteres.`);
  return clean;
}
export function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new MarketError(400, 'Identificador inválido.');
  return value;
}
export function merchantInput(input: unknown) {
  const data = object(input);
  if (typeof data.dni !== 'string' || !/^\d{8}$/.test(data.dni.trim())) throw new MarketError(400, 'El DNI debe tener ocho dígitos.');
  return { dni: data.dni.trim(), name: text(data.name, 'Nombre', 120), trade: text(data.trade, 'Rubro', 80) };
}
export function stallInput(input: unknown) {
  const data = object(input);
  const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9][A-Z0-9 -]{0,19}$/.test(code)) throw new MarketError(400, 'Código de puesto inválido (máximo 20 caracteres).');
  return { code, sector: text(data.sector, 'Sector', 80) };
}
export function assignmentInput(input: unknown) {
  const data = object(input);
  return { merchantId: uuid(data.merchantId), stallId: uuid(data.stallId) };
}
export function requirementInput(input: unknown) {
  const data = object(input);
  if (typeof data.code !== 'string' || !Object.hasOwn(requirementLabels, data.code) || typeof data.fulfilled !== 'boolean') throw new MarketError(400, 'Requisito inválido.');
  return { dossierId: uuid(data.dossierId), code: data.code as RequirementCode, fulfilled: data.fulfilled };
}
export function statusInput(input: unknown) {
  const data = object(input);
  if (!statuses.includes(data.status as Status)) throw new MarketError(400, 'Estado inválido.');
  return { dossierId: uuid(data.dossierId), status: data.status as Status };
}
export function dossierFilter(value: string | null): DossierFilter {
  const filter = value ?? 'todos';
  if (!['todos', 'pendientes', ...statuses].includes(filter)) throw new MarketError(400, 'Filtro de estado inválido.');
  return filter as DossierFilter;
}
export function merchantSearch(value: string | null) {
  const query = value?.trim() ?? '';
  if (query.length > 80) throw new MarketError(400, 'Búsqueda demasiado larga.');
  return query;
}

export interface MarketStore {
  listMerchants(search: string): Promise<Merchant[]>;
  createMerchant(input: ReturnType<typeof merchantInput>): Promise<unknown>;
  listStalls(): Promise<Stall[]>;
  createStall(input: ReturnType<typeof stallInput>): Promise<unknown>;
  assignStall(input: ReturnType<typeof assignmentInput>): Promise<unknown>;
  listDossiers(filter: DossierFilter): Promise<Dossier[]>;
  updateRequirement(input: ReturnType<typeof requirementInput>): Promise<unknown>;
  updateStatus(input: ReturnType<typeof statusInput>): Promise<unknown>;
  indicators(): Promise<Indicators>;
}
