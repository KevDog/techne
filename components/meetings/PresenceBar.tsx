'use client'

type Member = {
  userId: string
  name: string
  initials: string
  isPresenter: boolean
  mode: 'browse' | 'follow'
}

type Props = { members: Member[] }

export function PresenceBar({ members }: Props) {
  return (
    <div className="flex items-center gap-1">
      {members.map((m) => (
        <div
          key={m.userId}
          title={`${m.name} (${m.isPresenter ? 'presenting' : m.mode})`}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 ${
            m.isPresenter ? 'border-green-500 bg-green-800' : 'border-blue-500 bg-blue-900'
          }`}
        >
          {m.initials}
        </div>
      ))}
    </div>
  )
}
