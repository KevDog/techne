'use client'

type Props = {
  requesterName: string
  onYield: () => void
  onDecline: () => void
}

export function PresenterRequestToast({ requesterName, onYield, onDecline }: Props) {
  return (
    <div className="fixed bottom-24 right-4 bg-neutral-800 border border-neutral-600 rounded-lg p-4 shadow-xl z-50 max-w-xs">
      <p className="text-white text-sm mb-3">
        <span className="font-medium">{requesterName}</span> wants to present
      </p>
      <div className="flex gap-2">
        <button
          onClick={onYield}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded"
        >
          Yield
        </button>
        <button
          onClick={onDecline}
          className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs px-3 py-1.5 rounded"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
