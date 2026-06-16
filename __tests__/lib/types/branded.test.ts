import { describe, expectTypeOf, it } from 'vitest'
import {
  asDeptId,
  asMaterialId,
  asShowId,
  type DeptId,
  type MaterialId,
  type ShowId,
} from '@/lib/types/branded'

describe('branded ids', () => {
  it('constructors produce distinct types', () => {
    const showId = asShowId('s-1')
    const deptId = asDeptId('d-1')
    const materialId = asMaterialId('m-1')

    expectTypeOf(showId).toEqualTypeOf<ShowId>()
    expectTypeOf(deptId).toEqualTypeOf<DeptId>()
    expectTypeOf(materialId).toEqualTypeOf<MaterialId>()
  })

  it('disallows passing the wrong brand to a typed parameter', () => {
    function takeDeptId(_: DeptId): void {}

    const showId = asShowId('s-1')
    // @ts-expect-error — ShowId is not assignable to DeptId
    takeDeptId(showId)

    takeDeptId(asDeptId('d-1'))
  })
})
