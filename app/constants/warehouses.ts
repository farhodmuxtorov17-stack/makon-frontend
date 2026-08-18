/**
 * Ombor reyestri. `SessionUser.warehouseScope` shu identifikatorlarga
 * tayanadi, ombor nomi esa `data/operations.ts` dagi yozuvlar bilan bir xil.
 */
export interface WarehouseRef {
  id: string
  name: string
}

export const WAREHOUSES: WarehouseRef[] = [
  { id: 'w-01', name: 'Markaziy ombor' },
  { id: 'w-02', name: 'Green BC ombori' },
  { id: 'w-03', name: 'Industrial Park ombori' },
]

export function warehouseByName(name: string): WarehouseRef | undefined {
  return WAREHOUSES.find((w) => w.name === name)
}
