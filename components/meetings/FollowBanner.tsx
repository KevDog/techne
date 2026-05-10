'use client'

type Props = {
  presenterName: string
  onBrowseFreely: () => void
}

export function FollowBanner({ presenterName, onBrowseFreely }: Props) {
  return (
    <div className="px-3 py-1 bg-blue-900/50 border-b border-blue-700 flex items-center justify-between text-xs">
      <span className="text-blue-300">Following {presenterName}</span>
      <button onClick={onBrowseFreely} className="text-blue-400 underline hover:text-blue-200">
        Browse freely
      </button>
    </div>
  )
}
