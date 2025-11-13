// Matrix Application - Main controller and storage management

class MatrixApp {
  constructor() {
    this.matrices = new Map();
    this.currentMatrix = null;
    this.currentMatrixName = '';
    this.selectedMatrixA = null;
    this.selectedMatrixB = null;
    this.loadFromStorage();
    this.initializeUI();
  }

  // Storage Management

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('matrices');
      if (stored) {
        const data = JSON.parse(stored);
        for (const [name, matrixData] of Object.entries(data)) {
          this.matrices.set(name, Matrix.fromJSON(matrixData));
        }
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  }

  saveToStorage() {
    try {
      const data = {};
      for (const [name, matrix] of this.matrices.entries()) {
        data[name] = matrix.toJSON();
      }
      localStorage.setItem('matrices', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to storage:', error);
      alert('Error saving matrices to browser storage');
    }
  }

  saveMatrix(name, matrix) {
    if (!name || name.trim() === '') {
      alert('Please enter a name for the matrix');
      return false;
    }
    this.matrices.set(name, matrix);
    this.saveToStorage();
    this.updateMatrixList();
    return true;
  }

  deleteMatrix(name) {
    if (confirm(`Delete matrix "${name}"?`)) {
      this.matrices.delete(name);
      this.saveToStorage();
      this.updateMatrixList();
    }
  }

  renameMatrix(oldName, newName) {
    if (!newName || newName.trim() === '') {
      alert('Please enter a valid name');
      return;
    }
    if (this.matrices.has(newName) && newName !== oldName) {
      alert('A matrix with that name already exists');
      return;
    }
    const matrix = this.matrices.get(oldName);
    this.matrices.delete(oldName);
    this.matrices.set(newName, matrix);
    this.saveToStorage();
    this.updateMatrixList();
  }

  // UI Initialization

  initializeUI() {
    this.createNewMatrix(3, 3);
    this.updateMatrixList();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // New Matrix
    document.getElementById('newMatrixBtn').addEventListener('click', () => {
      const rows = parseInt(document.getElementById('newRows').value);
      const cols = parseInt(document.getElementById('newCols').value);
      this.createNewMatrix(rows, cols);
    });

    // Save Current Matrix
    document.getElementById('saveMatrixBtn').addEventListener('click', () => {
      const name = document.getElementById('matrixName').value;
      if (this.saveMatrix(name, this.currentMatrix)) {
        this.showMessage('Matrix saved successfully!', 'success');
      }
    });

    // Binary Operations
    document.getElementById('addBtn').addEventListener('click', () => this.performBinaryOp('add'));
    document.getElementById('subtractBtn').addEventListener('click', () => this.performBinaryOp('subtract'));
    document.getElementById('multiplyBtn').addEventListener('click', () => this.performBinaryOp('multiply'));

    // Unary Operations
    document.getElementById('transposeBtn').addEventListener('click', () => this.performUnaryOp('transpose'));
    document.getElementById('determinantBtn').addEventListener('click', () => this.performUnaryOp('determinant'));
    document.getElementById('inverseBtn').addEventListener('click', () => this.performUnaryOp('inverse'));
    document.getElementById('rankBtn').addEventListener('click', () => this.performUnaryOp('rank'));
    document.getElementById('eigenvaluesBtn').addEventListener('click', () => this.performUnaryOp('eigenvalues'));

    // Scalar Operation
    document.getElementById('scalarMultiplyBtn').addEventListener('click', () => {
      const scalar = parseFloat(document.getElementById('scalarValue').value);
      if (isNaN(scalar)) {
        alert('Please enter a valid number');
        return;
      }
      try {
        const result = this.currentMatrix.scalarMultiply(scalar);
        this.displayResult(result, `Scalar Multiplication (${scalar})`);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    });

    // Randomize Operation
    document.getElementById('randomizeBtn').addEventListener('click', () => {
      const min = parseFloat(document.getElementById('randomMin').value);
      const max = parseFloat(document.getElementById('randomMax').value);

      if (isNaN(min) || isNaN(max)) {
        alert('Please enter valid numbers for min and max');
        return;
      }

      if (min >= max) {
        alert('Min value must be less than max value');
        return;
      }

      // Randomize the current matrix
      for (let i = 0; i < this.currentMatrix.rows; i++) {
        for (let j = 0; j < this.currentMatrix.cols; j++) {
          const randomValue = Math.random() * (max - min) + min;
          // Round to 2 decimal places for cleaner display
          this.currentMatrix.set(i, j, Math.round(randomValue * 100) / 100);
        }
      }

      // Update the displayed matrix
      this.renderMatrix();
      this.showMessage(`Matrix randomized with values between ${min} and ${max}`, 'success');
    });

    // Custom Function
    document.getElementById('applyFunctionBtn').addEventListener('click', () => {
      const funcStr = document.getElementById('customFunction').value;
      try {
        const func = new Function('value', 'i', 'j', `return ${funcStr};`);
        const result = this.currentMatrix.applyFunction(func);
        this.displayResult(result, `Custom Function: ${funcStr}`);
      } catch (error) {
        alert('Error in custom function: ' + error.message);
      }
    });

    // Load to Current
    document.getElementById('loadToCurrentBtn').addEventListener('click', () => {
      const select = document.getElementById('loadMatrixSelect');
      const name = select.value;
      if (name && this.matrices.has(name)) {
        this.currentMatrix = this.matrices.get(name).clone();
        this.currentMatrixName = name;
        document.getElementById('matrixName').value = name;
        this.renderMatrix();
        this.showMessage(`Loaded "${name}" to editor`, 'success');
      }
    });
  }

  // Matrix Creation and Editing

  createNewMatrix(rows, cols) {
    if (rows < 1 || rows > 10 || cols < 1 || cols > 10) {
      alert('Matrix dimensions must be between 1 and 10');
      return;
    }
    this.currentMatrix = new Matrix(rows, cols);
    this.currentMatrixName = '';
    document.getElementById('matrixName').value = '';
    this.renderMatrix();
  }

  renderMatrix() {
    const container = document.getElementById('matrixGrid');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${this.currentMatrix.cols}, 1fr)`;

    for (let i = 0; i < this.currentMatrix.rows; i++) {
      for (let j = 0; j < this.currentMatrix.cols; j++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = this.currentMatrix.get(i, j);
        input.className = 'matrix-cell';
        input.dataset.row = i;
        input.dataset.col = j;
        input.addEventListener('change', (e) => {
          const row = parseInt(e.target.dataset.row);
          const col = parseInt(e.target.dataset.col);
          const value = parseFloat(e.target.value) || 0;
          this.currentMatrix.set(row, col, value);
        });
        container.appendChild(input);
      }
    }

    document.getElementById('matrixDimensions').textContent =
      `${this.currentMatrix.rows} × ${this.currentMatrix.cols}`;
  }

  // Matrix List Management

  updateMatrixList() {
    const listContainer = document.getElementById('matrixList');
    listContainer.innerHTML = '';

    const loadSelect = document.getElementById('loadMatrixSelect');
    const selectA = document.getElementById('matrixASelect');
    const selectB = document.getElementById('matrixBSelect');
    loadSelect.innerHTML = '<option value="">Select Matrix</option>';
    selectA.innerHTML = '<option value="">Select Matrix A</option>';
    selectB.innerHTML = '<option value="">Select Matrix B</option>';

    if (this.matrices.size === 0) {
      listContainer.innerHTML = '<p class="empty-message">No saved matrices</p>';
      return;
    }

    for (const [name, matrix] of this.matrices.entries()) {
      // Create list item
      const item = document.createElement('div');
      item.className = 'matrix-item';

      const info = document.createElement('div');
      info.className = 'matrix-info';
      info.innerHTML = `
        <strong>${name}</strong>
        <span class="matrix-dims">${matrix.rows} × ${matrix.cols}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'matrix-actions';

      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.className = 'btn-small';
      loadBtn.addEventListener('click', () => {
        this.currentMatrix = matrix.clone();
        this.currentMatrixName = name;
        document.getElementById('matrixName').value = name;
        this.renderMatrix();
        this.showMessage(`Loaded "${name}"`, 'success');
      });

      const renameBtn = document.createElement('button');
      renameBtn.textContent = 'Rename';
      renameBtn.className = 'btn-small';
      renameBtn.addEventListener('click', () => {
        const newName = prompt('Enter new name:', name);
        if (newName) this.renameMatrix(name, newName);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn-small btn-danger';
      deleteBtn.addEventListener('click', () => this.deleteMatrix(name));

      actions.appendChild(loadBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(info);
      item.appendChild(actions);
      listContainer.appendChild(item);

      // Add to select dropdowns
      const optionLoad = document.createElement('option');
      optionLoad.value = name;
      optionLoad.textContent = `${name} (${matrix.rows}×${matrix.cols})`;
      loadSelect.appendChild(optionLoad);

      const optionA = document.createElement('option');
      optionA.value = name;
      optionA.textContent = `${name} (${matrix.rows}×${matrix.cols})`;
      selectA.appendChild(optionA);

      const optionB = optionA.cloneNode(true);
      selectB.appendChild(optionB);
    }
  }

  // Operations

  performBinaryOp(operation) {
    const nameA = document.getElementById('matrixASelect').value;
    const nameB = document.getElementById('matrixBSelect').value;

    if (!nameA || !nameB) {
      alert('Please select both matrices');
      return;
    }

    const matrixA = this.matrices.get(nameA);
    const matrixB = this.matrices.get(nameB);

    try {
      let result;
      let opName;

      switch (operation) {
        case 'add':
          result = matrixA.add(matrixB);
          opName = 'Addition';
          break;
        case 'subtract':
          result = matrixA.subtract(matrixB);
          opName = 'Subtraction';
          break;
        case 'multiply':
          result = matrixA.multiply(matrixB);
          opName = 'Multiplication';
          break;
      }

      this.displayResult(result, `${opName}: ${nameA} and ${nameB}`);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }

  performUnaryOp(operation) {
    try {
      let result;
      let opName;

      switch (operation) {
        case 'transpose':
          result = this.currentMatrix.transpose();
          opName = 'Transpose';
          break;
        case 'determinant':
          result = this.currentMatrix.determinant();
          opName = 'Determinant';
          break;
        case 'inverse':
          result = this.currentMatrix.inverse();
          opName = 'Inverse';
          break;
        case 'rank':
          result = this.currentMatrix.rank();
          opName = 'Rank';
          break;
        case 'eigenvalues':
          result = this.currentMatrix.eigenvalues();
          opName = 'Eigenvalues';
          break;
      }

      this.displayResult(result, opName);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }

  // Result Display

  displayResult(result, operation) {
    const container = document.getElementById('resultDisplay');
    container.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = operation;
    container.appendChild(header);

    if (result instanceof Matrix) {
      const table = document.createElement('div');
      table.className = 'result-matrix';
      table.style.gridTemplateColumns = `repeat(${result.cols}, 1fr)`;

      for (let i = 0; i < result.rows; i++) {
        for (let j = 0; j < result.cols; j++) {
          const cell = document.createElement('div');
          cell.className = 'result-cell';
          const value = result.get(i, j);
          cell.textContent = typeof value === 'number' ? value.toFixed(4) : value;
          table.appendChild(cell);
        }
      }

      container.appendChild(table);

      // Add button to use result
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Use as Current Matrix';
      useBtn.className = 'btn';
      useBtn.addEventListener('click', () => {
        this.currentMatrix = result;
        this.currentMatrixName = '';
        document.getElementById('matrixName').value = '';
        this.renderMatrix();
        this.showMessage('Result loaded to editor', 'success');
      });
      container.appendChild(useBtn);

    } else if (Array.isArray(result)) {
      const list = document.createElement('div');
      list.className = 'result-list';
      result.forEach((val, idx) => {
        const item = document.createElement('div');
        item.textContent = `λ${idx + 1} = ${val.toFixed(4)}`;
        list.appendChild(item);
      });
      container.appendChild(list);

    } else {
      const value = document.createElement('div');
      value.className = 'result-value';
      value.textContent = typeof result === 'number' ? result.toFixed(4) : result;
      container.appendChild(value);
    }
  }

  showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, 2000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.matrixApp = new MatrixApp();
});
