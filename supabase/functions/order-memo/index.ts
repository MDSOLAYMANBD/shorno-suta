import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('id')
    const orderNumber = url.searchParams.get('order_number')

    if (!orderId && !orderNumber) {
      return new Response(JSON.stringify({ error: 'Invalid order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch order (include id for order_items query, remove from response later)
    let orderQuery = supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, customer_address, city, subtotal, delivery_charge, total, free_shipping, discount_note, created_at, status, order_attribution, paid_amount, payment_status, payment_method, payment_invoice_id, paid_at')

    if (orderId) {
      orderQuery = orderQuery.eq('id', orderId)
    } else {
      orderQuery = orderQuery.eq('order_number', orderNumber)
    }

    const { data: order, error: orderError } = await orderQuery.single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch order items with product data for images and pricing
    const { data: rawItems } = await supabase
      .from('order_items')
      .select('id, product_name, quantity, price, size, color, product_id, products!order_items_product_id_fkey(images, variant_images, colors, original_price, price)')
      .eq('order_id', order.id)

    // Compute image and regular_price per item
    const items = (rawItems || []).map((item: any) => {
      const vi = item.products?.variant_images || {}
      const colorImages = vi.color_images || {}
      const colorKey = item.color
        ? Object.keys(colorImages).find((k: string) => k.toLowerCase().trim() === item.color.toLowerCase().trim())
        : null
      const image = (colorKey ? colorImages[colorKey] : null) || item.products?.images?.[0] || null

      let regular_price: number | null = null
      if (item.products) {
        const sizeData = vi.size_data || {}
        if (item.size && sizeData[item.size]) {
          const sd = sizeData[item.size]
          if (sd.sale_price != null && sd.price != null && sd.price > sd.sale_price) {
            regular_price = sd.price
          } else if (sd.price != null) {
            regular_price = sd.price
          }
        }
        if (regular_price == null && item.products.original_price != null && item.products.original_price > item.products.price) {
          regular_price = item.products.original_price
        }
      }

      return {
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        image,
        regular_price,
      }
    })

    // Fetch store settings for branding
    const { data: settings } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['invoice_config', 'navbar_config', 'store_name', 'store_name_bn', 'footer_config'])

    const settingsMap: Record<string, string> = {}
    settings?.forEach((s: any) => { settingsMap[s.key] = s.value })

    let invoiceConfig: any = {}
    let navbarConfig: any = {}
    let footerConfig: any = {}
    try { invoiceConfig = JSON.parse(settingsMap.invoice_config || '{}') } catch {}
    try { navbarConfig = JSON.parse(settingsMap.navbar_config || '{}') } catch {}
    try { footerConfig = JSON.parse(settingsMap.footer_config || '{}') } catch {}


    // Remove id from order before sending response
    const { id: _omit, ...orderWithoutId } = order

    return new Response(JSON.stringify({
      order: orderWithoutId,
      items,
      branding: {
        brand_name: navbarConfig.brand_name || settingsMap.store_name_bn || 'Store',
        brand_name_en: navbarConfig.brand_name_en || settingsMap.store_name || '',
        logo_url: invoiceConfig.logo_url || '',
        brand_color: invoiceConfig.brand_color || '#16a34a',
        phone: invoiceConfig.phone || '',
        whatsapp: invoiceConfig.whatsapp || '',
        address: invoiceConfig.address || '',
        website: 'https://shorno-suta.vercel.app',
        footer_message: invoiceConfig.footer_message || '',
        facebook: footerConfig.facebook || footerConfig.facebook_url || '',
        youtube: footerConfig.youtube || footerConfig.youtube_url || '',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
