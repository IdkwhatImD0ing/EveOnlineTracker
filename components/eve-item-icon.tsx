import Image from "next/image"

interface EveItemIconProps {
  typeId: number
  size?: 32 | 64 | 128
  className?: string
}

export function EveItemIcon({ typeId, size = 32, className }: EveItemIconProps) {
  // EVE API only supports 32, 64, 128 sizes - we fetch the requested size
  // and use CSS className to resize if needed
  return (
    <Image
      src={`https://images.evetech.net/types/${typeId}/icon?size=${size}`}
      alt=""
      width={size}
      height={size}
      className={className}
      unoptimized // External images - required for eve image server
    />
  )
}

