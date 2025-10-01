// src/contexts/sidebar-context.tsx
import React,
{
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect
} from 'react';

// Define the shape of the context state
interface SidebarContextType {
  isExpanded: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  isHovering: boolean;
  setIsHovering: (hovering: boolean) => void;
}

// Create the context with a default undefined value
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Create a provider component
interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Toggle sidebar for desktop view
  const toggleSidebar = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Handlers for mobile view
  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  // Effect to close mobile sidebar on window resize (desktop transition)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const value = {
    isExpanded,
    isMobileOpen,
    toggleSidebar,
    openMobileSidebar,
    closeMobileSidebar,
    isHovering,
    setIsHovering,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};

// Create a custom hook for easy consumption of the context
export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
