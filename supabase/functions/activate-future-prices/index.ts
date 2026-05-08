import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date().toISOString().split('T')[0]
    let activated = 0
    let errors: string[] = []

    console.log(`Checking for future prices to activate for date: ${today}`)

    // Find APPROVED_FUTURE prices whose effective_from has arrived
    const { data: futurePrices, error: fetchError } = await supabase
      .from('item_sell_prices')
      .select('*')
      .eq('status', 'APPROVED_FUTURE')
      .lte('effective_from', today)

    if (fetchError) {
      console.error("Error fetching future prices:", fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Found ${futurePrices?.length || 0} future prices to process.`)

    for (const futurePrice of (futurePrices ?? [])) {
      try {
        // Find the current ACTIVE price for the same item/type/customer/uom combo
        let query = supabase
          .from('item_sell_prices')
          .select('id')
          .eq('item_id', futurePrice.item_id)
          .eq('price_type', futurePrice.price_type)
          .eq('sale_uom', futurePrice.sale_uom)
          .eq('status', 'ACTIVE')

        // Handle nullable scope fields correctly
        if (futurePrice.customer_id === null) query = query.is('customer_id', null)
        else query = query.eq('customer_id', futurePrice.customer_id)

        if (futurePrice.customer_group_id === null) query = query.is('customer_group_id', null)
        else query = query.eq('customer_group_id', futurePrice.customer_group_id)

        if (futurePrice.contract_id === null) query = query.is('contract_id', null)
        else query = query.eq('contract_id', futurePrice.contract_id)

        const { data: currentPrices, error: currentPricesError } = await query
        
        if (currentPricesError) throw currentPricesError

        // Supersede the outgoing current price(s)
        if (currentPrices && currentPrices.length > 0) {
          const outgoingIds = currentPrices.map(p => p.id)

          // Use direct DB update via service role (bypasses RLS)
          // Service role can transition ACTIVE → SUPERSEDED
          for (const outgoingId of outgoingIds) {
            const { error: supersedeError } = await supabase.from('item_sell_prices').update({
              status: 'SUPERSEDED',
              effective_to: new Date(
                new Date(futurePrice.effective_from).getTime() - 86400000
              ).toISOString().split('T')[0],
              superseded_by: futurePrice.id,
            }).eq('id', outgoingId)

            if (supersedeError) throw supersedeError
          }
        }

        // Activate the future price
        const { error: activateError } = await supabase.from('item_sell_prices')
          .update({ status: 'ACTIVE' })
          .eq('id', futurePrice.id)

        if (activateError) throw activateError

        // Create PriceVersionActivated publication events
        const { data: item } = await supabase
          .from('items')
          .select('id, sku')
          .eq('id', futurePrice.item_id)
          .single()

        const targets = []
        if (futurePrice.publish_to_bundle) targets.push('BUNDLE')
        if (futurePrice.publish_to_linenhub) targets.push('LINENHUB')
        if (futurePrice.publish_to_salesforce) targets.push('SALESFORCE')

        if (targets.length > 0) {
          const { error: pubError } = await supabase.from('item_publication_events').insert(
            targets.map(target => ({
              correlation_id: futurePrice.item_id,
              item_id: futurePrice.item_id,
              price_record_id: futurePrice.id,
              target_system: target,
              event_type: 'PriceVersionActivated',
              payload: {
                item_id: futurePrice.item_id,
                sku: item?.sku,
                price_record_id: futurePrice.id,
                new_price: futurePrice.sell_price_ex_gst,
                price_type: futurePrice.price_type,
                effective_from: futurePrice.effective_from,
                activated_at: new Date().toISOString(),
              },
              status: 'QUEUED',
            }))
          )
          if (pubError) throw pubError
        }

        activated++
      } catch (err: any) {
        console.error(`Error processing price ${futurePrice.id}:`, err.message)
        errors.push(`Price ${futurePrice.id}: ${err.message}`)
      }
    }

    console.log(`activate-future-prices: activated=${activated}, errors=${errors.length}`)

    return new Response(
      JSON.stringify({ activated, errors, run_date: today }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err: any) {
    console.error("Fatal error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
