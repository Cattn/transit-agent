import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, type PlanResponse, type TripRequest } from '@transit/shared';
import { useApi } from './api-context.js';

export function usePlanTrip() {
  const api = useApi();
  const sequence = useRef(0);
  const [state, setState] = useState<{ data?: PlanResponse; error?: ApiClientError; loading: boolean }>({ loading: false });
  const [previousApi, setPreviousApi] = useState(api);
  if (previousApi !== api) {
    setPreviousApi(api);
    setState({ loading: false });
  }
  useEffect(() => () => { sequence.current++; }, [api]);
  const clear = useCallback(() => { sequence.current++; setState({ loading: false }); }, []);
  const run = useCallback(async (request: TripRequest) => {
    const id = ++sequence.current;
    setState({ loading: true });
    try {
      const data = await api.planTrip(request);
      if (id === sequence.current) setState({ data, loading: false });
    } catch (error) {
      if (id === sequence.current) setState({ loading: false, error: error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)) });
    }
  }, [api]);
  return { ...state, run, clear };
}
