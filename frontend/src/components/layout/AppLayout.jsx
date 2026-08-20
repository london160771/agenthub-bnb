import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import { MobileNav } from './MobileNav.jsx';
import { Footer } from './Footer.jsx';

/** Global shell: sticky navbar, routed content, footer, and mobile tab bar. */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
