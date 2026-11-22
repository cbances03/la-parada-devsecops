import { describe, expect, it } from 'vitest';
import { merchantInput, merchantSearch, stallInput, assignmentInput, requirementInput, statusInput, dossierFilter } from '../lib/market';

const id = '11111111-1111-4111-8111-111111111111';

describe('market input and business vocabulary', () => {
  it('normalizes merchant data without coercing DNI into numbers', () => {
    expect(merchantInput({ dni: '01234567', name: '  Ana   Pérez  ', trade: ' Verduras ' })).toEqual({ dni: '01234567', name: 'Ana Pérez', trade: 'Verduras' });
  });
  it.each([
    null, [], {}, { dni: 12345678, name: 'Ana', trade: 'Frutas' },
    { dni: '1234567', name: 'Ana', trade: 'Frutas' },
    { dni: '12345678', name: '  ', trade: 'Frutas' },
    { dni: '12345678', name: 'a'.repeat(121), trade: 'Frutas' },
    { dni: '12345678', name: 'Ana', trade: 'x\u0000y' },
  ])('rejects invalid merchant data: %j', input => { expect(() => merchantInput(input)).toThrow(); });
  it('normalizes stall codes and rejects empty or unsafe codes', () => {
    expect(stallInput({ code: ' a-01 ', sector: ' Frutas ' })).toEqual({ code: 'A-01', sector: 'Frutas' });
    for (const code of ['', 'a'.repeat(21), '<script>', 'A/01']) expect(() => stallInput({ code, sector: 'Frutas' })).toThrow();
  });
  it('requires UUIDs for both sides of an assignment', () => {
    expect(assignmentInput({ merchantId: id, stallId: id })).toEqual({ merchantId: id, stallId: id });
    expect(() => assignmentInput({ merchantId: "' OR 1=1", stallId: id })).toThrow();
  });
  it('accepts only known requirements and real boolean values', () => {
    expect(requirementInput({ dossierId: id, code: 'identificacion', fulfilled: false }).fulfilled).toBe(false);
    expect(() => requirementInput({ dossierId: id, code: '__proto__', fulfilled: true })).toThrow();
    expect(() => requirementInput({ dossierId: id, code: 'identificacion', fulfilled: 'false' })).toThrow();
  });
  it('bounds the available states and pending filters', () => {
    expect(statusInput({ dossierId: id, status: 'completo' }).status).toBe('completo');
    expect(() => statusInput({ dossierId: id, status: 'aprobado_legalmente' })).toThrow();
    expect(dossierFilter(null)).toBe('todos');
    expect(dossierFilter('pendientes')).toBe('pendientes');
    expect(() => dossierFilter('arbitrary')).toThrow();
    expect(merchantSearch(' Ana ')).toBe('Ana');
    expect(() => merchantSearch('a'.repeat(81))).toThrow();
  });
});
