import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch all rows from a Supabase query, bypassing the 1000-row default limit.
 * 
 * Usage:
 *   const data = await fetchAllRows<MyType>(
 *     () => supabase.from('orders').select('id, total').eq('status', 'confirmed')
 *   );
 * 
 * @param queryFactory - A function that returns a fresh Supabase query builder each time
 * @param batchSize - Number of rows per batch (default 1000)
 */
export async function fetchAllRows<T = any>(
  queryFactory: () => any,
  batchSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFactory().range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allData;
}

/**
 * Fetch all rows using .in() filter, batching the IDs to avoid URL length limits.
 * Combines both ID batching and row pagination.
 */
export async function fetchAllByIds<T = any>(
  table: string,
  selectFields: string,
  column: string,
  ids: string[],
  idBatchSize = 50
): Promise<T[]> {
  if (ids.length === 0) return [];
  
  const allData: T[] = [];
  for (let i = 0; i < ids.length; i += idBatchSize) {
    const batch = ids.slice(i, i + idBatchSize);
    const items = await fetchAllRows<T>(
      () => (supabase.from(table as any) as any).select(selectFields).in(column, batch)
    );
    allData.push(...items);
  }
  return allData;
}
