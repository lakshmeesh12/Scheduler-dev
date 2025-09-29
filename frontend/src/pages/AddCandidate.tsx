import { useState } from "react";
import { ArrowLeft, Upload, User, FileText, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { uploadResumes, importExcel, importExceldata } from "@/api";
import { Progress } from "@/components/ui/progress";

type AddMode = "choice" | "manual" | "resume" | "excel";

interface CandidateForm {
  candidateName: string;
  mobileNumber: string;
  email: string;
  totalExperience: string;
  company: string;
  ctc: string;
  ectc: string;
  offerInHand: string;
  notice: string;
  currentLocation: string;
  preferredLocation: string;
  availabilityForInterview: string;
}

const AddCandidate = () => {
  const location = useLocation();
  const campaignId = location.state?.campaign?.campaignId;
  const { state } = useLocation();
  const [mode, setMode] = useState<AddMode>(state?.mode || "choice");
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<CandidateForm>({
    candidateName: "",
    mobileNumber: "",
    email: "",
    totalExperience: "",
    company: "",
    ctc: "",
    ectc: "",
    offerInHand: "",
    notice: "",
    currentLocation: "",
    preferredLocation: "",
    availabilityForInterview: ""
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleInputChange = (field: keyof CandidateForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files).filter(file => 
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".docx")
    );
    
    if (fileArray.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF or DOCX files only.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setUploadedFiles(prev => [...prev, ...fileArray]);

    try {
      const response = await uploadResumes(fileArray, (progress, fileName) => {
        setUploadProgress(progress);
        setCurrentFile(fileName);
      });

      if (response.message.includes("successfully")) {
        toast({
          title: "Resumes uploaded successfully",
          description: `Processed ${response.stats.success_count} out of ${response.stats.total_count} files in ${response.stats.processing_time.toFixed(2)} seconds.`,
          className: "bg-green-600 text-white"
        });
        setUploadedFiles([]);
        setUploadProgress(0);
        setCurrentFile("");
      } else if (response.errors) {
        toast({
          title: "Some files failed validation",
          description: response.errors.map(err => `${err.filename}: ${err.error}`).join("\n"),
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error uploading resumes",
        description: err instanceof Error ? err.message : "Failed to process resumes.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setCurrentFile("");
    }
  };

  const handleExcelUpload = async (file: File) => {
    if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload XLS, XLSX, or CSV files only.",
        variant: "destructive"
      });
      return;
    }

    if (!campaignId) {
      toast({
        title: "Error",
        description: "Campaign ID is missing. Please ensure you're accessing this page from a valid campaign.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await importExceldata(campaignId, file);
      console.log("AddCandidate: Excel API response:", response);

      if (response.message && response.inserted_count >= 0) {
        toast({
          title: "Candidates imported successfully",
          description: `${response.inserted_count} candidates were imported for Campaign ID: ${response.campaign_id}.`,
          className: "bg-green-600 text-white"
        });
        navigate(`/candidate-search/${campaignId}`);
      } else {
        toast({
          title: "Error importing Excel file",
          description: response.message || "Failed to process Excel file.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error importing Excel file",
        description: err instanceof Error ? err.message : "Failed to process Excel file.",
        variant: "destructive"
      });
      console.error("AddCandidate: Excel upload error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Candidate added successfully!",
        description: `${formData.candidateName} has been added to your candidate database.`,
      });
      navigate("/dashboard");
    }, 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const downloadTemplate = () => {
    const headers = [
      "S.no",
      "Candidate Name",
      "Mobile Number",
      "Email Id",
      "Total Experience",
      "Company",
      "CTC",
      "ECTC",
      "Offer in Hand",
      "Notice",
      "Current Location",
      "Preferred Location",
      "Availability for interview"
    ];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidate_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderChoiceScreen = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-4">How would you like to add a candidate?</h2>
        <p className="text-gray-600">Choose the method that works best for you</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <Card 
          className="glass-card hover-lift cursor-pointer group"
          onClick={() => setMode("manual")}
        >
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <User className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl">Add Manually</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Enter candidate information manually with form fields and optional resume upload
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">Custom Fields</Badge>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">Resume Upload</Badge>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">Full Control</Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass-card hover-lift cursor-pointer group"
          onClick={() => setMode("resume")}
        >
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl">Upload Resume</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Upload multiple resumes for batch processing
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-green-50 text-green-700">Multiple Files</Badge>
              <Badge variant="secondary" className="bg-green-50 text-green-700">Batch Upload</Badge>
              <Badge variant="secondary" className="bg-green-50 text-green-700">Fast Processing</Badge>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="glass-card hover-lift cursor-pointer group"
          onClick={() => setMode("excel")}
        >
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl">Import Excel/CSV</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Import candidate data from Excel or CSV files with predefined template
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">Excel/CSV</Badge>
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">Bulk Import</Badge>
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">Template Based</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderResumeUpload = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-4">Upload Multiple Resumes</h2>
        <p className="text-gray-600">Upload multiple resume files for batch processing</p>
      </div>

      <Card className="glass-card max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              dragActive 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Drop multiple resumes here</h3>
              <p className="text-gray-600">or click to browse files</p>
              <div className="flex justify-center space-x-4 text-sm text-gray-500">
                <span>PDF</span>
                <span>•</span>
                <span>DOCX</span>
                <span>•</span>
                <span>Multiple files supported</span>
              </div>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => document.getElementById('resume-upload')?.click()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Browse Files"
                )}
              </Button>
              <input 
                id="resume-upload"
                type="file" 
                className="hidden" 
                accept=".pdf,.docx"
                multiple
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
                disabled={isLoading}
              />
            </div>
          </div>
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Uploaded Files ({uploadedFiles.length})</h4>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700"
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Processing Progress</h4>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-gray-600 mt-2">
                {currentFile ? `Processing: ${currentFile}` : "Processing files..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderExcelUpload = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-4">Import Excel/CSV</h2>
        <p className="text-gray-600">Upload an Excel or CSV file with candidate data</p>
      </div>

      <Card className="glass-card max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-gray-50 transition-all duration-300">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Upload Excel/CSV File</h3>
              <p className="text-gray-600">Use our template for best results</p>
              <div className="flex justify-center space-x-4 text-sm text-gray-500">
                <span>XLS</span>
                <span>•</span>
                <span>XLSX</span>
                <span>•</span>
                <span>CSV</span>
              </div>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => document.getElementById('excel-upload')?.click()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Browse Files"
                )}
              </Button>
              <input 
                id="excel-upload"
                type="file" 
                className="hidden" 
                accept=".xls,.xlsx,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelUpload(file);
                }}
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg relative">
            <h4 className="font-semibold text-blue-800 mb-2">Template Columns Required:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
              <div>• S.no</div>
              <div>• Candidate Name</div>
              <div>• Mobile Number</div>
              <div>• Email Id</div>
              <div>• Total Experience</div>
              <div>• Company</div>
              <div>• CTC</div>
              <div>• ECTC</div>
              <div>• Offer in Hand</div>
              <div>• Notice</div>
              <div>• Current Location</div>
              <div>• Preferred Location</div>
              <div>• Availability for interview</div>
            </div>
            <div className="absolute top-4 right-4">
              <button
                onClick={downloadTemplate}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Download Template
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderManualForm = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-4">Add Candidate Details</h2>
        <p className="text-gray-600">Fill in the candidate information below</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Candidate Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="candidateName">Candidate Name *</Label>
              <Input
                id="candidateName"
                value={formData.candidateName}
                onChange={(e) => handleInputChange("candidateName", e.target.value)}
                required
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number *</Label>
              <Input
                id="mobileNumber"
                value={formData.mobileNumber}
                onChange={(e) => handleInputChange("mobileNumber", e.target.value)}
                required
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Id *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalExperience">Total Experience *</Label>
              <Input
                id="totalExperience"
                value={formData.totalExperience}
                onChange={(e) => handleInputChange("totalExperience", e.target.value)}
                required
                placeholder="e.g., 5 years"
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleInputChange("company", e.target.value)}
                required
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctc">CTC *</Label>
              <Input
                id="ctc"
                value={formData.ctc}
                onChange={(e) => handleInputChange("ctc", e.target.value)}
                required
                placeholder="e.g., 12 LPA"
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ectc">ECTC *</Label>
              <Input
                id="ectc"
                value={formData.ectc}
                onChange={(e) => handleInputChange("ectc", e.target.value)}
                required
                placeholder="e.g., 15 LPA"
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offerInHand">Offer in Hand</Label>
              <Select value={formData.offerInHand} onValueChange={(value) => handleInputChange("offerInHand", value)} disabled={isLoading}>
                <SelectTrigger className="glass border-gray-200">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="negotiating">Under Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice">Notice Period</Label>
              <Input
                id="notice"
                value={formData.notice}
                onChange={(e) => handleInputChange("notice", e.target.value)}
                placeholder="e.g., 30 days"
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentLocation">Current Location *</Label>
              <Input
                id="currentLocation"
                value={formData.currentLocation}
                onChange={(e) => handleInputChange("currentLocation", e.target.value)}
                required
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredLocation">Preferred Location</Label>
              <Input
                id="preferredLocation"
                value={formData.preferredLocation}
                onChange={(e) => handleInputChange("preferredLocation", e.target.value)}
                className="glass border-gray-200"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availabilityForInterview">Availability for Interview</Label>
              <Select value={formData.availabilityForInterview} onValueChange={(value) => handleInputChange("availabilityForInterview", value)} disabled={isLoading}>
                <SelectTrigger className="glass border-gray-200">
                  <SelectValue placeholder="Select availability" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="within-week">Within a week</SelectItem>
                  <SelectItem value="within-2weeks">Within 2 weeks</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Resume Upload (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Upload candidate's resume for reference</p>
              <Button 
                type="button"
                variant="outline" 
                className="mt-2"
                onClick={() => document.getElementById('manual-resume-upload')?.click()}
                disabled={isLoading}
              >
                Choose File
              </Button>
              <input 
                id="manual-resume-upload"
                type="file" 
                className="hidden" 
                accept=".pdf,.docx"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button 
            type="submit" 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg hover:scale-105 transition-all duration-300"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Adding Candidate...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Add Candidate
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to={`/candidate-search/${campaignId}`} className="flex items-center space-x-3 hover:scale-105 transition-transform duration-300">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold gradient-text">Add New Candidate</h1>
                <p className="text-sm text-gray-600">Expand your talent pool</p>
              </div>
            </Link>
            
            {mode !== "choice" && (
              <Button 
                variant="outline" 
                onClick={() => setMode("choice")}
                className="glass border-gray-200"
              >
                Change Method
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {mode === "choice" && renderChoiceScreen()}
        {mode === "resume" && renderResumeUpload()}
        {mode === "excel" && renderExcelUpload()}
        {mode === "manual" && renderManualForm()}
      </main>
    </div>
  );
};

export default AddCandidate;