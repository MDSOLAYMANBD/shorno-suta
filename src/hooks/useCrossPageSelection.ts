// Cross-page selection model for the customer preview table.
// "Select all matching" expands the engine filter into a phone set.

import { useCallback, useMemo, useState } from 'react';
import { resolveAudiencePhones } from '@/lib/audience/engine';
import type { AudienceFilter } from '@/lib/audience/types';

export function useCrossPageSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  }, []);

  const addMany = useCallback((phones: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of phones) next.add(p);
      return next;
    });
  }, []);

  const removeMany = useCallback((phones: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of phones) next.delete(p);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectAllMatching = useCallback(async (filter: AudienceFilter) => {
    const { phones } = await resolveAudiencePhones(filter, '');
    setSelected(new Set(phones));
    return phones.length;
  }, []);

  return useMemo(
    () => ({ selected, count: selected.size, toggle, addMany, removeMany, clear, selectAllMatching, setSelected }),
    [selected, toggle, addMany, removeMany, clear, selectAllMatching],
  );
}
