import React, { useState, useEffect, useCallback, useRef } from "react";
import QueryInput from "@/components/sql-generator/QueryInput";
import { ResultsDisplay } from "@/components/sql-generator/ResultsDisplay";
import VisualizationSection from "@/components/sql-generator/VisualizationSection";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import {
  processNaturalLanguageQuery,
  loadApiKeys,
  saveApiKeys,
  ApiKeys,
} from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Layout } from "@/components/layout/Layout";
import { Loader2, Settings, List } from "lucide-react";
import { BackToTop } from "@/components/ui/back-to-top";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define types for better code organization
interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
    borderWidth?: number;
  }[];
}

export default function SQLGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any[] | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: "",
    marketData: "",
    financialModelingPrep: "",
  });
  const [showVisualization, setShowVisualization] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [lastQuery, setLastQuery] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Check if API keys are set on component mount
  useEffect(() => {
    const loadKeys = async () => {
      const keys = await loadApiKeys();
      setApiKeys(keys);
      if (!keys.openai || !keys.financialModelingPrep) {
        setShowSettings(true);
        toast({
          title: "API Keys Required",
          description: "Please set your API keys to use the application.",
          variant: "destructive",
        });
      }
    };

    loadKeys();
  }, []);

  // Generate chart data based on the query results - now with dynamic field detection
  const generateChartData = useCallback(
    (resultData: any[], queryText: string) => {
      if (!resultData || resultData.length === 0) return null;

      // Determine the best visualization based on the data and query
      const queryLower = queryText.toLowerCase();
      let bestChartType: "bar" | "line" | "pie" = "bar";
      let labelField = "";
      let valueField = "";

      // Find the best label field dynamically
      const possibleLabelFields = [
        "name",
        "symbol",
        "company",
        "sector",
        "industry",
        "date",
      ];
      for (const field of possibleLabelFields) {
        const matchingKey = Object.keys(resultData[0]).find((key) =>
          key.toLowerCase().includes(field),
        );
        if (matchingKey) {
          labelField = matchingKey;
          break;
        }
      }

      // If no label field found, use the first field
      if (!labelField) {
        labelField = Object.keys(resultData[0])[0];
      }

      // Find the best value field based on the query context
      const queryContexts = [
        {
          keywords: ["revenue", "sales", "growth"],
          fieldHints: ["revenue", "growth"],
          chartType: "bar",
        },
        {
          keywords: ["market cap", "marketcap", "valuation"],
          fieldHints: ["marketcap", "market", "cap"],
          chartType: "bar",
        },
        {
          keywords: ["dividend", "yield", "payout"],
          fieldHints: ["dividend", "yield", "payout"],
          chartType: "bar",
        },
        {
          keywords: ["price", "stock", "share"],
          fieldHints: ["price", "value"],
          chartType: "line",
        },
        {
          keywords: ["profit", "margin", "profitability"],
          fieldHints: ["profit", "margin"],
          chartType: "bar",
        },
        {
          keywords: ["sector", "industry", "segment"],
          fieldHints: ["percentage", "value", "count"],
          chartType: "pie",
        },
        {
          keywords: ["eps", "earnings", "income"],
          fieldHints: ["eps", "earnings", "income"],
          chartType: "bar",
        },
      ];

      // Find the best matching context based on the query
      let bestContext = null;
      let highestScore = 0;

      for (const context of queryContexts) {
        const score = context.keywords.reduce((total, keyword) => {
          return queryLower.includes(keyword) ? total + 1 : total;
        }, 0);

        if (score > highestScore) {
          highestScore = score;
          bestContext = context;
        }
      }

      // If we found a matching context, look for a matching field
      if (bestContext) {
        for (const hint of bestContext.fieldHints) {
          const matchingKey = Object.keys(resultData[0]).find((key) =>
            key.toLowerCase().includes(hint),
          );
          if (matchingKey) {
            valueField = matchingKey;
            bestChartType = bestContext.chartType;
            break;
          }
        }
      }

      // If we still couldn't find a specific value field, use the first numeric field
      if (!valueField) {
        valueField =
          Object.keys(resultData[0]).find(
            (key) => typeof resultData[0][key] === "number" && key !== "id",
          ) ||
          Object.keys(resultData[0])[1] ||
          "";
      }

      // Set the chart type
      setChartType(bestChartType);

      // Generate the chart data
      return {
        labels: resultData.map(
          (item, index) => item[labelField] || `Item ${index + 1}`,
        ),
        datasets: [
          {
            label: valueField.charAt(0).toUpperCase() + valueField.slice(1),
            data: resultData.map((item) => {
              // Handle case where the value field doesn't exist
              if (!valueField || !(valueField in item)) {
                const numericKey = Object.keys(item).find(
                  (key) => typeof item[key] === "number" && key !== "id",
                );
                return numericKey ? item[numericKey] : 0;
              }
              return item[valueField] || 0;
            }),
            backgroundColor: [
              "#26A69A",
              "#4CAF50",
              "#2196F3",
              "#9C27B0",
              "#FF9800",
              "#F44336",
              "#673AB7",
              "#3F51B5",
              "#009688",
              "#795548",
              "#607D8B",
              "#E91E63",
              "#CDDC39",
              "#00BCD4",
              "#FFC107",
              "#8BC34A",
              "#03A9F4",
              "#FF5722",
              "#9E9E9E",
              "#3F51B5",
            ],
            borderWidth: 1,
          },
        ],
      };
    },
    [],
  );

  const handleGenerate = async (prompt: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setLastQuery(prompt);
      setPrompt(prompt); // Save the prompt for future reference

      // Load the latest API keys
      const latestKeys = await loadApiKeys();
      setApiKeys(latestKeys);

      // Check if API keys are set
      if (!latestKeys.openai || !latestKeys.financialModelingPrep) {
        setShowSettings(true);
        throw new Error(
          "API keys are required. Please set them in the settings.",
        );
      }

      // Process the natural language query using real APIs
      const result = await processNaturalLanguageQuery(prompt, latestKeys);

      if (result.error) {
        throw new Error(result.error);
      }

      // Set the data and SQL query
      setData(result.data);
      setSqlQuery(result.sqlQuery);

      // Generate chart data if we have results
      if (result.data && result.data.length > 0) {
        const newChartData = generateChartData(result.data, prompt);
        setChartData(newChartData);
        setShowVisualization(true);
      } else {
        setShowVisualization(false);
        throw new Error(
          "No data available for this query. Our system is designed to fetch real-time data for any market index or financial query. If you're seeing this error, it might be due to API rate limits or the specific data not being available through our current data providers. Please try a different query or check your API keys.",
        );
      }
    } catch (err) {
      console.error("Error generating results:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to process query",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKeys = async (keys: ApiKeys) => {
    setApiKeys(keys);
    await saveApiKeys(keys);
    setShowSettings(false);
    toast({
      title: "API Keys Saved",
      description: "Your API keys have been saved successfully.",
    });
  };

  // Handle chart type change from visualization section
  const handleChartTypeChange = (type: "bar" | "line" | "pie") => {
    setChartType(type);
  };

  return (
    <Layout>
      <div className="flex w-full h-full">
        <div className="hidden md:block w-48 lg:w-64 h-screen overflow-auto border-r p-4 sticky top-0">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <List className="h-4 w-4" /> Navigation
          </h3>
          <ul className="space-y-2">
            <li>
              <a
                href="#query-input"
                className="text-sm hover:text-[#26A69A] block py-1"
              >
                Query Input
              </a>
            </li>
            <li>
              <a
                href="#results"
                className="text-sm hover:text-[#26A69A] block py-1"
              >
                Results
              </a>
            </li>
            <li>
              <a
                href="#visualization"
                className="text-sm hover:text-[#26A69A] block py-1"
              >
                Visualization
              </a>
            </li>
          </ul>
        </div>
        <div className="flex-1 space-y-6 pb-80 overflow-auto">
          {/* Added more padding at the bottom for scrolling */}
          <div className="flex justify-between items-center sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 border-b">
            <h1 className="text-3xl font-bold">
              Natural Language <span className="text-[#26A69A]">SQL</span>{" "}
              Generator
            </h1>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="rounded-full h-10 w-10"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div id="query-input" className="grid grid-cols-1 gap-6">
            <div>
              <div className="bg-card rounded-lg border shadow-sm p-6">
                <QueryInput
                  onGenerate={handleGenerate}
                  isLoading={isLoading}
                  initialPrompt={prompt}
                />
              </div>
            </div>
          </div>

          <div id="results" ref={resultsRef}>
            <ResultsDisplay
              data={data}
              sqlQuery={sqlQuery}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {isLoading && !data && (
            <div className="w-full flex justify-center py-8">
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#26A69A]" />
                <p className="mt-4 text-muted-foreground">
                  Generating visualization...
                </p>
              </div>
            </div>
          )}

          {showVisualization && data && data.length > 0 && chartData && (
            <section id="visualization" className="mt-4">
              <VisualizationSection
                data={data}
                isVisible={showVisualization}
                chartData={chartData}
                chartType={chartType}
              />
            </section>
          )}
        </div>
      </div>

      <SettingsDialog
        apiKeys={apiKeys}
        onSaveApiKeys={handleSaveApiKeys}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      <BackToTop />
    </Layout>
  );
}
