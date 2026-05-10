'use client'

import { Fragment } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Layout } from 'react-resizable-panels'
import { MaterialPanel } from '@/components/meetings/MaterialPanel'
import type { Material } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  panelSizes: number[]
  onPanelResize: (sizes: number[]) => void
}

export function LightTable({ materials, panelSizes, onPanelResize }: Props) {
  if (materials.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
        Click a thumbnail to add materials to the light table.
      </div>
    )
  }

  const defaultSizes = panelSizes.length === materials.length ? panelSizes : undefined

  function handleLayoutChange(layout: Layout) {
    const sizes = materials.map((mat) => layout[mat.id] ?? 0)
    onPanelResize(sizes)
  }

  return (
    <Group
      orientation="horizontal"
      onLayoutChange={handleLayoutChange}
      className="h-full"
    >
      {materials.map((mat, i) => (
        <Fragment key={mat.id}>
          <Panel id={mat.id} defaultSize={defaultSizes?.[i]}>
            <MaterialPanel material={mat} />
          </Panel>
          {i < materials.length - 1 && (
            <Separator className="w-1 bg-neutral-800 hover:bg-blue-600 transition-colors cursor-col-resize" />
          )}
        </Fragment>
      ))}
    </Group>
  )
}
