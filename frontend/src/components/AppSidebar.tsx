import { NavLink, useLocation } from "react-router-dom";
import {
  Users,
  Calendar,
  BarChart3,
  Eye,
  Home,
  UserPlus,
  Settings,
  Briefcase,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Search Candidates", url: "/search", icon: UserPlus },
  { title: "Add Candidate", url: "/add-candidate", icon: UserPlus },
  { title: "Panel Members", url: "/panel-members", icon: Users },
  { title: "View Candidates", url: "/view-candidates", icon: Eye },
  { title: "Scheduler", url: "/scheduler", icon: Calendar },
  { title: "Event Tracker", url: "/event-tracker", icon: BarChart3 },
  { title: "Reminder Settings", url: "/reminder-settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar 
      collapsible="icon"
      className="glass border-r border-white/20"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-primary font-semibold">
            QHub Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}