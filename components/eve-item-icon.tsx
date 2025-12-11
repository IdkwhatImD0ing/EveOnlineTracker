import Image from "next/image"

interface EveItemIconProps {
  typeId: number
  size?: 32 | 64 | 128
  className?: string
}

export function EveItemIcon({ typeId, size = 32, className }: EveItemIconProps) {
  return (
    <Image
      src={`https://images.evetech.net/types/${typeId}/icon?size=${size}`}
      alt=""
      width={size}
      height={size}
      className={className}
      unoptimized // External images
    />
  )
}

