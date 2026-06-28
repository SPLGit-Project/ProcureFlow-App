import sql from 'mssql'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types matching azureDbService.ts interfaces ───────────────────────────────

interface AzureDbConfig {
  host: string
  port: number
  database: string
  connected: boolean
}

// ── Site-specific RFID transaction filter rules ───────────────────────────────
// Mirrors bundleConnectSyncService.getSiteQueryRules()

type SiteQueryRule = {
  transTypeFilter: string
  despatchWeight: number
  excluded: boolean
}

function getSiteRule(siteCode: string): SiteQueryRule {
  switch (siteCode) {
    case 'ADL': return { transTypeFilter: "trans_type IN ('6','D')", despatchWeight: 1.0, excluded: false }
    case 'BNE': return { transTypeFilter: "trans_type = '8'",        despatchWeight: 0.55, excluded: false }
    case 'SYD': return { transTypeFilter: '',                        despatchWeight: 1.0,  excluded: true }
    default:    return { transTypeFilter: "trans_type = '2'",        despatchWeight: 1.0,  excluded: false }
  }
}

// ── Query handlers ────────────────────────────────────────────────────────────

async function handlePing(pool: sql.ConnectionPool): Promise<object[]> {
  const result = await pool.request().query('SELECT @@VERSION AS version')
  return result.recordset
}

async function handleShortSupply(
  pool: sql.ConnectionPool,
  sites: string[]
): Promise<object[]> {
  const activeSites = sites.filter(s => !getSiteRule(s).excluded)
  if (activeSites.length === 0) return []

  const rows: object[] = []

  for (const siteCode of activeSites) {
    const rule = getSiteRule(siteCode)
    const despatchFilter = rule.transTypeFilter
    const weight = rule.despatchWeight

    // T-SQL: join corders + stock + rfidtrans for current calendar month.
    // BNE hire items (type 8) are weighted at 55% of despatch count.
    const query = `
      SELECT
        c.stk_key                                          AS stkKey,
        MAX(s.description)                                 AS description,
        SUM(c.ordered)                                     AS ordQty,
        CASE
          WHEN SUM(c.ordered) - CAST(COUNT(r.rfid_no) * ${weight} AS INT) > 0
          THEN SUM(c.ordered) - CAST(COUNT(r.rfid_no) * ${weight} AS INT)
          ELSE 0
        END                                                AS shortQty,
        MAX(s.launderChg)                                  AS launderChg,
        MAX(s.hireChg)                                     AS hireChg,
        MAX(s.weight)                                      AS weight,
        AVG(
          CAST(DATEDIFF(day, r.trans_date, soil.trans_date) AS FLOAT)
        )                                                  AS starDays,
        ISNULL(MAX(CASE WHEN al.stk_key IS NOT NULL THEN 1 END), 0) AS hasSuggestedBuy
      FROM corders c
      LEFT JOIN stock s
        ON s.stk_key = c.stk_key
        AND s.site_code = @siteCode
      LEFT JOIN rfidtrans r
        ON r.stk_key = c.stk_key
        AND r.site_code = @siteCode
        AND ${despatchFilter}
        AND MONTH(r.trans_date) = MONTH(GETDATE())
        AND YEAR(r.trans_date)  = YEAR(GETDATE())
      LEFT JOIN rfidtrans soil
        ON soil.rfid_no    = r.rfid_no
        AND soil.trans_type = '1'
        AND soil.trans_date > r.trans_date
        AND soil.trans_date = (
          SELECT MIN(s2.trans_date)
          FROM rfidtrans s2
          WHERE s2.rfid_no    = r.rfid_no
            AND s2.trans_type = '1'
            AND s2.trans_date > r.trans_date
        )
      LEFT JOIN autoreturn_log al
        ON al.stk_key   = c.stk_key
        AND al.site_code = @siteCode
      WHERE c.site_code = @siteCode
        AND MONTH(c.order_date) = MONTH(GETDATE())
        AND YEAR(c.order_date)  = YEAR(GETDATE())
      GROUP BY c.stk_key
      HAVING
        CASE
          WHEN SUM(c.ordered) - CAST(COUNT(r.rfid_no) * ${weight} AS INT) > 0
          THEN SUM(c.ordered) - CAST(COUNT(r.rfid_no) * ${weight} AS INT)
          ELSE 0
        END > 0
    `

    const result = await pool.request()
      .input('siteCode', sql.NVarChar, siteCode)
      .query(query)

    for (const row of result.recordset) {
      rows.push({
        siteCode,
        stkKey:       row.stkKey,
        description:  row.description ?? '',
        ordQty:       Number(row.ordQty ?? 0),
        shortQty:     Number(row.shortQty ?? 0),
        launderChg:   Number(row.launderChg ?? 0),
        hireChg:      Number(row.hireChg ?? 0),
        weight:       Number(row.weight ?? 0),
        starDays:     row.starDays != null ? Number(row.starDays) : undefined,
        suggestedBuy: Number(row.hasSuggestedBuy ?? 0),
      })
    }
  }

  return rows
}

async function handleStarMetrics(
  pool: sql.ConnectionPool,
  sites: string[]
): Promise<object[]> {
  const activeSites = sites.filter(s => !getSiteRule(s).excluded)
  if (activeSites.length === 0) return []

  const rows: object[] = []

  for (const siteCode of activeSites) {
    const rule = getSiteRule(siteCode)
    const despatchFilter = rule.transTypeFilter

    // Average days from despatch to next soil-in, last 30 days of data.
    const query = `
      SELECT
        t1.stk_key                               AS stkKey,
        AVG(
          CAST(DATEDIFF(day, t1.trans_date, (
            SELECT MIN(t2.trans_date)
            FROM rfidtrans t2
            WHERE t2.rfid_no    = t1.rfid_no
              AND t2.trans_type = '1'
              AND t2.trans_date > t1.trans_date
          )) AS FLOAT)
        )                                        AS starDays,
        COUNT(t1.rfid_no)                        AS sampleCount
      FROM rfidtrans t1
      WHERE t1.site_code = @siteCode
        AND ${despatchFilter}
        AND t1.trans_date > DATEADD(day, -30, GETDATE())
      GROUP BY t1.stk_key
    `

    const result = await pool.request()
      .input('siteCode', sql.NVarChar, siteCode)
      .query(query)

    for (const row of result.recordset) {
      rows.push({
        siteCode,
        stkKey:      row.stkKey,
        starDays:    Number(row.starDays ?? 0),
        sampleCount: Number(row.sampleCount ?? 0),
      })
    }
  }

  return rows
}

async function handleCorders(
  pool: sql.ConnectionPool,
  siteCode: string,
  since?: string
): Promise<object[]> {
  const request = pool.request().input('siteCode', sql.NVarChar, siteCode)
  let where = 'WHERE site_code = @siteCode'
  if (since) {
    request.input('since', sql.Date, new Date(since))
    where += ' AND order_date >= @since'
  }

  const result = await request.query(`
    SELECT stk_key AS stkKey, ordered AS ordQty, order_date AS ordDate,
           short AS shortQty, record_number AS recordNumber
    FROM corders
    ${where}
    ORDER BY order_date DESC
  `)
  return result.recordset.map(r => ({
    siteCode,
    stkKey:       r.stkKey,
    ordQty:       Number(r.ordQty ?? 0),
    ordDate:      r.ordDate,
    shortQty:     Number(r.shortQty ?? 0),
    recordNumber: Number(r.recordNumber ?? 0),
  }))
}

async function handleStock(
  pool: sql.ConnectionPool,
  siteCode: string,
  stkKeys?: string[]
): Promise<object[]> {
  const request = pool.request().input('siteCode', sql.NVarChar, siteCode)
  let where = 'WHERE site_code = @siteCode'

  if (stkKeys && stkKeys.length > 0) {
    const placeholders = stkKeys.map((_, i) => `@k${i}`).join(',')
    stkKeys.forEach((k, i) => request.input(`k${i}`, sql.NVarChar, k))
    where += ` AND stk_key IN (${placeholders})`
  }

  const result = await request.query(`
    SELECT stk_key AS stkKey, description, launderChg, hireChg,
           weight, record_number AS recordNumber
    FROM stock
    ${where}
  `)
  return result.recordset.map(r => ({
    siteCode,
    stkKey:       r.stkKey,
    description:  r.description ?? '',
    launderChg:   Number(r.launderChg ?? 0),
    hireChg:      Number(r.hireChg ?? 0),
    weight:       Number(r.weight ?? 0),
    recordNumber: Number(r.recordNumber ?? 0),
  }))
}

async function handleAutoreturn(
  pool: sql.ConnectionPool,
  siteCode: string,
  since?: string
): Promise<object[]> {
  const request = pool.request().input('siteCode', sql.NVarChar, siteCode)
  let where = 'WHERE site_code = @siteCode'
  if (since) {
    request.input('since', sql.Date, new Date(since))
    where += ' AND return_date >= @since'
  }

  const result = await request.query(`
    SELECT stk_key AS stkKey, return_qty AS returnQty,
           return_date AS returnDate, record_number AS recordNumber
    FROM autoreturn_log
    ${where}
    ORDER BY return_date DESC
  `)
  return result.recordset.map(r => ({
    siteCode,
    stkKey:       r.stkKey,
    returnQty:    Number(r.returnQty ?? 0),
    returnDate:   r.returnDate,
    recordNumber: Number(r.recordNumber ?? 0),
  }))
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth: validate Supabase JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Load Azure DB config from app_config ─────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configRow, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'azure_db_config')
      .maybeSingle()

    if (configError || !configRow?.value) {
      return new Response(JSON.stringify({ error: 'Azure DB config not found' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const config = configRow.value as AzureDbConfig
    if (!config.host || !config.database) {
      return new Response(JSON.stringify({ error: 'Azure DB config incomplete — set host and database' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Parse request body ───────────────────────────────────────────────────
    const { queryType, params } = await req.json() as {
      queryType: string
      params: Record<string, unknown>
    }

    // ── Open MSSQL connection pool (Azure AD service principal auth) ─────────
    const pool = await sql.connect({
      server:   config.host,
      port:     config.port || 1433,
      database: config.database,
      authentication: {
        type: 'azure-active-directory-service-principal-secret',
        options: {
          clientId:     Deno.env.get('AZURE_CLIENT_ID') ?? '',
          clientSecret: Deno.env.get('AZURE_CLIENT_SECRET') ?? '',
          tenantId:     Deno.env.get('AZURE_TENANT_ID') ?? '',
        },
      },
      options: {
        encrypt:                true,
        trustServerCertificate: false,
        connectTimeout:         15000,
        requestTimeout:         30000,
      },
    })

    try {
      let rows: object[] = []

      switch (queryType) {
        case 'PING':
          rows = await handlePing(pool)
          break

        case 'SHORT_SUPPLY': {
          const sites = (params.sites as string[]) ?? []
          rows = await handleShortSupply(pool, sites)
          break
        }

        case 'STAR_METRICS': {
          const sites = (params.sites as string[]) ?? []
          rows = await handleStarMetrics(pool, sites)
          break
        }

        case 'CORDERS':
          rows = await handleCorders(
            pool,
            params.siteCode as string,
            params.since as string | undefined
          )
          break

        case 'STOCK':
          rows = await handleStock(
            pool,
            params.siteCode as string,
            params.stkKeys as string[] | undefined
          )
          break

        case 'AUTORETURN':
          rows = await handleAutoreturn(
            pool,
            params.siteCode as string,
            params.since as string | undefined
          )
          break

        default:
          return new Response(JSON.stringify({ error: `Unknown queryType: ${queryType}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
      }

      return new Response(JSON.stringify({ rows }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } finally {
      await pool.close()
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[azure-db-proxy] error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
