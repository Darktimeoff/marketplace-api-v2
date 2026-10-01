export type SerializedType<T> = T extends Date
  ? string
  : T extends (infer TItem)[]
    ? SerializedType<TItem>[]
    : T extends object
      ? { [TKey in keyof T]: SerializedType<T[TKey]> }
      : T;
