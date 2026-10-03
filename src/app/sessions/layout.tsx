import { SessionShell } from "@/components/session/session-shell";

export default function SessionsLayout({ children }: LayoutProps<"/sessions">) {
  return <SessionShell>{children}</SessionShell>;
}
