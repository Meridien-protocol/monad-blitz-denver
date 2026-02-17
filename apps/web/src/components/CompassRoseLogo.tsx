import Image from "next/image";

interface CompassRoseLogoProps {
  size?: number;
  className?: string;
}

export function CompassRoseLogo({ size = 26, className }: CompassRoseLogoProps) {
  return (
    <Image
      src="/meridian-logo.svg"
      alt="Meridian"
      width={size}
      height={Math.round(size * (4011 / 4181))}
      className={className}
      priority
    />
  );
}
