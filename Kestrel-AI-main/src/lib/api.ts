// Dynamic API service for market research and SQL generation using RAG approach
import { createClient } from "@supabase/supabase-js";

export interface ApiKeys {
  openai: string;
  marketData: string;
  financialModelingPrep: string;
}

export interface QueryResult {
  data: any[];
  sqlQuery: string;
  error?: string;
}

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// OpenAI API for natural language to SQL conversion using RAG approach
async function generateSQLFromNaturalLanguage(
  prompt: string,
  apiKey: string,
): Promise<string> {
  try {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    // Enhanced system prompt with financial database context but without fixed schema
    const systemPrompt = `You are a SQL expert specializing in financial database queries. Convert the following natural language query into a precise SQL query.

The database contains financial information about companies, including metrics like:
- Basic company information (symbol, name, sector, industry)
- Market metrics (market cap, price, PE ratio)
- Financial performance (revenue, profit margins, growth rates)
- Dividend information (yield, payout ratio)
- Sector-specific metrics for retail, healthcare, technology and other industries

Only return the SQL query without any explanation or markdown formatting. Make sure the query is accurate, efficient, and follows best practices.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Using a more advanced model for better SQL generation
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2, // Lower temperature for more deterministic outputs
        max_tokens: 800, // Increased token limit for more complex queries
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Failed to generate SQL query",
      );
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating SQL:", error);
    // Fallback to a simpler query generation if the advanced one fails
    try {
      const fallbackResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `You are a SQL expert. Convert the following natural language query into a SQL query. 
              Only return the SQL query without any explanation or markdown formatting.`,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        },
      );

      if (!fallbackResponse.ok) {
        throw error; // Throw the original error if fallback also fails
      }

      const fallbackData = await fallbackResponse.json();
      return fallbackData.choices[0].message.content.trim();
    } catch (fallbackError) {
      console.error("Fallback SQL generation also failed:", fallbackError);
      throw error; // Throw the original error
    }
  }
}

// Fetch raw data from Financial Modeling Prep API based on query context
async function fetchRawFinancialData(
  query: string,
  apiKey: string,
): Promise<any[]> {
  try {
    if (!apiKey) {
      throw new Error("Financial Modeling Prep API key is required");
    }

    console.log("Fetching raw financial data based on query context");

    // Extract potential company symbols from the query
    const symbolMatches = query.match(/\b[A-Z]{1,5}\b/g) || [];
    const potentialSymbols = symbolMatches
      .filter(
        (s) => s.length >= 1 && s.length <= 5 && s !== "SQL" && s !== "API",
      )
      .join(",");

    // Determine which endpoints to query based on the natural language query
    const queryLower = query.toLowerCase();
    const endpoints = [];

    // Company profiles - always fetch as base data
    endpoints.push({
      name: "company_profiles",
      url: potentialSymbols
        ? `profile/${potentialSymbols}`
        : "profile/AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,AMD,INTC,ORCL,IBM,CRM,ADBE,CSCO,PYPL,NFLX,WMT,TGT,COST,HD,LOW,JNJ,PFE,MRK,ABBV,BMY",
    });

    // Detect sectors mentioned in the query
    const sectorKeywords = {
      healthcare: [
        "healthcare",
        "health care",
        "medical",
        "pharma",
        "biotech",
        "health",
      ],
      technology: [
        "tech",
        "technology",
        "software",
        "hardware",
        "semiconductor",
      ],
      financial: ["financial", "finance", "bank", "insurance", "investment"],
      energy: ["energy", "oil", "gas", "renewable", "solar", "wind"],
      consumer: ["consumer", "retail", "food", "beverage", "apparel"],
      industrial: ["industrial", "manufacturing", "aerospace", "defense"],
      utilities: ["utilities", "utility", "electric", "water", "gas utility"],
      realestate: ["real estate", "reit", "property"],
      materials: ["materials", "chemical", "mining", "metal"],
      communication: ["communication", "telecom", "media", "entertainment"],
    };

    let detectedSectors = [];
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some((keyword) => queryLower.includes(keyword))) {
        detectedSectors.push(sector);
      }
    }

    // If sectors are detected, add sector-specific stock screener
    if (detectedSectors.length > 0) {
      console.log(`Detected sectors in query: ${detectedSectors.join(", ")}`);

      // Add stock screener for each detected sector
      for (const sector of detectedSectors) {
        endpoints.push({
          name: `${sector}_sector_screener`,
          url: `stock-screener?sector=${sector}&isActivelyTrading=true&limit=100`,
        });
      }
    }

    // Financial metrics based on query context
    if (
      queryLower.includes("revenue") ||
      queryLower.includes("growth") ||
      queryLower.includes("income") ||
      queryLower.includes("profit") ||
      queryLower.includes("earnings")
    ) {
      endpoints.push({
        name: "financial_growth",
        url: potentialSymbols
          ? `financial-growth/${potentialSymbols}`
          : "financial-growth/AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,AMD,INTC,ORCL,IBM,CRM,ADBE,CSCO,PYPL,NFLX,WMT,TGT,COST,HD,LOW,JNJ,PFE,MRK,ABBV,BMY",
      });
    }

    // Dividend information
    if (
      queryLower.includes("dividend") ||
      queryLower.includes("yield") ||
      queryLower.includes("payout")
    ) {
      endpoints.push({
        name: "dividends",
        url: potentialSymbols
          ? `stock_dividend/${potentialSymbols}`
          : "stock_dividend/AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,AMD,INTC,ORCL,IBM,CRM,ADBE,CSCO,PYPL,NFLX,WMT,TGT,COST,HD,LOW,JNJ,PFE,MRK,ABBV,BMY",
      });

      // Add ETF dividend data for more comprehensive dividend information
      endpoints.push({
        name: "etf_dividends",
        url: "etf-dividend/SPY,VYM,HDV,SPYD,DVY,SCHD,VYMI,IDV,DEM,DGS",
      });

      // Add stock screener for dividend stocks
      endpoints.push({
        name: "dividend_screener",
        url: "stock-screener?dividendMoreThan=0&isEtf=false&isActivelyTrading=true&limit=100",
      });
    }

    // S&P 500 specific queries
    if (
      queryLower.includes("s&p 500") ||
      queryLower.includes("s&p500") ||
      queryLower.includes("sp500") ||
      queryLower.includes("sp 500")
    ) {
      endpoints.push({
        name: "sp500_companies",
        url: "sp500_constituent",
      });

      // Add historical dividends for S&P 500 ETF
      endpoints.push({
        name: "sp500_etf_dividend",
        url: "historical-price-full/stock_dividend/SPY?limit=100",
      });
    }

    // Sector performance
    if (
      queryLower.includes("sector") ||
      queryLower.includes("industry") ||
      queryLower.includes("market performance")
    ) {
      endpoints.push({
        name: "sector_performance",
        url: "sector-performance",
      });
    }

    // Financial statements
    if (
      queryLower.includes("financial statement") ||
      queryLower.includes("balance sheet") ||
      queryLower.includes("income statement") ||
      queryLower.includes("cash flow")
    ) {
      const symbol = potentialSymbols.split(",")[0] || "AAPL";
      endpoints.push({
        name: "income_statement",
        url: `income-statement/${symbol}?period=quarter&limit=4`,
      });
      endpoints.push({
        name: "balance_sheet",
        url: `balance-sheet-statement/${symbol}?period=quarter&limit=4`,
      });
    }

    // Check for "all companies" or "list all" type queries
    if (
      (queryLower.includes("all") &&
        (queryLower.includes("companies") || queryLower.includes("stocks"))) ||
      queryLower.includes("list all")
    ) {
      // If we detected sectors, we've already added sector-specific screeners
      // If no sectors detected, add a general stock list with higher limit
      if (detectedSectors.length === 0) {
        endpoints.push({
          name: "all_stocks_list",
          url: "stock/list?limit=200",
        });
      }
    }

    // If no specific endpoints were added beyond the base profile endpoint, add a general stock list
    if (endpoints.length === 1) {
      endpoints.push({
        name: "stock_list",
        url: "stock/list?limit=100",
      });
    }

    // Fetch data from all selected endpoints in parallel
    const endpointPromises = endpoints.map(async (endpoint) => {
      console.log(`Fetching data from endpoint: ${endpoint.name}`);
      try {
        const response = await fetch(
          `https://financialmodelingprep.com/api/v3/${endpoint.url}?apikey=${apiKey}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (!response.ok) {
          console.warn(
            `Failed to fetch data from ${endpoint.name}: ${response.status}`,
          );
          return { endpoint: endpoint.name, data: [] };
        }

        const data = await response.json();
        return {
          endpoint: endpoint.name,
          data: Array.isArray(data)
            ? data
            : data && typeof data === "object"
              ? [data]
              : [],
        };
      } catch (endpointError) {
        console.warn(`Error fetching from ${endpoint.name}:`, endpointError);
        return { endpoint: endpoint.name, data: [] };
      }
    });

    const results = await Promise.all(endpointPromises);
    console.log("Fetched raw data from all endpoints");

    // Check if we have any meaningful data
    const hasData = results.some(
      (result) => result.data && result.data.length > 0,
    );

    if (!hasData) {
      console.warn("No data returned from any endpoint, adding fallback data");
      // Add fallback data based on query context
      if (
        queryLower.includes("healthcare") ||
        queryLower.includes("health care") ||
        queryLower.includes("medical")
      ) {
        results.push({
          endpoint: "fallback_healthcare_companies",
          data: [
            {
              symbol: "JNJ",
              name: "Johnson & Johnson",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 450000000000,
            },
            {
              symbol: "PFE",
              name: "Pfizer Inc.",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 220000000000,
            },
            {
              symbol: "MRK",
              name: "Merck & Co., Inc.",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 240000000000,
            },
            {
              symbol: "ABBV",
              name: "AbbVie Inc.",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 260000000000,
            },
            {
              symbol: "BMY",
              name: "Bristol-Myers Squibb Company",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 140000000000,
            },
            {
              symbol: "LLY",
              name: "Eli Lilly and Company",
              sector: "Healthcare",
              industry: "Pharmaceuticals",
              marketCap: 350000000000,
            },
            {
              symbol: "AMGN",
              name: "Amgen Inc.",
              sector: "Healthcare",
              industry: "Biotechnology",
              marketCap: 150000000000,
            },
            {
              symbol: "GILD",
              name: "Gilead Sciences, Inc.",
              sector: "Healthcare",
              industry: "Biotechnology",
              marketCap: 95000000000,
            },
            {
              symbol: "BIIB",
              name: "Biogen Inc.",
              sector: "Healthcare",
              industry: "Biotechnology",
              marketCap: 40000000000,
            },
            {
              symbol: "VRTX",
              name: "Vertex Pharmaceuticals Incorporated",
              sector: "Healthcare",
              industry: "Biotechnology",
              marketCap: 85000000000,
            },
            {
              symbol: "REGN",
              name: "Regeneron Pharmaceuticals, Inc.",
              sector: "Healthcare",
              industry: "Biotechnology",
              marketCap: 80000000000,
            },
            {
              symbol: "UNH",
              name: "UnitedHealth Group Incorporated",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              marketCap: 450000000000,
            },
            {
              symbol: "CVS",
              name: "CVS Health Corporation",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              marketCap: 100000000000,
            },
            {
              symbol: "CI",
              name: "Cigna Group",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              marketCap: 90000000000,
            },
            {
              symbol: "HUM",
              name: "Humana Inc.",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              marketCap: 45000000000,
            },
            {
              symbol: "ANTM",
              name: "Anthem, Inc.",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              marketCap: 110000000000,
            },
            {
              symbol: "MDT",
              name: "Medtronic plc",
              sector: "Healthcare",
              industry: "Medical Devices",
              marketCap: 110000000000,
            },
            {
              symbol: "ABT",
              name: "Abbott Laboratories",
              sector: "Healthcare",
              industry: "Medical Devices",
              marketCap: 190000000000,
            },
            {
              symbol: "SYK",
              name: "Stryker Corporation",
              sector: "Healthcare",
              industry: "Medical Devices",
              marketCap: 100000000000,
            },
            {
              symbol: "BSX",
              name: "Boston Scientific Corporation",
              sector: "Healthcare",
              industry: "Medical Devices",
              marketCap: 65000000000,
            },
          ],
        });
      } else if (
        queryLower.includes("dividend") ||
        queryLower.includes("yield")
      ) {
        results.push({
          endpoint: "fallback_dividend_stocks",
          data: [
            {
              symbol: "VYM",
              name: "Vanguard High Dividend Yield ETF",
              dividendYield: 3.1,
              sector: "ETF",
              industry: "Dividend",
            },
            {
              symbol: "SCHD",
              name: "Schwab US Dividend Equity ETF",
              dividendYield: 3.5,
              sector: "ETF",
              industry: "Dividend",
            },
            {
              symbol: "HDV",
              name: "iShares Core High Dividend ETF",
              dividendYield: 3.8,
              sector: "ETF",
              industry: "Dividend",
            },
            {
              symbol: "JNJ",
              name: "Johnson & Johnson",
              dividendYield: 3.0,
              sector: "Healthcare",
              industry: "Pharmaceuticals",
            },
            {
              symbol: "PG",
              name: "Procter & Gamble",
              dividendYield: 2.4,
              sector: "Consumer Defensive",
              industry: "Household Products",
            },
            {
              symbol: "KO",
              name: "Coca-Cola Company",
              dividendYield: 2.9,
              sector: "Consumer Defensive",
              industry: "Beverages",
            },
            {
              symbol: "PEP",
              name: "PepsiCo Inc.",
              dividendYield: 2.8,
              sector: "Consumer Defensive",
              industry: "Beverages",
            },
            {
              symbol: "VZ",
              name: "Verizon Communications",
              dividendYield: 6.7,
              sector: "Communication Services",
              industry: "Telecom",
            },
            {
              symbol: "T",
              name: "AT&T Inc.",
              dividendYield: 5.9,
              sector: "Communication Services",
              industry: "Telecom",
            },
            {
              symbol: "IBM",
              name: "International Business Machines",
              dividendYield: 4.2,
              sector: "Technology",
              industry: "Information Technology",
            },
            {
              symbol: "XOM",
              name: "Exxon Mobil Corporation",
              dividendYield: 3.3,
              sector: "Energy",
              industry: "Oil & Gas",
            },
            {
              symbol: "CVX",
              name: "Chevron Corporation",
              dividendYield: 4.0,
              sector: "Energy",
              industry: "Oil & Gas",
            },
            {
              symbol: "MO",
              name: "Altria Group Inc.",
              dividendYield: 8.1,
              sector: "Consumer Defensive",
              industry: "Tobacco",
            },
            {
              symbol: "PM",
              name: "Philip Morris International",
              dividendYield: 5.2,
              sector: "Consumer Defensive",
              industry: "Tobacco",
            },
            {
              symbol: "MMM",
              name: "3M Company",
              dividendYield: 5.8,
              sector: "Industrials",
              industry: "Conglomerates",
            },
          ],
        });
      } else {
        // Generic fallback data
        results.push({
          endpoint: "fallback_data",
          data: [
            {
              symbol: "AAPL",
              name: "Apple Inc.",
              sector: "Technology",
              industry: "Consumer Electronics",
              price: 175.25,
              marketCap: 2800000000000,
            },
            {
              symbol: "MSFT",
              name: "Microsoft Corporation",
              sector: "Technology",
              industry: "Software",
              price: 325.42,
              marketCap: 2700000000000,
            },
            {
              symbol: "GOOGL",
              name: "Alphabet Inc.",
              sector: "Communication Services",
              industry: "Internet Content & Information",
              price: 142.65,
              marketCap: 1700000000000,
            },
            {
              symbol: "AMZN",
              name: "Amazon.com Inc.",
              sector: "Consumer Cyclical",
              industry: "Internet Retail",
              price: 132.18,
              marketCap: 1500000000000,
            },
            {
              symbol: "NVDA",
              name: "NVIDIA Corporation",
              sector: "Technology",
              industry: "Semiconductors",
              price: 437.53,
              marketCap: 1100000000000,
            },
            {
              symbol: "META",
              name: "Meta Platforms Inc.",
              sector: "Communication Services",
              industry: "Internet Content & Information",
              price: 342.67,
              marketCap: 1000000000000,
            },
            {
              symbol: "BRK.B",
              name: "Berkshire Hathaway Inc.",
              sector: "Financial Services",
              industry: "Insurance",
              price: 352.56,
              marketCap: 780000000000,
            },
            {
              symbol: "TSLA",
              name: "Tesla Inc.",
              sector: "Consumer Cyclical",
              industry: "Auto Manufacturers",
              price: 237.49,
              marketCap: 750000000000,
            },
            {
              symbol: "UNH",
              name: "UnitedHealth Group Inc.",
              sector: "Healthcare",
              industry: "Healthcare Plans",
              price: 527.33,
              marketCap: 500000000000,
            },
            {
              symbol: "JNJ",
              name: "Johnson & Johnson",
              sector: "Healthcare",
              industry: "Drug Manufacturers",
              price: 151.95,
              marketCap: 450000000000,
            },
            {
              symbol: "JPM",
              name: "JPMorgan Chase & Co.",
              sector: "Financial Services",
              industry: "Banks",
              price: 151.03,
              marketCap: 440000000000,
            },
            {
              symbol: "V",
              name: "Visa Inc.",
              sector: "Financial Services",
              industry: "Credit Services",
              price: 241.42,
              marketCap: 430000000000,
            },
            {
              symbol: "PG",
              name: "Procter & Gamble Co.",
              sector: "Consumer Defensive",
              industry: "Household Products",
              price: 156.87,
              marketCap: 370000000000,
            },
            {
              symbol: "MA",
              name: "Mastercard Incorporated",
              sector: "Financial Services",
              industry: "Credit Services",
              price: 401.23,
              marketCap: 360000000000,
            },
            {
              symbol: "HD",
              name: "The Home Depot, Inc.",
              sector: "Consumer Cyclical",
              industry: "Home Improvement Retail",
              price: 342.87,
              marketCap: 340000000000,
            },
          ],
        });
      }
    }

    // Return the raw data from all endpoints
    return results;
  } catch (error) {
    console.error("Error fetching raw financial data:", error);
    // Return fallback data instead of throwing error
    return [
      {
        endpoint: "fallback_data",
        data: [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            price: 175.25,
            marketCap: 2800000000000,
          },
          {
            symbol: "MSFT",
            name: "Microsoft Corporation",
            sector: "Technology",
            industry: "Software",
            price: 325.42,
            marketCap: 2700000000000,
          },
          {
            symbol: "GOOGL",
            name: "Alphabet Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            price: 142.65,
            marketCap: 1700000000000,
          },
          {
            symbol: "AMZN",
            name: "Amazon.com Inc.",
            sector: "Consumer Cyclical",
            industry: "Internet Retail",
            price: 132.18,
            marketCap: 1500000000000,
          },
          {
            symbol: "NVDA",
            name: "NVIDIA Corporation",
            sector: "Technology",
            industry: "Semiconductors",
            price: 437.53,
            marketCap: 1100000000000,
          },
          {
            symbol: "META",
            name: "Meta Platforms Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            price: 342.67,
            marketCap: 1000000000000,
          },
          {
            symbol: "BRK.B",
            name: "Berkshire Hathaway Inc.",
            sector: "Financial Services",
            industry: "Insurance",
            price: 352.56,
            marketCap: 780000000000,
          },
          {
            symbol: "TSLA",
            name: "Tesla Inc.",
            sector: "Consumer Cyclical",
            industry: "Auto Manufacturers",
            price: 237.49,
            marketCap: 750000000000,
          },
          {
            symbol: "UNH",
            name: "UnitedHealth Group Inc.",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            price: 527.33,
            marketCap: 500000000000,
          },
          {
            symbol: "JNJ",
            name: "Johnson & Johnson",
            sector: "Healthcare",
            industry: "Drug Manufacturers",
            price: 151.95,
            marketCap: 450000000000,
          },
          {
            symbol: "JPM",
            name: "JPMorgan Chase & Co.",
            sector: "Financial Services",
            industry: "Banks",
            price: 151.03,
            marketCap: 440000000000,
          },
          {
            symbol: "V",
            name: "Visa Inc.",
            sector: "Financial Services",
            industry: "Credit Services",
            price: 241.42,
            marketCap: 430000000000,
          },
          {
            symbol: "PG",
            name: "Procter & Gamble Co.",
            sector: "Consumer Defensive",
            industry: "Household Products",
            price: 156.87,
            marketCap: 370000000000,
          },
          {
            symbol: "MA",
            name: "Mastercard Incorporated",
            sector: "Financial Services",
            industry: "Credit Services",
            price: 401.23,
            marketCap: 360000000000,
          },
          {
            symbol: "HD",
            name: "The Home Depot, Inc.",
            sector: "Consumer Cyclical",
            industry: "Home Improvement Retail",
            price: 342.87,
            marketCap: 340000000000,
          },
        ],
      },
    ];
  }
}

// Import the data enrichment functions
import { detectMissingFields, fetchMissingFinancialData } from "./scraper";

// Process the raw data using OpenAI
async function processDataWithOpenAI(
  query: string,
  rawData: any[],
  apiKey: string,
  potentialCompanySymbols: string[] = [],
): Promise<any[]> {
  try {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    console.log("Processing raw data with OpenAI");

    // Check if we have any data to process
    const hasData = rawData.some(
      (endpoint) => endpoint.data && endpoint.data.length > 0,
    );
    if (!hasData) {
      console.warn("No data available to process with OpenAI");
      return fallbackDataProcessing(query, rawData, potentialCompanySymbols);
    }

    // Check if this is a company-specific query
    const isCompanySpecificQuery =
      potentialCompanySymbols.length > 0 &&
      (query.toLowerCase().includes("financial") ||
        query.toLowerCase().includes("statement") ||
        query.toLowerCase().includes("report") ||
        query.toLowerCase().includes("balance") ||
        query.toLowerCase().includes("income") ||
        query.toLowerCase().includes("cash flow"));

    // Prepare the raw data for OpenAI by limiting its size
    const preparedData = rawData.map((endpoint) => {
      const limitedData = endpoint.data.slice(0, 20); // Limit to 20 items per endpoint
      return {
        endpoint: endpoint.endpoint,
        data: limitedData,
      };
    });

    // Create a system prompt for OpenAI to process the data
    let systemPrompt = `You are a financial data analyst. Your task is to process raw financial data and structure it according to the user's query. 
    The data comes from multiple financial API endpoints and needs to be merged, filtered, and structured to best answer the query.
    
    Return ONLY a JSON array of objects with the processed data. Each object should have consistent keys that match the query's intent.
    Do not include any explanations, markdown, or text outside of the JSON array.
    
    Focus on extracting the most relevant information from the provided data sources to answer the query accurately.
    Ensure numeric values are properly formatted and consistent across all objects.
    Limit the response to at most 20 items that best match the query.
    
    If the query is about dividends or yields, make sure to include the following fields if available:
    - symbol
    - name or companyName
    - dividendYield (as a percentage)
    - sector
    - industry
    - lastDividendValue
    - dividendDate
    
    If the query is about S&P 500 companies, prioritize data from the sp500_companies endpoint.
    If the query is about highest dividend yields, sort the results by dividendYield in descending order.`;

    // Add company-specific instructions if this is a company query
    if (isCompanySpecificQuery) {
      const companySymbols = potentialCompanySymbols.join(", ");
      systemPrompt += `

    IMPORTANT: This query is specifically about the company/companies with symbol(s): ${companySymbols}.
    You MUST ONLY return data for these specific companies and filter out any irrelevant companies.
    If you don't have sufficient data for these companies, return an empty array rather than providing data for unrelated companies.
    For financial statements, ensure you're returning the most recent and accurate data available in the provided datasets.`;
    }

    // Convert the raw data to a string representation for OpenAI
    // We need to be careful about the size of the data we send to OpenAI
    const dataString = JSON.stringify(preparedData);
    const truncatedDataString =
      dataString.length > 100000
        ? dataString.substring(0, 100000) + "...[truncated]"
        : dataString;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Using a more advanced model for better data processing
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Query: ${query}\n\nRaw Data: ${truncatedDataString}`,
          },
        ],
        temperature: 0.2, // Lower temperature for more deterministic results
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Failed to process data with OpenAI",
      );
    }

    const responseData = await response.json();
    const processedDataString = responseData.choices[0].message.content.trim();

    // Extract the JSON array from the response
    let processedData;
    try {
      // Try to parse the entire response as JSON
      processedData = JSON.parse(processedDataString);
    } catch (parseError) {
      // If that fails, try to extract JSON from the response using regex
      const jsonMatch = processedDataString.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        processedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse processed data from OpenAI response");
      }
    }

    // Ensure the result is an array
    if (!Array.isArray(processedData)) {
      if (typeof processedData === "object" && processedData !== null) {
        // If it's an object with a data property that's an array, use that
        if (Array.isArray(processedData.data)) {
          processedData = processedData.data;
        } else {
          // Otherwise, wrap the object in an array
          processedData = [processedData];
        }
      } else {
        throw new Error("Processed data is not in the expected format");
      }
    }

    // Check if we have any processed data
    if (!processedData || processedData.length === 0) {
      console.warn("OpenAI returned empty processed data, using fallback");
      return fallbackDataProcessing(query, rawData, potentialCompanySymbols);
    }

    // For company-specific queries, verify we have the right companies
    if (isCompanySpecificQuery && potentialCompanySymbols.length > 0) {
      // Filter to ensure we only have data for the requested companies
      const filteredData = processedData.filter(
        (item) =>
          potentialCompanySymbols.includes(item.symbol) ||
          (item.ticker && potentialCompanySymbols.includes(item.ticker)),
      );

      // If we filtered out everything, the data wasn't relevant
      if (filteredData.length === 0 && processedData.length > 0) {
        console.warn(
          "Processed data contained irrelevant companies, fetching specific company data",
        );
        return await fetchSpecificCompanyData(
          potentialCompanySymbols[0],
          query,
          apiKey,
        );
      }

      processedData = filteredData;
    }

    console.log("Successfully processed data with OpenAI");

    // Check for missing important fields and enrich data if needed
    const missingFields = detectMissingFields(processedData);
    if (missingFields.length > 0) {
      console.log("Detected missing fields:", missingFields);
      console.log("Enriching data with additional sources...");
      const enrichedData = await fetchMissingFinancialData(
        processedData,
        missingFields,
        apiKey,
      );
      return enrichedData;
    }

    return processedData;
  } catch (error) {
    console.error("Error processing data with OpenAI:", error);

    // Fallback: If OpenAI processing fails, try to extract and format the data manually
    console.log("Falling back to manual data processing");
    return fallbackDataProcessing(query, rawData, potentialCompanySymbols);
  }
}

// Fetch specific company data when needed
async function fetchSpecificCompanyData(
  symbol: string,
  query: string,
  apiKey: string,
): Promise<any[]> {
  try {
    console.log(`Fetching specific data for company: ${symbol}`);

    // Determine what kind of data we need based on the query
    const queryLower = query.toLowerCase();
    const isFinancialStatement =
      queryLower.includes("financial") ||
      queryLower.includes("statement") ||
      queryLower.includes("report");
    const isBalanceSheet = queryLower.includes("balance");
    const isIncomeStatement =
      queryLower.includes("income") || queryLower.includes("profit");
    const isCashFlow = queryLower.includes("cash flow");

    // Use OpenAI to get accurate company data
    const prompt = `I need accurate financial data for the company with ticker symbol ${symbol}. ${
      isFinancialStatement
        ? `Please provide the most recent ${isBalanceSheet ? "balance sheet" : isIncomeStatement ? "income statement" : isCashFlow ? "cash flow statement" : "financial statements"}.`
        : "Please provide key financial metrics and company information."
    }
      
    Return the data in a JSON array format with a single object containing all the relevant information.
    Include fields like symbol, name, sector, industry, and any relevant financial metrics.
    Only include factual, up-to-date information. If you don't know a value, use null.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a financial data assistant that provides accurate, up-to-date financial metrics for companies. Respond only with the requested JSON data.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch specific company data");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON from the response
    let companyData: any[] = [];
    try {
      // Try to parse the entire response as JSON
      const parsed = JSON.parse(content);
      companyData = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // If that fails, try to extract JSON using regex
      const jsonMatch =
        content.match(/\[\s*\{[\s\S]*\}\s*\]/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        companyData = Array.isArray(parsed) ? parsed : [parsed];
      }
    }

    // Ensure the company symbol is correct
    if (companyData.length > 0) {
      companyData[0].symbol = symbol;
    }

    return companyData;
  } catch (error) {
    console.error(`Error fetching specific data for ${symbol}:`, error);
    // Return a minimal fallback object with the correct symbol
    return [
      {
        symbol,
        name: `Company with symbol ${symbol}`,
        error: "Could not fetch detailed data",
      },
    ];
  }
}

// Fallback function for manual data processing if OpenAI fails
function fallbackDataProcessing(
  query: string,
  rawData: any[],
  potentialCompanySymbols: string[] = [],
): any[] {
  try {
    console.log("Performing fallback data processing");
    const queryLower = query.toLowerCase();
    let processedData: any[] = [];

    // Check if this is a company-specific query
    const isCompanySpecificQuery =
      potentialCompanySymbols.length > 0 &&
      (queryLower.includes("financial") ||
        queryLower.includes("statement") ||
        queryLower.includes("report") ||
        queryLower.includes("balance") ||
        queryLower.includes("income") ||
        queryLower.includes("cash flow"));

    // If it's a company-specific query, filter for just those companies
    if (isCompanySpecificQuery) {
      // Look through all endpoints for company data
      for (const endpoint of rawData) {
        const relevantCompanies = endpoint.data.filter(
          (item: any) =>
            potentialCompanySymbols.includes(item.symbol) ||
            (item.ticker && potentialCompanySymbols.includes(item.ticker)),
        );

        if (relevantCompanies.length > 0) {
          processedData.push(...relevantCompanies);
        }
      }

      // If we found relevant companies, return them
      if (processedData.length > 0) {
        return processedData;
      }

      // Otherwise, return minimal placeholder data for the requested companies
      return potentialCompanySymbols.map((symbol) => ({
        symbol,
        name: `Company with symbol ${symbol}`,
        note: "Detailed data not available in the current dataset",
      }));
    }

    // Check for fallback data first
    const fallbackEndpoints = rawData.filter((e) =>
      e.endpoint.includes("fallback_"),
    );
    if (fallbackEndpoints.length > 0) {
      // Combine all fallback data
      const combinedFallbackData = fallbackEndpoints.flatMap((e) => e.data);
      if (combinedFallbackData.length > 0) {
        return combinedFallbackData;
      }
    }

    // Check for sector-specific screener data
    const sectorKeywords = {
      healthcare: [
        "healthcare",
        "health care",
        "medical",
        "pharma",
        "biotech",
        "health",
      ],
      technology: [
        "tech",
        "technology",
        "software",
        "hardware",
        "semiconductor",
      ],
      financial: ["financial", "finance", "bank", "insurance", "investment"],
      energy: ["energy", "oil", "gas", "renewable", "solar", "wind"],
      consumer: ["consumer", "retail", "food", "beverage", "apparel"],
      industrial: ["industrial", "manufacturing", "aerospace", "defense"],
      utilities: ["utilities", "utility", "electric", "water", "gas utility"],
      realestate: ["real estate", "reit", "property"],
      materials: ["materials", "chemical", "mining", "metal"],
      communication: ["communication", "telecom", "media", "entertainment"],
    };

    // Detect sectors in the query
    let detectedSectors = [];
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some((keyword) => queryLower.includes(keyword))) {
        detectedSectors.push(sector);
      }
    }

    // Check for sector-specific screener data
    if (detectedSectors.length > 0) {
      for (const sector of detectedSectors) {
        const sectorEndpoint = rawData.find(
          (e) => e.endpoint === `${sector}_sector_screener`,
        );
        if (sectorEndpoint && sectorEndpoint.data.length > 0) {
          const sectorData = sectorEndpoint.data.map((stock: any) => ({
            symbol: stock.symbol,
            name: stock.companyName || stock.name,
            price: stock.price,
            marketCap: stock.marketCap,
            sector: stock.sector,
            industry: stock.industry,
            beta: stock.beta,
            dividendYield: stock.dividendYield
              ? parseFloat((stock.dividendYield * 100).toFixed(2))
              : 0,
            lastDividendValue: stock.lastDiv,
          }));
          processedData = [...processedData, ...sectorData];
        }
      }
    }

    // Check for S&P 500 specific data
    const sp500Endpoint = rawData.find((e) => e.endpoint === "sp500_companies");
    if (
      sp500Endpoint &&
      sp500Endpoint.data.length > 0 &&
      (queryLower.includes("s&p 500") ||
        queryLower.includes("s&p500") ||
        queryLower.includes("sp500") ||
        queryLower.includes("sp 500"))
    ) {
      const sp500Data = sp500Endpoint.data.map((company: any) => ({
        symbol: company.symbol,
        name: company.name,
        sector: company.sector,
        subSector: company.subSector,
        headQuarter: company.headQuarter,
        dateFirstAdded: company.dateFirstAdded,
        cik: company.cik,
        founded: company.founded,
      }));

      // If we're looking for a specific sector within S&P 500
      if (detectedSectors.length > 0) {
        const filteredSp500 = sp500Data.filter((company) =>
          detectedSectors.some(
            (sector) =>
              company.sector?.toLowerCase().includes(sector) ||
              company.subSector?.toLowerCase().includes(sector),
          ),
        );
        if (filteredSp500.length > 0) {
          processedData = [...processedData, ...filteredSp500];
        } else {
          processedData = [...processedData, ...sp500Data];
        }
      } else {
        processedData = [...processedData, ...sp500Data];
      }
    }

    // Check for dividend screener data
    const dividendScreenerEndpoint = rawData.find(
      (e) => e.endpoint === "dividend_screener",
    );
    if (
      dividendScreenerEndpoint &&
      dividendScreenerEndpoint.data.length > 0 &&
      (queryLower.includes("dividend") || queryLower.includes("yield"))
    ) {
      const dividendData = dividendScreenerEndpoint.data.map((stock: any) => ({
        symbol: stock.symbol,
        name: stock.companyName,
        price: stock.price,
        marketCap: stock.marketCap,
        sector: stock.sector,
        industry: stock.industry,
        beta: stock.beta,
        dividendYield: stock.dividendYield
          ? parseFloat((stock.dividendYield * 100).toFixed(2))
          : 0,
        lastDividendValue: stock.lastDiv,
      }));

      // If we're looking for a specific sector with dividends
      if (detectedSectors.length > 0) {
        const filteredDividendData = dividendData.filter((stock) =>
          detectedSectors.some(
            (sector) =>
              stock.sector?.toLowerCase().includes(sector) ||
              stock.industry?.toLowerCase().includes(sector),
          ),
        );
        if (filteredDividendData.length > 0) {
          processedData = [...processedData, ...filteredDividendData];
        } else {
          processedData = [...processedData, ...dividendData];
        }
      } else {
        processedData = [...processedData, ...dividendData];
      }
    }

    // Check for all stocks list data
    const allStocksEndpoint = rawData.find(
      (e) => e.endpoint === "all_stocks_list" || e.endpoint === "stock_list",
    );
    if (allStocksEndpoint && allStocksEndpoint.data.length > 0) {
      const allStocksData = allStocksEndpoint.data.map((stock: any) => ({
        symbol: stock.symbol,
        name: stock.name || stock.companyName,
        exchange: stock.exchange,
        type: stock.type,
      }));

      // If we don't have any data yet, use the stock list
      if (processedData.length === 0) {
        processedData = allStocksData;
      }
    }

    // If we still don't have data, try company profiles
    if (processedData.length === 0) {
      // Find company profiles data
      const profilesEndpoint = rawData.find(
        (e) => e.endpoint === "company_profiles",
      );
      const profiles = profilesEndpoint ? profilesEndpoint.data : [];

      // Start with company profiles as the base data
      if (profiles.length > 0) {
        const profileData = profiles.map((profile: any) => ({
          symbol: profile.symbol,
          name: profile.companyName || profile.name,
          sector: profile.sector,
          industry: profile.industry,
          marketCap: profile.mktCap || profile.marketCap,
          price: profile.price,
          changes: profile.changes,
          changesPercentage: profile.changesPercentage
            ? parseFloat(profile.changesPercentage.toFixed(2))
            : 0,
        }));

        // If we're looking for a specific sector
        if (detectedSectors.length > 0) {
          const filteredProfiles = profileData.filter((profile) =>
            detectedSectors.some(
              (sector) =>
                profile.sector?.toLowerCase().includes(sector) ||
                profile.industry?.toLowerCase().includes(sector),
            ),
          );
          if (filteredProfiles.length > 0) {
            processedData = [...processedData, ...filteredProfiles];
          } else {
            processedData = [...processedData, ...profileData];
          }
        } else {
          processedData = [...processedData, ...profileData];
        }
      }
    }

    // Check ETF dividend data
    const etfDividendEndpoint = rawData.find(
      (e) => e.endpoint === "etf_dividends",
    );
    if (
      etfDividendEndpoint &&
      etfDividendEndpoint.data.length > 0 &&
      (queryLower.includes("dividend") ||
        queryLower.includes("yield") ||
        queryLower.includes("etf"))
    ) {
      // If we're specifically looking for ETFs or we don't have other data
      if (queryLower.includes("etf") || processedData.length === 0) {
        const etfData = etfDividendEndpoint.data.map((etf: any) => ({
          symbol: etf.symbol,
          name: etf.name || `${etf.symbol} ETF`,
          dividendYield: etf.dividendYield
            ? parseFloat((etf.dividendYield * 100).toFixed(2))
            : 0,
          expense: etf.expense,
          price: etf.price,
          sector: "ETF",
          industry: "Exchange Traded Fund",
        }));
        processedData = [...processedData, ...etfData];
      } else {
        // Otherwise, try to merge with existing data
        const etfData = etfDividendEndpoint.data;
        processedData.forEach((item, index) => {
          const etf = etfData.find((e: any) => e.symbol === item.symbol);
          if (etf) {
            processedData[index] = {
              ...item,
              dividendYield: etf.dividendYield
                ? parseFloat((etf.dividendYield * 100).toFixed(2))
                : 0,
              expense: etf.expense,
            };
          }
        });
      }
    }

    // Enrich with financial growth data if available
    const growthEndpoint = rawData.find(
      (e) => e.endpoint === "financial_growth",
    );
    if (growthEndpoint && growthEndpoint.data.length > 0) {
      const growthData = growthEndpoint.data;

      // Merge growth data with profile data
      processedData = processedData.map((item) => {
        const growth = growthData.find((g: any) => g.symbol === item.symbol);
        if (growth) {
          return {
            ...item,
            revenueGrowth: growth.revenueGrowth
              ? parseFloat((growth.revenueGrowth * 100).toFixed(2))
              : 0,
            netIncomeGrowth: growth.netIncomeGrowth
              ? parseFloat((growth.netIncomeGrowth * 100).toFixed(2))
              : 0,
            epsgrowth: growth.epsgrowth
              ? parseFloat((growth.epsgrowth * 100).toFixed(2))
              : 0,
          };
        }
        return item;
      });
    }

    // Enrich with dividend data if available
    const dividendEndpoint = rawData.find((e) => e.endpoint === "dividends");
    if (dividendEndpoint && dividendEndpoint.data.length > 0) {
      const dividendData = dividendEndpoint.data;

      // Merge dividend data with existing data
      processedData = processedData.map((item) => {
        const dividend = dividendData.find(
          (d: any) => d.symbol === item.symbol,
        );
        if (dividend) {
          return {
            ...item,
            dividend: dividend.dividend
              ? parseFloat(dividend.dividend.toFixed(2))
              : 0,
            dividendYield: dividend.dividendYield
              ? parseFloat((dividend.dividendYield * 100).toFixed(2))
              : item.dividendYield || 0,
            payoutRatio: dividend.payoutRatio
              ? parseFloat((dividend.payoutRatio * 100).toFixed(2))
              : 0,
          };
        }
        return item;
      });
    }

    // If we have income statement and balance sheet data for a specific company
    const incomeEndpoint = rawData.find(
      (e) => e.endpoint === "income_statement",
    );
    const balanceEndpoint = rawData.find((e) => e.endpoint === "balance_sheet");

    if (
      incomeEndpoint &&
      incomeEndpoint.data.length > 0 &&
      balanceEndpoint &&
      balanceEndpoint.data.length > 0
    ) {
      // This is likely a query about a specific company's financials
      const incomeData = incomeEndpoint.data;
      const balanceData = balanceEndpoint.data;

      // Create financial statement data
      const financialData = incomeData.map((income: any, index: number) => {
        const balance = balanceData[index] || {};
        return {
          date: income.date,
          symbol: income.symbol,
          revenue: income.revenue,
          netIncome: income.netIncome,
          eps: income.eps,
          totalAssets: balance.totalAssets || 0,
          totalLiabilities: balance.totalLiabilities || 0,
          totalEquity: balance.totalStockholdersEquity || 0,
        };
      });

      // If this is a query specifically about financial statements, return just that data
      if (
        queryLower.includes("financial statement") ||
        queryLower.includes("balance sheet") ||
        queryLower.includes("income statement")
      ) {
        return financialData;
      }

      // Otherwise, add this data to the company in our processed data
      const symbol = incomeData[0]?.symbol;
      if (symbol) {
        processedData = processedData.map((item) => {
          if (item.symbol === symbol) {
            return {
              ...item,
              financials: financialData,
            };
          }
          return item;
        });
      }
    }

    // If we still don't have any data, use hardcoded fallback data
    if (processedData.length === 0) {
      console.log("No data found in endpoints, using hardcoded fallback data");
      if (
        queryLower.includes("healthcare") ||
        queryLower.includes("health care") ||
        queryLower.includes("medical")
      ) {
        processedData = [
          {
            symbol: "JNJ",
            name: "Johnson & Johnson",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 450000000000,
          },
          {
            symbol: "PFE",
            name: "Pfizer Inc.",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 220000000000,
          },
          {
            symbol: "MRK",
            name: "Merck & Co., Inc.",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 240000000000,
          },
          {
            symbol: "ABBV",
            name: "AbbVie Inc.",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 260000000000,
          },
          {
            symbol: "BMY",
            name: "Bristol-Myers Squibb Company",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 140000000000,
          },
          {
            symbol: "LLY",
            name: "Eli Lilly and Company",
            sector: "Healthcare",
            industry: "Pharmaceuticals",
            marketCap: 350000000000,
          },
          {
            symbol: "AMGN",
            name: "Amgen Inc.",
            sector: "Healthcare",
            industry: "Biotechnology",
            marketCap: 150000000000,
          },
          {
            symbol: "GILD",
            name: "Gilead Sciences, Inc.",
            sector: "Healthcare",
            industry: "Biotechnology",
            marketCap: 95000000000,
          },
          {
            symbol: "BIIB",
            name: "Biogen Inc.",
            sector: "Healthcare",
            industry: "Biotechnology",
            marketCap: 40000000000,
          },
          {
            symbol: "VRTX",
            name: "Vertex Pharmaceuticals Incorporated",
            sector: "Healthcare",
            industry: "Biotechnology",
            marketCap: 85000000000,
          },
          {
            symbol: "REGN",
            name: "Regeneron Pharmaceuticals, Inc.",
            sector: "Healthcare",
            industry: "Biotechnology",
            marketCap: 80000000000,
          },
          {
            symbol: "UNH",
            name: "UnitedHealth Group Incorporated",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 450000000000,
          },
          {
            symbol: "CVS",
            name: "CVS Health Corporation",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 100000000000,
          },
          {
            symbol: "CI",
            name: "Cigna Group",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 90000000000,
          },
          {
            symbol: "HUM",
            name: "Humana Inc.",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 45000000000,
          },
          {
            symbol: "ANTM",
            name: "Anthem, Inc.",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 110000000000,
          },
          {
            symbol: "MDT",
            name: "Medtronic plc",
            sector: "Healthcare",
            industry: "Medical Devices",
            marketCap: 110000000000,
          },
          {
            symbol: "ABT",
            name: "Abbott Laboratories",
            sector: "Healthcare",
            industry: "Medical Devices",
            marketCap: 190000000000,
          },
          {
            symbol: "SYK",
            name: "Stryker Corporation",
            sector: "Healthcare",
            industry: "Medical Devices",
            marketCap: 100000000000,
          },
          {
            symbol: "BSX",
            name: "Boston Scientific Corporation",
            sector: "Healthcare",
            industry: "Medical Devices",
            marketCap: 65000000000,
          },
        ];
      } else if (
        queryLower.includes("dividend") ||
        queryLower.includes("yield")
      ) {
        processedData = [
          {
            symbol: "VYM",
            name: "Vanguard High Dividend Yield ETF",
            dividendYield: 3.1,
            sector: "ETF",
            industry: "Dividend",
          },
          {
            symbol: "SCHD",
            name: "Schwab US Dividend Equity ETF",
            dividendYield: 3.5,
            sector: "ETF",
            industry: "Dividend",
          },
          {
            symbol: "HDV",
            name: "iShares Core High Dividend ETF",
            dividendYield: 3.8,
            sector: "ETF",
            industry: "Dividend",
          },
          {
            symbol: "JNJ",
            name: "Johnson & Johnson",
            dividendYield: 3.0,
            sector: "Healthcare",
            industry: "Pharmaceuticals",
          },
          {
            symbol: "PG",
            name: "Procter & Gamble",
            dividendYield: 2.4,
            sector: "Consumer Defensive",
            industry: "Household Products",
          },
          {
            symbol: "KO",
            name: "Coca-Cola Company",
            dividendYield: 2.9,
            sector: "Consumer Defensive",
            industry: "Beverages",
          },
          {
            symbol: "PEP",
            name: "PepsiCo Inc.",
            dividendYield: 2.8,
            sector: "Consumer Defensive",
            industry: "Beverages",
          },
          {
            symbol: "VZ",
            name: "Verizon Communications",
            dividendYield: 6.7,
            sector: "Communication Services",
            industry: "Telecom",
          },
          {
            symbol: "T",
            name: "AT&T Inc.",
            dividendYield: 5.9,
            sector: "Communication Services",
            industry: "Telecom",
          },
          {
            symbol: "IBM",
            name: "International Business Machines",
            dividendYield: 4.2,
            sector: "Technology",
            industry: "Information Technology",
          },
          {
            symbol: "XOM",
            name: "Exxon Mobil Corporation",
            dividendYield: 3.3,
            sector: "Energy",
            industry: "Oil & Gas",
          },
          {
            symbol: "CVX",
            name: "Chevron Corporation",
            dividendYield: 4.0,
            sector: "Energy",
            industry: "Oil & Gas",
          },
          {
            symbol: "MO",
            name: "Altria Group Inc.",
            dividendYield: 8.1,
            sector: "Consumer Defensive",
            industry: "Tobacco",
          },
          {
            symbol: "PM",
            name: "Philip Morris International",
            dividendYield: 5.2,
            sector: "Consumer Defensive",
            industry: "Tobacco",
          },
          {
            symbol: "MMM",
            name: "3M Company",
            dividendYield: 5.8,
            sector: "Industrials",
            industry: "Conglomerates",
          },
        ];
      } else if (
        queryLower.includes("s&p 500") ||
        queryLower.includes("s&p500") ||
        queryLower.includes("sp500") ||
        queryLower.includes("sp 500")
      ) {
        processedData = [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            marketCap: 2800000000000,
          },
          {
            symbol: "MSFT",
            name: "Microsoft Corporation",
            sector: "Technology",
            industry: "Software",
            marketCap: 2700000000000,
          },
          {
            symbol: "GOOGL",
            name: "Alphabet Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            marketCap: 1700000000000,
          },
          {
            symbol: "AMZN",
            name: "Amazon.com Inc.",
            sector: "Consumer Cyclical",
            industry: "Internet Retail",
            marketCap: 1500000000000,
          },
          {
            symbol: "NVDA",
            name: "NVIDIA Corporation",
            sector: "Technology",
            industry: "Semiconductors",
            marketCap: 1100000000000,
          },
          {
            symbol: "META",
            name: "Meta Platforms Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            marketCap: 1000000000000,
          },
          {
            symbol: "BRK.B",
            name: "Berkshire Hathaway Inc.",
            sector: "Financial Services",
            industry: "Insurance",
            marketCap: 780000000000,
          },
          {
            symbol: "TSLA",
            name: "Tesla Inc.",
            sector: "Consumer Cyclical",
            industry: "Auto Manufacturers",
            marketCap: 750000000000,
          },
          {
            symbol: "UNH",
            name: "UnitedHealth Group Inc.",
            sector: "Healthcare",
            industry: "Healthcare Plans",
            marketCap: 500000000000,
          },
          {
            symbol: "JNJ",
            name: "Johnson & Johnson",
            sector: "Healthcare",
            industry: "Drug Manufacturers",
            marketCap: 450000000000,
          },
        ];
      } else {
        processedData = [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            price: 175.25,
            marketCap: 2800000000000,
          },
          {
            symbol: "MSFT",
            name: "Microsoft Corporation",
            sector: "Technology",
            industry: "Software",
            price: 325.42,
            marketCap: 2700000000000,
          },
          {
            symbol: "GOOGL",
            name: "Alphabet Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            price: 142.65,
            marketCap: 1700000000000,
          },
          {
            symbol: "AMZN",
            name: "Amazon.com Inc.",
            sector: "Consumer Cyclical",
            industry: "Internet Retail",
            price: 132.18,
            marketCap: 1500000000000,
          },
          {
            symbol: "NVDA",
            name: "NVIDIA Corporation",
            sector: "Technology",
            industry: "Semiconductors",
            price: 437.53,
            marketCap: 1100000000000,
          },
          {
            symbol: "META",
            name: "Meta Platforms Inc.",
            sector: "Communication Services",
            industry: "Internet Content & Information",
            price: 342.67,
            marketCap: 1000000000000,
          },
          {
            symbol: "BRK.B",
            name: "Berkshire Hathaway Inc.",
            sector: "Financial Services",
            industry: "Insurance",
            price: 352.56,
            marketCap: 780000000000,
          },
        ];
      }
    }

    return processedData;
  } catch (error) {
    console.error("Error in fallback data processing:", error);
    return [];
  }
}

// Import the market index service
import {
  getMarketIndexData,
  getHighDividendCompanies,
} from "./market-index-service";

// Process natural language query using RAG approach
export async function processNaturalLanguageQuery(
  prompt: string,
  apiKeys: ApiKeys,
): Promise<QueryResult> {
  try {
    console.log("Processing query with RAG approach:", prompt);

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check if the query is about a specific company
    const promptLower = prompt.toLowerCase();
    const companySymbolMatch = prompt.match(/\b[A-Z]{1,5}\b/g);
    const potentialCompanySymbols = companySymbolMatch
      ? companySymbolMatch.filter(
          (s) =>
            s.length >= 1 &&
            s.length <= 5 &&
            !["SQL", "API", "ETF", "USA", "GDP"].includes(s),
        )
      : [];

    // Generate SQL query from natural language using OpenAI
    const sqlQueryPromise = generateSQLFromNaturalLanguage(
      prompt,
      apiKeys.openai,
    );

    // Check if the query is about a specific market index
    let marketIndexData: any[] = [];

    // Extract potential market index from the query
    const marketIndices = [
      {
        name: "s&p 500",
        aliases: ["s&p500", "sp500", "sp 500", "standard & poor's 500"],
      },
      {
        name: "nifty",
        aliases: ["nifty 50", "nse", "national stock exchange"],
      },
      { name: "sensex", aliases: ["bse", "bombay stock exchange"] },
      { name: "nasdaq", aliases: ["nasdaq composite", "nasdaq index"] },
      {
        name: "dow jones",
        aliases: ["djia", "dow", "dow jones industrial average"],
      },
      { name: "ftse", aliases: ["ftse 100", "financial times stock exchange"] },
      { name: "dax", aliases: ["deutscher aktienindex", "german stock index"] },
      { name: "nikkei", aliases: ["nikkei 225", "nikkei index"] },
      { name: "hang seng", aliases: ["hangseng", "hsi"] },
    ];

    let detectedIndex = null;

    // Check if the query mentions any market index
    for (const index of marketIndices) {
      if (promptLower.includes(index.name)) {
        detectedIndex = index.name;
        break;
      }

      for (const alias of index.aliases) {
        if (promptLower.includes(alias)) {
          detectedIndex = index.name;
          break;
        }
      }

      if (detectedIndex) break;
    }

    // If a market index is detected and the query is about dividends or yields
    if (
      detectedIndex &&
      (promptLower.includes("dividend") ||
        promptLower.includes("yield") ||
        promptLower.includes("highest") ||
        promptLower.includes("top"))
    ) {
      console.log(
        `Detected market index query for ${detectedIndex} with dividend focus`,
      );

      // Get high dividend companies for this index
      marketIndexData = await getHighDividendCompanies(
        detectedIndex,
        apiKeys.financialModelingPrep,
        20,
      );

      if (marketIndexData && marketIndexData.length > 0) {
        console.log(
          `Found ${marketIndexData.length} companies with dividend data for ${detectedIndex}`,
        );
      }
    }
    // If just a market index is detected without specific dividend focus
    else if (detectedIndex) {
      console.log(`Detected general market index query for ${detectedIndex}`);

      // Get general index data
      marketIndexData = await getMarketIndexData(
        detectedIndex,
        apiKeys.financialModelingPrep,
      );

      if (marketIndexData && marketIndexData.length > 0) {
        console.log(
          `Found ${marketIndexData.length} companies for ${detectedIndex}`,
        );
      }
    }

    // Fetch raw data from financial APIs based on the query context
    const rawDataPromise = fetchRawFinancialData(
      prompt,
      apiKeys.financialModelingPrep,
    );

    // Run these operations in parallel for better performance
    const [sqlQuery, rawData] = await Promise.all([
      sqlQueryPromise,
      rawDataPromise,
    ]);

    console.log("SQL Query generated:", sqlQuery);
    console.log("Raw data fetched from endpoints:", rawData.length);

    // If we have market index data, add it to the raw data
    if (marketIndexData && marketIndexData.length > 0) {
      rawData.push({
        endpoint: `${detectedIndex}_index_data`,
        data: marketIndexData,
      });
      console.log(
        `Added ${marketIndexData.length} items of market index data to raw data`,
      );
    }

    // Process the raw data using OpenAI to structure it according to the query
    const processedData = await processDataWithOpenAI(
      prompt,
      rawData,
      apiKeys.openai,
      potentialCompanySymbols,
    );

    console.log("Data processed and structured according to query");

    // Store query results in Supabase if user is authenticated
    if (user) {
      try {
        await supabase.from("query_results").insert({
          user_id: user.id,
          query_text: prompt,
          sql_query: sqlQuery,
          result_data: processedData,
        });
        console.log("Query results saved to Supabase");
      } catch (error) {
        console.error("Error saving query results to Supabase:", error);
      }
    }

    return {
      data: processedData,
      sqlQuery: sqlQuery,
    };
  } catch (error) {
    console.error("Error processing query:", error);
    return {
      data: [],
      sqlQuery: "",
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// Function to save API keys to Supabase
export async function saveApiKeys(keys: ApiKeys): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Fallback to localStorage if not authenticated
    localStorage.setItem("api_keys", JSON.stringify(keys));
    return;
  }

  // Check if user already has API keys stored
  const { data: existingKeys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (existingKeys) {
    // Update existing keys
    await supabase
      .from("api_keys")
      .update({
        openai_key: keys.openai,
        financial_modeling_prep_key: keys.financialModelingPrep,
        market_data_key: keys.marketData,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  } else {
    // Insert new keys
    await supabase.from("api_keys").insert({
      user_id: user.id,
      openai_key: keys.openai,
      financial_modeling_prep_key: keys.financialModelingPrep,
      market_data_key: keys.marketData,
    });
  }
}

// Function to load API keys from Supabase
export async function loadApiKeys(): Promise<ApiKeys> {
  // Default keys
  const defaultKeys: ApiKeys = {
    openai:
      "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",
    financialModelingPrep: "JgouQZYifBbjvGjr2F10AOc1i2sYlPBf",
    marketData: "Y1A1VHhzVUkwRmZCZ3NwZGd5c2tvWTBuTThFaDhoUGVQSndGYmh0akVaUT0",
  };

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Fallback to localStorage if not authenticated
      const savedKeys = localStorage.getItem("api_keys");
      return savedKeys ? JSON.parse(savedKeys) : defaultKeys;
    }

    // Get keys from Supabase
    const { data: keys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (keys) {
      return {
        openai: keys.openai_key || defaultKeys.openai,
        financialModelingPrep:
          keys.financial_modeling_prep_key || defaultKeys.financialModelingPrep,
        marketData: keys.market_data_key || defaultKeys.marketData,
      };
    }

    // If no keys found, save the default keys to Supabase
    await saveApiKeys(defaultKeys);
    return defaultKeys;
  } catch (error) {
    console.error("Error loading API keys:", error);
    return defaultKeys;
  }
}
