import { randomUUID } from 'node:crypto';
import { getAuthPool } from './auth-store.mjs';
import { MarketError } from './market-errors.mjs';

export function createMarketStore(getPool = getAuthPool) {
  async function transaction(action) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async function lockDossier(client, id) {
    const result = await client.query('SELECT id, status FROM dossiers WHERE id = $1 FOR UPDATE', [id]);
    if (!result.rows[0]) throw new MarketError(404, 'Expediente no encontrado.');
    return result.rows[0];
  }

  return {
    async listMerchants(search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      const result = await getPool().query(
        `SELECT m.id, m.dni, m.name, m.trade, s.code AS stall_code
           FROM merchants m LEFT JOIN stalls s ON s.merchant_id = m.id
          WHERE m.name ILIKE $1 OR m.dni ILIKE $1 ORDER BY m.name, m.id`, [pattern],
      );
      return result.rows;
    },
    async createMerchant({ dni, name, trade }) {
      return transaction(async client => {
        const id = randomUUID();
        const dossierId = randomUUID();
        const result = await client.query('INSERT INTO merchants (id, dni, name, trade) VALUES ($1, $2, $3, $4) RETURNING id, dni, name, trade', [id, dni, name, trade]);
        await client.query('INSERT INTO dossiers (id, merchant_id) VALUES ($1, $2)', [dossierId, id]);
        await client.query(
          `INSERT INTO dossier_requirements (dossier_id, code) VALUES
           ($1, 'identificacion'), ($1, 'declaracion_actividad'), ($1, 'revision_sanitaria')`, [dossierId],
        );
        return result.rows[0];
      });
    },
    async listStalls() {
      const result = await getPool().query(
        `SELECT s.id, s.code, s.sector, s.merchant_id, m.name AS merchant_name
           FROM stalls s LEFT JOIN merchants m ON m.id = s.merchant_id ORDER BY s.code`,
      );
      return result.rows;
    },
    async createStall({ code, sector }) {
      const result = await getPool().query('INSERT INTO stalls (id, code, sector) VALUES ($1, $2, $3) RETURNING id, code, sector', [randomUUID(), code, sector]);
      return result.rows[0];
    },
    async assignStall({ merchantId, stallId }) {
      // Atomic conditional write + UNIQUE merchant_id protects concurrent requests.
      const result = await getPool().query(
        'UPDATE stalls SET merchant_id = $1 WHERE id = $2 AND merchant_id IS NULL RETURNING id, code, merchant_id', [merchantId, stallId],
      );
      if (!result.rows[0]) throw new MarketError(409, 'El puesto no existe o ya está ocupado.');
      return result.rows[0];
    },
    async listDossiers(filter) {
      const result = await getPool().query(
        `SELECT d.id, d.merchant_id, d.status, m.name, m.dni,
                json_agg(json_build_object('code', r.code, 'fulfilled', r.fulfilled) ORDER BY r.code) AS requirements
           FROM dossiers d JOIN merchants m ON m.id = d.merchant_id
           JOIN dossier_requirements r ON r.dossier_id = d.id
          WHERE ($1 = 'todos' OR ($1 = 'pendientes' AND d.status <> 'completo') OR d.status = $1)
          GROUP BY d.id, m.name, m.dni ORDER BY m.name, d.id`, [filter],
      );
      return result.rows;
    },
    async updateRequirement({ dossierId, code, fulfilled }) {
      return transaction(async client => {
        const dossier = await lockDossier(client, dossierId);
        if (dossier.status === 'completo' && !fulfilled) throw new MarketError(409, 'Reabre el expediente antes de quitar un requisito.');
        const result = await client.query('UPDATE dossier_requirements SET fulfilled = $1 WHERE dossier_id = $2 AND code = $3 RETURNING code, fulfilled', [fulfilled, dossierId, code]);
        if (!result.rows[0]) throw new MarketError(404, 'Requisito no encontrado.');
        await client.query('UPDATE dossiers SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [dossierId]);
        return result.rows[0];
      });
    },
    async updateStatus({ dossierId, status }) {
      return transaction(async client => {
        await lockDossier(client, dossierId);
        if (status === 'completo') {
          const result = await client.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE fulfilled)::int AS fulfilled FROM dossier_requirements WHERE dossier_id = $1', [dossierId]);
          if (result.rows[0]?.total !== 3 || result.rows[0]?.fulfilled !== 3) throw new MarketError(409, 'Completa los tres requisitos antes de cerrar el expediente.');
        }
        const result = await client.query('UPDATE dossiers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status', [status, dossierId]);
        return result.rows[0];
      });
    },
    async indicators() {
      const result = await getPool().query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'pendiente')::int AS pendiente,
                count(*) FILTER (WHERE status = 'en_revision')::int AS en_revision,
                count(*) FILTER (WHERE status = 'completo')::int AS completo,
                count(*) FILTER (WHERE status <> 'completo')::int AS pendientes FROM dossiers`,
      );
      return result.rows[0];
    },
  };
}

export const marketStore = createMarketStore();
