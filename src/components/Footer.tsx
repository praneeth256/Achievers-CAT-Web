import Link from "next/link";
import Logo from "./Logo";
import { FaGithub, FaWhatsapp } from "react-icons/fa";

const WA_LINK = "https://chat.whatsapp.com/JrJ0LM4eeuYL48bijRpoqB";

export default function Footer() {
  return (
    <footer className="mt-6 border-t border-brand/10 bg-white/50 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">

          {/* Brand */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
              Daily practice, sectional and full mocks, and study material —
              everything you need to ace CAT, in one place.
            </p>
            {/* WhatsApp CTA */}
            <Link
              href={WA_LINK}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-2 text-[13px] font-semibold text-green-700 hover:bg-green-100"
            >
              <FaWhatsapp size={15} className="shrink-0" />
              Join our WhatsApp Group
            </Link>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-3">
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Practice</p>
              <ul className="mt-3 space-y-2.5 text-[13.5px]">
                <li><Link href="/daily" className="text-foreground/80 transition hover:text-brand-darker">Daily Practice</Link></li>
                <li><Link href="/sectional" className="text-foreground/80 transition hover:text-brand-darker">Sectional Mocks</Link></li>
                <li><Link href="/mocks" className="text-foreground/80 transition hover:text-brand-darker">Full Mocks</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Resources</p>
              <ul className="mt-3 space-y-2.5 text-[13.5px]">
                <li><Link href="/materials" className="text-foreground/80 transition hover:text-brand-darker">Materials</Link></li>
                <li><Link href="/performance" className="text-foreground/80 transition hover:text-brand-darker">My Performance</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted">Account</p>
              <ul className="mt-3 space-y-2.5 text-[13.5px]">
                <li><Link href="/login" className="text-foreground/80 transition hover:text-brand-darker">Log in</Link></li>
                <li><Link href="/admin" className="text-foreground/80 transition hover:text-brand-darker">Admin</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-[13px] font-medium text-foreground/80">
            Made with love and faith by Praneeth and Pavan
          </p>
          <div className="flex items-center gap-3">
            <Link
              target="_blank"
              href="https://github.com/praneeth256/Achievers-CAT-Web/"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/60 transition hover:border-brand hover:text-brand-darker"
              aria-label="GitHub"
            >
              <FaGithub size={16} />
            </Link>
            <Link
              target="_blank"
              href={WA_LINK}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-600 transition hover:bg-green-100"
              aria-label="WhatsApp Group"
            >
              <FaWhatsapp size={16} />
            </Link>
            <p className="text-[12.5px] text-muted">
              © {new Date().getFullYear()} Achievers CAT
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
