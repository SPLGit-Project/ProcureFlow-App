import { createClient } from "@supabase/supabase-js"
import { Client } from "mysql"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch active site configs
    const { data: sites, error: siteError } = await supabase
      .from('bundle_connect_site_config')
      .select('*, sites(name)')
      .eq('is_active', true)

    if (siteError) throw siteError

    const results = []

    for (const siteConfig of sites) {
      console.log(`Processing site: ${siteConfig.sites.name}`)
      
      const mysqlClient = await new Client().connect({
        hostname: siteConfig.host,
        port: siteConfig.port,
        username: Deno.env.get(`BC_USER_${siteConfig.sites.name}`) ?? Deno.env.get('BC_USER_GLOBAL'),
        password: Deno.env.get(`BC_PASS_${siteConfig.sites.name}`) ?? Deno.env.get('BC_PASS_GLOBAL'),
        db: siteConfig.db_name,
      })

      try {
        // 2. Determine time range (Previous Month for Short Supply reporting)
        const now = new Date()
        const periodMonth = now.getMonth() // 0-based
        const periodYear = now.getFullYear()
        
        // Adjust to previous month if today is early in the month? 
        // For now, let's use the current month for "live" tracking.

        // 3. Extract Ordered Qty from corders
        // Based on forensic schema: stk_key, order_date, ordered
        const ordersQuery = `
          SELECT stk_key, SUM(ordered) as total_ordered
          FROM corders
          WHERE MONTH(order_date) = ${periodMonth + 1}
          AND YEAR(order_date) = ${periodYear}
          GROUP BY stk_key
        `
        const orders = await mysqlClient.query(ordersQuery)

        if (orders.length === 0) {
          console.warn(`No orders found in corders for site ${siteConfig.sites.name} in ${periodMonth + 1}/${periodYear}`)
        }

        // 4. Extract Despatched Qty from rfidtrans
        // Applying the forensic filters: trans_type 1=Soil, 2=Despatch
        // Excluding Type 8 (System) and ADL types 6, D (where applicable)
        const despatchQuery = `
          SELECT stk_key, COUNT(rfid_no) as despatch_qty
          FROM rfidtrans
          WHERE trans_type = '2'
          AND MONTH(trans_date) = ${periodMonth + 1}
          AND YEAR(trans_date) = ${periodYear}
          GROUP BY stk_key
        `
        const despatches = await mysqlClient.query(despatchQuery)

        // 5. STAR Calculation (Customer Turnaround)
        // Measures time from Despatch (2) to the NEXT Soil-In (1) return
        const starQuery = `
          SELECT t1.stk_key, AVG(TIMESTAMPDIFF(HOUR, t1.trans_date, (
            SELECT MIN(t2.trans_date) 
            FROM rfidtrans t2 
            WHERE t2.rfid_no = t1.rfid_no 
            AND t2.trans_type = '1' 
            AND t2.trans_date > t1.trans_date
          ))) / 24 as avg_star_days
          FROM rfidtrans t1
          WHERE t1.trans_type = '2'
          AND t1.trans_date > DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY t1.stk_key
        `
        const starMetrics = await mysqlClient.query(starQuery)

        // 6. Map and Upsert to Supabase
        // We join with bundle_connect_item_map to get master_item_id
        for (const order of orders) {
          const { data: itemMap } = await supabase
            .from('bundle_connect_item_map')
            .select('master_item_id')
            .eq('site_id', siteConfig.site_id)
            .eq('bc_stk_key', order.stk_key)
            .single()

          if (!itemMap) {
            console.debug(`No mapping found for site ${siteConfig.site_id}, stk_key ${order.stk_key}`)
            continue
          }

          const despatchRow = despatches.find((d: { stk_key: string, despatch_qty: number }) => d.stk_key === order.stk_key)
          const starRow = starMetrics.find((s: { stk_key: string, avg_star_days: number }) => s.stk_key === order.stk_key)

          const ordered = order.total_ordered || 0
          const short = Math.max(0, ordered - (despatchRow?.despatch_qty || 0))

          // Upsert Fact
          await supabase.from('short_supply_facts').upsert({
            site_id: siteConfig.site_id,
            master_item_id: itemMap.master_item_id,
            period_month: periodMonth + 1,
            period_year: periodYear,
            ordered_qty: ordered,
            short_qty: short,
            fill_percentage: ordered > 0 ? ((ordered - short) / ordered) * 100 : 100
          })

          // Update Metrics
          if (starRow) {
            await supabase.from('item_operational_metrics').upsert({
              site_id: siteConfig.site_id,
              master_item_id: itemMap.master_item_id,
              star_days: Math.round(starRow.avg_star_days)
            }, { onConflict: 'master_item_id,site_id' })
          }
        }

        results.push({ site: siteConfig.sites.name, status: 'success' })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing ${siteConfig.sites.name}:`, err)
        results.push({ site: siteConfig.sites.name, status: 'error', message: errorMsg })
      } finally {
        await mysqlClient.close()
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
