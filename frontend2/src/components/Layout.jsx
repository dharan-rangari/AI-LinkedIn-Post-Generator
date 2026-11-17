import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

/**
 * Overall dashboard shell: fixed sidebar + topbar, scrollable content area.
 * `title`/`subtitle` are passed down to the Topbar per page.
 */
function Layout({ title, subtitle, children, rightSidebar }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 page-enter">
          <main className="flex-1 min-w-0">{children}</main>
          {rightSidebar && (
            <aside className="w-full lg:w-80 shrink-0 space-y-4">{rightSidebar}</aside>
          )}
        </div>
      </div>
    </div>
  )
}

export default Layout
