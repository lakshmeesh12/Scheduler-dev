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
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Drives", url: "/drives", icon: Briefcase },
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
        <div className="py-4 px-3">
          <img 
            src={state === "collapsed" 
              ? "https://cdn-avatars.huggingface.co/v1/production/uploads/672a914b4ecb5f4a75ddc500/9sFcJ0YX5FfDI1yaH2rg4.jpeg"
              : "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTV2BpTtkhGmUriwjhwOpjNHZAQxp5fW0bMwg&s"
            }
            alt="Logo"
            className={`${
              state === "collapsed" ? "w-8 h-8" : "max-w-65 h-18 object-contain"
            } mx-auto transition-all duration-200`}
          />
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-primary font-semibold">
            {state !== "collapsed" && "QHub Navigation"}
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
      <SidebarFooter>
        <SidebarTrigger className="w-full p-2 hover:bg-sidebar-accent/50">
          <span className="sr-only">Toggle Sidebar</span>
        </SidebarTrigger>
      </SidebarFooter>
    </Sidebar>
  );
}