export function UserStatsCard({ position = 3, ofTotal = 10, points = 90 }) {
  return (
    <div className="flex min-h-[81px] items-center justify-between gap-4 rounded-xl border border-plantation bg-aztec p-4 max-[360px]:gap-3 max-[360px]:p-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-half-baked max-[360px]:text-[9px] max-[360px]:leading-3">
          Ваша позиция
        </span>
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-bold leading-8 text-catskill max-[360px]:text-xl max-[360px]:leading-7">
            #{position}
          </span>
          <span className="text-xs font-normal leading-4 text-spring">/{ofTotal}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-half-baked max-[360px]:text-[9px] max-[360px]:leading-3">
          Очков заработано
        </span>
        <span className="text-2xl font-bold leading-8 text-turquoise max-[360px]:text-xl max-[360px]:leading-7">
          {points}
        </span>
      </div>
    </div>
  )
}
