import { ICONS } from "@/lib/constants";
import Image from "next/image";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-full flex-col bg-white">
      <div className="bannerGradinetBg rounf flex h-[119px] w-full shrink-0 items-center justify-center">
        <div className="m-0 flex h-[92.81px] w-full justify-center border-b border-white/10">
          <Image
            src={ICONS.logoPng1}
            width={400}
            height={400}
            alt="logo"
            className="h-auto w-auto"
          />
        </div>
      </div>
      <div className="flex h-[calc(100vh-119px)] w-full items-center justify-center pb-[50px]">
        {children}
      </div>
    </div>
  );
}
