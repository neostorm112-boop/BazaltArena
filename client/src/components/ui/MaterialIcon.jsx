export function MaterialIcon({ name, size, opticalSize, className = '', style, ...props }) {
  const opsz =
    opticalSize ?? (typeof size === 'number' ? Math.min(Math.round(size), 24) : undefined)

  const fixedSizeStyle =
    typeof size === 'number'
      ? {
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${size}px`,
          ...(opsz != null && {
            fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`,
          }),
        }
      : {}

  const mergedStyle = typeof size === 'number' ? { ...fixedSizeStyle, ...style } : style

  return (
    <span
      className={`material-symbols-outlined inline-flex shrink-0 items-center justify-center leading-none ${className}`.trim()}
      style={mergedStyle}
      aria-hidden
      {...props}
    >
      {name}
    </span>
  )
}
