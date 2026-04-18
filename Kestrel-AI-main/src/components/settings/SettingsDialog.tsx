import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ApiKeys } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SettingsDialogProps {
  apiKeys?: ApiKeys;
  onSaveApiKeys?: (keys: ApiKeys) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  apiKeys = {
    openai: "",
    marketData: "",
    financialModelingPrep: "",
  },
  onSaveApiKeys = () => {},
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const [keys, setKeys] = useState<ApiKeys>(apiKeys);
  const [dialogOpen, setDialogOpen] = useState(open || false);
  const { toast } = useToast();

  // Update internal state when props change
  useEffect(() => {
    if (open !== undefined) {
      setDialogOpen(open);
    }
  }, [open]);

  useEffect(() => {
    setKeys(apiKeys);
  }, [apiKeys]);

  const handleOpenChange = (newOpen: boolean) => {
    setDialogOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  const handleSave = () => {
    onSaveApiKeys(keys);
    if (onOpenChange === undefined) {
      setDialogOpen(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys for the services used by this application.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="openai" className="text-right">
              OpenAI
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="openai"
                type="password"
                value={keys.openai}
                onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
                className="flex-1"
                placeholder="sk-..."
                required
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="px-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Required for SQL generation. Get your API key from{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        OpenAI
                      </a>
                      .
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="marketData" className="text-right">
              MarketData
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="marketData"
                type="password"
                value={keys.marketData}
                onChange={(e) =>
                  setKeys({ ...keys, marketData: e.target.value })
                }
                className="flex-1"
                placeholder="md-..."
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="px-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Optional. Used for additional market insights. Get your
                      API key from{" "}
                      <a
                        href="https://marketdata.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        MarketData.app
                      </a>
                      .
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fmp" className="text-right">
              FMP
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="col-span-3 flex gap-2">
              <Input
                id="fmp"
                type="password"
                value={keys.financialModelingPrep}
                onChange={(e) =>
                  setKeys({ ...keys, financialModelingPrep: e.target.value })
                }
                className="flex-1"
                placeholder="fmp-..."
                required
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="px-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Required for market data. Get your free API key from{" "}
                      <a
                        href="https://site.financialmodelingprep.com/developer/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Financial Modeling Prep
                      </a>
                      .
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <p className="text-sm text-muted-foreground">
            Fields marked with <span className="text-destructive">*</span> are
            required
          </p>
          <Button
            onClick={handleSave}
            className="bg-[#26A69A] hover:bg-[#2bbeaf] ml-auto"
            disabled={!keys.openai || !keys.financialModelingPrep}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
