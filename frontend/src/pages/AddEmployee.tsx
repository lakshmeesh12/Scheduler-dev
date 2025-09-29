import { useState } from "react";
import { ArrowLeft, Upload, User, FileText, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { uploadResumes } from "@/api";

type AddMode = "choice" | "manual" | "resume" | "excel";

interface EmployeeForm {
  employeeName: string;
  employeeId: string;
  email: string;
  department: string;
  jobTitle: string;
  managerName: string;
  employmentType: string;
  officeLocation: string;
  startDate: string;
  notes: string;
}

const AddEmployee = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<AddMode>("choice");
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState<EmployeeForm>({
    employeeName: "",
    employeeId: "",
    email: "",
    department: "",
    jobTitle: "",
    managerName: "",
    employmentType: "",
    officeLocation: "",
    startDate: "",
    notes: "",
  });

  const handleInputChange = (field: keyof EmployeeForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".docx")
    );

    if (fileArray.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF or DOCX files only.",
        variant: "destructive",
        className: "text-sm",
      });
      return;
    }

    setIsLoading(true);
    setUploadedFiles((prev) => [...prev, ...fileArray]);

    try {
      const response = await uploadResumes(fileArray, (progress, fileName) => {
        setUploadProgress(progress);
        setCurrentFile(fileName);
      });

      toast({
        title: "Resumes uploaded successfully",
        description: `Processed ${response.stats.success_count} of ${response.stats.total_count} files successfully. ${
          response.stats.failure_count > 0
            ? `${response.stats.failure_count} files failed: ${response.stats.failed_files.join(", ")}`
            : ""
        }`,
        className: "bg-green-600 text-white text-sm",
      });

      if (response.errors && response.errors.length > 0) {
        response.errors.forEach((error) => {
          toast({
            title: `Error processing ${error.filename}`,
            description: error.error,
            variant: "destructive",
            className: "text-sm",
          });
        });
      }

      setUploadedFiles([]);
      setUploadProgress(0);
      setCurrentFile("");
      navigate(`/campaign-dashboard/${clientId}`);
    } catch (err) {
      toast({
        title: "Error uploading resumes",
        description: err instanceof Error ? err.message : "Failed to process resumes.",
        variant: "destructive",
        className: "text-sm",
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setCurrentFile("");
    }
  };

  const handleExcelUpload = async (file: File) => {
    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload XLS, XLSX, or CSV files only.",
        variant: "destructive",
        className: "text-sm",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Client ID is missing.",
        variant: "destructive",
        className: "text-sm",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate Excel import
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Employees imported successfully",
        description: `Imported employee data for Client ID: ${clientId}.`,
        className: "bg-green-600 text-white text-sm",
      });
      navigate(`/campaign-dashboard/${clientId}`);
    } catch (err) {
      toast({
        title: "Error importing Excel file",
        description: "Failed to process Excel file.",
        variant: "destructive",
        className: "text-sm",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Employee added successfully!",
        description: `${formData.employeeName} has been added to the employee database.`,
        className: "text-sm",
      });
      navigate(`/campaign-dashboard/${clientId}`);
    } catch (err) {
      toast({
        title: "Error adding employee",
        description: "Failed to add employee.",
        variant: "destructive",
        className: "text-sm",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const downloadTemplate = () => {
    const headers = [
      "Employee Name",
      "Employee ID",
      "Email",
      "Department",
      "Job Title",
      "Manager Name",
      "Employment Type",
      "Office Location",
      "Start Date",
      "Notes",
    ];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderChoiceScreen = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">How would you like to add an employee?</h2>
        <p className="text-sm text-gray-600">Choose the method that works best for you</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-6xl mx-auto">
        <Card className="glass hover:shadow-md cursor-pointer group">
          <CardHeader className="text-center pb-2" onClick={() => setMode("manual")}>
            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform duration-300">
              <User className="w-6 h-6 text-gray-600" />
            </div>
            <CardTitle className="text-base font-semibold">Add Manually</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xs text-gray-600 mb-3">
              Enter employee information manually with form fields and optional resume upload
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Custom Fields</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Resume Upload</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Full Control</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-md cursor-pointer group" onClick={() => setMode("resume")}>
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform duration-300">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
            <CardTitle className="text-base font-semibold">Upload Resume</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xs text-gray-600 mb-3">
              Upload multiple resumes for batch processing
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Multiple Files</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Batch Upload</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Fast Processing</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-md cursor-pointer group" onClick={() => setMode("excel")}>
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform duration-300">
              <Upload className="w-6 h-6 text-gray-600" />
            </div>
            <CardTitle className="text-base font-semibold">Import Excel/CSV</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xs text-gray-600 mb-3">
              Import employee data from Excel or CSV files with predefined template
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Excel/CSV</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Bulk Import</Badge>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">Template Based</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderResumeUpload = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Upload Multiple Resumes</h2>
        <p className="text-sm text-gray-600">Upload multiple resume files for batch processing</p>
      </div>

      <Card className="glass max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive ? "border-gray-500 bg-gray-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-base font-semibold">Drop multiple resumes here</h3>
              <p className="text-xs text-gray-600">or click to browse files</p>
              <div className="flex justify-center space-x-3 text-xs text-gray-500">
                <span>PDF</span>
                <span>•</span>
                <span>DOCX</span>
                <span>•</span>
                <span>Multiple files supported</span>
              </div>
              <Button
                variant="outline"
                className="mt-3 text-sm py-1 px-3 h-8"
                onClick={() => document.getElementById("resume-upload")?.click()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-3 h-3 mr-1 animate-spin" />
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
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Uploaded Files ({uploadedFiles.length})</h4>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-3 h-3 text-gray-600" />
                      <span className="text-xs">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700"
                      disabled={isLoading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Processing Progress</h4>
              <Progress value={uploadProgress} className="w-full h-2" />
              <p className="text-xs text-gray-600 mt-1">
                {currentFile ? `Processing: ${currentFile}` : "Processing files..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderExcelUpload = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Import Excel/CSV</h2>
        <p className="text-sm text-gray-600">Upload an Excel or CSV file with employee data</p>
      </div>

      <Card className="glass max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-base font-semibold">Upload Excel/CSV File</h3>
              <p className="text-xs text-gray-600">Use our template for best results</p>
              <div className="flex justify-center space-x-3 text-xs text-gray-500">
                <span>XLS</span>
                <span>•</span>
                <span>XLSX</span>
                <span>•</span>
                <span>CSV</span>
              </div>
              <Button
                variant="outline"
                className="mt-3 text-sm py-1 px-3 h-8"
                onClick={() => document.getElementById("excel-upload")?.click()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-3 h-3 mr-1 animate-spin" />
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

          <div className="mt-4 p-3 bg-gray-50 rounded-lg relative">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Template Columns Required:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
              <div>• Employee Name</div>
              <div>• Employee ID</div>
              <div>• Email</div>
              <div>• Department</div>
              <div>• Job Title</div>
              <div>• Manager Name</div>
              <div>• Employment Type</div>
              <div>• Office Location</div>
              <div>• Start Date</div>
              <div>• Notes</div>
            </div>
            <div className="absolute top-3 right-3">
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
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Add Employee Details</h2>
        <p className="text-sm text-gray-600">Fill in the employee information below</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center text-base font-semibold">
              <User className="w-4 h-4 mr-2" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="employeeName" className="text-xs">Employee Name *</Label>
              <Input
                id="employeeName"
                value={formData.employeeName}
                onChange={(e) => handleInputChange("employeeName", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="employeeId" className="text-xs">Employee ID *</Label>
              <Input
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => handleInputChange("employeeId", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="department" className="text-xs">Department *</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleInputChange("department", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobTitle" className="text-xs">Job Title *</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="managerName" className="text-xs">Manager Name</Label>
              <Input
                id="managerName"
                value={formData.managerName}
                onChange={(e) => handleInputChange("managerName", e.target.value)}
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="employmentType" className="text-xs">Employment Type *</Label>
              <Select
                value={formData.employmentType}
                onValueChange={(value) => handleInputChange("employmentType", value)}
                disabled={isLoading}
              >
                <SelectTrigger className="glass border-gray-200 text-sm h-8">
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="full-time">Full-Time</SelectItem>
                  <SelectItem value="part-time">Part-Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="officeLocation" className="text-xs">Office Location *</Label>
              <Input
                id="officeLocation"
                value={formData.officeLocation}
                onChange={(e) => handleInputChange("officeLocation", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                required
                className="glass border-gray-200 text-sm h-8"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="notes" className="text-xs">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                className="glass border-gray-200 min-h-[60px] text-sm"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center text-base font-semibold">
              <Upload className="w-4 h-4 mr-2" />
              Resume Upload (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors"
            >
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-600">Upload employee's resume for reference</p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 text-sm py-1 px-3 h-8"
                onClick={() => document.getElementById("manual-resume-upload")?.click()}
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
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm py-1 px-3 h-8"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-3 h-3 mr-1 animate-spin" />
                Adding Employee...
              </>
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Add Employee
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
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              to={`/campaign-dashboard/${clientId}`}
              className="flex items-center space-x-2 hover:scale-105 transition-transform duration-300"
            >
              <Button variant="ghost" size="sm" className="p-1">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">Add New Employee</h1>
                <p className="text-xs text-gray-600">Expand your internal team</p>
              </div>
            </Link>

            {mode !== "choice" && (
              <Button
                variant="outline"
                onClick={() => setMode("choice")}
                className="glass border-gray-200 text-sm py-1 px-3 h-8"
              >
                Change Method
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {mode === "choice" && renderChoiceScreen()}
        {mode === "resume" && renderResumeUpload()}
        {mode === "excel" && renderExcelUpload()}
        {mode === "manual" && renderManualForm()}
      </main>
    </div>
  );
};

export default AddEmployee;