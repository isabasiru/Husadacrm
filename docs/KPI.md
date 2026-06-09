# Agent Response Time KPI

This document details the architecture and mathematical logic used to calculate and visualize the agent response speed metrics in the Husada CRM.

## KPI Metric definition

Agent response speed is defined as the duration between the **last inbound message from a lead** and the **subsequent reply from an agent** inside the same conversation.
Only outbound messages sent by active human agents are considered. Automated system follow-ups or inbound-only conversations are excluded.

## Database Query Structure

The calculation uses a **Lateral Join** (`CROSS JOIN LATERAL` in PostgreSQL) to correlate each outbound reply message with the immediately preceding inbound message in that conversation.

### SQL Query

```sql
SELECT 
  m.sent_by_id AS "agentId",
  u.full_name AS "agentName",
  AVG(EXTRACT(EPOCH FROM (m.sent_at - prev.sent_at)))::double precision AS "avgResponseSeconds",
  COUNT(m.id)::integer AS "replyCount"
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
  AND m.sent_at >= :startDate
  AND m.sent_at <= :endDate
GROUP BY m.sent_by_id, u.full_name
ORDER BY "avgResponseSeconds" ASC;
```

### Explanation:
1. **Outer Query**: Scans all messages `m` where the message direction is `OUTBOUND` and an agent (`sent_by_id`) is attached.
2. **`CROSS JOIN LATERAL`**: For each outbound message, it executes a correlated subquery to find the most recent `INBOUND` message (`prev`) sent *before* `m.sent_at` in the same conversation.
3. **`AVG(EXTRACT(EPOCH FROM ...))`**: Computes the difference between the outbound timestamp and the preceding inbound timestamp in seconds, then calculates the average.
4. **Prisma Typecast**: The columns are cast to `double precision` and `integer` to prevent BigInt serialization failures in Javascript, allowing Next.js to return metrics directly.

## Formatting Visualizations

* The average response time is formatted into human-readable Indonesian strings:
  * `< 60 seconds`: `X detik`
  * `1 to 59 minutes`: `X menit`
  * `1 to 23 hours`: `X jam Y menit`
  * `> 24 hours`: `X hari Y jam`
* Visual indicators categorize agents:
  * **Sangat Cepat** (Very Fast): Average response time $\le$ 5 minutes.
  * **Sedang** (Average): Average response time between 5 and 15 minutes.
  * **Lambat** (Slow): Average response time $>$ 15 minutes.
