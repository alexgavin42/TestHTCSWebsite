// Data.gov Random Dataset Visualizer
class DataGovManager {
  constructor() {
    this.chart = null;
    this.currentData = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const attachListeners = () => {
      const getDatasetBtn = document.getElementById('getRandomDatasetBtn');
      if (getDatasetBtn) {
        getDatasetBtn.addEventListener('click', () => this.getRandomDataset());
        console.log('Data.gov button listener attached');
      } else {
        console.log('Data.gov button not found');
      }
    };

    // Handle both cases: DOM already loaded or not yet loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachListeners);
    } else {
      attachListeners();
    }
  }

  showStatus(message, type = 'info', progress = null) {
    const statusDiv = document.getElementById('dataStatus');
    if (statusDiv) {
      let html = `<p class="status-${type}">${message}</p>`;
      if (progress !== null) {
        html += `
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
          <p class="progress-text">${progress}%</p>
        `;
      }
      statusDiv.innerHTML = html;
      statusDiv.style.display = 'block';
    }
  }

  hideStatus() {
    const statusDiv = document.getElementById('dataStatus');
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }
  }

  async fetchWithProxy(url) {
    // Use CORS proxy to fetch data
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
  }

  async getRandomDataset() {
    this.showStatus('Searching for datasets...', 'loading', 10);

    // Hide previous results
    document.getElementById('dataInfo').style.display = 'none';
    document.getElementById('dataChartContainer').style.display = 'none';
    document.getElementById('dataTableContainer').style.display = 'none';

    try {
      // Fetch random datasets from data.gov CKAN API via CORS proxy
      const randomStart = Math.floor(Math.random() * 500);
      const apiUrl = `https://catalog.data.gov/api/3/action/package_search?rows=50&start=${randomStart}`;

      this.showStatus('Connecting to data.gov...', 'loading', 20);

      const response = await this.fetchWithProxy(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch from data.gov API');
      }

      this.showStatus('Parsing catalog data...', 'loading', 40);

      const data = await response.json();

      if (!data.success || !data.result || !data.result.results.length) {
        throw new Error('No datasets found');
      }

      // Filter for datasets with CSV or JSON resources
      const datasetsWithData = data.result.results.filter(dataset => {
        return dataset.resources && dataset.resources.some(r => {
          const format = (r.format || '').toLowerCase();
          return format === 'csv' || format === 'json';
        });
      });

      if (datasetsWithData.length === 0) {
        this.showStatus('No CSV/JSON datasets found. Trying again...', 'loading', 30);
        setTimeout(() => this.getRandomDataset(), 500);
        return;
      }

      this.showStatus('Selecting random dataset...', 'loading', 50);

      // Select a random dataset
      const dataset = datasetsWithData[Math.floor(Math.random() * datasetsWithData.length)];

      // Find CSV or JSON resource
      const resource = dataset.resources.find(r => {
        const format = (r.format || '').toLowerCase();
        return format === 'csv' || format === 'json';
      });

      this.showStatus('Downloading dataset...', 'loading', 60);

      // Display dataset info
      this.displayDatasetInfo(dataset);

      // Fetch and parse the actual data
      const parsedData = await this.fetchAndParseData(resource.url, resource.format);

      this.showStatus('Processing data...', 'loading', 80);

      if (!parsedData || parsedData.length === 0) {
        throw new Error('Dataset is empty or could not be parsed');
      }

      this.currentData = parsedData;

      this.showStatus('Generating visualization...', 'loading', 90);

      // Render chart and table
      this.renderChart(parsedData);
      this.renderDataTable(parsedData);

      this.showStatus('Complete!', 'loading', 100);

      // Hide status after a brief delay to show 100%
      setTimeout(() => this.hideStatus(), 500);

    } catch (error) {
      console.error('Error fetching dataset:', error);
      this.showStatus(`Error: ${error.message}. <a href="#" onclick="dataGovManager.getRandomDataset(); return false;">Try again</a>`, 'error');
    }
  }

  displayDatasetInfo(dataset) {
    const infoDiv = document.getElementById('dataInfo');
    const titleEl = document.getElementById('datasetTitle');
    const descEl = document.getElementById('datasetDescription');
    const orgEl = document.getElementById('datasetOrg');
    const linkEl = document.getElementById('datasetLink');

    titleEl.textContent = dataset.title || 'Untitled Dataset';
    descEl.textContent = dataset.notes ?
      (dataset.notes.length > 300 ? dataset.notes.substring(0, 300) + '...' : dataset.notes) :
      'No description available';
    orgEl.textContent = dataset.organization ? `Source: ${dataset.organization.title}` : '';
    linkEl.href = `https://catalog.data.gov/dataset/${dataset.name}`;

    infoDiv.style.display = 'block';
  }

  async fetchAndParseData(url, format) {
    // Always use CORS proxy for data files
    const response = await this.fetchWithProxy(url);

    if (!response.ok) {
      throw new Error('Failed to fetch data file');
    }

    const text = await response.text();
    const formatLower = (format || '').toLowerCase();

    if (formatLower === 'json') {
      return this.parseJSON(text);
    } else {
      return this.parseCSV(text);
    }
  }

  parseJSON(text) {
    try {
      const json = JSON.parse(text);
      // Handle different JSON structures
      if (Array.isArray(json)) {
        return json;
      } else if (json.data && Array.isArray(json.data)) {
        return json.data;
      } else if (json.results && Array.isArray(json.results)) {
        return json.results;
      } else {
        // Try to find any array property
        for (const key of Object.keys(json)) {
          if (Array.isArray(json[key]) && json[key].length > 0) {
            return json[key];
          }
        }
        // If single object, wrap in array
        return [json];
      }
    } catch (e) {
      console.error('JSON parse error:', e);
      return [];
    }
  }

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header
    const headers = this.parseCSVLine(lines[0]);

    // Parse data rows (limit to first 1000 for performance)
    const data = [];
    const maxRows = Math.min(lines.length, 1001);

    for (let i = 1; i < maxRows; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, j) => {
          row[header] = values[j];
        });
        data.push(row);
      }
    }

    return data;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  detectChartableColumns(data) {
    if (!data || data.length === 0) return { xColumn: null, yColumn: null };

    const columns = Object.keys(data[0]);
    let xColumn = null;
    let yColumns = [];

    // Analyze each column
    columns.forEach(col => {
      const values = data.slice(0, 50).map(row => row[col]);
      const numericCount = values.filter(v => !isNaN(parseFloat(v)) && v !== '').length;
      const numericRatio = numericCount / values.length;

      if (numericRatio > 0.8) {
        yColumns.push(col);
      } else if (!xColumn) {
        xColumn = col;
      }
    });

    // If no categorical column found, use first column
    if (!xColumn && columns.length > 0) {
      xColumn = columns[0];
    }

    // If no numeric columns, try to find one
    if (yColumns.length === 0 && columns.length > 1) {
      yColumns = [columns[1]];
    }

    return { xColumn, yColumns };
  }

  renderChart(data) {
    const container = document.getElementById('dataChartContainer');
    const canvas = document.getElementById('dataChart');

    if (!container || !canvas) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const { xColumn, yColumns } = this.detectChartableColumns(data);

    if (!xColumn || yColumns.length === 0) {
      container.style.display = 'none';
      return;
    }

    // Limit data points for visualization
    const chartData = data.slice(0, 20);

    const labels = chartData.map(row => {
      const val = row[xColumn];
      return val && val.length > 20 ? val.substring(0, 20) + '...' : val;
    });

    // Create datasets for each numeric column (max 3)
    const colors = [
      { bg: 'rgba(102, 126, 234, 0.6)', border: 'rgba(102, 126, 234, 1)' },
      { bg: 'rgba(118, 75, 162, 0.6)', border: 'rgba(118, 75, 162, 1)' },
      { bg: 'rgba(255, 193, 7, 0.6)', border: 'rgba(255, 193, 7, 1)' }
    ];

    const datasets = yColumns.slice(0, 3).map((col, index) => ({
      label: col,
      data: chartData.map(row => parseFloat(row[col]) || 0),
      backgroundColor: colors[index % colors.length].bg,
      borderColor: colors[index % colors.length].border,
      borderWidth: 2
    }));

    // Determine chart type - use line if data looks like time series
    const chartType = this.looksLikeTimeSeries(labels) ? 'line' : 'bar';

    this.chart = new Chart(canvas, {
      type: chartType,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${yColumns[0]} by ${xColumn}`,
            font: { size: 16 }
          },
          legend: {
            display: yColumns.length > 1
          }
        },
        scales: {
          y: {
            beginAtZero: true
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });

    container.style.display = 'block';
  }

  looksLikeTimeSeries(labels) {
    // Check if labels look like dates/years
    const datePatterns = [
      /^\d{4}$/,           // Year: 2020
      /^\d{4}-\d{2}$/,     // Year-Month: 2020-01
      /^\d{4}-\d{2}-\d{2}/, // Full date: 2020-01-15
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/ // MM/DD/YYYY
    ];

    const matchCount = labels.filter(label => {
      return datePatterns.some(pattern => pattern.test(label));
    }).length;

    return matchCount > labels.length * 0.5;
  }

  renderDataTable(data) {
    const container = document.getElementById('dataTableContainer');
    const thead = document.getElementById('dataTableHead');
    const tbody = document.getElementById('dataTableBody');

    if (!container || !thead || !tbody) return;

    // Get columns
    const columns = Object.keys(data[0] || {});
    if (columns.length === 0) {
      container.style.display = 'none';
      return;
    }

    // Limit columns for display
    const displayColumns = columns.slice(0, 8);

    // Build header
    thead.innerHTML = `<tr>${displayColumns.map(col =>
      `<th>${this.escapeHtml(col)}</th>`
    ).join('')}</tr>`;

    // Build body (first 10 rows)
    const displayData = data.slice(0, 10);
    tbody.innerHTML = displayData.map(row =>
      `<tr>${displayColumns.map(col => {
        let val = row[col];
        if (val && val.length > 50) val = val.substring(0, 50) + '...';
        return `<td>${this.escapeHtml(val || '')}</td>`;
      }).join('')}</tr>`
    ).join('');

    container.style.display = 'block';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize - handle both cases: DOM already loaded or not yet loaded
let dataGovManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dataGovManager = new DataGovManager();
  });
} else {
  dataGovManager = new DataGovManager();
}
