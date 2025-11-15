import { Home, TrendingUp, History, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Predictions", url: "/predict", icon: TrendingUp },
  { title: "Charts", url: "/charts", icon: BarChart3 },
  { title: "History", url: "/history", icon: History },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-quantum flex items-center justify-center shadow-glow">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            {open && (
              <div>
                <h2 className="font-bold text-lg">Quantum VQC</h2>
                <p className="text-xs text-muted-foreground">Market Predictor</p>
              </div>
            )}
          </div>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="w-5 h-5" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-6 border-t border-border">
          {open && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Quantum Computing v2.0</p>
              <p className="text-primary">Model: VQC-Hybrid</p>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
