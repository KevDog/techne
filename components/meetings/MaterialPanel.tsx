'use client'

import ReactMarkdown from 'react-markdown'
import type { Material } from '@/lib/types/domain'

type Props = { material: Material }

function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const url = new URL(u)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function MaterialPanel({ material }: Props) {
  const safeUrl = safeHttpUrl(material.url)
  return (
    <div className="h-full flex flex-col bg-neutral-900 border border-neutral-700 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-700 flex items-center gap-2">
        <span className="text-white text-sm font-medium truncate">{material.title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
          material.state === 'decided'
            ? 'bg-green-900 text-green-300'
            : material.state === 'proposed'
            ? 'bg-blue-900 text-blue-300'
            : 'bg-neutral-700 text-neutral-400'
        }`}>
          {material.state}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {material.type === 'image' && safeUrl && (
          <img src={safeUrl} alt={material.title} className="max-w-full max-h-full object-contain mx-auto" />
        )}
        {material.type === 'link' && safeUrl && (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 underline break-all">
            {safeUrl}
          </a>
        )}
        {material.type === 'note' && material.body && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{material.body}</ReactMarkdown>
          </div>
        )}
        {material.type === 'file' && (
          <div className="text-neutral-400 text-sm">
            File: {material.storagePath ?? material.title}
          </div>
        )}
      </div>
    </div>
  )
}
