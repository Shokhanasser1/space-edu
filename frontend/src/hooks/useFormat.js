import { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
} from '@/lib/format';

/**
 * The formatters, already bound to the language the page is in.
 *
 * A component that shows a number should not have to remember to thread the
 * language through to it — that is precisely what nobody remembered, twenty-odd
 * times, which is how `toLocaleString()` with no argument ended up everywhere.
 *
 * Reactive: change the language in the switcher and the numbers change with the
 * words, rather than after a reload.
 */
export function useFormat() {
  const { language } = useTranslation();

  return useMemo(() => ({
    number: (value) => formatNumber(value, language),
    date: (value, options) => formatDate(value, language, options),
    time: (value, options) => formatTime(value, language, options),
    dateTime: (value) => formatDateTime(value, language),
    money: formatMoney,
  }), [language]);
}

export default useFormat;
