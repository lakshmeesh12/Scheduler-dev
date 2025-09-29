
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { initiateLogin } from '@/api';
import { Users, Brain, Search, Target, Shield, Building2 } from 'lucide-react';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    try {
      const loginUrl = await initiateLogin();
      console.log("Initiating Microsoft login, redirecting to:", loginUrl); // Debug log
      window.location.href = loginUrl;
    } catch (error) {
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to initiate Microsoft login.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-32 right-32 w-48 h-48 bg-purple-200/20 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-indigo-200/20 rounded-full blur-xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 relative z-10">
        {/* Left side - Adjusted font sizes */}
        <div className="hidden lg:flex flex-col justify-center space-y-6 px-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center animate-glow shadow-2xl">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">QHire</h1>
                <p className="text-sm text-gray-600">Enterprise Candidate Search</p>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Welcome to the Future of
                <span className="gradient-text"> AI-Powered Recruiting</span>
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Transform your hiring process with intelligent candidate matching, 
                natural language search, and automated resume analysis.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-4 p-4 glass-card rounded-xl hover:scale-105 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">AI-Powered Matching</h3>
                  <p className="text-xs text-gray-600">Smart algorithms find perfect candidates</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 glass-card rounded-xl hover:scale-105 transition-all duration-300">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Natural Language Search</h3>
                  <p className="text-xs text-gray-600">Search candidates like you talk</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 p-4 glass-card rounded-xl hover:scale-105 transition-all duration-300">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Precision Filtering</h3>
                  <p className="text-xs text-gray-600">Advanced filters for exact matches</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Microsoft-only login with adjusted font sizes */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md glass-card border-0 shadow-2xl animate-scale-in">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="lg:hidden flex items-center justify-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-glow">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold gradient-text">QHire</h1>
                </div>
              </div>
              
              {/* Microsoft Logo */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-gray-100">
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                    <path fill="#F25022" d="M2 3h9v9H2V3z"/>
                    <path fill="#7FBA00" d="M2 13h9v9H2v-9z"/>
                    <path fill="#00A4EF" d="M13 3h9v9h-9V3z"/>
                    <path fill="#FFB900" d="M13 13h9v9h-9v-9z"/>
                  </svg>
                </div>
              </div>
              
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold text-gray-800">Welcome Back</CardTitle>
                <p className="text-xs text-gray-600">Sign in with your Microsoft account to access QHire</p>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 px-6 pb-6">
              {/* Microsoft Login Button */}
              <Button
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Connecting to Microsoft...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path fill="white" d="M2 3h9v9H2V3z"/>
                      <path fill="white" d="M2 13h9v9H2v-9z"/>
                      <path fill="white" d="M13 3h9v9h-9V3z"/>
                      <path fill="white" d="M13 13h9v9h-9v-9z"/>
                    </svg>
                    <span className="text-sm">Continue with Microsoft</span>
                  </div>
                )}
              </Button>

              {/* Security Features */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-xs text-gray-600">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>Secured by Microsoft Enterprise Authentication</span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-gray-600">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Single Sign-On (SSO) enabled for your organization</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-2">
                <p>By signing in, you agree to QHire's Terms of Service and Privacy Policy</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;