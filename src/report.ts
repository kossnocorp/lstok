export interface Report {
  input: number | null;
  cache_read: number | null;
  cache_write: number | null;
  output: number | null;
  reasoning: number | null;
  cost: number | null;
  time: number | null;
  total_input: number | null;
  total_output: number | null;
  total: number | null;
  provider: string | null;
  model: string | null;
  encoding: string | null;
}

export function createReport(values: Partial<Report> = {}): Report {
  return {
    input: null,
    cache_read: null,
    cache_write: null,
    output: null,
    reasoning: null,
    cost: null,
    time: null,
    total_input: null,
    total_output: null,
    total: null,
    provider: null,
    model: null,
    encoding: null,
    ...values,
  };
}

export function fileReport(input: number, encoding: string, time: number): Report {
  return createReport({
    input,
    time,
    cache_read: 0,
    cache_write: 0,
    output: 0,
    reasoning: 0,
    total_input: input,
    total_output: 0,
    total: input,
    encoding,
  });
}
