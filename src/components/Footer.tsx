import Link from "next/link";
import Logo from "./Logo";
import { GitBranch } from "lucide-react";
import { FaGithub, FaWhatsapp } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-muted">
              Daily practice, sectional and full mocks, and study material —
              everything you need to prepare for CAT, in one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Practice</p>
              <ul className="mt-3 space-y-2 text-[13.5px]">
                <li><Link href="/daily" className="text-foreground/80 hover:text-brand-darker">Daily Practice</Link></li>
                <li><Link href="/sectional" className="text-foreground/80 hover:text-brand-darker">Sectional Mocks</Link></li>
                <li><Link href="/mocks" className="text-foreground/80 hover:text-brand-darker">Full Mocks</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Resources</p>
              <ul className="mt-3 space-y-2 text-[13.5px]">
                <li><Link href="/materials" className="text-foreground/80 hover:text-brand-darker">Materials</Link></li>
                <li><Link href="/performance" className="text-foreground/80 hover:text-brand-darker">My Performance</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Account</p>
              <ul className="mt-3 space-y-2 text-[13.5px]">
                <li><Link href="/login" className="text-foreground/80 hover:text-brand-darker">Log in</Link></li>
                <li><Link href="/admin" className="text-foreground/80 hover:text-brand-darker">Admin</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[12px] truncate font-semibold uppercase tracking-wide text-muted">Social Media</p>
              <ul className="flex gap-5 mt-3 space-y-2 text-[13.5px]">
                <li><Link target="_blank" href="https://github.com/praneeth256/Achievers-CAT-Web/" className="text-foreground/80 hover:text-brand-darker"><FaGithub size={20}/></Link></li>
                <li><Link target="_blank" href="https://chat.whatsapp.com/L59MZiqz4ueKOSEyZ06TxD" className="text-foreground/80 hover:text-brand-darker"><FaWhatsapp size={20}/></Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-5 text-center">
          <p className="text-[13px] font-medium text-foreground/80">
            Made with love and faith by Praneeth and Pavan
          </p>
          <p className="mt-2 text-[12.5px] text-muted">
            © {new Date().getFullYear()} Achievers CAT. Not affiliated with IIM CAT.
          </p>
        </div>
      </div>
    </footer>
  );
}
