import { useCallback, useEffect, useState } from 'react';

import api from '@/lib/api';

/**
 * The Masalalar set, from the server.
 *
 * It used to come from `src/data/problemsData.js`, which carried the answer to
 * every problem straight into the browser bundle — the same solution key
 * `ProblemSerializer` had been hardened to keep out of the API. Closing one
 * door and leaving the other open is not closing it.
 *
 * The list endpoint returns questions only. Grading happens at
 * `POST /courses/problems/<id>/check/`.
 *
 * That file also held 145 entries of which 115 were generated filler —
 * "Masala #47: Bu yerda fizika masalasi matni bo'ladi" with an answer taken off
 * a cycling list. Only the 30 written ones were seeded, so the set is honestly
 * 30 now rather than dishonestly 145.
 */
export function useProblems() {
  const [problems, setProblems] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    // The endpoint is paginated at 20. Reading only `results` and stopping is
    // how /learn/problems came to say "20 problems" over a set of 30 — the last
    // ten were not just unreachable, the page did not know they were there. The
    // set had already been cut from a dishonest 145 to an honest 30; showing 20
    // of those gave a third of it back.
    //
    // `next` is followed rather than counted so a changed page size needs no
    // change here, with a hard stop because a server that always answers with a
    // `next` must not spin the browser.
    const MAX_PAGES = 25;

    (async () => {
      const collected = [];
      let url = '/courses/problems/?sphere=problems';

      for (let page = 0; page < MAX_PAGES && url; page += 1) {
        let data;
        try {
          ({ data } = await api.get(url));
        } catch {
          // Keep whatever arrived. Twenty problems beats an error screen over a
          // set that mostly loaded; only a first page that fails is a failure.
          if (cancelled) return;
          if (!collected.length) {
            setState('error');
            return;
          }
          break;
        }
        if (cancelled) return;

        if (Array.isArray(data)) {
          collected.push(...data);
          break;
        }
        collected.push(...(data?.results ?? []));
        url = data?.next ?? null;
      }

      setProblems(collected.sort((a, b) => a.number - b.number));
      setState('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { problems, state };
}

/**
 * Grade one answer. Returns `{ correct, answer, explanation }`, or null if the
 * request failed — the caller has to say so rather than mark a correct answer
 * wrong because the network dropped.
 */
export async function checkProblem(problemId, answer) {
  try {
    const { data } = await api.post(`/courses/problems/${problemId}/check/`, { answer });
    return data;
  } catch (err) {
    if (err?.response?.status === 429) {
      return { throttled: true };
    }
    return null;
  }
}
