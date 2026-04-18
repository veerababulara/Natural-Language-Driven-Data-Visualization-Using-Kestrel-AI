import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Edit,
  BarChart,
  LineChart,
  PieChart,
  Settings,
  Download,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import Highcharts
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

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

interface VisualizationSectionProps {
  data?: any[];
  isVisible?: boolean;
  chartData?: ChartData;
  chartType?: "bar" | "line" | "pie";
}

const VisualizationSection = ({
  data = [],
  isVisible = true,
  chartData,
  chartType = "bar",
}: VisualizationSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [currentChartType, setCurrentChartType] = useState<
    "bar" | "line" | "pie"
  >(chartType);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDataField, setSelectedDataField] = useState<string>("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [chartTitle, setChartTitle] = useState<string>("");
  const [chartOptions, setChartOptions] = useState<Highcharts.Options>({});
  const [colorScheme, setColorScheme] = useState<string>("teal");
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  // Color schemes for charts
  const colorSchemes = {
    teal: ["#26A69A", "#4DB6AC", "#80CBC4", "#B2DFDB", "#E0F2F1"],
    blue: ["#2196F3", "#64B5F6", "#90CAF9", "#BBDEFB", "#E3F2FD"],
    purple: ["#9C27B0", "#BA68C8", "#CE93D8", "#E1BEE7", "#F3E5F5"],
    green: ["#4CAF50", "#81C784", "#A5D6A7", "#C8E6C9", "#E8F5E9"],
    orange: ["#FF9800", "#FFB74D", "#FFCC80", "#FFE0B2", "#FFF3E0"],
    red: ["#F44336", "#E57373", "#EF9A9A", "#FFCDD2", "#FFEBEE"],
    multi: [
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
    ],
  };

  // Initialize available fields and selected field when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      // Find numeric fields for charting
      const numericFields = Object.keys(data[0]).filter(
        (key) => typeof data[0][key] === "number" && key !== "id",
      );
      setAvailableFields(numericFields);

      // Set default selected field
      if (numericFields.length > 0 && !selectedDataField) {
        setSelectedDataField(numericFields[0]);
        setChartTitle(
          `${numericFields[0].charAt(0).toUpperCase() + numericFields[0].slice(1)} Comparison`,
        );
      }
    }
  }, [data, selectedDataField]);

  // Update chart when chartData, currentChartType, or selectedDataField changes
  useEffect(() => {
    if (chartData || (data && data.length > 0 && selectedDataField)) {
      // Add a small delay to ensure the container is rendered and has dimensions
      const timer = setTimeout(() => {
        updateChartOptions();
        // Force a reflow of the chart if it exists
        if (chartRef.current && chartRef.current.chart) {
          chartRef.current.chart.reflow();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chartData, currentChartType, selectedDataField, colorScheme, data]);

  // Handle chart type change
  const handleChartTypeChange = (type: "bar" | "line" | "pie") => {
    setCurrentChartType(type);
  };

  // Toggle edit mode
  const handleToggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  // Handle data field selection change
  const handleDataFieldChange = (field: string) => {
    setSelectedDataField(field);
    setChartTitle(
      `${field.charAt(0).toUpperCase() + field.slice(1)} Comparison`,
    );
  };

  // Handle color scheme change
  const handleColorSchemeChange = (scheme: string) => {
    setColorScheme(scheme);
  };

  // Generate chart data based on selected field
  const generateChartData = () => {
    if (!data || data.length === 0 || !selectedDataField) {
      return chartData || null;
    }

    // Get label field (usually name, symbol, or company)
    const labelField =
      Object.keys(data[0]).find(
        (key) =>
          key.toLowerCase().includes("name") ||
          key.toLowerCase().includes("symbol") ||
          key.toLowerCase().includes("company"),
      ) || Object.keys(data[0])[0];

    // Determine if we should sort the data
    let processedData = [...data];

    // Get the data values for the selected field
    const dataValues = processedData.map(
      (item) => item[selectedDataField] || 0,
    );

    // Generate appropriate colors based on data values
    const colors =
      colorSchemes[colorScheme as keyof typeof colorSchemes] ||
      colorSchemes.teal;

    // For percentage or ratio fields, use a gradient color scheme
    const isPercentageField =
      selectedDataField.toLowerCase().includes("percent") ||
      selectedDataField.toLowerCase().includes("ratio") ||
      selectedDataField.toLowerCase().includes("yield");

    // Generate background colors based on data values
    const backgroundColors = isPercentageField
      ? dataValues.map((value, index) => {
          // For percentage fields, use a gradient from red (low) to green (high)
          const normalizedValue = Math.min(Math.max(value / 100, 0), 1); // Normalize to 0-1
          return colors[Math.floor(normalizedValue * (colors.length - 1))];
        })
      : colors;

    return {
      labels: processedData.map((item) => item[labelField] || "Unknown"),
      datasets: [
        {
          label:
            selectedDataField.charAt(0).toUpperCase() +
            selectedDataField.slice(1),
          data: processedData.map((item) => item[selectedDataField] || 0),
          backgroundColor: backgroundColors,
          borderWidth: 1,
        },
      ],
    };
  };

  // Update Highcharts options based on chart type and data
  const updateChartOptions = () => {
    const generatedData = generateChartData();
    if (!generatedData) return;

    const { labels, datasets } = generatedData;
    const colors =
      colorSchemes[colorScheme as keyof typeof colorSchemes] ||
      colorSchemes.teal;

    // Detect if data values are very large and format accordingly
    const hasLargeValues = datasets[0].data.some((value) => value > 1000000);
    const valueFormatter = hasLargeValues
      ? (value: number) => {
          if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
          if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
          if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
          return value.toFixed(2);
        }
      : undefined;

    let options: Highcharts.Options = {
      chart: {
        type:
          currentChartType === "pie"
            ? "pie"
            : currentChartType === "line"
              ? "line"
              : "column",
        backgroundColor: "transparent",
        style: {
          fontFamily: "Inter, sans-serif",
        },
        zooming: {
          type: "xy",
          mouseWheel: true,
        },
        animation: {
          duration: 1000,
          easing: "easeOutBounce",
        },
        events: {
          load: function () {
            // This ensures the chart is properly sized when loaded
            setTimeout(() => {
              if (this.reflow) this.reflow();
            }, 100);
          },
        },
      },
      title: {
        text: chartTitle,
        style: {
          color: "#26A69A",
          fontWeight: "bold",
          fontSize: "16px",
        },
      },
      subtitle: {
        text: "Click and drag to zoom in. Shift + drag to pan.",
        style: {
          fontSize: "11px",
          color: "#666",
        },
      },
      credits: {
        enabled: false,
      },
      colors: colors,
      tooltip: {
        valueDecimals: 2,
        shared: true,
        useHTML: true,
        headerFormat: "<small>{point.key}</small><table>",
        pointFormat:
          '<tr><td style="color: {series.color}">{series.name}: </td>' +
          '<td style="text-align: right"><b>{point.y:,.2f}</b></td></tr>',
        footerFormat: "</table>",
        valuePrefix:
          currentChartType === "pie" &&
          datasets[0].label.toLowerCase().includes("percentage")
            ? ""
            : "",
        valueSuffix:
          currentChartType === "pie" &&
          datasets[0].label.toLowerCase().includes("percentage")
            ? "%"
            : "",
      },
      plotOptions: {
        series: {
          animation: {
            duration: 1000,
          },
          borderRadius: 3,
          states: {
            hover: {
              brightness: 0.1,
              halo: {
                size: 5,
              },
            },
            inactive: {
              opacity: 0.5,
            },
          },
          dataLabels: {
            enabled: false,
          },
        },
        column: {
          pointPadding: 0.2,
          borderWidth: 0,
          borderRadius: 5,
          colorByPoint: datasets[0].data.length <= 10,
        },
        line: {
          marker: {
            enabled: datasets[0].data.length < 15,
            radius: 4,
            symbol: "circle",
          },
          lineWidth: 3,
        },
      },
      legend: {
        enabled: true,
        align: "center",
        verticalAlign: "bottom",
        layout: "horizontal",
        itemStyle: {
          fontWeight: "normal",
        },
      },
      exporting: {
        enabled: true,
        buttons: {
          contextButton: {
            menuItems: [
              "downloadPNG",
              "downloadJPEG",
              "downloadPDF",
              "downloadSVG",
              "separator",
              "downloadCSV",
              "downloadXLS",
            ],
          },
        },
      },
      responsive: {
        rules: [
          {
            condition: {
              maxWidth: 500,
            },
            chartOptions: {
              legend: {
                layout: "horizontal",
                align: "center",
                verticalAlign: "bottom",
              },
              yAxis: {
                labels: {
                  align: "left",
                  x: 0,
                  y: -5,
                },
                title: {
                  text: null,
                },
              },
              subtitle: {
                text: null,
              },
              credits: {
                enabled: false,
              },
            },
          },
        ],
      },
    };

    if (currentChartType === "pie") {
      options.series = [
        {
          type: "pie",
          name: datasets[0].label,
          data: labels.map((label, index) => ({
            name: label,
            y: datasets[0].data[index],
            // Add custom colors for each slice if we have fewer data points
            color:
              datasets[0].data.length <= 10
                ? colors[index % colors.length]
                : undefined,
          })),
        },
      ];
      options.plotOptions = {
        ...options.plotOptions,
        pie: {
          allowPointSelect: true,
          cursor: "pointer",
          depth: 35,
          innerSize: "40%", // Creates a donut chart
          dataLabels: {
            enabled: true,
            format: "<b>{point.name}</b>: {point.percentage:.1f}%",
            distance: 20,
            filter: {
              property: "percentage",
              operator: ">",
              value: 4, // Only show labels for slices larger than 4%
            },
            style: {
              fontWeight: "normal",
              textOutline: "1px contrast",
            },
          },
          showInLegend: true,
          borderWidth: 0,
          states: {
            hover: {
              brightness: 0.1,
            },
          },
        },
      };
    } else {
      options.xAxis = {
        categories: labels,
        crosshair: true,
        labels: {
          rotation: labels.length > 10 ? -45 : 0,
          style: {
            fontSize: "10px",
            color: "#666",
          },
          overflow: "justify",
        },
        tickLength: 5,
        lineColor: "#ddd",
        lineWidth: 1,
        title: {
          text: null,
        },
      };
      options.yAxis = {
        title: {
          text: datasets[0].label,
          style: {
            color: "#666",
          },
        },
        labels: {
          formatter: function () {
            // @ts-ignore
            return hasLargeValues ? valueFormatter(this.value) : this.value;
          },
          style: {
            color: "#666",
          },
        },
        gridLineColor: "#eee",
        gridLineDashStyle: "Dash",
        lineColor: "#ddd",
        lineWidth: 1,
        min: 0,
      };
      options.series = [
        {
          type: currentChartType === "line" ? "line" : "column",
          name: datasets[0].label,
          data: datasets[0].data,
          // For line charts, add area under the line with transparency
          ...(currentChartType === "line"
            ? {
                fillOpacity: 0.2,
                fillColor: {
                  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                  stops: [
                    [0, colors[0]],
                    [
                      1,
                      Highcharts.color(colors[0])
                        .setOpacity(0)
                        .get("rgba") as string,
                    ],
                  ],
                },
              }
            : {}),
        },
      ];
    }

    setChartOptions(options);
  };

  // Export chart as image
  const handleExportChart = () => {
    if (chartRef.current && chartRef.current.chart) {
      // Show export menu with options
      chartRef.current.chart.exportChart();
    } else {
      alert("Chart is not ready for export. Please try again.");
    }
  };

  // Refresh chart with current data
  const handleRefreshChart = () => {
    if (chartRef.current && chartRef.current.chart) {
      // Add animation to refresh
      chartRef.current.chart.update(
        {
          chart: {
            animation: {
              duration: 800,
              easing: "easeOutBounce",
            },
          },
        },
        false,
        false,
        false,
      );
      chartRef.current.chart.reflow();
      updateChartOptions();
    }
  };

  if (!isVisible || ((!data || data.length === 0) && !chartData)) return null;

  const generatedChartData = generateChartData();

  return (
    <div className="w-full bg-card rounded-lg border shadow-sm mt-4 overflow-visible">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between w-full p-4 cursor-pointer hover:bg-accent/50 rounded-t-lg">
            <div className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-[#26A69A]" />
              <h2 className="text-xl font-semibold">Data Visualization</h2>
            </div>
            <Button variant="ghost" size="icon">
              {isOpen ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="p-4">
          <div className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={currentChartType === "bar" ? "default" : "outline"}
                  onClick={() => handleChartTypeChange("bar")}
                  className={
                    currentChartType === "bar"
                      ? "bg-[#26A69A] hover:bg-[#2bbeaf]"
                      : ""
                  }
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  Bar Chart
                </Button>
                <Button
                  variant={currentChartType === "line" ? "default" : "outline"}
                  onClick={() => handleChartTypeChange("line")}
                  className={
                    currentChartType === "line"
                      ? "bg-[#26A69A] hover:bg-[#2bbeaf]"
                      : ""
                  }
                >
                  <LineChart className="h-4 w-4 mr-2" />
                  Line Chart
                </Button>
                <Button
                  variant={currentChartType === "pie" ? "default" : "outline"}
                  onClick={() => handleChartTypeChange("pie")}
                  className={
                    currentChartType === "pie"
                      ? "bg-[#26A69A] hover:bg-[#2bbeaf]"
                      : ""
                  }
                >
                  <PieChart className="h-4 w-4 mr-2" />
                  Pie Chart
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRefreshChart}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" onClick={handleExportChart}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" onClick={handleToggleEditMode}>
                  {isEditing ? (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Done
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Card className="w-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[#26A69A]">{chartTitle}</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <p>
                          This visualization is based on the data returned from
                          your query. You can change the chart type and
                          customize it using the edit button.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="h-96 w-full rounded-md overflow-hidden"
                  style={{ minHeight: "384px", minWidth: "100%" }}
                >
                  {generatedChartData ? (
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={chartOptions}
                      ref={chartRef}
                      containerProps={{
                        style: { height: "100%", width: "100%" },
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted/20">
                      <p className="text-muted-foreground">
                        No data available for chart
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {isEditing && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Chart Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Data Field Selection
                        </h3>
                        <Select
                          value={selectedDataField}
                          onValueChange={handleDataFieldChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select data field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFields.map((field) => (
                              <SelectItem key={field} value={field}>
                                {field.charAt(0).toUpperCase() + field.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Chart Title
                        </h3>
                        <input
                          type="text"
                          value={chartTitle}
                          onChange={(e) => setChartTitle(e.target.value)}
                          className="w-full p-2 border rounded-md bg-background"
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Color Scheme
                        </h3>
                        <Select
                          value={colorScheme}
                          onValueChange={handleColorSchemeChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select color scheme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teal">Teal</SelectItem>
                            <SelectItem value="blue">Blue</SelectItem>
                            <SelectItem value="purple">Purple</SelectItem>
                            <SelectItem value="green">Green</SelectItem>
                            <SelectItem value="orange">Orange</SelectItem>
                            <SelectItem value="red">Red</SelectItem>
                            <SelectItem value="multi">Multi-color</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Chart Appearance
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="showLegend"
                              className="rounded border-gray-300"
                              checked
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  chartRef.current.chart.update(
                                    {
                                      legend: {
                                        enabled: e.target.checked,
                                      },
                                    },
                                    true,
                                  );
                                }
                              }}
                            />
                            <label htmlFor="showLegend" className="text-sm">
                              Show Legend
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="showDataLabels"
                              className="rounded border-gray-300"
                              checked
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Update data labels for all series
                                  chartRef.current.chart.update(
                                    {
                                      plotOptions: {
                                        series: {
                                          dataLabels: {
                                            enabled: e.target.checked,
                                          },
                                        },
                                      },
                                    },
                                    true,
                                  );
                                }
                              }}
                            />
                            <label htmlFor="showDataLabels" className="text-sm">
                              Show Data Labels
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="enableAnimation"
                              className="rounded border-gray-300"
                              checked
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Toggle animation
                                  chartRef.current.chart.update(
                                    {
                                      plotOptions: {
                                        series: {
                                          animation: {
                                            duration: e.target.checked
                                              ? 1000
                                              : 0,
                                          },
                                        },
                                      },
                                    },
                                    true,
                                  );
                                }
                              }}
                            />
                            <label
                              htmlFor="enableAnimation"
                              className="text-sm"
                            >
                              Enable Animation
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="transparentBg"
                              className="rounded border-gray-300"
                              checked
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Toggle background transparency
                                  chartRef.current.chart.update(
                                    {
                                      chart: {
                                        backgroundColor: e.target.checked
                                          ? "transparent"
                                          : "#ffffff",
                                      },
                                    },
                                    true,
                                  );
                                }
                              }}
                            />
                            <label htmlFor="transparentBg" className="text-sm">
                              Transparent Background
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="enable3D"
                              className="rounded border-gray-300"
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Toggle 3D effect for pie charts
                                  if (currentChartType === "pie") {
                                    chartRef.current.chart.update(
                                      {
                                        chart: {
                                          options3d: {
                                            enabled: e.target.checked,
                                            alpha: 45,
                                            beta: 0,
                                          },
                                        },
                                        plotOptions: {
                                          pie: {
                                            depth: e.target.checked ? 35 : 0,
                                          },
                                        },
                                      },
                                      true,
                                    );
                                  }
                                }
                              }}
                            />
                            <label htmlFor="enable3D" className="text-sm">
                              3D Effect (Pie)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="enableZoom"
                              className="rounded border-gray-300"
                              checked
                              onChange={(e) => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Toggle zooming capability
                                  chartRef.current.chart.update(
                                    {
                                      chart: {
                                        zooming: {
                                          enabled: e.target.checked,
                                        },
                                      },
                                    },
                                    true,
                                  );
                                }
                              }}
                            />
                            <label htmlFor="enableZoom" className="text-sm">
                              Enable Zoom
                            </label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Data Display
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sortNone"
                              name="sortOrder"
                              className="rounded border-gray-300"
                              checked
                              onChange={() => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Reset to original order
                                  updateChartOptions();
                                }
                              }}
                            />
                            <label htmlFor="sortNone" className="text-sm">
                              No Sorting
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sortAsc"
                              name="sortOrder"
                              className="rounded border-gray-300"
                              onChange={() => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Sort series data ascending
                                  const chart = chartRef.current.chart;
                                  if (chart.series[0]) {
                                    chart.series[0].setData(
                                      [...chart.series[0].data]
                                        .sort((a, b) => (a.y || 0) - (b.y || 0))
                                        .map((point) => point.y),
                                      true,
                                    );
                                  }
                                }
                              }}
                            />
                            <label htmlFor="sortAsc" className="text-sm">
                              Sort Ascending
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="sortDesc"
                              name="sortOrder"
                              className="rounded border-gray-300"
                              onChange={() => {
                                if (
                                  chartRef.current &&
                                  chartRef.current.chart
                                ) {
                                  // Sort series data descending
                                  const chart = chartRef.current.chart;
                                  if (chart.series[0]) {
                                    chart.series[0].setData(
                                      [...chart.series[0].data]
                                        .sort((a, b) => (b.y || 0) - (a.y || 0))
                                        .map((point) => point.y),
                                      true,
                                    );
                                  }
                                }
                              }}
                            />
                            <label htmlFor="sortDesc" className="text-sm">
                              Sort Descending
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default VisualizationSection;
