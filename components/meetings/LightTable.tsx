'use client'

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
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

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={onPanelResize}
      className="h-full"
    >
      {materials.map((mat, i) => (
        <>
          <Panel key={mat.id} defaultSize={defaultSizes?.[i]}>
            <MaterialPanel material={mat} />
          </Panel>
          {i < materials.length - 1 && (
            <PanelResizeHandle
              key={`handle-${i}`}
              className="w-1 bg-neutral-800 hover:bg-blue-600 transition-colors cursor-col-resize"
            />
          )}
        </>
      ))}
    </PanelGroup>
  )
}
