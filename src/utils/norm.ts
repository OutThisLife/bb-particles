const deepSort = (o: unknown): unknown =>
  o && typeof o === 'object' && !Array.isArray(o)
    ? Object.fromEntries(
        Object.entries(o)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, deepSort(v)])
      )
    : o

export const norm = (s: string) => JSON.stringify(deepSort(JSON.parse(s)))
