import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Code2,
  Copy,
  Check,
  Play,
  Book,
  Webhook,
  Video,
  FolderOpen,
  BarChart3,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface APIEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  description: string;
  auth?: boolean;
  requestBody?: {
    [key: string]: {
      type: string;
      required: boolean;
      description: string;
    };
  };
  responseExample?: any;
  category: string;
}

const API_ENDPOINTS: APIEndpoint[] = [
  {
    method: "GET",
    path: "/api/videos",
    description: "Get all videos from all folders",
    category: "Videos",
    responseExample: {
      videos: [
        {
          id: "abc123",
          title: "Sample Video",
          duration: 120,
          thumbnail: "https://...",
          folder_id: "folder1",
        },
      ],
      folders: [],
      total: 1,
    },
  },
  {
    method: "GET",
    path: "/api/videos/:id",
    description: "Get a specific video by ID",
    category: "Videos",
    responseExample: {
      id: "abc123",
      title: "Sample Video",
      duration: 120,
      thumbnail: "https://...",
    },
  },
  {
    method: "DELETE",
    path: "/api/admin/videos/:id",
    description: "Delete a video (requires authentication)",
    auth: true,
    category: "Videos",
    responseExample: { success: true },
  },
  {
    method: "PATCH",
    path: "/api/admin/videos/:id",
    description: "Update video metadata (requires authentication)",
    auth: true,
    category: "Videos",
    requestBody: {
      name: { type: "string", required: true, description: "New video name" },
    },
    responseExample: { success: true },
  },
  {
    method: "GET",
    path: "/api/admin/folders",
    description: "Get all folders with statistics",
    auth: true,
    category: "Folders",
    responseExample: {
      folders: [
        {
          id: "folder1",
          name: "My Folder",
          video_count: 10,
          total_size: 1024000,
        },
      ],
    },
  },
  {
    method: "POST",
    path: "/api/admin/folders",
    description: "Create a new folder",
    auth: true,
    category: "Folders",
    requestBody: {
      name: { type: "string", required: true, description: "Folder name" },
      description: { type: "string", required: false, description: "Folder description" },
    },
    responseExample: { id: "new-folder-id", name: "New Folder" },
  },
  {
    method: "GET",
    path: "/api/admin/webhooks",
    description: "Get all webhooks for authenticated user",
    auth: true,
    category: "Webhooks",
    responseExample: {
      webhooks: [
        {
          id: "webhook1",
          name: "My Webhook",
          url: "https://example.com/webhook",
          events: ["video.uploaded"],
          active: true,
        },
      ],
      total: 1,
    },
  },
  {
    method: "POST",
    path: "/api/admin/webhooks",
    description: "Create a new webhook",
    auth: true,
    category: "Webhooks",
    requestBody: {
      name: { type: "string", required: true, description: "Webhook name" },
      url: { type: "string", required: true, description: "Webhook URL" },
      events: { type: "string[]", required: true, description: "Array of event types" },
      active: { type: "boolean", required: false, description: "Active status (default: true)" },
    },
    responseExample: {
      id: "new-webhook-id",
      name: "My Webhook",
      url: "https://example.com/webhook",
    },
  },
  {
    method: "GET",
    path: "/api/admin/analytics/overview",
    description: "Get analytics overview",
    auth: true,
    category: "Analytics",
    responseExample: {
      totalViews: 1000,
      totalWatchTime: 50000,
      averageCompletionRate: 0.75,
    },
  },
  {
    method: "POST",
    path: "/api/analytics/session/start",
    description: "Start a video analytics session",
    category: "Analytics",
    requestBody: {
      videoId: { type: "string", required: true, description: "Video ID" },
      userId: { type: "string", required: false, description: "User ID" },
    },
    responseExample: {
      sessionId: "session123",
      videoId: "abc123",
    },
  },
];

const CATEGORIES = [
  { name: "All", icon: Book },
  { name: "Videos", icon: Video },
  { name: "Folders", icon: FolderOpen },
  { name: "Webhooks", icon: Webhook },
  { name: "Analytics", icon: BarChart3 },
];

export default function APIDocs() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [testEndpoint, setTestEndpoint] = useState("");
  const [testMethod, setTestMethod] = useState<string>("GET");
  const [testBody, setTestBody] = useState("{}");
  const [testResponse, setTestResponse] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredEndpoints =
    selectedCategory === "All"
      ? API_ENDPOINTS
      : API_ENDPOINTS.filter((e) => e.category === selectedCategory);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const testAPI = async () => {
    try {
      const options: RequestInit = {
        method: testMethod,
        headers: { "Content-Type": "application/json" },
      };

      if (testMethod !== "GET" && testBody) {
        try {
          JSON.parse(testBody);
          options.body = testBody;
        } catch (e) {
          toast.error("Invalid JSON in request body");
          return;
        }
      }

      const response = await fetch(testEndpoint, options);
      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
      toast.success(`API call ${response.ok ? "successful" : "failed"}`);
    } catch (error) {
      setTestResponse(error instanceof Error ? error.message : "Request failed");
      toast.error("API call failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground">
          Complete reference for VideoHub API endpoints
        </p>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={category.name} value={category.name} className="gap-2">
                <Icon className="h-4 w-4" />
                {category.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-4 mt-6">
          {/* API Endpoints */}
          <div className="space-y-4">
            {filteredEndpoints.map((endpoint, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "font-mono",
                            endpoint.method === "GET" && "bg-blue-500",
                            endpoint.method === "POST" && "bg-green-500",
                            endpoint.method === "PATCH" && "bg-yellow-500",
                            endpoint.method === "DELETE" && "bg-red-500"
                          )}
                        >
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm font-mono">{endpoint.path}</code>
                        {endpoint.auth && (
                          <Badge variant="outline" className="text-xs">
                            Auth Required
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{endpoint.description}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          `fetch('${endpoint.path}', { method: '${endpoint.method}' })`,
                          `endpoint-${index}`
                        )
                      }
                    >
                      {copiedCode === `endpoint-${index}` ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {endpoint.requestBody && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Request Body</h4>
                      <div className="rounded-lg bg-muted p-4 space-y-2">
                        {Object.entries(endpoint.requestBody).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <code className="font-mono">
                              {key}{value.required && <span className="text-red-500">*</span>}
                            </code>
                            <span className="text-muted-foreground ml-2">
                              ({value.type}) - {value.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {endpoint.responseExample && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Response Example</h4>
                      <pre className="rounded-lg bg-muted p-4 overflow-x-auto">
                        <code className="text-sm">
                          {JSON.stringify(endpoint.responseExample, null, 2)}
                        </code>
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* API Testing Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            API Testing Interface
          </CardTitle>
          <CardDescription>
            Test API endpoints directly from this interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="method">HTTP Method</Label>
              <select
                id="method"
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                placeholder="/api/videos"
              />
            </div>
          </div>

          {testMethod !== "GET" && (
            <div className="space-y-2">
              <Label htmlFor="body">Request Body (JSON)</Label>
              <Textarea
                id="body"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={5}
                className="font-mono text-sm"
              />
            </div>
          )}

          <Button onClick={testAPI} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            Send Request
          </Button>

          {testResponse && (
            <div className="space-y-2">
              <Label>Response</Label>
              <pre className="rounded-lg bg-muted p-4 overflow-x-auto max-h-96">
                <code className="text-sm">{testResponse}</code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
