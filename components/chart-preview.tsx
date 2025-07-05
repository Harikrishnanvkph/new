"use client"

import { useRef, useEffect, useState } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler,
  ScatterController,
  BubbleController,
  TimeScale
} from "chart.js"
import { Chart } from "react-chartjs-2"
import { useChartStore, universalImagePlugin } from "@/lib/chart-store"
import exportPlugin from "@/lib/export-plugin"
import { useChatStore } from "@/lib/chat-store"
import { customLabelPlugin } from "@/lib/custom-label-plugin"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw, Maximize2, Minimize2, RotateCcw, X, PanelLeft, PanelRight } from "lucide-react"
import { BarChart3, Database, Dot } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"


ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale, // Required for logarithmic scale
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  Filler,
  ScatterController,  // Required for scatter charts
  BubbleController,   // Required for bubble charts
  TimeScale,          // Required for time-based scales
  universalImagePlugin, // Register our universal image plugin
  customLabelPlugin, // Register our custom label plugin
  exportPlugin // Register our export plugin
);

// Verify plugin registration
console.log('Registered plugins:', Object.keys(ChartJS.registry.plugins));

// Utility to fade any color to a given alpha
function fadeColor(color: any, alpha = 0.15) {
  if (!color) return color;
  if (typeof color !== 'string') return color;
  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+),[^)]+\)/, `rgba($1,${alpha})`);
  }
  if (color.startsWith('rgb')) {
    return color.replace(/rgb\(([^)]+)\)/, `rgba($1,${alpha})`);
  }
  if (color.startsWith('#')) {
    let r = 0, g = 0, b = 0;
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else if (color.length === 7) {
      r = parseInt(color[1] + color[2], 16);
      g = parseInt(color[3] + color[4], 16);
      b = parseInt(color[5] + color[6], 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export function ChartPreview({ onToggleSidebar, isSidebarCollapsed, onToggleLeftSidebar, isLeftSidebarCollapsed }: {
  onToggleSidebar?: () => void,
  isSidebarCollapsed?: boolean,
  onToggleLeftSidebar?: () => void,
  isLeftSidebarCollapsed?: boolean
}) {
  const { chartConfig, chartData, chartType, resetChart, legendFilter, fillArea, showBorder, setHasJSON, chartMode, activeDatasetIndex, uniformityMode, toggleDatasetVisibility, toggleSliceVisibility } = useChartStore()
  const chartRef = useRef<ChartJS>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { clearMessages } = useChatStore();
  const [hoveredDatasetIndex, setHoveredDatasetIndex] = useState<number | null>(null);

  if (chartType === 'pie' || chartType === 'doughnut') {
    console.log("ChartPreview - Pie/Doughnut chartConfig received:", JSON.parse(JSON.stringify(chartConfig)));
  }
  
  const customLabelsConfig = ((chartConfig.plugins as any)?.customLabelsConfig) || {}

  // Get enabled datasets
  const enabledDatasets = chartMode === 'single'
    ? chartData.datasets.filter((_, i) => i === activeDatasetIndex)
    : chartData.datasets
        .map((ds, i) => legendFilter.datasets[i] === false ? null : ds)
        .filter((ds): ds is typeof chartData.datasets[number] => ds !== null);

  // Filter datasets based on mode
  const modeFilteredDatasets = enabledDatasets.filter(dataset => {
    // If dataset has a mode property, filter by it
    if (dataset.mode) {
      return dataset.mode === chartMode
    }
    // For backward compatibility, show all datasets if no mode is set
    return true
  });

  // Find all slice indices that are enabled and present in at least one enabled dataset
  const sliceCount = chartData.labels ? chartData.labels.length : 0;
  const enabledSliceIndicesSet = new Set<number>();
  modeFilteredDatasets.forEach(ds => {
    (ds.data || []).forEach((_, idx) => {
      if (legendFilter.slices[idx] !== false) {
        enabledSliceIndicesSet.add(idx);
      }
    });
  });
  const enabledSliceIndices = Array.from(enabledSliceIndicesSet).sort((a, b) => a - b);

  // Filter x-axis labels to only include enabled slices
  let filteredLabels: string[] = [];
  if (Array.isArray(chartData.labels)) {
    filteredLabels = enabledSliceIndices.map(idx => String(chartData.labels![idx]));
  }

  // Filter datasets to only include enabled slices
  const filteredDatasets = modeFilteredDatasets.map(ds => {
    const filterSlice = (arr: any[] | undefined) => {
      if (!arr) return [];
      return enabledSliceIndices.map(idx => arr?.[idx]);
    };
    
    let newData = filterSlice(ds.data);
    let newBackgroundColor = Array.isArray(ds.backgroundColor) 
      ? filterSlice(ds.backgroundColor) 
      : [];
    let newBorderColor = Array.isArray(ds.borderColor) 
      ? filterSlice(ds.borderColor) 
      : [];
    let newPointImages = ds.pointImages ? filterSlice(ds.pointImages) : [];
    let newPointImageConfig = ds.pointImageConfig ? filterSlice(ds.pointImageConfig) : [];

    let processedDs = {
      ...ds,
      data: newData,
      backgroundColor: newBackgroundColor.length ? newBackgroundColor : ds.backgroundColor,
      borderColor: newBorderColor.length ? newBorderColor : ds.borderColor,
      borderWidth: ds.borderWidth,
      fill: ds.fill,
      pointImages: newPointImages.length ? newPointImages : ds.pointImages,
      pointImageConfig: newPointImageConfig.length ? newPointImageConfig : ds.pointImageConfig,
    };

    if (!fillArea) {
      if (Array.isArray(processedDs.backgroundColor)) {
        processedDs.backgroundColor = processedDs.backgroundColor.map(() => 'transparent');
      } else {
        processedDs.backgroundColor = 'transparent';
      }
      if (chartType === 'line' || chartType === 'area' || chartType === 'radar') {
        processedDs.fill = false;
      }
    }

    if (!showBorder) {
      if (Array.isArray(processedDs.borderColor)) {
        processedDs.borderColor = processedDs.borderColor.map(() => 'transparent');
      } else {
        processedDs.borderColor = 'transparent';
      }
      processedDs.borderWidth = 0;
    }

    return processedDs;
  });

  // Patch: For stackedBar, if only one dataset, add a second dataset with zeros and a different color for demo/demo visibility
  let filteredDatasetsPatched = [...filteredDatasets];
  
  // Always ensure datasets have valid Chart.js types
  filteredDatasetsPatched = filteredDatasetsPatched.map((ds, i) => {
    const datasetType = ds.chartType || chartType || 'bar';
    // Convert custom chart types to valid Chart.js types
    const validType = datasetType === 'stackedBar' || datasetType === 'horizontalBar' ? 'bar' : 
                     (datasetType === 'area' ? 'line' : datasetType);
    // If in grouped mode and a dataset is hovered, make others faded
    let patched = { ...ds, type: validType };
    if (
      chartConfig.hoverFadeEffect !== false &&
      chartMode === 'grouped' && hoveredDatasetIndex !== null
    ) {
      if (i !== hoveredDatasetIndex) {
        patched = {
          ...patched,
          backgroundColor: Array.isArray(patched.backgroundColor)
            ? patched.backgroundColor.map(c => fadeColor(c))
            : fadeColor(patched.backgroundColor),
          borderColor: Array.isArray(patched.borderColor)
            ? patched.borderColor.map(c => fadeColor(c))
            : fadeColor(patched.borderColor),
          pointBackgroundColor: Array.isArray((patched as any).pointBackgroundColor)
            ? (patched as any).pointBackgroundColor.map((c: any) => fadeColor(c))
            : fadeColor((patched as any).pointBackgroundColor),
          pointBorderColor: Array.isArray((patched as any).pointBorderColor)
            ? (patched as any).pointBorderColor.map((c: any) => fadeColor(c))
            : fadeColor((patched as any).pointBorderColor),
          fill: false, // For area charts, remove fill for non-hovered
        };
      }
    }
    return patched;
  });

  // Build customLabels config for the current chart using the config from the panel
  const customLabels = filteredDatasetsPatched.map((ds, datasetIdx) =>
    ds.data.map((value, pointIdx) => {
      if (customLabelsConfig.display === false) return { text: '' };
      let text = String(value);
      // Label content logic
      if (customLabelsConfig.labelContent === 'label') {
        text = String(chartData.labels?.[pointIdx] ?? text);
      } else if (customLabelsConfig.labelContent === 'percentage') {
        const total = ds.data.reduce((a: number, b: any) => {
          if (typeof b === 'number') return a + b;
          if (b && typeof b === 'object' && 'y' in b && typeof b.y === 'number') return a + b.y;
          return a;
        }, 0);
        let val = 0;
        if (typeof value === 'number') val = value;
        else if (value && typeof value === 'object' && 'y' in value && typeof value.y === 'number') val = value.y;
        text = ((val / total) * 100).toFixed(1) + '%';
      } else if (customLabelsConfig.labelContent === 'index') {
        text = String(pointIdx + 1);
      } else if (customLabelsConfig.labelContent === 'dataset') {
        text = ds.label ?? text;
      }
      // Prefix/suffix
      if (customLabelsConfig.prefix) text = customLabelsConfig.prefix + text;
      if (customLabelsConfig.suffix) text = text + customLabelsConfig.suffix;
      // Transparency for non-hovered datasets in grouped mode
      let color = customLabelsConfig.color || '#222';
      let backgroundColor = customLabelsConfig.shape === 'none' ? undefined : (customLabelsConfig.backgroundColor || '#fff');
      let borderColor = customLabelsConfig.shape === 'none' ? undefined : (customLabelsConfig.borderColor || '#333');
      if (
        chartConfig.hoverFadeEffect !== false &&
        chartMode === 'grouped' && hoveredDatasetIndex !== null && datasetIdx !== hoveredDatasetIndex
      ) {
        color = 'rgba(0,0,0,0.08)';
        backgroundColor = 'rgba(0,0,0,0.04)';
        borderColor = 'rgba(0,0,0,0.04)';
      }
      return {
        text,
        anchor: customLabelsConfig.anchor || 'center',
        shape: customLabelsConfig.shape || 'none',
        align: customLabelsConfig.align || 'center',
        color,
        backgroundColor,
        borderColor,
        borderWidth: customLabelsConfig.shape === 'none' ? 0 : (customLabelsConfig.borderWidth ?? 2),
        borderRadius: customLabelsConfig.shape === 'none' ? 0 : (customLabelsConfig.borderRadius ?? 6),
        padding: customLabelsConfig.shape === 'none' ? 0 : (customLabelsConfig.padding ?? 6),
        font: `${customLabelsConfig.fontWeight || 'bold'} ${customLabelsConfig.fontSize || 14}px ${customLabelsConfig.fontFamily || 'Arial'}`,
      };
    })
  );

  // Compute chart labels based on mode and per-dataset sliceLabels
  let chartLabels: string[] = [];
  let chartTypeForChart = chartType === 'area' ? 'line' : 
                          (chartType === 'stackedBar' ? 'bar' : 
                          (chartType === 'horizontalBar' ? 'bar' : chartType));
  
  if (chartMode === 'single') {
    const activeDs = chartData.datasets[activeDatasetIndex];
    chartLabels = (activeDs?.sliceLabels && activeDs.sliceLabels.length > 0)
      ? activeDs.sliceLabels
      : (chartData.labels || []);
    // Use the dataset's chartType if present
    if (activeDs?.chartType) {
      const dsChartType = activeDs.chartType;
      chartTypeForChart = dsChartType === 'stackedBar' ? 'bar' : 
                         (dsChartType === 'horizontalBar' ? 'bar' : dsChartType);
    }
  } else {
    // Grouped mode: merge all unique sliceLabels from all datasets
    const allLabels = chartData.datasets
      .map(ds => ds.sliceLabels || [])
      .reduce((acc, arr) => acc.concat(arr), [] as string[]);
    chartLabels = Array.from(new Set(allLabels.length ? allLabels : (chartData.labels || []))).map(String);
    
    // For grouped mode, determine chart type based on uniformity mode
    if (uniformityMode === 'uniform') {
      // Use the global chart type for uniform mode
      chartTypeForChart = chartType === 'area' ? 'line' : 
                         (chartType === 'stackedBar' ? 'bar' : 
                         (chartType === 'horizontalBar' ? 'bar' : chartType));
    } else {
      // For mixed mode, always use 'bar' as the base chart type for Chart.js mixed charts
      chartTypeForChart = 'bar';
    }
  }

  // Build the chart data for Chart.js using filtered labels and datasets
  const chartDataForChart = {
    ...chartData,
    labels: filteredLabels,
    datasets: filteredDatasetsPatched,
  };

  // Final safety check to ensure chartTypeForChart is a valid Chart.js type
  if (chartTypeForChart === 'stackedBar' || chartTypeForChart === 'horizontalBar') {
    chartTypeForChart = 'bar';
  } else if (chartTypeForChart === 'area') {
    chartTypeForChart = 'line';
  }





  const handleExport = () => {
    if (chartRef.current) {
      const chartInstance = chartRef.current;
      const bgConfig = getBackgroundConfig();
      console.log('Exporting with config:', {
        background: bgConfig,
        hasExportMethod: !!chartInstance.exportToImage
      });
      
      // Use the export plugin
      if (chartInstance.exportToImage) {
        try {
          chartInstance.exportToImage({
            background: bgConfig,
            fileNamePrefix: 'chart',
            quality: 1.0
          });
        } catch (error) {
          console.error('Error during export:', error);
        }
      } else {
        console.error('Export plugin not initialized on chart instance');
      }
    } else {
      console.error('Chart ref is not available');
    }
  };

  const handleRefresh = () => {
    if (chartRef.current) {
      chartRef.current.update("active")
    }
  }

  const handleFullscreen = async () => {
    if (!chartRef.current || !fullscreenContainerRef.current) return;

    const container = fullscreenContainerRef.current;
    const canvas = chartRef.current.canvas;
    
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await container.requestFullscreen();
        setIsFullscreen(true);
        
        // Increase canvas resolution for better quality
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match display size
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
        
        // Set actual pixel dimensions for crisp rendering
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Update chart to use new dimensions
        chartRef.current.resize();
        chartRef.current.render();
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
        
        // Reset canvas size
        canvas.style.width = '';
        canvas.style.height = '';
        canvas.style.objectFit = '';
        
        // Reset to original dimensions
        chartRef.current.resize();
        chartRef.current.render();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };
  
  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getChartDisplayName = () => {
    const displayNames: Record<string, string> = {
      bar: chartConfig.indexAxis === "y" ? "Horizontal Bar" : "Bar",
      line: chartData.datasets.some((d) => d.fill) ? "Area" : "Line",
      area: "Area",
      pie: "Pie",
      doughnut: "Doughnut",
      radar: "Radar",
      polarArea: "Polar Area",
      scatter: "Scatter",
      bubble: "Bubble",
      horizontalBar: "Horizontal Bar",
      stackedBar: "Stacked Bar"
    }
    return displayNames[chartType] || chartType.charAt(0).toUpperCase() + chartType.slice(1)
  }

  // Handle background settings
  const getBackgroundLayers = () => {
    const background = (chartConfig as any)?.background || { type: 'color', color: '#ffffff' };
    if (background.type === "image" && background.imageUrl) {
      const opacity = background.opacity || 100;
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundImage: `url(${background.imageUrl})`,
            backgroundSize: background.imageFit === 'fill' ? '100% 100%' : 
                          background.imageFit === 'contain' ? 'contain' : 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            objectFit: background.imageFit || 'cover',
            opacity: opacity / 100,
            pointerEvents: 'none',
          }}
        />
      );
    }
    if (background.type === "gradient") {
      const color1 = background.gradientColor1 || '#ffffff';
      const color2 = background.gradientColor2 || '#000000';
      const opacity = background.opacity || 100;
      const gradientType = background.gradientType || 'linear';
      const direction = background.gradientDirection || 'to right';
      let gradient;
      if (gradientType === 'radial') {
        gradient = `radial-gradient(circle, ${color1}, ${color2})`;
      } else {
        gradient = `linear-gradient(${direction}, ${color1}, ${color2})`;
      }
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundImage: gradient,
            opacity: opacity / 100,
            pointerEvents: 'none',
          }}
        />
      );
    }
    if (background.type === "color" || background.type === undefined) {
      const color = background.color || "#ffffff";
      const opacity = background.opacity || 100;
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundColor: `${color}${Math.round(opacity * 2.55).toString(16).padStart(2, '0')}`,
            pointerEvents: 'none',
          }}
        />
      );
    }
    if (background.type === "transparent") {
      return null;
    }
    return null;
  };

  // Radar chart config bug fix: ensure correct config/scales on first load
  useEffect(() => {
    if (chartType === 'radar' && (!chartConfig.scales || !(chartConfig.scales as any).r)) {
      // force update config for radar
      const { getDefaultConfigForType } = require('@/lib/chart-store');
      const newConfig = getDefaultConfigForType('radar');
      (window as any).chartStoreUpdateRadarConfig?.(newConfig); // will be set below
    }
  }, [chartType, chartConfig]);

  // Provide a global setter for radar config update
  useEffect(() => {
    (window as any).chartStoreUpdateRadarConfig = (newConfig: any) => {
      if (typeof newConfig === 'object') {
        useChartStore.getState().updateChartConfig(newConfig);
      }
    };
    return () => {
      (window as any).chartStoreUpdateRadarConfig = undefined;
    };
  }, []);

  // Get background configuration
  const getBackgroundConfig = () => {
    const bgConfig = (chartConfig as any)?.background;
    console.log('Current background config from chart:', bgConfig);
    
    let result;
    if (bgConfig) {
      // For gradient, ensure both start and end colors are present
      if (bgConfig.type === 'gradient') {
        result = {
          ...bgConfig,
          type: 'gradient' as const,
          gradientStart: bgConfig.gradientStart || '#000000',
          gradientEnd: bgConfig.gradientEnd || '#ffffff',
          opacity: bgConfig.opacity ?? 100
        };
      } else {
        result = {
          ...bgConfig,
          opacity: bgConfig.opacity ?? 100
        };
      }
    } else if (chartConfig.backgroundColor) {
      result = {
        type: 'color' as const,
        color: chartConfig.backgroundColor,
        opacity: 100
      };
    } else {
      result = {
        type: 'color' as const,
        color: '#ffffff',
        opacity: 100
      };
    }
    
    console.log('Export background config:', JSON.stringify(result, null, 2));
    return result;
  };

  // Chart size logic
  const isResponsive = (chartConfig as any)?.responsive !== false;
  const chartWidth = !isResponsive ? ((chartConfig as any)?.width ? Number((chartConfig as any)?.width) : 900) : undefined;
  const chartHeight = !isResponsive ? ((chartConfig as any)?.height ? Number((chartConfig as any)?.height) : 400) : undefined;

  // If stackedBar, ensure both x and y axes are stacked
  let stackedBarConfig = {
    ...chartConfig,
    plugins: {
      ...chartConfig.plugins,
      exportWithBackground: {
        background: getBackgroundConfig(),
        fileNamePrefix: 'chart',
        quality: 1.0
      }
    }
  };
  
  if (chartType === 'stackedBar') {
    stackedBarConfig = {
      ...stackedBarConfig,
      scales: {
        ...chartConfig.scales,
        x: { ...((chartConfig.scales && chartConfig.scales.x) || {}), stacked: true },
        y: { ...((chartConfig.scales && chartConfig.scales.y) || {}), stacked: true },
      },
    };
  }

  // When switching to stackedBar, ensure all datasets are enabled by default
  useEffect(() => {
    if (chartType === 'stackedBar') {
      const { legendFilter, chartData } = useChartStore.getState();
      const anyDisabled = Object.values(legendFilter.datasets).some(v => v === false);
      if (anyDisabled) {
        const newLegendFilter = {
          ...legendFilter,
          datasets: Object.fromEntries(chartData.datasets.map((_, i) => [i, true]))
        };
        useChartStore.setState({ legendFilter: newLegendFilter });
      }
    }
  }, [chartType, chartData.datasets.length]);

  // Ensure hover effect is cleared if mouse leaves window or on unmount
  useEffect(() => {
    const clearHover = () => setHoveredDatasetIndex(null);

    const handleWindowMouseLeave = (e: MouseEvent) => {
      if (e.relatedTarget === null) clearHover();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clearHover();
    };
    const handleWindowBlur = () => clearHover();

    window.addEventListener('mouseout', handleWindowMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('mouseout', handleWindowMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      clearHover();
    };
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden" ref={fullscreenContainerRef}>
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white z-40" />
      )}
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-gray-900 truncate">Chart Preview</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              <BarChart3 className="h-4 w-4 mr-1" />
              <span>{getChartDisplayName()}</span>
              <Dot className="h-4 w-4 mx-1" />
              <span>{chartData.datasets.length} Dataset(s)</span>
              <Dot className="h-4 w-4 mx-1" />
              <span className="font-medium">{chartData.labels?.length || 0} Points</span>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 ml-4">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
              {onToggleLeftSidebar && (
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={onToggleLeftSidebar}
                  title={isLeftSidebarCollapsed ? "Expand Left Sidebar" : "Collapse Left Sidebar"}
                  className="rounded-none"
                >
                  <PanelLeft className={`h-5 w-5 transition-colors ${isLeftSidebarCollapsed ? 'text-slate-300' : 'text-black'}`} />
                </Button>
              )}
              <div className="w-px bg-gray-200 my-2" />
              {onToggleSidebar && (
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={onToggleSidebar}
                  title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  className="rounded-none"
                >
                  <PanelRight className={`h-5 w-5 transition-colors ${isSidebarCollapsed ? 'text-slate-300' : 'text-black'}`} />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} title="Refresh Chart">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleFullscreen} title="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              clearMessages();
  resetChart();
  setHasJSON(false);
}} title="Reset Chart" className="flex items-center gap-1">
  <RotateCcw className="h-4 w-4" />
  <span>Reset</span>
</Button>
            <Button size="sm" onClick={handleExport} title="Export as PNG">
              <Download className="h-4 w-4 mr-1" />
              PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <Card className={`flex-1 shadow-lg overflow-hidden transition-all duration-200 ${isFullscreen ? 'fixed inset-4 z-50 m-0 rounded-lg' : ''}`}>
        <CardContent className="p-6 h-full">
          {chartData.datasets.length > 0 ? (
            <div className={`h-full w-full flex items-center justify-center relative`} style={isResponsive ? { minHeight: 300, minWidth: 400 } : { height: chartHeight, width: chartWidth }}>
              {getBackgroundLayers()}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: isResponsive ? '100%' : chartWidth,
                  height: isResponsive ? '100%' : chartHeight,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
                onMouseLeave={() => setHoveredDatasetIndex(null)}
              >
                <Chart
                  key={`${chartType}-${chartTypeForChart}`} // Force re-mount on type change
                  ref={chartRef}
                  type={chartTypeForChart as any}
                  data={chartDataForChart}
                  options={{
                    ...(chartType === 'stackedBar' ? stackedBarConfig : 
                        (chartType === 'horizontalBar' ? { ...chartConfig, indexAxis: 'y' } : chartConfig)),
                    responsive: isResponsive,
                    maintainAspectRatio: false,
                    hover: {
                      intersect: chartConfig.hover?.intersect ?? false,
                      mode: chartConfig.hover?.mode ?? 'nearest',
                      animationDuration: chartConfig.hover?.animationDuration ?? 400,
                    },
                    onHover: (event: any, elements: any[]) => {
                      if (chartMode === 'grouped' && elements && elements.length > 0) {
                        setHoveredDatasetIndex(elements[0].datasetIndex);
                      } else {
                        setHoveredDatasetIndex(null);
                      }
                    },
                    plugins: ({
                      ...chartConfig.plugins,
                      customLabels: { shapeSize: 32, labels: customLabels },
                      legend: {
                        ...((chartConfig.plugins as any)?.legend),
                        labels: {
                          ...(((chartConfig.plugins as any)?.legend)?.labels || {}),
                          generateLabels: (chart: any) => {
                            const legendType = ((chartConfig.plugins as any)?.legendType) || 'slice';
                            const usePointStyle = (chartConfig.plugins?.legend as any)?.labels?.usePointStyle || false;
                            const pointStyle = (chartConfig.plugins?.legend as any)?.labels?.pointStyle || 'circle';
                            const fontColor = (chartConfig.plugins?.legend?.labels as any)?.color || '#000000';
                            
                            const createItem = (props: any) => ({
                              ...props,
                              pointStyle: usePointStyle ? pointStyle : undefined,
                              fontColor: fontColor // Apply the font color to each legend item
                            });
                            
                            const items = [];
                            if (legendType === 'slice' || legendType === 'both') {
                              // Slices: filteredLabels
                              for (let i = 0; i < filteredLabels.length; ++i) {
                                items.push(createItem({
                                  text: String(filteredLabels[i]),
                                  fillStyle: filteredDatasets[0]?.backgroundColor?.[i] || '#ccc',
                                  strokeStyle: filteredDatasets[0]?.borderColor?.[i] || '#333',
                                  hidden: false, // Already filtered, so not hidden
                                  index: i,
                                  datasetIndex: 0,
                                  type: 'slice',
                                }));
                              }
                            }
                            if (legendType === 'dataset' || legendType === 'both') {
                              // Datasets: filteredDatasets
                              for (let i = 0; i < filteredDatasets.length; ++i) {
                                items.push(createItem({
                                  text: filteredDatasets[i].label || `Dataset ${i + 1}`,
                                  fillStyle: Array.isArray(filteredDatasets[i].backgroundColor) ? (filteredDatasets[i].backgroundColor as string[])[0] : (filteredDatasets[i].backgroundColor as string) || '#ccc',
                                  strokeStyle: Array.isArray(filteredDatasets[i].borderColor) ? (filteredDatasets[i].borderColor as string[])[0] : (filteredDatasets[i].borderColor as string) || '#333',
                                  hidden: false, // Already filtered, so not hidden
                                  datasetIndex: i,
                                  index: i,
                                  type: 'dataset',
                                }));
                              }
                            }
                            return items;
                          },
                        },
                        onClick: (e: any, legendItem: any, legend: any) => {
                          // legendItem.type is either 'dataset' or 'slice'
                          if (legendItem.type === 'dataset') {
                            toggleDatasetVisibility(legendItem.datasetIndex);
                          } else if (legendItem.type === 'slice') {
                            toggleSliceVisibility(legendItem.index);
                          }
                        },
                        onHover: () => {},
                        onLeave: () => {},
                      },
                    } as any),
                  }}
                  width={isResponsive ? undefined : chartWidth}
                  height={isResponsive ? undefined : chartHeight}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-gray-500">
              <div>
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-500 mb-4">Add datasets from the sidebar to see your chart</p>
                <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("add-sample-data"))}>
                  Add Sample Data
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Fullscreen Toolbar */}
      {isFullscreen && (
        <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2 flex gap-2 border border-gray-200 animate-in fade-in duration-200">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleExport}
            title="Download"
            className="hover:bg-gray-100"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleFullscreen}
            title="Exit fullscreen"
            className="hover:bg-gray-100"
          >
            <Minimize2 className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => document.exitFullscreen()}
            title="Close"
            className="hover:bg-gray-100 text-red-500 hover:bg-red-50"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
}