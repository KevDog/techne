'use client'

type Props = {
  presenterId: string | null
  presenterRequest: { from_user_id: string; requested_at: number } | null
  selfUserId: string
  onClaim: () => void
  onRequest: () => void
  onRelease: () => void
}

export function PresenterControls({
  presenterId, presenterRequest, selfUserId,
  onClaim, onRequest, onRelease,
}: Props) {
  const isSelfPresenter = presenterId === selfUserId
  const hasPresenter = presenterId !== null
  const requestPending = presenterRequest !== null

  if (!hasPresenter) {
    return (
      <button
        onClick={onClaim}
        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
      >
        Claim presenter
      </button>
    )
  }

  if (isSelfPresenter) {
    return (
      <button
        onClick={onRelease}
        className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1.5 rounded"
      >
        Release
      </button>
    )
  }

  return (
    <button
      onClick={onRequest}
      disabled={requestPending}
      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded"
    >
      Request presenter
    </button>
  )
}
