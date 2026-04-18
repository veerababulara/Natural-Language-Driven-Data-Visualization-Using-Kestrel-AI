import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryInputProps {
  onGenerate?: (prompt: string) => Promise<void>;
  isLoading?: boolean;
  initialPrompt?: string;
}

const EXAMPLE_PROMPTS = [
  "Show me the top 10 tech companies by market cap",
  "List all companies in the healthcare sector",
  "What are the profit margins of major retail companies?",
  "Show financial performance of renewable energy companies",
  "List companies with highest dividend yield in the S&P 500",
  "Compare the stock prices of Apple, Microsoft, and Google",
  "Find companies with the highest revenue growth in the technology sector",
  "Show me financial statements for Tesla",
  "Which tech companies have the best revenue growth in 2023?",
  "Compare the market capitalization of top semiconductor companies",
  "Show me dividend yields of blue-chip technology stocks",
  "What are the financial metrics for NVIDIA and AMD?",
  "List the most profitable cloud computing companies",
  "Show me tech companies with the highest P/E ratios",
  "Show me the top pharmaceutical companies by market cap",
  "Which healthcare companies have the highest profit margins?",
  "Compare revenue growth of major biotech firms",
  "Show medical device manufacturers with positive revenue growth",
];

export default function QueryInput({
  onGenerate = async () => {},
  isLoading = false,
  initialPrompt = "",
}: QueryInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  // Update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleExampleSelect = (value: string) => {
    setPrompt(EXAMPLE_PROMPTS[parseInt(value)]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt);
    }
  };

  return (
    <div className="w-full space-y-4 bg-card p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold">Natural Language Query</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p>
                  Enter your market research question in plain English. The
                  system will convert it to SQL and fetch relevant data.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select onValueChange={handleExampleSelect}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Example prompts" />
          </SelectTrigger>
          <SelectContent>
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <SelectItem key={index} value={index.toString()}>
                Example {index + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="Enter your market research query in natural language..."
          className="min-h-[120px] text-base"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <p className="text-sm text-muted-foreground">
            Example: "Show me tech companies with market cap over $500B"
          </p>
          <Button
            type="submit"
            className="w-full sm:w-auto sm:ml-auto bg-[#26A69A] hover:bg-[#2bbeaf] text-white"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
