export type Serialized<T> = T extends Date
  ? string
  : T extends (infer TItem)[]
    ? Serialized<TItem>[]
    : T extends object
      ? { [TKey in keyof T]: Serialized<T[TKey]> }
      : T;
