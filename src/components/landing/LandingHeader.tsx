import { Link } from 'react-router-dom';
import { useClientAuth } from '@/hooks/useClientAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, LogIn, Sparkles, User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LandingHeader() {
  const { user, isLoading, isProSubscriber, signOut, profile } = useClientAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="text-2xl font-heading font-bold text-primary">
            Talendro<span className="text-secondary">™</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* Navigation Links - hidden on mobile */}
            <nav className="hidden md:flex gap-8">
              <a href="#how-it-works" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
                How it Works
              </a>
              <a href="#products" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
                Products
              </a>
              <a href="#why" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
                Why Talendro
              </a>
              <a href="#coming-soon" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
                Coming Soon
              </a>
            </nav>

            {/* Auth Section */}
            {!isLoading && (
              <>
                {user ? (
                  // Logged in
                  <div className="flex items-center gap-3">
                    {isProSubscriber ? (
                      // Pro subscriber - show Dashboard link
                      <Link to="/dashboard">
                        <Button size="sm" className="gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          <span className="hidden sm:inline">Dashboard</span>
                        </Button>
                      </Link>
                    ) : (
                      // Not Pro - show Upgrade button
                      <a href="#products">
                        <Button size="sm" variant="default" className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span className="hidden sm:inline">Upgrade to Pro</span>
                        </Button>
                      </a>
                    )}
                    
                    {/* User Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <User className="h-4 w-4" />
                          <span className="hidden sm:inline max-w-[100px] truncate">
                            {profile?.full_name || user.email?.split('@')[0]}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-background">
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard" className="cursor-pointer">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => signOut()}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  // Not logged in
                  <div className="flex items-center gap-3">
                    <Link to="/login">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <LogIn className="h-4 w-4" />
                        <span className="hidden sm:inline">Login</span>
                      </Button>
                    </Link>
                    <a href="#products">
                      <Button size="sm" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="hidden sm:inline">Get Started</span>
                      </Button>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
