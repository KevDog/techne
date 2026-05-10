'use client'

type Mode = 'browse' | 'follow'

type Props = {
  onJoin: (mode: Mode) => void
}

export function JoinPrompt({ onJoin }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-8 max-w-sm w-full text-center space-y-6">
        <h2 className="text-white text-lg font-semibold">Join the meeting</h2>
        <div className="space-y-3">
          <button
            onClick={() => onJoin('follow')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-3 text-sm font-medium"
          >
            Join as viewer — follow presenter
          </button>
          <button
            onClick={() => onJoin('browse')}
            className="w-full bg-neutral-700 hover:bg-neutral-600 text-white rounded px-4 py-3 text-sm font-medium"
          >
            Browse freely
          </button>
        </div>
        <p className="text-neutral-500 text-xs">
          You can switch modes at any time during the meeting.
        </p>
      </div>
    </div>
  )
}
