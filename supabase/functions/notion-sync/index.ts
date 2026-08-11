import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const notionHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2025-09-03',
})

const getPlainText = (items: Array<{ plain_text?: string }> | undefined) =>
  items?.map((item) => item.plain_text ?? '').join('').trim() ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sign in to connect Notion.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.warn('[notion-sync] rejected invalid session')
      return new Response(JSON.stringify({ error: 'Your session has expired. Please sign in again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notionToken = Deno.env.get('NOTION_API_KEY')
    if (!notionToken) {
      console.warn('[notion-sync] NOTION_API_KEY is not configured')
      return new Response(JSON.stringify({ error: 'Notion needs its one-time household setup.', code: 'NOTION_NOT_CONFIGURED' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const action = body?.action

    if (action === 'list') {
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders(notionToken),
        body: JSON.stringify({
          filter: { property: 'object', value: 'data_source' },
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 100,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        console.error('[notion-sync] failed to list data sources', { status: response.status, code: result?.code })
        return new Response(JSON.stringify({ error: result?.message ?? 'Notion could not list shared data sources.' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const dataSources = (result.results ?? []).map((source: Record<string, unknown>) => {
        const title = getPlainText(source.title as Array<{ plain_text?: string }> | undefined)
        return { id: source.id, title: title || 'Untitled data source', url: source.url }
      })
      console.log('[notion-sync] listed household data sources', { userId: user.id, count: dataSources.length })
      return new Response(JSON.stringify({ dataSources }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'import') {
      const dataSourceId = typeof body?.dataSourceId === 'string' ? body.dataSourceId.trim() : ''
      if (!dataSourceId) {
        return new Response(JSON.stringify({ error: 'Choose a Notion data source first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const pages: Array<Record<string, unknown>> = []
      let cursor: string | undefined
      for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
        const response = await fetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
          method: 'POST',
          headers: notionHeaders(notionToken),
          body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
        })
        const result = await response.json()
        if (!response.ok) {
          console.error('[notion-sync] failed to query data source', { status: response.status, code: result?.code })
          return new Response(JSON.stringify({ error: result?.message ?? 'Notion could not read that data source.' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        pages.push(...(result.results ?? []))
        if (!result.has_more || !result.next_cursor) break
        cursor = result.next_cursor
      }

      const items = pages.map((page) => {
        const properties = (page.properties ?? {}) as Record<string, Record<string, unknown>>
        const entries = Object.entries(properties)
        const titleProperty = entries.find(([, value]) => value.type === 'title')?.[1]
        const title = getPlainText(titleProperty?.title as Array<{ plain_text?: string }> | undefined)
        const dueProperty = entries.find(([name, value]) => /due|date/i.test(name) && value.type === 'date')?.[1]
        const statusProperty = entries.find(([name]) => /status|done|complete/i.test(name))?.[1]
        const categoryProperty = entries.find(([name]) => /category|area|type/i.test(name))?.[1]
        const assigneeProperty = entries.find(([name]) => /person|assignee|owner/i.test(name))?.[1]
        const statusName = ((statusProperty?.status as { name?: string } | undefined)?.name ?? (statusProperty?.select as { name?: string } | undefined)?.name ?? '').toLowerCase()
        const completed = statusProperty?.type === 'checkbox'
          ? Boolean(statusProperty.checkbox)
          : /done|complete|finished/.test(statusName)
        const category = (categoryProperty?.select as { name?: string } | undefined)?.name
          ?? ((categoryProperty?.multi_select as Array<{ name?: string }> | undefined)?.[0]?.name)
        const assignee = (assigneeProperty?.select as { name?: string } | undefined)?.name
          ?? ((assigneeProperty?.people as Array<{ name?: string }> | undefined)?.[0]?.name)

        return {
          id: page.id,
          url: page.url,
          title: title || 'Untitled Notion task',
          completed,
          dueDate: (dueProperty?.date as { start?: string } | undefined)?.start,
          category,
          assignee,
        }
      })

      console.log('[notion-sync] imported household tasks', { userId: user.id, dataSourceId, count: items.length })
      return new Response(JSON.stringify({ items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unsupported Notion action.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[notion-sync] unexpected error', { message: error instanceof Error ? error.message : String(error) })
    return new Response(JSON.stringify({ error: 'Notion had trouble responding. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
