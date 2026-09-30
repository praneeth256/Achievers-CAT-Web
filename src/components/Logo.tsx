import Image from "next/image";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/achievers-logo.png"
        alt="Achievers CAT"
        width={180}
        height={71}
        priority
        className="h-10 w-auto object-contain sm:h-11"
      />
    </span>
  );
}
