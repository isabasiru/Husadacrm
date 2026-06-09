const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRaw`
    SELECT 
      m.sent_by_id AS agent_id,
      u.full_name AS agent_name,
      AVG(EXTRACT(EPOCH FROM (m.sent_at - prev.sent_at))) AS avg_response_seconds,
      COUNT(m.id) AS reply_count
    FROM messages m
    JOIN users u ON m.sent_by_id = u.id
    CROSS JOIN LATERAL (
      SELECT sent_at 
      FROM messages 
      WHERE conversation_id = m.conversation_id 
        AND direction = 'INBOUND' 
        AND sent_at < m.sent_at
      ORDER BY sent_at DESC
      LIMIT 1
    ) prev
    WHERE m.direction = 'OUTBOUND' 
      AND m.sent_by_id IS NOT NULL
    GROUP BY m.sent_by_id, u.full_name
  `;
  const serialized = JSON.stringify(result, (key, value) => 
    typeof value === 'bigint' ? Number(value) : value
  , 2);
  console.log(serialized);
}

main().catch(console.error).finally(() => pool.end());
