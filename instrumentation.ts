export async function register() {
  // The --localstorage-file Node flag creates a localStorage object with no methods.
  // Patch it with a working in-memory implementation before any modules use it.
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem !== 'function') {
    const store: Record<string, string> = {}
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem:    (k: string) => store[k] ?? null,
        setItem:    (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
        clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
        get length() { return Object.keys(store).length },
        key:        (i: number) => Object.keys(store)[i] ?? null,
      },
    })
  }
}
